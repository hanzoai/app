// `t` for a plain module. A room passes its own (`useI18n().t` from
// @hanzo/i18n/react), so what the module says is in the reader's language; a
// caller with none, a spec or a server, gets the English with its arguments
// filled. No React, so a module that loads in plain Node can take it.

import { translate } from '@hanzo/i18n'

/** Authored English in, a sentence out, `{name}` arguments filled. */
export type Say = (source: string, values?: Readonly<Record<string, string | number>>) => string

/** The English, for a caller that passes no `t`. */
export const english: Say = (source, values) => translate({}, source, values)
