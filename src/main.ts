import { loadSnapshot, saveSnapshot } from './persistence';
import { reduce, spawnSafe, type SafeEvent } from './safeMachine';
import type { Lang, SafeSnapshot } from './types';
import { hashPin } from './pin';
import { t, setLang } from './i18n';

let snapshot: SafeSnapshot = loadSnapshot() ?? spawnSafe();
setLang(snapshot.settings.language);
saveSnapshot(snapshot);

function dispatch(event: SafeEvent): void {
  const queue: SafeEvent[] = [event];
  while (queue.length) {
    const e = queue.shift()!;
    const [next, emitted] = reduce(snapshot, e);
    snapshot = next;
    queue.push(...emitted);
  }
  setLang(snapshot.settings.language);
  saveSnapshot(snapshot);
  scheduleTimer();
  render();
}

let timerId: number | undefined;
let countdownId: number | undefined;

function scheduleTimer(): void {
  if (timerId !== undefined) {
    clearTimeout(timerId);
    timerId = undefined;
  }
  if (countdownId !== undefined) {
    clearInterval(countdownId);
    countdownId = undefined;
  }
  if (snapshot.runtime.state === 'closed') {
    const destructAt = snapshot.runtime.destructAt;
    if (destructAt !== undefined) {
      const delay = destructAt - Date.now();
      if (delay <= 0) {
        dispatch({ type: 'tick', now: Date.now() });
      } else {
        timerId = window.setTimeout(() => {
          dispatch({ type: 'tick', now: Date.now() });
        }, delay);
        countdownId = window.setInterval(() => {
          updateCountdownElements();
        }, 1000);
        queueMicrotask(() => {
          updateCountdownElements();
        });
      }
    }
  }
}

function updateCountdownElement(element: HTMLElement): void {
  if (snapshot.runtime.state !== 'closed') return;
  const destructAt = snapshot.runtime.destructAt;
  if (destructAt === undefined) return;
  const msRemaining = destructAt - Date.now();
  const remaining = Math.max(0, msRemaining);
  const seconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(seconds / 60);
  const s = (seconds % 60).toString().padStart(2, '0');
  element.textContent = `${t('autodestructIn')}: ${minutes}:${s}`;

  const closedAt = snapshot.runtime.closedAt;
  if (closedAt === undefined) {
    element.classList.remove('countdown-warning');
    return;
  }
  const total = destructAt - closedAt;
  if (total <= 0) {
    element.classList.remove('countdown-warning');
    return;
  }
  const ratio = remaining / total;
  if (ratio <= 0.1) {
    element.classList.add('countdown-warning');
  } else {
    element.classList.remove('countdown-warning');
  }
}

function updateCountdownElements(): void {
  const timers = document.querySelectorAll<HTMLElement>('[data-countdown]');
  timers.forEach((timer) => updateCountdownElement(timer));
}

const app = document.querySelector<HTMLDivElement>('#app');

