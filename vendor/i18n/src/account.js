import { locales, resolveLocale } from './index.js';
async function preferences(account, patch, signal) {
  const response = await fetch(`${account.base.replace(/\/+$/, '')}/v1/iam/preferences`, {
    method: 'POST', credentials: 'omit', signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${account.token}` },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error(`IAM preferences: ${response.status}`);
  const body = await response.json();
  if (body?.status !== 'ok') throw new Error('IAM refused the preference');
  return body.data || {};
}
export async function loadAccountLocale(account, signal) {
  // IAM's existing preferences contract uses an empty merge as its read.
  const data = await preferences(account, {}, signal);
  return locales.some(l => l.code === data.locale) ? data.locale : undefined;
}
export async function saveAccountLocale(account, locale, signal) {
  const code = resolveLocale(locale);
  const data = await preferences(account, { locale: code }, signal);
  if (data.locale !== code) throw new Error('IAM did not persist the selected locale');
}
