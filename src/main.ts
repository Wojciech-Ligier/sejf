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
          render();
        }, 1000);
      }
    }
  }
}

const app = document.querySelector<HTMLDivElement>('#app');

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

  const autoLabel = document.createElement('label');
  const autoText = document.createTextNode(t('autodestructMinutes'));
  autoLabel.appendChild(autoText);
  const autoInput = document.createElement('input');
  autoInput.type = 'number';
  autoInput.inputMode = 'numeric';
  autoInput.pattern = '\\d*';
  autoInput.min = '1';
  autoInput.max = '999';
  autoInput.value = snapshot.settings.autodestructMinutes?.toString() ?? '';
  const autoErr = document.createElement('div');
  autoErr.className = 'settings-error';
  autoInput.addEventListener('input', () => {
    const val = Number(autoInput.value);
    if (autoInput.value && (!Number.isInteger(val) || val < 1 || val > 999)) {
      autoErr.textContent = t('valueRangeError');
    } else {
      autoErr.textContent = '';
    }
  });
  autoLabel.appendChild(autoInput);
  autoLabel.appendChild(autoErr);

  const limitLabel = document.createElement('label');
  const limitText = document.createTextNode(t('pinAttemptsLimit'));
  limitLabel.appendChild(limitText);
  const limitInput = document.createElement('input');
  limitInput.type = 'number';
  limitInput.inputMode = 'numeric';
  limitInput.pattern = '\\d*';
  limitInput.min = '1';
  limitInput.max = '999';
  limitInput.value = snapshot.settings.pinAttemptsLimit?.toString() ?? '';
  const limitErr = document.createElement('div');
  limitErr.className = 'settings-error';
  limitInput.addEventListener('input', () => {
    const val = Number(limitInput.value);
    if (limitInput.value && (!Number.isInteger(val) || val < 1 || val > 999)) {
      limitErr.textContent = t('valueRangeError');
    } else {
      limitErr.textContent = '';
    }
  });
  limitLabel.appendChild(limitInput);
  limitLabel.appendChild(limitErr);

  const survivalLabel = document.createElement('label');
  const survivalInput = document.createElement('input');
  survivalInput.type = 'checkbox';
  survivalInput.checked = snapshot.settings.survivalEnabled;
  survivalLabel.appendChild(survivalInput);
  const survivalText = document.createTextNode(' ' + t('survivalOption'));
  survivalLabel.appendChild(survivalText);

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
  form.appendChild(autoLabel);
  form.appendChild(limitLabel);
  form.appendChild(survivalLabel);
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
    autoText.textContent = t('autodestructMinutes');
    limitText.textContent = t('pinAttemptsLimit');
    survivalText.textContent = ' ' + t('survivalOption');
    cancelBtn.textContent = t('cancel');
    saveBtn.textContent = t('save');
    if (autoErr.textContent) autoErr.textContent = t('valueRangeError');
    if (limitErr.textContent) limitErr.textContent = t('valueRangeError');
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
    const autoVal = Number(autoInput.value);
    if (
      autoInput.value &&
      (!Number.isInteger(autoVal) || autoVal < 1 || autoVal > 999)
    ) {
      autoErr.textContent = t('valueRangeError');
      autoInput.focus();
      return;
    }
    const limitVal = Number(limitInput.value);
    if (
      limitInput.value &&
      (!Number.isInteger(limitVal) || limitVal < 1 || limitVal > 999)
    ) {
      limitErr.textContent = t('valueRangeError');
      limitInput.focus();
      return;
    }
    snapshot.settings.language = langSelect.value as Lang;
    setLang(snapshot.settings.language);
    snapshot.settings.autodestructMinutes = autoInput.value
      ? autoVal
      : undefined;
    snapshot.settings.pinAttemptsLimit = limitInput.value
      ? limitVal
      : undefined;
    snapshot.settings.survivalEnabled = survivalInput.checked;
    saveSnapshot(snapshot);
    cleanup();
  });
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

function renderOpen(): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'safe-panel';

  const settingsBtn = document.createElement('button');
  settingsBtn.className = 'settings-icon';
  settingsBtn.textContent = '⚙️';
  settingsBtn.addEventListener('click', openSettings);
  panel.appendChild(settingsBtn);

  const icon = document.createElement('img');
  icon.src = '/safe.webp';
  icon.alt = '';
  icon.className = 'safe-icon';
  panel.appendChild(icon);

  const state = document.createElement('p');
  state.className = 'safe-state';
  state.textContent = t('safeOpen');
  panel.appendChild(state);

  const content = document.createElement('div');
  content.className = 'safe-content';
  const top = document.createElement('div');
  top.className = 'safe-top';

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

  const textarea = document.createElement('textarea');
  textarea.value = snapshot.content.text;
  textarea.placeholder = t('secretPlaceholder');
  textarea.addEventListener('input', () => {
    snapshot.content.text = textarea.value;
    saveSnapshot(snapshot);
  });

  const textBtn = document.createElement('button');
  textBtn.textContent = t('insertText');
  textBtn.addEventListener('click', () => {
    textarea.focus();
  });
  top.appendChild(textBtn);

  const imageBtn = document.createElement('button');
  imageBtn.textContent = t('chooseImage');
  imageBtn.addEventListener('click', () => fileInput.click());
  top.appendChild(imageBtn);

  content.appendChild(top);
  content.appendChild(textarea);
  content.appendChild(fileInput);

  if (snapshot.content.imageDataUrl) {
    const img = document.createElement('img');
    img.src = snapshot.content.imageDataUrl;
    img.className = 'image-preview';
    content.appendChild(img);
  }

  panel.appendChild(content);

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
  panel.appendChild(closeBtn);

  return panel;
}

function renderClosed(): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'safe-panel';

  const icon = document.createElement('img');
  icon.src = '/safe.webp';
  icon.alt = '';
  icon.className = 'safe-icon';
  panel.appendChild(icon);

  const state = document.createElement('p');
  state.className = 'safe-state';
  state.textContent = t('safeClosed');
  panel.appendChild(state);

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
    const update = () => {
      const ms = snapshot.runtime.destructAt! - Date.now();
      const sec = Math.max(0, Math.floor(ms / 1000));
      const min = Math.floor(sec / 60);
      const s = (sec % 60).toString().padStart(2, '0');
      timer.textContent = `${t('autodestructIn')}: ${min}:${s}`;
    };
    update();
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

  const emoji = document.createElement('div');
  emoji.className = 'destroyed-emoji';
  emoji.textContent = '💥';
  panel.appendChild(emoji);

  const title = document.createElement('h2');
  title.className = 'destroyed-title';
  title.textContent = t('safeDestroyed');
  panel.appendChild(title);

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
