import type { SafeSnapshot } from './types';

export type SafeEvent =
  | { type: 'open' }
  | { type: 'close'; pinHash: string; now: number }
  | { type: 'wrongPin' }
  | { type: 'tick'; now: number }
  | { type: 'explode' }
  | { type: 'survive' };

export function spawnSafe(): SafeSnapshot {
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

interface ReduceOptions {
  random?: () => number;
}

export function reduce(
  snapshot: SafeSnapshot,
  event: SafeEvent,
  opts: ReduceOptions = {},
): [SafeSnapshot, SafeEvent[]] {
  const { random = Math.random } = opts;

  switch (event.type) {
    case 'open':
      if (snapshot.runtime.state !== 'closed') return [snapshot, []];
      return [
        {
          ...snapshot,
          runtime: {
            state: 'open',
            attemptsMade: 0,
          },
        },
        [],
      ];

    case 'close': {
      if (snapshot.runtime.state !== 'open') return [snapshot, []];
      const closedAt = event.now;
      const minutes = snapshot.settings.autodestructMinutes;
      const destructAt =
        minutes !== undefined ? closedAt + minutes * 60 * 1000 : undefined;
      return [
        {
          ...snapshot,
          runtime: {
            state: 'closed',
            pinHash: event.pinHash,
            attemptsMade: 0,
            closedAt,
            destructAt,
          },
        },
        [],
      ];
    }

    case 'wrongPin': {
      if (snapshot.runtime.state !== 'closed') return [snapshot, []];
      const attempts = snapshot.runtime.attemptsMade + 1;
      const updated: SafeSnapshot = {
        ...snapshot,
        runtime: { ...snapshot.runtime, attemptsMade: attempts },
      };
      const limit = snapshot.settings.pinAttemptsLimit;
      if (limit !== undefined && attempts >= limit) {
        return [updated, [{ type: 'explode' }]];
      }
      return [updated, []];
    }

    case 'tick': {
      if (snapshot.runtime.state !== 'closed') return [snapshot, []];
      const destructAt = snapshot.runtime.destructAt;
      if (destructAt !== undefined && event.now >= destructAt) {
        return [snapshot, [{ type: 'explode' }]];
      }
      return [snapshot, []];
    }

    case 'explode': {
      if (snapshot.settings.survivalEnabled && random() < 0.1) {
        return [snapshot, [{ type: 'survive' }]];
      }
      return [spawnSafe(), []];
    }

    case 'survive': {
      if (snapshot.runtime.state !== 'closed') return [snapshot, []];
      return [
        {
          ...snapshot,
          runtime: {
            ...snapshot.runtime,
            attemptsMade: 0,
            destructAt: undefined,
          },
        },
        [],
      ];
    }
  }
}