function createPanelHeader(
  stateKey: 'safeOpen' | 'safeClosed' | 'safeDestroyed',
  variant: 'open' | 'closed' | 'destroyed',
  actions?: HTMLElement[],
): HTMLElement {
  const header = document.createElement('header');
  header.className = 'panel-header';

  const info = document.createElement('div');
  info.className = 'panel-header-info';

  const icon = document.createElement('div');
  icon.className = `safe-icon safe-icon--${variant}`;

  if (variant === 'destroyed') {
    icon.textContent = '💥';
    icon.setAttribute('aria-hidden', 'true');
  } else {
    const img = document.createElement('img');
    img.src = '/safe.webp';
    img.alt = '';
    img.className = 'safe-icon-image';
    icon.appendChild(img);
  }

  const text = document.createElement('div');
  text.className = 'panel-header-text';

  const title = document.createElement('h1');
  title.className = 'panel-title';
  title.textContent = t('safeTitle');

  const state = document.createElement('p');
  state.className = `safe-state safe-state--${variant}`;
  state.textContent = t(stateKey);

  text.appendChild(title);
  text.appendChild(state);

  info.appendChild(icon);
  info.appendChild(text);
  header.appendChild(info);

  if (actions && actions.length > 0) {
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'panel-header-actions';
    actions.forEach((action) => actionsContainer.appendChild(action));
    header.appendChild(actionsContainer);
  }

  return header;
}

  async function promptPin(message: string): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'pin-overlay';
    const dialog = document.createElement('div');
    dialog.className = 'pin-dialog';
    const label = document.createElement('p');
    label.textContent = message;
    const input = document.createElement('input');
    input.type = 'password';
    input.inputMode = 'numeric';
    input.pattern = '\\d*';
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '');
    });
      const okBtn = document.createElement('button');
      okBtn.className = 'close-btn';
      okBtn.textContent = t('ok');
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'close-btn';
      cancelBtn.textContent = t('cancel');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') okBtn.click();
    });
    okBtn.addEventListener('click', () => {
      cleanup();
      resolve(input.value);
    });
    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });
    const buttons = document.createElement('div');
    buttons.className = 'pin-actions';
    buttons.appendChild(okBtn);
    buttons.appendChild(cancelBtn);
    dialog.appendChild(label);
    dialog.appendChild(input);
    dialog.appendChild(buttons);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    input.focus();
    function cleanup() {
      document.body.removeChild(overlay);
    }
  });
}

