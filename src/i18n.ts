import en from './i18n/en.json';
import pl from './i18n/pl.json';
import it from './i18n/it.json';
import type { Lang } from './types';

const messages = { en, pl, it } as const;
let current: Lang = 'en';

export function setLang(lang: Lang): void {
  current = lang;
  document.documentElement.lang = lang;
}

export function t(key: keyof typeof en): string {
  return messages[current][key];
}
