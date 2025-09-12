import '../styles/app.css';

const panel = document.querySelector<HTMLDivElement>('.safe-panel');

panel?.addEventListener('click', () => {
  console.log('Safe panel clicked');
});