function openSettings(): void {
  const overlay = document.createElement('div');
  overlay.className = 'settings-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'settings-dialog';
  const form = document.createElement('form');
  form.className = 'settings-form';

  const langLabel = document.createElement('label');
  const langText = document.createTextNode(t('language'));
  langLabel.appendChild(langText);
  const langSelect = document.createElement('select');
  const langs: [Lang, string][] = [
    ['pl', 'Polski'],
    ['en', 'English'],
    ['it', 'Italiano'],
  ];
  for (const [code, name] of langs) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = name;
    langSelect.appendChild(opt);
  }
  langSelect.value = snapshot.settings.language;
  langLabel.appendChild(langSelect);
  const autoRow = document.createElement('div');
  autoRow.className = 'settings-row';
  const autoHeader = document.createElement('div');
  autoHeader.className = 'settings-row-header';
  const autoTitle = document.createElement('span');
  const autoTitleId = `auto-${crypto.randomUUID()}`;
  autoTitle.id = autoTitleId;
  autoTitle.className = 'settings-row-title';
  const autoToggle = document.createElement('input');
  autoToggle.type = 'checkbox';
  autoToggle.className = 'settings-toggle';
  autoToggle.setAttribute('aria-labelledby', autoTitleId);
  autoHeader.appendChild(autoTitle);
  autoHeader.appendChild(autoToggle);
  autoRow.appendChild(autoHeader);
  const autoInputWrapper = document.createElement('div');
  autoInputWrapper.className = 'settings-input-wrapper';
  const autoInput = document.createElement('input');
  autoInput.type = 'number';
  autoInput.inputMode = 'numeric';
  autoInput.pattern = '\\d*';
  autoInput.min = '1';
  autoInput.max = '999';
  autoInput.setAttribute('aria-labelledby', autoTitleId);
  autoInputWrapper.appendChild(autoInput);
  autoRow.appendChild(autoInputWrapper);
  const autoErr = document.createElement('div');
  autoErr.className = 'settings-error';
  autoRow.appendChild(autoErr);
  const autoEnabled = snapshot.settings.autodestructMinutes !== undefined;
  const autoRememberedValue =
    snapshot.settings.autodestructMinutesRemembered ??
    snapshot.settings.autodestructMinutes ??
    90;
  const initialAutoValue = autoEnabled
    ? snapshot.settings.autodestructMinutes ?? autoRememberedValue
    : autoRememberedValue;
  autoToggle.checked = autoEnabled;
  autoInput.value = String(initialAutoValue);
  autoInput.disabled = !autoEnabled;

  let autoStored = autoInput.value;

  autoToggle.addEventListener('change', () => {
    if (autoToggle.checked) {
      autoInput.disabled = false;
      autoInput.value = autoStored;
      autoErr.textContent = '';
      autoInput.focus();
    } else {
      autoStored = autoInput.value.trim() || autoStored;
      autoInput.disabled = true;
      autoErr.textContent = '';
    }
  });

  autoInput.addEventListener('input', () => {
    autoStored = autoInput.value;
    if (!autoToggle.checked) {
      autoErr.textContent = '';
      return;
    }
    const raw = autoInput.value.trim();
    const val = Number(raw);
    if (
      raw === '' ||
      !Number.isInteger(val) ||
      val < 1 ||
      val > 999
    ) {
      autoErr.textContent = t('valueRangeError');
    } else {
      autoErr.textContent = '';
    }
  });

  const limitRow = document.createElement('div');
  limitRow.className = 'settings-row';
  const limitHeader = document.createElement('div');
  limitHeader.className = 'settings-row-header';
  const limitTitle = document.createElement('span');
  const limitTitleId = `limit-${crypto.randomUUID()}`;
  limitTitle.id = limitTitleId;
  limitTitle.className = 'settings-row-title';
  const limitToggle = document.createElement('input');
  limitToggle.type = 'checkbox';
  limitToggle.className = 'settings-toggle';
  limitToggle.setAttribute('aria-labelledby', limitTitleId);
  limitHeader.appendChild(limitTitle);
  limitHeader.appendChild(limitToggle);
  limitRow.appendChild(limitHeader);
  const limitInputWrapper = document.createElement('div');
  limitInputWrapper.className = 'settings-input-wrapper';
  const limitInput = document.createElement('input');
  limitInput.type = 'number';
  limitInput.inputMode = 'numeric';
  limitInput.pattern = '\\d*';
  limitInput.min = '1';
  limitInput.max = '999';
  limitInput.setAttribute('aria-labelledby', limitTitleId);
  limitInputWrapper.appendChild(limitInput);
  limitRow.appendChild(limitInputWrapper);
  const limitErr = document.createElement('div');
  limitErr.className = 'settings-error';
  limitRow.appendChild(limitErr);
  const limitEnabled = snapshot.settings.pinAttemptsLimit !== undefined;
  const limitRememberedValue =
    snapshot.settings.pinAttemptsLimitRemembered ??
    snapshot.settings.pinAttemptsLimit ??
    3;
  const initialLimitValue = limitEnabled
    ? snapshot.settings.pinAttemptsLimit ?? limitRememberedValue
    : limitRememberedValue;
  limitToggle.checked = limitEnabled;
  limitInput.value = String(initialLimitValue);
  limitInput.disabled = !limitEnabled;

  let limitStored = limitInput.value;

  limitToggle.addEventListener('change', () => {
    if (limitToggle.checked) {
      limitInput.disabled = false;
      limitInput.value = limitStored;
      limitErr.textContent = '';
      limitInput.focus();
    } else {
      limitStored = limitInput.value.trim() || limitStored;
      limitInput.disabled = true;
      limitErr.textContent = '';
    }
  });

  limitInput.addEventListener('input', () => {
    limitStored = limitInput.value;
    if (!limitToggle.checked) {
      limitErr.textContent = '';
      return;
    }
    const raw = limitInput.value.trim();
    const val = Number(raw);
    if (
      raw === '' ||
      !Number.isInteger(val) ||
      val < 1 ||
      val > 999
    ) {
      limitErr.textContent = t('valueRangeError');
    } else {
      limitErr.textContent = '';
    }
  });

  const survivalRow = document.createElement('div');
  survivalRow.className = 'settings-row';
  const survivalHeader = document.createElement('div');
  survivalHeader.className = 'settings-row-header';
  const survivalTitle = document.createElement('span');
  const survivalTitleId = `survival-${crypto.randomUUID()}`;
  survivalTitle.id = survivalTitleId;
  survivalTitle.className = 'settings-row-title';
  const survivalToggle = document.createElement('input');
  survivalToggle.type = 'checkbox';
  survivalToggle.className = 'settings-toggle';
  survivalToggle.setAttribute('aria-labelledby', survivalTitleId);
  survivalHeader.appendChild(survivalTitle);
  survivalHeader.appendChild(survivalToggle);
  survivalRow.appendChild(survivalHeader);
  const survivalInputWrapper = document.createElement('div');
  survivalInputWrapper.className = 'settings-input-wrapper';
  const survivalInput = document.createElement('input');
  survivalInput.type = 'number';
  survivalInput.inputMode = 'numeric';
  survivalInput.pattern = '\\d*';
  survivalInput.min = '1';
  survivalInput.max = '100';
  survivalInput.step = '1';
  survivalInput.setAttribute('aria-labelledby', survivalTitleId);
  survivalInputWrapper.appendChild(survivalInput);
  const survivalSuffix = document.createElement('span');
  survivalSuffix.className = 'settings-suffix';
  survivalSuffix.textContent = '%';
  survivalInputWrapper.appendChild(survivalSuffix);
  survivalRow.appendChild(survivalInputWrapper);
  const survivalErr = document.createElement('div');
  survivalErr.className = 'settings-error';
  survivalRow.appendChild(survivalErr);
  const survivalEnabled = snapshot.settings.survivalEnabled;
  const survivalRememberedValue =
    snapshot.settings.survivalChanceRemembered ??
    snapshot.settings.survivalChance ??
    10;
  const initialSurvivalValue = survivalEnabled
    ? snapshot.settings.survivalChance ?? survivalRememberedValue
    : survivalRememberedValue;
  survivalToggle.checked = survivalEnabled;
  survivalInput.value = String(initialSurvivalValue);
  survivalInput.disabled = !survivalEnabled;

  let survivalStored = survivalInput.value;

  survivalToggle.addEventListener('change', () => {
    if (survivalToggle.checked) {
      survivalInput.disabled = false;
      survivalInput.value = survivalStored;
      survivalErr.textContent = '';
      survivalInput.focus();
    } else {
      survivalStored = survivalInput.value.trim() || survivalStored;
      survivalInput.disabled = true;
      survivalErr.textContent = '';
    }
  });

  survivalInput.addEventListener('input', () => {
    survivalStored = survivalInput.value;
    if (!survivalToggle.checked) {
      survivalErr.textContent = '';
      return;
    }
    const raw = survivalInput.value.trim();
    const val = Number(raw);
    if (
      raw === '' ||
      !Number.isInteger(val) ||
      val < 1 ||
      val > 100
    ) {
      survivalErr.textContent = t('percentageRangeError');
    } else {
      survivalErr.textContent = '';
    }
  });

  const actions = document.createElement('div');
  actions.className = 'settings-actions';
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'close-btn';
  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.className = 'close-btn';
  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);

  form.appendChild(langLabel);
  form.appendChild(autoRow);
  form.appendChild(limitRow);
  form.appendChild(survivalRow);
  form.appendChild(actions);

  dialog.appendChild(form);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  dialog.tabIndex = -1;
  dialog.focus();

  function cleanup(): void {
    document.body.removeChild(overlay);
    render();
  }

  function updateTexts(): void {
    langText.textContent = t('language');
    autoTitle.textContent = t('autodestructMinutes');
    autoToggle.setAttribute('aria-label', t('autodestructMinutes'));
    limitTitle.textContent = t('pinAttemptsLimit');
    limitToggle.setAttribute('aria-label', t('pinAttemptsLimit'));
    survivalTitle.textContent = t('survivalChance');
    survivalToggle.setAttribute('aria-label', t('survivalChance'));
    cancelBtn.textContent = t('cancel');
    saveBtn.textContent = t('save');
    if (autoErr.textContent) autoErr.textContent = t('valueRangeError');
    if (limitErr.textContent) limitErr.textContent = t('valueRangeError');
    if (survivalErr.textContent)
      survivalErr.textContent = t('percentageRangeError');
  }

  updateTexts();

  cancelBtn.addEventListener('click', cleanup);

  langSelect.addEventListener('change', () => {
    snapshot.settings.language = langSelect.value as Lang;
    setLang(snapshot.settings.language);
    saveSnapshot(snapshot);
    render();
    updateTexts();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let focusTarget: HTMLInputElement | undefined;

    const autoRaw = autoInput.value.trim();
    const autoVal = Number(autoRaw);
    const autoValid =
      autoRaw !== '' &&
      Number.isInteger(autoVal) &&
      autoVal >= 1 &&
      autoVal <= 999;
    if (autoToggle.checked) {
      if (!autoValid) {
        autoErr.textContent = t('valueRangeError');
        focusTarget = focusTarget ?? autoInput;
      } else {
        autoErr.textContent = '';
      }
    } else {
      autoErr.textContent = '';
    }

    const limitRaw = limitInput.value.trim();
    const limitVal = Number(limitRaw);
    const limitValid =
      limitRaw !== '' &&
      Number.isInteger(limitVal) &&
      limitVal >= 1 &&
      limitVal <= 999;
    if (limitToggle.checked) {
      if (!limitValid) {
        limitErr.textContent = t('valueRangeError');
        focusTarget = focusTarget ?? limitInput;
      } else {
        limitErr.textContent = '';
      }
    } else {
      limitErr.textContent = '';
    }

    const survivalRaw = survivalInput.value.trim();
    const survivalVal = Number(survivalRaw);
    const survivalValid =
      survivalRaw !== '' &&
      Number.isInteger(survivalVal) &&
      survivalVal >= 1 &&
      survivalVal <= 100;
    if (survivalToggle.checked) {
      if (!survivalValid) {
        survivalErr.textContent = t('percentageRangeError');
        focusTarget = focusTarget ?? survivalInput;
      } else {
        survivalErr.textContent = '';
      }
    } else {
      survivalErr.textContent = '';
    }

    if (focusTarget) {
      focusTarget.focus();
      return;
    }

    snapshot.settings.language = langSelect.value as Lang;
    setLang(snapshot.settings.language);
    if (autoValid) {
      snapshot.settings.autodestructMinutesRemembered = autoVal;
    }
    snapshot.settings.autodestructMinutes =
      autoToggle.checked && autoValid ? autoVal : undefined;
    if (limitValid) {
      snapshot.settings.pinAttemptsLimitRemembered = limitVal;
    }
    snapshot.settings.pinAttemptsLimit =
      limitToggle.checked && limitValid ? limitVal : undefined;
    snapshot.settings.survivalEnabled = survivalToggle.checked;
    if (survivalValid) {
      snapshot.settings.survivalChanceRemembered = survivalVal;
    }
    snapshot.settings.survivalChance =
      survivalToggle.checked && survivalValid ? survivalVal : undefined;
    saveSnapshot(snapshot);
    cleanup();
  });
}

