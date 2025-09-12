import { startDestructTimer } from './timer';
import type { SafeRuntime } from './types';

const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  const panel = document.createElement('div');
  panel.className = 'safe-panel';
  panel.textContent = 'Safe panel placeholder';
  app.appendChild(panel);
}

// Demo: schedule a destruct timer 5 seconds from now when the safe is closed.
const runtime: SafeRuntime = {
  state: 'closed',
  attemptsMade: 0,
  destructAt: Date.now() + 5000,
};

startDestructTimer(runtime, () => {
  // Placeholder explosion handler
  console.log('Explosion! Timer elapsed.');
});
