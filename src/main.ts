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

scheduleTimer();

window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    dispatch({ type: 'tick', now: Date.now() });
  }
});

window.addEventListener('focus', () => {
  dispatch({ type: 'tick', now: Date.now() });
});

const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  const panel = document.createElement('div');
  panel.className = 'safe-panel';
  panel.textContent = 'Safe panel placeholder';
  app.appendChild(panel);
}