function openAbout(): void {
  const overlay = document.createElement('div');
  overlay.className = 'settings-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'info-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', t('about'));
  dialog.tabIndex = -1;

  const title = document.createElement('h2');
  title.textContent = t('aboutTitle');
  dialog.appendChild(title);

  const intro = document.createElement('p');
  intro.textContent = t('aboutIntro');
  dialog.appendChild(intro);

  const how = document.createElement('p');
  how.textContent = t('aboutHow');
  dialog.appendChild(how);

  const note = document.createElement('p');
  note.className = 'info-note';
  note.textContent = t('aboutNote');
  dialog.appendChild(note);

  const actions = document.createElement('div');
  actions.className = 'settings-actions';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'close-btn';
  closeBtn.textContent = t('close');
  actions.appendChild(closeBtn);
  dialog.appendChild(actions);

  overlay.appendChild(dialog);

  function cleanup(): void {
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    document.removeEventListener('keydown', onKeyDown);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      cleanup();
    }
  }

  closeBtn.addEventListener('click', cleanup);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      cleanup();
    }
  });
  document.addEventListener('keydown', onKeyDown);

  document.body.appendChild(overlay);
  dialog.focus();
}

function render(): void {
  if (!app) return;
  app.innerHTML = '';
  if (snapshot.runtime.state === 'open') {
    app.appendChild(renderOpen());
  } else if (snapshot.runtime.state === 'closed') {
    app.appendChild(renderClosed());
  } else {
    app.appendChild(renderDestroyed());
  }
}

