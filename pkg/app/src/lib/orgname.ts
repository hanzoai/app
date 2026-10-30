/**
 * An organization's name as IAM keys it, said once for the chooser.
 *
 * IAM refuses a name that is not already canonical rather than rewriting it
 * (hanzoai/iam pkg/schema/orgname.go `OrgName`: lowercasing "Admin" would make
 * it the reserved org), so a slug typed here is checked and refused, never
 * folded. What IS folded is a display name into the slug it suggests, the way
 * IAM's own onboarding does it (internal/oidc/onboard.go `slugifyOrg`), so the
 * slug shown is the slug IAM makes of the same name.
 */

import { english, type Say } from '@hanzo/i18n'

/** The longest organization name IAM takes. */
export const LONGEST = 55

/**
 * The slug IAM's onboarding makes of a name: lowercase ASCII letters and digits,
 * every other run one hyphen, none at either end, at most `LONGEST` long.
 */
export function slugify(name: string): string {
  let out = ''
  let dash = false
  for (const ch of name.toLowerCase()) {
    if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) {
      out += ch
      dash = false
    } else if (!dash) {
      out += '-'
      dash = true
    }
  }
  return out.replace(/^-+|-+$/g, '').slice(0, LONGEST).replace(/-+$/, '')
}

/**
 * Why IAM would not take `slug` as an organization's name, or null when it
 * would. A name onboarding keeps exactly as typed: IAM's shape with single inner
 * hyphens, since onboarding folds a double one. The names IAM holds for the
 * platform are IAM's to refuse, in its own words. Said in the reader's language
 * through the room's `t`.
 */
export function refusal(slug: string, t: Say = english): string | null {
  if (slug.length < 2) return t('Use at least 2 letters or numbers.')
  if (slug.length > LONGEST) return t('Use at most {n} characters.', { n: LONGEST })
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return t('Use lowercase letters, digits and single hyphens between them.')
  return null
}

/** Whether an organization answers what was typed: its name or its display name, in any case (IAM's `matches`). */
export function matches(o: { name: string; display: string }, typed: string): boolean {
  const q = typed.trim().toLowerCase()
  return !q || o.name.toLowerCase().includes(q) || o.display.toLowerCase().includes(q)
}
