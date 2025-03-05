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

  // Update the theme store
  themeStore.set(newTheme);

  // Update localStorage
  localStorage.setItem(kTheme, newTheme);

  // Update the HTML attribute
  document.querySelector('html')?.setAttribute('data-theme', newTheme);

  // Update user profile if it exists
  try {
    const userProfile = localStorage.getItem('hanzo_user_profile');

    if (userProfile) {
      const profile = JSON.parse(userProfile);
      profile.theme = newTheme;
      localStorage.setItem('hanzo_user_profile', JSON.stringify(profile));
    }
  } catch (error) {
    console.error('Error updating user profile theme:', error);
  }

  logStore.logSystem(`Theme changed to ${newTheme} mode`);
}