function openImagePreview(src: string): void {
  const overlay = document.createElement('div');
  overlay.className = 'image-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'image-preview-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', t('viewImage'));
  dialog.tabIndex = -1;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'image-preview-close close-btn';
  closeBtn.setAttribute('aria-label', t('closePreview'));
  closeBtn.textContent = '×';

  const img = document.createElement('img');
  img.src = src;
  img.alt = t('imageAlt');
  img.className = 'image-preview-full';

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'image-preview-remove close-btn';
  removeBtn.textContent = t('removeImage');
  removeBtn.addEventListener('click', () => {
    snapshot.content.imageDataUrl = undefined;
    saveSnapshot(snapshot);
    cleanup();
    render();
  });

  dialog.appendChild(closeBtn);
  dialog.appendChild(img);
  dialog.appendChild(removeBtn);
  overlay.appendChild(dialog);

  function cleanup(): void {
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    document.removeEventListener('keydown', onKeyDown);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      cleanup();
    }
  }

  closeBtn.addEventListener('click', cleanup);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      cleanup();
    }
  });
  document.addEventListener('keydown', onKeyDown);

  document.body.appendChild(overlay);
  closeBtn.focus();
}

function renderOpen(): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'safe-panel';

  const infoBtn = document.createElement('button');
  infoBtn.type = 'button';
  infoBtn.className = 'panel-icon-button info-icon';
  infoBtn.textContent = 'ℹ️';
  infoBtn.setAttribute('aria-label', t('about'));
  infoBtn.title = t('about');
  infoBtn.addEventListener('click', openAbout);

  const settingsBtn = document.createElement('button');
  settingsBtn.type = 'button';
  settingsBtn.className = 'panel-icon-button settings-icon';
  settingsBtn.textContent = '⚙️';
  settingsBtn.setAttribute('aria-label', t('settings'));
  settingsBtn.title = t('settings');
  settingsBtn.addEventListener('click', openSettings);

  panel.appendChild(
    createPanelHeader('safeOpen', 'open', [infoBtn, settingsBtn]),
  );

  const content = document.createElement('div');
  content.className = 'safe-content';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.className = 'file-input';
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      snapshot.content.imageDataUrl = reader.result as string;
      saveSnapshot(snapshot);
      render();
    };
    reader.readAsDataURL(file);
  });

  const imageUrl = snapshot.content.imageDataUrl;
  const hasImage = Boolean(imageUrl);

  const textarea = document.createElement('textarea');
  textarea.value = snapshot.content.text;
  textarea.placeholder = t('secretPlaceholder');
  textarea.addEventListener('input', () => {
    snapshot.content.text = textarea.value;
    saveSnapshot(snapshot);
  });

  content.appendChild(textarea);
  content.appendChild(fileInput);

  if (imageUrl) {
    const thumbButton = document.createElement('button');
    thumbButton.type = 'button';
    thumbButton.className = 'image-thumb';
    thumbButton.setAttribute('aria-label', t('viewImage'));

    const thumbImg = document.createElement('img');
    thumbImg.src = imageUrl;
    thumbImg.alt = t('imageAlt');
    thumbImg.className = 'image-thumb-img';

    thumbButton.appendChild(thumbImg);
    thumbButton.addEventListener('click', () => {
      openImagePreview(imageUrl);
    });

    content.appendChild(thumbButton);
  }

  panel.appendChild(content);

  const actions = document.createElement('div');
  actions.className = 'safe-actions';

  const imageBtn = document.createElement('button');
  imageBtn.className = 'close-btn image-action-btn';
  imageBtn.textContent = hasImage ? t('replaceImage') : t('chooseImage');
  imageBtn.addEventListener('click', () => fileInput.click());
  actions.appendChild(imageBtn);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'close-btn';
  closeBtn.textContent = t('closeSafe');
  closeBtn.addEventListener('click', async () => {
    const pin = await promptPin(t('setPin'));
    if (pin === null || pin === '') return;
    const confirmPin = await promptPin(t('confirmPin'));
    if (confirmPin === null || confirmPin !== pin) {
      alert(t('pinMismatch'));
      return;
    }
    const pinHash = await hashPin(pin);
    dispatch({ type: 'close', pinHash, now: Date.now() });
  });
  actions.appendChild(closeBtn);
  panel.appendChild(actions);

  return panel;
}

