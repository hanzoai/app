import { toast } from '@hanzo/ui'
import type { Thread } from '@hanzo/ai'

/** What archiving a conversation needs of the store: the change, answered true when it held. */
interface Archiver {
  archive: (t: Thread) => Promise<boolean>
}

/** Archive or unarchive one conversation. An archive is said with an Undo that puts it back, since nothing else brings it back to the list. */
export async function archiveWithUndo(act: Archiver, t: (s: string) => string, target: Thread): Promise<void> {
  const wasArchived = Boolean(target.archived)
  if (!(await act.archive(target))) return
  if (wasArchived) {
    toast.success(t('Unarchived chat'))
    return
  }
  const archived: Thread = { ...target, archived: true }
  toast(t('Archived chat'), {
    duration: 5000,
    action: { label: t('Undo'), onClick: () => void act.archive(archived) },
  })
}
