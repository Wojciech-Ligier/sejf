export type Lang = 'en' | 'pl' | 'it';

export interface SafeContent {
  text: string;
  imageDataUrl?: string; // stored as Data URL; consider size limits
}

export interface SafeSettings {
  language: Lang;
  survivalEnabled: boolean; // 10% chance on destruction
  autodestructMinutes?: number; // 1–999, undefined = disabled
  pinAttemptsLimit?: number; // positive integer, undefined = unlimited
}

export interface SafeRuntime {
  state: 'open' | 'closed';
  pinHash?: string; // sha256 of pin; undefined only in open/no-pin pre-close state
  attemptsMade: number; // counts wrong attempts in current closed cycle
  closedAt?: number; // epoch ms
  destructAt?: number; // epoch ms, if timer armed
}

export interface SafeSnapshot {
  id: string; // uuid
  content: SafeContent;
  settings: SafeSettings;
  runtime: SafeRuntime;
}

