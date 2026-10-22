'use client';
import { createContext, createElement, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { defaultLocale, direction, locales, preferenceKey, resolveLocale, translate } from './index.js';
import { loaders } from './loaders.js';
import { loadAccountLocale, saveAccountLocale } from './account.js';
const Context = createContext({
  locale: defaultLocale, dir: 'ltr', messages: {}, loading: false, error: null,
  t: (source, values) => translate({}, source, values),
  setLocale: async () => { throw new Error('Changing language requires I18nProvider'); },
});
export function I18nProvider({ children, userId, initialLocale = defaultLocale, account, loadCatalog = code => loaders[code]() }) {
  const [state, setState] = useState({ locale: resolveLocale(initialLocale), messages: {} });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const sequence = useRef(0);
  const writes = useRef(Promise.resolve());
  const identity = useRef(userId);
  identity.current = userId;
  async function select(value, persist = true) {
    const locale = resolveLocale(value);
    const request = ++sequence.current;
    const owner = identity.current;
    setLoading(true);
    setError(null);
    try {
      const loaded = locale === defaultLocale ? {} : await loadCatalog(locale);
      if (sequence.current !== request || identity.current !== owner) return;
      const messages = loaded.default || loaded;
      setState({ locale, messages });
      document.documentElement.lang = locale;
      document.documentElement.dir = direction(locale);
      if (persist) {
        try { localStorage.setItem(preferenceKey(owner), locale); } catch { /* Private browsing may disallow storage. */ }
        if (owner && account?.token) {
          const credentials = account;
          writes.current = writes.current.catch(() => {}).then(async () => {
            if (identity.current !== owner) return;
            await saveAccountLocale(credentials, locale, AbortSignal.timeout(10000));
          }).catch(() => {
            if (sequence.current === request && identity.current === owner)
              setError('Language saved on this device. Account sync failed; select the language again to retry.');
          });
        }
      }
    } catch {
      if (sequence.current === request) setError('Unable to load this language. Please try again.');
    } finally {
      if (sequence.current === request) setLoading(false);
    }
  }
  useEffect(() => {
    let saved;
    try { saved = localStorage.getItem(preferenceKey(userId)); } catch { /* optional persistence */ }
    // A different account never inherits the preceding account's preference.
    void select(saved || (userId ? initialLocale : navigator.language), false);
    const changed = event => { if (event.key === preferenceKey(userId)) void select(event.newValue || initialLocale, false); };
    window.addEventListener('storage', changed);
    return () => { ++sequence.current; window.removeEventListener('storage', changed); };
  }, [userId, initialLocale]);
  useEffect(() => {
    if (!userId || !account?.token) return;
    const stop = new AbortController();
    const before = sequence.current;
    loadAccountLocale(account, stop.signal).then(locale => {
      if (locale && sequence.current === before && !stop.signal.aborted) void select(locale, false);
    }).catch(() => {}); // Device/browser preference remains usable offline.
    return () => stop.abort();
  }, [userId, account?.base, account?.token]);
  const value = useMemo(() => ({ ...state, dir: direction(state.locale), loading, error, setLocale: select, t: (source, values) => translate(state.messages, source, values) }), [state, loading, error, userId, account?.base, account?.token]);
  return createElement(Context.Provider, { value }, children);
}
export function useI18n() {
  const value = useContext(Context);
  if (!value) throw new Error('useI18n requires I18nProvider');
  return value;
}
export function T({ children, values }) { return useI18n().t(children, values); }
export function LanguagePicker({ className, style }) {
  const { locale, setLocale, t, loading, error } = useI18n();
  return createElement('label', { className, style: { display: 'inline-flex', flexDirection: 'column', gap: 4, maxWidth: '100%', ...style } },
    createElement('span', null, t('Language')),
    createElement('select', { 'aria-label': t('Language'), 'aria-busy': loading, value: locale, onChange: event => void setLocale(event.target.value), style: { maxWidth: '100%', minHeight: 36, color: 'inherit', background: 'var(--background, Canvas)', border: '1px solid var(--border, GrayText)', borderRadius: 6, paddingInline: 8, font: 'inherit' } },
      locales.map(item => createElement('option', { key: item.code, value: item.code, lang: item.code, dir: item.dir }, item.name))),
    error && createElement('span', { role: 'alert' }, t(error)));
}
