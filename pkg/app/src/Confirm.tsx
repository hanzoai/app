'use client'

// ONE CONFIRM for a press that cannot be taken back or that spends: a plain
// title, one sentence of what happens, Cancel first (it holds the focus the
// dialog opens with, so Enter never says yes by accident), then the yes.
//
// `useSpend` puts it in front of a one-click spend: what will start, and that it
// counts against the plan or credits. No price is named: the app does not know
// one it could stand behind. "Don't ask again for this" is remembered per kind
// of spend (lib/spend), so one yes never waves another kind through.

import { Fragment, useCallback, useId, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogTitle, Label, XStack } from '@hanzo/ui'
import { fromBuild, rememberable, trust, trusted, type Spend } from './lib/spend'
import type { Spend as BuildSpend } from '@hanzo/dev/builder'

/**
 * Whether a key belongs to an open confirm: Escape there closes the confirm alone,
 * never the panel or dialog it stands over (Share's panel, a bot's computer).
 */
export const confirming = (): boolean => typeof document !== 'undefined' && document.querySelector('[data-slot="confirm"]') !== null

export function Confirm({
  open,
  title,
  body,
  detail,
  yes,
  danger = false,
  remember,
  onYes,
  onOpenChange,
  onCloseAutoFocus,
}: {
  open: boolean
  title: string
  /** What happens, in one sentence: the dialog's description, which a screen reader says with its title. */
  body: string
  /** What goes with it, drawn under the sentence (thread.tsx's list of the chats). */
  detail?: ReactNode
  /** The yes button's words: the act itself ("Start machine", "Delete"). */
  yes: string
  /** Red, for a press that destroys something. */
  danger?: boolean
  /** Draws "Don't ask again for this"; called with whether it was ticked. */
  remember?: (again: boolean) => void
  onYes: () => void
  onOpenChange: (open: boolean) => void
  /** Where focus goes when it shuts (a list's row, not the page). */
  onCloseAutoFocus?: (e: Event) => void
}) {
  const { t } = useI18n()
  const box = useId()
  // What had the focus when the confirm opened: it gets it back when the confirm closes.
  const from = useRef<HTMLElement | null>(null)
  const [skip, setSkip] = useState(false)
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setSkip(false)
        onOpenChange(o)
      }}
    >
      <DialogContent
        data-slot="confirm"
        maxW={440}
        width="calc(100vw - 24px)"
        rounded="$6"
        gap="$3"
        onCloseAutoFocus={(e: Event) => {
          if (onCloseAutoFocus) return onCloseAutoFocus(e)
          e.preventDefault()
          if (from.current?.isConnected) from.current.focus()
        }}
        onOpenAutoFocus={(e: Event) => {
          const was = document.activeElement as HTMLElement | null
          if (was && !(e.currentTarget as HTMLElement | null)?.contains(was)) from.current = was
          // Cancel takes the focus, not the first control (the checkbox): Enter never says yes.
          const cancel = (e.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>('[data-slot="confirm-cancel"]')
          if (!cancel) return
          e.preventDefault()
          cancel.focus()
        }}
      >
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription fontSize="$2" color="$soft">
          {body}
        </DialogDescription>
        {detail}
        {remember ? (
          <XStack items="center" gap="$2">
            <Checkbox id={box} data-slot="confirm-remember" checked={skip} onCheckedChange={(v) => setSkip(v === true)} />
            <Label htmlFor={box} fontSize="$2" color="$ink">
              {t("Don't ask again for this")}
            </Label>
          </XStack>
        ) : null}
        <XStack gap="$2" justify="flex-end" flexWrap="wrap">
          <Button
            size="sm"
            variant="outline"
            rounded={999}
            borderColor="var(--border-strong)"
            focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
            $max-sm={{ minH: 44 }}
            data-slot="confirm-cancel"
            onPress={() => onOpenChange(false)}
          >
            {t('Cancel')}
          </Button>
          <Button
            size="sm"
            rounded={999}
            {...(danger
              ? { bg: 'var(--state-error)', borderColor: 'var(--state-error)', color: 'var(--pure-white)', hoverStyle: { bg: 'var(--state-error)', opacity: 0.9 } }
              : null)}
            focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
            $max-sm={{ minH: 44 }}
            data-slot="confirm-yes"
            onPress={() => {
              // Once: a second press while the dialog closes would start it twice.
              if (!open) return
              remember?.(skip)
              setSkip(false)
              onYes()
              onOpenChange(false)
            }}
          >
            {yes}
          </Button>
        </XStack>
      </DialogContent>
    </Dialog>
  )
}

/**
 * What one press says beyond its kind: its own title and sentence, and `once`
 * when no remembered yes may cover it (nor offer to be remembered), however
 * the kind is otherwise treated.
 */
export interface Asked {
  title?: string
  what?: string
  yes?: string
  once?: boolean
  /** The kind this press is remembered as, when the hook's own does not say (one hook asking for many kinds). */
  as?: Spend
  /**
   * When the question stops counting (a `Date.now()` time): the dialog closes
   * itself then, so no yes can be given after it, and `late` runs instead of
   * `cancel`.
   */
  expires?: number
  late?: () => void
}

