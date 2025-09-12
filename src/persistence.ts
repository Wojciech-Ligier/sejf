import type { SafeSnapshot } from './types';

const STORAGE_KEY = 'safe-game:v1';
const SCHEMA_VERSION = 1;

type Persisted<T> = {
  v: number;
  data: T;
};

type Migration = (data: unknown) => unknown;

const migrations: Record<number, Migration> = {
  0: (data) => data as SafeSnapshot,
};

export function loadSnapshot(): SafeSnapshot | undefined {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as any;
    let version: number;
    let data: unknown;

    if (typeof parsed.v === 'number' && 'data' in parsed) {
      version = parsed.v;
      data = parsed.data;
    } else {
      version = 0;
      data = parsed;
    }

    while (version < SCHEMA_VERSION) {
      const migrate = migrations[version];
      if (!migrate) return undefined;
      data = migrate(data);
      version += 1;
    }

    return data as SafeSnapshot;
  } catch {
    return undefined;
  }
}

export function saveSnapshot(snapshot: SafeSnapshot): void {
  const payload: Persisted<SafeSnapshot> = {
    v: SCHEMA_VERSION,
    data: snapshot,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}
