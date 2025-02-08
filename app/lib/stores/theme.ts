import { atom } from 'nanostores';
import { logStore } from './logs';

export type Theme = 'dark' | 'light';

export const kTheme = 'hanzo_theme';

export function themeIsDark() {
  return themeStore.get() === 'dark';
}

export const DEFAULT_THEME = 'dark' as const;

export const themeStore = atom<Theme>(initStore());

function initStore(): Theme {
  if (!import.meta.env.SSR) {
    localStorage.setItem(kTheme, DEFAULT_THEME);
    document.querySelector('html')?.setAttribute('data-theme', 'dark');

    return 'dark';
  }

  return 'dark';
}

export function toggleTheme() {
  const currentTheme = themeStore.get();
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  themeStore.set(newTheme);
  logStore.logSystem(`Theme changed to ${newTheme} mode`);
  localStorage.setItem(kTheme, newTheme);
  document.querySelector('html')?.setAttribute('data-theme', newTheme);
}
