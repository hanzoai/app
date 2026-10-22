export interface Locale { code: string; name: string; englishName: string; dir: 'ltr' | 'rtl' }
export const locales: readonly Locale[];
export const defaultLocale: 'en-US';
export function resolveLocale(value?: string | null): string;
export function direction(locale: string): 'ltr' | 'rtl';
export function translate(messages: Record<string, string>, source: string, values?: Record<string, string | number>): string;
export function preferenceKey(userId?: string | null): string;
