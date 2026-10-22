import type { ReactNode, CSSProperties } from 'react';
export interface I18n { locale: string; dir: 'ltr' | 'rtl'; messages: Record<string, string>; loading: boolean; error: string | null; setLocale: (locale: string) => Promise<void>; t: (source: string, values?: Record<string, string | number>) => string }
export function I18nProvider(props: { children: ReactNode; userId?: string | null; initialLocale?: string; account?: { base: string; token: string }; loadCatalog?: (code: string) => Promise<Record<string, string> | {default: Record<string, string>}> }): ReactNode;
export function useI18n(): I18n;
export function T(props: { children: string; values?: Record<string, string | number> }): ReactNode;
export function LanguagePicker(props: { className?: string; style?: CSSProperties }): ReactNode;
