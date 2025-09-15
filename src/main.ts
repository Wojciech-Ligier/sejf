import { loadSnapshot, saveSnapshot } from './persistence';
import { reduce, spawnSafe, type SafeEvent } from './safeMachine';
import type { SafeSnapshot } from './types';
import { hashPin } from './pin';
import { t, setLang, defaultLang } from './i18n';

let snapshot: SafeSnapshot = loadSnapshot() ?? spawnSafe();
if (!snapshot.settings.language) {
  snapshot.settings.language = defaultLang;
}
setLang(snapshot.settings.language);
saveSnapshot(snapshot);

function dispatch(event: SafeEvent): void {
  const queue: SafeEvent[] = [event];
  while (queue.length) {
    const e = queue.shift()!;
    const [next, emitted] = reduce(snapshot, e);
    snapshot = next;
    setLang(snapshot.settings.language);
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

function render(): void {
  if (!app) return;
  app.innerHTML = '';
  if (snapshot.runtime.state === 'open') {
    app.appendChild(renderOpen());
  } else {
    const panel = document.createElement('div');
    panel.className = 'safe-panel';
    const text = document.createElement('p');
    text.textContent = t('closedNotImplemented');
    panel.appendChild(text);
    const restartBtn = document.createElement('button');
    restartBtn.className = 'close-btn';
    restartBtn.textContent = t('restartApp');
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
  settingsBtn.addEventListener('click', () => {
    console.log('open settings not implemented');
  });
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
      ? t('safeOpen')
      : t('safeClosed');
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
