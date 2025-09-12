import { loadSnapshot, saveSnapshot } from './persistence';
import type { SafeSnapshot } from './types';

function createNewSnapshot(): SafeSnapshot {
  return {
    id: crypto.randomUUID(),
    content: { text: '' },
    settings: {
      language: 'en',
      survivalEnabled: false,
    },
    runtime: {
      state: 'open',
      attemptsMade: 0,
    },
  };
}

const snapshot = loadSnapshot() ?? createNewSnapshot();
saveSnapshot(snapshot);

const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  const panel = document.createElement('div');
  panel.className = 'safe-panel';
  panel.textContent = 'Safe panel placeholder';
  app.appendChild(panel);
}
