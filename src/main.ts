import { loadSnapshot, saveSnapshot } from './persistence';
import { reduce, spawnSafe, type SafeEvent } from './safeMachine';
import type { SafeSnapshot } from './types';

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

function render(): void {
  if (!app) return;
  app.innerHTML = '';
  if (snapshot.runtime.state === 'open') {
    app.appendChild(renderOpen());
  } else {
    const panel = document.createElement('div');
    panel.className = 'safe-panel';
    panel.textContent = 'Closed state not implemented';
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
