import type { SafeRuntime } from './types';

export type ExplodeHandler = () => void;

/**
 * Starts a destruction timer based on `runtime.destructAt` and ensures the
 * check runs again when the tab wakes up from being hidden or unfocused.
 * Returns a cleanup function to cancel the timer and listeners.
 */
export function startDestructTimer(
  runtime: SafeRuntime,
  onExplode: ExplodeHandler,
): () => void {
  if (runtime.destructAt === undefined) {
    return () => {
      /* no timer armed */
    };
  }

  let timeoutId: number | undefined;

  const check = () => {
    if (runtime.destructAt !== undefined && Date.now() >= runtime.destructAt) {
      cleanup();
      onExplode();
    }
  };

  const schedule = () => {
    const delay = runtime.destructAt! - Date.now();
    if (delay <= 0) {
      check();
      return;
    }
    timeoutId = window.setTimeout(check, delay);
  };

  const onWake = () => check();

  const cleanup = () => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
    document.removeEventListener('visibilitychange', onWake);
    window.removeEventListener('focus', onWake);
  };

  schedule();
  document.addEventListener('visibilitychange', onWake);
  window.addEventListener('focus', onWake);

  return cleanup;
}

