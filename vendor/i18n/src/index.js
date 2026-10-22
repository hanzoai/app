import { locales } from './locales.js';
export { locales };
export const defaultLocale = 'en-US';
const aliases = { en: 'en-US', zh: 'zh-Hans', 'zh-cn': 'zh-Hans', 'zh-sg': 'zh-Hans', 'zh-tw': 'zh-Hant', 'zh-hk': 'zh-Hant', 'zh-mo': 'zh-Hant', fr: 'fr-FR', de: 'de-DE', hi: 'hi-IN', id: 'id-ID', it: 'it-IT', ja: 'ja-JP', ko: 'ko-KR', pt: 'pt-BR', es: 'es-ES', no: 'nb', 'nb-no': 'nb', tl: 'fil' };
export function resolveLocale(value) {
  if (typeof value !== 'string') return defaultLocale;
  const tag = value.trim().replaceAll('_', '-').toLowerCase();
  const exact = locales.find(l => l.code.toLowerCase() === tag)?.code;
  if (exact) return exact;
  if (aliases[tag]) return aliases[tag];
  if (tag.startsWith('zh-hant-')) return 'zh-Hant';
  if (tag.startsWith('zh-hans-')) return 'zh-Hans';
  if (tag.startsWith('es-') && !['es-es'].includes(tag)) return 'es-419';
  const base = tag.split('-')[0];
  return aliases[base] || locales.find(l => l.code === base)?.code || defaultLocale;
}
export function direction(locale) { return resolveLocale(locale) === 'ar' ? 'rtl' : 'ltr'; }
export function translate(messages, source, values = {}) {
  const text = Object.hasOwn(messages, source) ? messages[source] : source;
  const spaced = source.match(/^\s*/)[0] + text.trim() + source.match(/\s*$/)[0];
  return spaced.replace(/\{([\w]+)\}/g, (whole, key) => Object.hasOwn(values, key) ? String(values[key]) : whole);
}
export function preferenceKey(userId) { return `hanzo.locale.v1:${encodeURIComponent(userId || 'guest')}`; }
