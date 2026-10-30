'use client'

// The conversation header's Share control and the panel it opens, and the same
// panel as a dialog for a conversation's row menu (thread.tsx): one `Sharing`,
// placed two ways.
//
// A link opens this ONE conversation, read only, as it stands when the link is
// made (lib/share.ts), to the people who open it signed in. The panel copies
// it, lists every live link with the people who opened it, removes any one of
// them, and revokes a link, which ends it for all of them. Recipients read and
// do not reply: a conversation belongs to the member who started it.

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { DEFAULT_LOCALE, type Say } from '@hanzo/i18n'
import { useI18n } from '@hanzo/i18n/react'
import { Check, Link2, Upload } from 'lucide-react'
import { Box, Button, Dialog, DialogContent, DialogTitle, Text, XStack, YStack } from '@hanzo/ui'
import { hold, heldToken, link, Refused, shares, type ShareRow, type Viewer } from './lib/share'
import { BAD } from './lib/mix'

/** How long "Link copied" stays. The same 1400 ms `Take` confirms for. */
const CONFIRM = 1400

/** A date as the panel says it: "Sep 29, 2026", in the reader's language once one is chosen. */
const day = (iso: string, locale: string): string => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(locale === DEFAULT_LOCALE ? undefined : locale, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** The store's own words where it gave some, else ours. */
const said = (e: unknown, t: Say): string => (e instanceof Refused || e instanceof Error ? e.message : t('That did not work. Try again.'))

export function Share({ thread }: { thread: string }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLElement | null>(null)
  const close = useCallback(() => {
    setOpen(false)
    button.current?.focus()
  }, [])
  return (
    <Box position="relative">
      <Box
        ref={button as never}
        render="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('Share this conversation')}
        data-slot="share"
        display="flex"
        flexDirection="row"
        gap="$1.5"
        height={32}
        px="$2.5"
        items="center"
        justify="center"
        borderWidth={0}
        bg={open ? '$hover' : 'transparent'}
        rounded="$3"
        cursor="pointer"
        hoverStyle={{ bg: '$hover' }}
      >
        <Upload size={16} aria-hidden />
        <Text fontSize="$3" color="$ink">
          {t('Share')}
        </Text>
      </Box>
      {open ? <Panel thread={thread} onClose={close} /> : null}
    </Box>
  )
}

/** The header's panel: hung under its button, shut by Escape or a press outside, focus starting inside. */
function Panel({ thread, onClose }: { thread: string; onClose: () => void }) {
  const { t } = useI18n()
  const heading = useId()
  const box = useRef<HTMLDivElement | null>(null)

  // Escape closes; a press outside closes; focus starts inside.
  useEffect(() => {
    box.current?.querySelector<HTMLElement>('button')?.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const press = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node) && !(e.target as HTMLElement)?.closest?.('[aria-haspopup="dialog"]')) onClose()
    }
    document.addEventListener('keydown', key)
    document.addEventListener('mousedown', press)
    return () => {
      document.removeEventListener('keydown', key)
      document.removeEventListener('mousedown', press)
    }
  }, [onClose])

  return (
    <YStack
      ref={box as never}
      role="dialog"
      aria-labelledby={heading}
      position="absolute"
      insetInlineEnd={0}
      t="100%"
      mt="$2"
      z="var(--z-dropdown)"
      width={360}
      maxW="calc(100vw - 32px)"
      p="$4"
      gap="$3"
      rounded="$4"
      borderWidth={1}
      borderColor="$borderColor"
      bg="$background"
      boxShadow="0 16px 36px color-mix(in srgb, var(--pure-black) 30%, transparent)"
    >
      <Sharing
        thread={thread}
        note={`${heading}-said`}
        title={
          <Text id={heading} render="h2" fontSize="$4" fontWeight="600" color="$ink">
            {t('Share this chat')}
          </Text>
        }
      />
    </YStack>
  )
}

/**
 * The same panel as a dialog, for a conversation the pane need not hold: a row
 * menu's Share…. `onCloseAutoFocus` says where focus goes when it shuts.
 */
export function ShareDialog({
  thread,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: {
  thread: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onCloseAutoFocus?: (e: Event) => void
}) {
  const { t } = useI18n()
  const note = useId()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent maxW={400} rounded="$6" gap="$3" onCloseAutoFocus={onCloseAutoFocus}>
        {thread ? <Sharing thread={thread} note={note} title={<DialogTitle>{t('Share this chat')}</DialogTitle>} /> : null}
      </DialogContent>
    </Dialog>
  )
}

