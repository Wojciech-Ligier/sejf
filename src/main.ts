const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  const panel = document.createElement('div');
  panel.className = 'safe-panel';
  panel.textContent = 'Safe panel placeholder';
  app.appendChild(panel);
}
