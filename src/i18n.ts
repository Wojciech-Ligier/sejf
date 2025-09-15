import type { Lang } from './types';
import pl from './i18n/pl.json';
import en from './i18n/en.json';

export type MessageKey = keyof typeof pl;

const messages: Record<Lang, Record<MessageKey, string>> = {
  pl,
  en,
  // it will be added later when available
};

export const defaultLang: Lang = 'pl';
let currentLang: Lang = defaultLang;

export function setLang(lang?: Lang): void {
  currentLang = lang && messages[lang] ? lang : defaultLang;
  document.documentElement.lang = currentLang;
}

export function t(key: MessageKey): string {
  return messages[currentLang][key];
}
