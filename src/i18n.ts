import type { Lang } from './types';
import pl from './i18n/pl.json';
import en from './i18n/en.json';

export type MessageKey = keyof typeof pl;

const messages: Record<Lang, Record<MessageKey, string>> = {
  pl,
  en,
  // it will be added later when available
};

let currentLang: Lang = 'pl';

export function setLang(lang: Lang): void {
  if (messages[lang]) {
    currentLang = lang;
    document.documentElement.lang = lang;
  }
}

export function t(key: MessageKey): string {
  return messages[currentLang][key];
}
