import { loadSnapshot, saveSnapshot } from './persistence';
import { reduce, spawnSafe, type SafeEvent } from './safeMachine';
import type { Lang, SafeSnapshot } from './types';
import { hashPin } from './pin';

let snapshot: SafeSnapshot = loadSnapshot() ?? spawnSafe();
saveSnapshot(snapshot);

function dispatch(event: SafeEvent): void {
  const queue: SafeEvent[] = [event];
  while (queue.length) {
    const e = queue.shift()!;
    const [next, emitted] = reduce(snapshot, e);
    snapshot = next;
    queue.push(...emitted);
  }
  saveSnapshot(snapshot);
  scheduleTimer();
  render();
}

let timerId: number | undefined;

function scheduleTimer(): void {
  if (timerId !== undefined) {
    clearTimeout(timerId);
    timerId = undefined;
  }
  if (
    snapshot.runtime.state === 'closed' &&
    snapshot.runtime.destructAt !== undefined
  ) {
    const delay = snapshot.runtime.destructAt - Date.now();
    if (delay <= 0) {
      dispatch({ type: 'tick', now: Date.now() });
    } else {
      timerId = window.setTimeout(() => {
        dispatch({ type: 'tick', now: Date.now() });
      }, delay);
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
    okBtn.textContent = 'OK';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'close-btn';
    cancelBtn.textContent = 'Anuluj';
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
  langLabel.textContent = 'Język';
  const langSelect = document.createElement('select');
  langSelect.value = snapshot.settings.language;
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
  langLabel.appendChild(langSelect);

  const autoLabel = document.createElement('label');
  autoLabel.textContent = 'Autodestrukcja (minuty)';
  const autoInput = document.createElement('input');
  autoInput.type = 'number';
  autoInput.min = '1';
  autoInput.max = '999';
  autoInput.value = snapshot.settings.autodestructMinutes?.toString() ?? '';
  autoLabel.appendChild(autoInput);

  const limitLabel = document.createElement('label');
  limitLabel.textContent = 'Limit prób PIN';
  const limitInput = document.createElement('input');
  limitInput.type = 'number';
  limitInput.min = '1';
  limitInput.max = '999';
  limitInput.value = snapshot.settings.pinAttemptsLimit?.toString() ?? '';
  limitLabel.appendChild(limitInput);

  const survivalLabel = document.createElement('label');
  const survivalInput = document.createElement('input');
  survivalInput.type = 'checkbox';
  survivalInput.checked = snapshot.settings.survivalEnabled;
  survivalLabel.appendChild(survivalInput);
  survivalLabel.appendChild(
    document.createTextNode(' Możliwy przetrwanie eksplozji'),
  );

  const actions = document.createElement('div');
  actions.className = 'settings-actions';
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'close-btn';
  cancelBtn.textContent = 'Anuluj';
  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.className = 'close-btn';
  saveBtn.textContent = 'Zapisz';
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
  langSelect.focus();

  function cleanup(): void {
    document.body.removeChild(overlay);
    render();
  }

  cancelBtn.addEventListener('click', cleanup);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    snapshot.settings.language = langSelect.value as Lang;
    const auto = Number(autoInput.value);
    snapshot.settings.autodestructMinutes = autoInput.value ? auto : undefined;
    const limit = Number(limitInput.value);
    snapshot.settings.pinAttemptsLimit = limitInput.value ? limit : undefined;
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
  } else {
    const panel = document.createElement('div');
    panel.className = 'safe-panel';
    const text = document.createElement('p');
    text.textContent = 'Closed state not implemented';
    panel.appendChild(text);
    const restartBtn = document.createElement('button');
    restartBtn.className = 'close-btn';
    restartBtn.textContent = 'Restartuj aplikację';
    restartBtn.addEventListener('click', () => {
      localStorage.clear();
      location.reload();
    });
    panel.appendChild(restartBtn);
    app.appendChild(panel);
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
  state.textContent =
    snapshot.runtime.state === 'open'
      ? 'Sejf jest otwarty'
      : 'Sejf jest zamknięty';
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
  textarea.placeholder = 'Twój największy sekret';
  textarea.addEventListener('input', () => {
    snapshot.content.text = textarea.value;
    saveSnapshot(snapshot);
  });

  const textBtn = document.createElement('button');
  textBtn.textContent = 'Włóż tekst';
  textBtn.addEventListener('click', () => {
    textarea.focus();
  });
  top.appendChild(textBtn);

  const imageBtn = document.createElement('button');
  imageBtn.textContent = 'Wybierz obrazek';
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
  closeBtn.textContent = 'Zamknij sejf';
  closeBtn.addEventListener('click', async () => {
    const pin = await promptPin('Ustaw PIN');
    if (pin === null || pin === '') return;
    const confirmPin = await promptPin('Potwierdź PIN');
    if (confirmPin === null || confirmPin !== pin) {
      alert('PIN nie pasuje');
      return;
    }
    const pinHash = await hashPin(pin);
    dispatch({ type: 'close', pinHash, now: Date.now() });
  });
  panel.appendChild(closeBtn);

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