/** What a link to one conversation is, who opened each, and the controls over them. */
function Sharing({ thread, title, note }: { thread: string; title: ReactNode; note: string }) {
  const { t, locale } = useI18n()
  const [live, setLive] = useState<ShareRow[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [wrong, setWrong] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let on = true
    shares
      .list(thread)
      .then((rows) => on && setLive(rows))
      .catch((e) => {
        if (!on) return
        setLive([])
        setWrong(said(e, t))
      })
    return () => {
      on = false
    }
  }, [thread])

  useEffect(() => {
    if (!copied) return
    const shown = setTimeout(() => setCopied(false), CONFIRM)
    return () => clearTimeout(shown)
  }, [copied])

  const copy = async () => {
    setBusy('copy')
    setWrong(null)
    try {
      let got = heldToken(thread, live ?? [])
      if (!got) {
        const made = await shares.make(thread)
        got = { id: made.share.id, token: made.token }
        hold(thread, got)
        setLive((rows) => [...(rows ?? []), made.share])
      }
      await navigator.clipboard.writeText(link(got.token))
      setCopied(true)
    } catch (e) {
      setWrong(e instanceof DOMException ? t('The browser would not copy. Select the link and copy it by hand.') : said(e, t))
    } finally {
      setBusy(null)
    }
  }

  const unview = async (row: ShareRow, viewer: Viewer) => {
    setBusy(viewer.id)
    setWrong(null)
    try {
      await shares.unview(thread, row.id, viewer.id)
      setLive((rows) => (rows ?? []).map((r) => (r.id === row.id ? { ...r, viewers: r.viewers.filter((v) => v.id !== viewer.id) } : r)))
    } catch (e) {
      setWrong(said(e, t))
    } finally {
      setBusy(null)
    }
  }

  const revoke = async (id: string) => {
    setBusy(id)
    setWrong(null)
    try {
      await shares.revoke(thread, id)
      if (heldToken(thread, live ?? [])?.id === id) hold(thread, null)
      setLive((rows) => (rows ?? []).filter((r) => r.id !== id))
    } catch (e) {
      setWrong(said(e, t))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      {title}
      <Text fontSize="$2" color="$soft" lineHeight="$3">
        {t('People who open the link signed in can read this chat as it is now, and you see who they are below. They cannot reply, and messages you send later are not shared.')}
      </Text>

      <XStack items="center" gap="$2">
        <Button size="sm" onClick={() => void copy()} disabled={busy !== null || live === null} aria-describedby={note}>
          <XStack items="center" gap="$1.5">
            {copied ? <Check size={14} aria-hidden /> : <Link2 size={14} aria-hidden />}
            <Text fontSize="$2" color="inherit">
              {copied ? t('Link copied') : busy === 'copy' ? t('Making a link…') : t('Copy link')}
            </Text>
          </XStack>
        </Button>
        <Text fontSize="$1" color="$soft">
          {t('Read only')}
        </Text>
      </XStack>
      <Text id={note} aria-live="polite" fontSize="$1" color="$soft" minH={16}>
        {copied ? t('The link is on your clipboard.') : ''}
      </Text>

      <YStack gap="$2">
        <Text fontSize="$1" color="$soft" textTransform="uppercase">
          {t('Who has access')}
        </Text>
        <XStack items="center" justify="space-between">
          <Text fontSize="$2" color="$ink">
            {t('You')}
          </Text>
          <Text fontSize="$1" color="$soft">
            {t('Owner')}
          </Text>
        </XStack>
        {live === null ? (
          <Text fontSize="$2" color="$soft">
            {t('Reading links.')}
          </Text>
        ) : live.length === 0 ? (
          <Text fontSize="$2" color="$soft">
            {t('No links yet. Copy link makes one.')}
          </Text>
        ) : (
          <YStack render="ul" gap="$2" m={0} p={0} aria-label={t('Live links')}>
            {live.map((row) => {
              const made = day(row.createdAt, locale)
              return (
              <YStack render="li" key={row.id} gap="$1.5">
                <XStack items="center" justify="space-between" gap="$2">
                  <YStack minW={0}>
                    <Text fontSize="$2" color="$ink" numberOfLines={1}>
                      {t('Link')}
                    </Text>
                    <Text fontSize="$1" color="$soft">
                      {made ? t('Read only · made {date}', { date: made }) : t('Read only')}
                    </Text>
                  </YStack>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void revoke(row.id)}
                    disabled={busy !== null}
                    aria-label={made ? t('Revoke the link made {date}', { date: made }) : t('Revoke the link made earlier')}
                  >
                    {t(busy === row.id ? 'Revoking…' : 'Revoke')}
                  </Button>
                </XStack>
                {(row.viewers ?? []).length === 0 ? (
                  <Text fontSize="$1" color="$soft" paddingInlineStart="$3">
                    {t('Nobody has opened it yet.')}
                  </Text>
                ) : (
                  <YStack render="ul" gap="$1" m={0} paddingInlineStart="$3" aria-label={t('Opened by')}>
                    {row.viewers.map((v) => (
                      <XStack render="li" key={v.id} items="center" justify="space-between" gap="$2">
                        <Text fontSize="$2" color="$ink" numberOfLines={1}>
                          {v.name || t('Someone signed in')}
                        </Text>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void unview(row, v)}
                          disabled={busy !== null}
                          aria-label={v.name ? t('Remove {name}', { name: v.name }) : t('Remove this reader')}
                        >
                          {t(busy === v.id ? 'Removing…' : 'Remove')}
                        </Button>
                      </XStack>
                    ))}
                  </YStack>
                )}
              </YStack>
              )
            })}
          </YStack>
        )}
      </YStack>

      {wrong ? (
        <Text role="alert" fontSize="$2" color={BAD}>
          {wrong}
        </Text>
      ) : null}
    </>
  )
}