/**
 * Asks before a one-click spend of this kind, unless the person said not to.
 * A null kind remembers nothing unless the press names its own (`as`).
 * `ask(run, cancel, asked)` runs `run` once they say yes (at once when trusted
 * and the press may be remembered), or `cancel` when they say no; draw `dialog`
 * anywhere in the caller's tree.
 */
export function useSpend(
  kind: Spend | null,
  title: string,
  what: string,
  yes: string,
): { ask: (run: () => void, cancel?: () => void, asked?: Asked) => void; dialog: ReactNode } {
  const { t } = useI18n()
  const waiting = useRef<{ run: () => void; cancel?: () => void } | null>(null)
  const deadline = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const [asked, setAsked] = useState<Asked>({})
  // THE ONE LAYERING RULE: a spend question is above whatever is open when it is asked. gui gives
  // every dialog the same z-index and paints them in the order their portals were MOUNTED, so a
  // question mounted with its page sat under a window opened later ("Need more usage?" over
  // "Turn on usage credits?"). Each ask mounts it afresh, last, on top.
  const [asking, setAsking] = useState(0)
  /** The waiting question, taken: answered once, its deadline off. */
  const take = () => {
    clearTimeout(deadline.current)
    const held = waiting.current
    waiting.current = null
    return held
  }
  const ask = useCallback(
    (run: () => void, cancel?: () => void, about: Asked = {}) => {
      const as = about.as ?? kind
      if (!about.once && as && trusted(as)) return run()
      // A second ask while one waits answers the first no: one dialog, one spend.
      take()?.cancel?.()
      waiting.current = { run, cancel }
      if (about.expires !== undefined) {
        deadline.current = setTimeout(() => {
          const held = waiting.current
          if (!held) return
          take()
          setOpen(false)
          ;(about.late ?? held.cancel)?.()
        }, Math.max(0, about.expires - Date.now()))
      }
      setAsked(about)
      setAsking((n) => n + 1)
      setOpen(true)
    },
    [kind],
  )
  const remembered = asked.as ?? kind
  const dialog = (
    <Confirm
      key={asking}
      open={open}
      title={asked.title ?? title}
      body={`${asked.what ?? what} ${t('It counts against your plan or your credits.')}`}
      yes={asked.yes ?? yes}
      remember={remembered !== null && rememberable(remembered) && !asked.once ? (again) => again && trust(remembered) : undefined}
      onYes={() => take()?.run()}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) return
        take()?.cancel?.()
      }}
    />
  )
  return { ask, dialog }
}

/**
 * @hanzo/build's spend question (`Host.confirm`), asked through the app's one `useSpend`: the
 * package's own title, sentence and yes, and a "Don't ask again" only where the package names a
 * key (`again`), kept under that key alone (lib/spend `fromBuild`). A 24/7 bot names none, so it
 * is asked every time. Passed as the host's confirm, it is the package's only asker.
 */
export function useBuildSpend(): { confirm: (spend: BuildSpend) => Promise<boolean>; dialog: ReactNode } {
  const { ask, dialog } = useSpend(null, '', '', '')
  const confirm = useCallback(
    (spend: BuildSpend) =>
      new Promise<boolean>((answer) => {
        const as = fromBuild(spend.again)
        ask(() => answer(true), () => answer(false), { title: spend.title, what: spend.what, yes: spend.yes, ...(as ? { as } : { once: true }) })
      }),
    [ask],
  )
  return { confirm, dialog }
}

/** What Design and Flow (@hanzo/studio) spend on, each its own kind in lib/spend. */
export type Making = Extract<Spend, 'design-image' | 'design-video' | 'design-gpu' | 'flow-run' | 'flow-mutate'>

/**
 * Design's and Flow's paid calls through the one confirm. @hanzo/studio is handed `spend` on its host and
 * awaits it where each paid call starts: true once the person says yes (at once for a kind they trusted),
 * false for no. A kind not listed here is never started, so a call the app does not know cannot spend.
 */
export function useMaking(): { spend: (kind: string, asked?: Asked) => Promise<boolean>; dialog: ReactNode } {
  const { t } = useI18n()
  const asks: Record<Making, ReturnType<typeof useSpend>> = {
    'design-image': useSpend('design-image', t('Make this picture?'), t('This makes one picture.'), t('Make it')),
    'design-video': useSpend('design-video', t('Make this clip?'), t('This makes one short video clip, which keeps rendering if you leave this page.'), t('Make clip')),
    'design-gpu': useSpend('design-gpu', t('Render on your GPU?'), t("This renders on your organization's GPU, where it keeps going if you leave this page."), t('Start render')),
    'flow-run': useSpend('flow-run', t('Run this flow?'), t('This queues the flow on the GPU, where it keeps running if you leave this page.'), t('Run flow')),
    'flow-mutate': useSpend('flow-mutate', t('Ask Copilot to change the flow?'), t('This sends your words and the flow to a model.'), t('Ask Copilot')),
  }
  // The host that carries `spend` is memoized, so `spend` stays one function and reads the latest asks.
  const latest = useRef(asks)
  latest.current = asks
  const spend = useCallback(
    (kind: string, asked?: Asked) =>
      new Promise<boolean>((done) => {
        const one = latest.current[kind as Making]
        if (!one) return done(false)
        one.ask(() => done(true), () => done(false), asked)
      }),
    [],
  )
  return { spend, dialog: Object.values(asks).map((a, i) => <Fragment key={i}>{a.dialog}</Fragment>) }
}
