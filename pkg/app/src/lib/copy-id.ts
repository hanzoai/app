import { toast } from '@hanzo/ui'

import type { Say } from '@hanzo/i18n'

/** A row's own id on the clipboard, for a support request or a script: not a link. */
export async function copyId(id: string, t: Say): Promise<void> {
  try {
    await navigator.clipboard.writeText(id)
    toast.success(t('Id copied'))
  } catch {
    toast.error(t('The browser would not copy the id.'))
  }
}