function renderClosed(): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'safe-panel';

  panel.appendChild(createPanelHeader('safeClosed', 'closed'));

  if (snapshot.runtime.explosionResult === 'survived') {
    const survived = document.createElement('p');
    survived.className = 'explosion-message';
    survived.textContent = t('contentSurvived');
    panel.appendChild(survived);
  }

  const label = document.createElement('label');
  label.textContent = t('enterPin');
  label.className = 'closed-info';
  const input = document.createElement('input');
  input.type = 'password';
  input.inputMode = 'numeric';
  input.pattern = '\\d*';
  input.className = 'pin-input';
  input.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '');
  });
  const openBtn = document.createElement('button');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') openBtn.click();
  });
  label.appendChild(input);
  panel.appendChild(label);

  if (snapshot.settings.pinAttemptsLimit !== undefined) {
    const remaining =
      snapshot.settings.pinAttemptsLimit - snapshot.runtime.attemptsMade;
    const attempts = document.createElement('p');
    attempts.className = 'closed-info';
    attempts.textContent = `${t('attemptsRemaining')}: ${remaining}`;
    panel.appendChild(attempts);
  }

  if (snapshot.runtime.destructAt !== undefined) {
    const timer = document.createElement('p');
    timer.className = 'closed-info';
    timer.dataset.countdown = 'true';
    updateCountdownElement(timer);
    panel.appendChild(timer);
  }

  openBtn.className = 'close-btn';
  openBtn.textContent = t('openSafe');
  openBtn.addEventListener('click', async () => {
    const pin = input.value;
    if (!pin) return;
    const pinHash = await hashPin(pin);
    if (pinHash === snapshot.runtime.pinHash) {
      dispatch({ type: 'open' });
    } else {
      alert(t('wrongPin'));
      dispatch({ type: 'wrongPin' });
    }
  });
  panel.appendChild(openBtn);

  const blowBtn = document.createElement('button');
  blowBtn.className = 'close-btn danger-btn';
  blowBtn.textContent = t('blowSafe');
  blowBtn.addEventListener('click', () => {
    dispatch({ type: 'explode' });
  });
  panel.appendChild(blowBtn);

  return panel;
}

function renderDestroyed(): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'safe-panel destroyed-panel';

  panel.appendChild(createPanelHeader('safeDestroyed', 'destroyed'));

  const description = document.createElement('p');
  description.className = 'destroyed-text';
  description.textContent = t('safeDestroyedDescription');
  panel.appendChild(description);

  const newSafeBtn = document.createElement('button');
  newSafeBtn.className = 'close-btn';
  newSafeBtn.textContent = t('startNewSafe');
  newSafeBtn.addEventListener('click', () => {
    dispatch({ type: 'startNew' });
  });
  panel.appendChild(newSafeBtn);

  return panel;
}

scheduleTimer();
render();

window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    dispatch({ type: 'tick', now: Date.now() });
  }
});

window.addEventListener('focus', () => {
  dispatch({ type: 'tick', now: Date.now() });
});
