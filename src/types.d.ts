export type Lang = 'en' | 'pl' | 'it';

export interface SafeContent {
  text: string;
  imageDataUrl?: string; // Data URL representation
}

export interface SafeSettings {
  language: Lang;
  survivalEnabled: boolean; // survival chance active when true
  survivalChance?: number; // 1–100 percent chance on destruction
  autodestructMinutes?: number; // 1–999, undefined = disabled
  pinAttemptsLimit?: number; // positive integer, undefined = unlimited
}

export type SafeState = 'open' | 'closed' | 'destroyed';

export interface SafeRuntime {
  state: SafeState;
  pinHash?: string; // sha256 of pin
  attemptsMade: number; // wrong attempts in current closed cycle
  closedAt?: number; // epoch ms
  destructAt?: number; // epoch ms, if timer armed
  explosionResult?: 'survived' | 'destroyed';
}

export interface SafeSnapshot {
  id: string; // uuid
  content: SafeContent;
  settings: SafeSettings;
  runtime: SafeRuntime;
}
