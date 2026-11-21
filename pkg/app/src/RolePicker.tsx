'use client'

// The role picker and its recommended skills (roles.ts, hanzo-inc/app issue 323).
//
// Three ways in, one picker:
//   - `RoleCard`, the new customer's ask: drawn in the sidebar's column for an
//     account made in the last two weeks that has not answered, in place of
//     an interstitial (the owner retired /onboarding's page, 2026-10-29).
//   - Customize's sidebar row "Skills for your role" (Sidebar.tsx).
//   - Settings › General's row beside "Occupation or work role" (hanzo.app's
//     own page, which renders `RoleDialog`).
//
// Choosing a role answers the question (kept on the account, `ROLE_KEY`); the
// skills are only added when the person presses Add, after unticking any they
// don't want. Adding is one activation for the org (connect.ts `install`),
// the write Customize makes, so an org admin's to make.

import { useMemo, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { useIam } from '@hanzo/iam/react'
import { Button, Checkbox, Dialog, DialogContent, DialogTitle, Text, XStack, YStack } from '@hanzo/ui'
import { Check, Sparkles } from 'lucide-react'
import { install } from './connect'
import { usePref } from './pref'
import { useSkills } from './tools'
import { useAccount } from './lib/account'
import { app } from './lib/host'
import { org, role as roleIn, superAdmin } from './lib/session'
import { site } from './where'
import { BAD } from './lib/mix'
import { ELSE, ROLE_KEY, ROLES, SKILLS, SKIP, answered, fresh, listed, nameOf, picked, recommended, role as roleOf, type Role } from './roles'

/** Customize's skills tab, where every added skill can be read, switched off or more added. */
const SKILLS_TAB = '-/customize/skills'
const FOCUS_RING = { outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' } as const

/** The person's answer and the way to change it, shared by whoever draws the picker (usePref). */
export type Answer = readonly [string, (next: string) => void]

type Step = { at: 'pick' } | { at: 'list'; role: Role } | { at: 'done'; role: Role; added: number }

/** The catalogue's own words for a skill, after its "Read …:" title: the detail line under its label. */
export function detail(description: string): string {
  const said = description.includes(':') ? description.slice(description.indexOf(':') + 1) : description
  // The catalogue joins an operation's sentences with ".," and may end on "..".
  const first = said.trim().replace(/\.+$/, '').split(/\.(?:\s|,)/)[0] ?? ''
  return first.trim()
}

/** Whether the reader may switch skills for the org in scope: an owner or admin there, or a SuperAdmin. Unknown is left to the server. */
function mayAdd(): boolean {
  if (superAdmin()) return true
  const r = roleIn(org())
  return r === null || r === 'owner' || r === 'admin'
}

/**
 * The picker itself: roles first, then the chosen role's skills to untick and
 * add in one click. `onClose` ends it (Skip, Not now, Done); `go` moves the app
 * to Customize where the host reads paths, else the page loads there.
 */
export function RolePicker({ onClose, go, answer }: { onClose?: () => void; go?: (address: string) => void; answer?: Answer }) {
  const { t } = useI18n()
  // The card hands in its own copy of the answer, so it hides the moment one is given.
  const own = usePref<string>(ROLE_KEY, '')
  const [saved, save] = answer ?? own
  const [step, setStep] = useState<Step>({ at: 'pick' })
  const [off, setOff] = useState<ReadonlySet<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [wrong, setWrong] = useState<string | null>(null)
  // Skills switched on here, so the list reads them as on before the tool plane is read again.
  const [lit, setLit] = useState<ReadonlySet<string>>(new Set())
  const plane = useSkills()

  // What the tool plane lists, and which of it is on, by the skill's own name.
  const { known, on, about } = useMemo(() => {
    if (!plane.rows) return { known: null, on: lit, about: new Map<string, string>() }
    const known = new Set<string>()
    const on = new Set<string>(lit)
    const about = new Map<string, string>()
    for (const row of plane.rows) {
      const name = nameOf(row.name) || row.name
      known.add(name)
      if (row.activated) on.add(name)
      if (row.description) about.set(name, detail(row.description))
    }
    // A plane that lists none of the map's skills has not read the brand's catalogue (its skills
    // app was cold or away), which is no reason to offer nothing: it reads as not yet known.
    const catalogue = recommended().some((n) => known.has(n))
    return { known: catalogue ? known : null, on, about }
  }, [plane.rows, lit])

  const may = mayAdd()
  const choose = (r: Role) => {
    save(r.id)
    setOff(new Set())
    setWrong(null)
    setStep({ at: 'list', role: r })
  }
  const skip = () => {
    if (!answered(saved)) save(SKIP)
    onClose?.()
  }
  const customize = () => {
    onClose?.()
    if (go) go(app(SKILLS_TAB))
    else if (typeof window !== 'undefined') window.location.assign(site(app(SKILLS_TAB)))
  }

  if (step.at === 'done') {
    return (
      <YStack gap="$3" data-slot="roles-done">
        <XStack items="center" gap="$2">
          <Check size={18} color="var(--primary)" aria-hidden />
          <Text fontSize="$4" fontWeight="600" color="$ink">
            {step.added === 1 ? t('Added 1 skill') : t('Added {n} skills', { n: step.added })}
          </Text>
        </XStack>
        <Text fontSize="$2" color="$soft">
          {t('Every run in your organization can use them now. You can switch any of them off in Customize.')}
        </Text>
        <XStack gap="$2" justify="flex-end" flexWrap="wrap">
          <Button type="button" variant="outline" size="sm" data-slot="roles-customize" onClick={customize}>
            {t('Open Customize')}
          </Button>
          <Button type="button" size="sm" data-slot="roles-close" onClick={() => onClose?.()}>
            {t('Done')}
          </Button>
        </XStack>
      </YStack>
    )
  }

  if (step.at === 'list') {
    const r = step.role
    const shown = listed(r, known)
    const adding = picked(shown, off, on)
    const allOn = shown.length > 0 && shown.every((n) => on.has(n))
    const toggle = (name: string, next: boolean) =>
      setOff((was) => {
        const now = new Set(was)
        if (next) now.delete(name)
        else now.add(name)
        return now
      })
    const add = async () => {
      if (!adding.length || busy) return
      setBusy(true)
      setWrong(null)
      try {
        await install(adding)
        setLit((was) => new Set([...was, ...adding]))
        setStep({ at: 'done', role: r, added: adding.length })
      } catch (e) {
        const code = (e as { status?: unknown } | null)?.status
        setWrong(
          code === 403
            ? t('Only an organization admin can add skills. Ask one to add these, or find them in Customize.')
            : t('The skills could not be added. Try again in a moment.'),
        )
      } finally {
        setBusy(false)
      }
    }
    return (
      <YStack gap="$3" data-slot="roles-list" data-role={r.id}>
        <Text fontSize="$2" color="$soft">
          {t('Each skill lets Hanzo read that part of your organization’s work when a task needs it. Untick any you don’t want.')}
        </Text>
        {shown.length === 0 ? (
          <Text fontSize="$2" color="$soft" data-slot="roles-none">
            {t('None of these skills is offered to your organization right now. Browse every skill in Customize.')}
          </Text>
        ) : (
          <YStack gap="$1" maxH={340} overflowY="auto" overflowX="hidden" role="group" aria-label={t('Recommended skills')}>
            {shown.map((name) => {
              const already = on.has(name)
              const ticked = already || !off.has(name)
              const id = `role-skill-${name}`
              return (
                <XStack
                  key={name}
                  data-slot="role-skill"
                  data-skill={name}
                  data-on={already ? '' : undefined}
                  items="center"
                  gap="$2.5"
                  px="$2"
                  py="$1.5"
                  rounded="$3"
                  minH={44}
                  hoverStyle={{ bg: '$hover' }}
                >
                  <Checkbox
                    id={id}
                    checked={ticked}
                    disabled={already || busy}
                    onCheckedChange={(next: boolean | 'indeterminate') => toggle(name, next === true)}
                    aria-label={t(SKILLS[name] ?? name)}
                  />
                  <YStack flex={1} minW={0} render={<label htmlFor={id} />} cursor={already ? 'default' : 'pointer'}>
                    <Text fontSize="$2" fontWeight="500" color="$ink" numberOfLines={1}>
                      {t(SKILLS[name] ?? name)}
                    </Text>
                    {about.get(name) ? (
                      <Text fontSize="$1" color="$soft" numberOfLines={1}>
                        {about.get(name)}
                      </Text>
                    ) : null}
                  </YStack>
                  {already ? (
                    <Text fontSize="$1" color="$soft" shrink={0}>
                      {t('Added')}
                    </Text>
                  ) : null}
                </XStack>
              )
            })}
          </YStack>
        )}
        {!may ? (
          <Text fontSize="$1" color="$soft" data-slot="roles-admin">
            {t('Only an organization admin can add skills. Ask one to add these, or find them in Customize.')}
          </Text>
        ) : null}
        {wrong ? (
          <Text fontSize="$1" color={BAD} role="alert" data-slot="roles-wrong">
            {wrong}
          </Text>
        ) : null}
        <XStack gap="$2" justify="space-between" items="center" flexWrap="wrap">
          <Button type="button" variant="ghost" size="sm" data-slot="roles-back" onClick={() => setStep({ at: 'pick' })} disabled={busy}>
            {t('Change role')}
          </Button>
          <XStack gap="$2" items="center">
            <Button type="button" variant="outline" size="sm" data-slot="roles-later" onClick={() => onClose?.()} disabled={busy}>
              {t('Not now')}
            </Button>
            {allOn ? (
              <Button type="button" size="sm" data-slot="roles-close" onClick={() => onClose?.()}>
                {t('Done')}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                data-slot="roles-add"
                disabled={!may || busy || adding.length === 0}
                onClick={() => void add()}
              >
                {busy
                  ? t('Adding…')
                  : adding.length === 1
                    ? t('Add 1 skill')
                    : t('Add {n} skills', { n: adding.length })}
              </Button>
            )}
          </XStack>
        </XStack>
      </YStack>
    )
  }

  const current = roleOf(saved)
  return (
    <YStack gap="$3" data-slot="roles-pick">
      <Text fontSize="$2" color="$soft">
        {t('Pick the one closest to your work and Hanzo recommends skills for it. You can change it any time in Settings.')}
      </Text>
      <XStack flexWrap="wrap" gap="$2" role="group" aria-label={t('Roles')}>
        {[...ROLES, ELSE].map((r) => {
          const chosen = current?.id === r.id
          return (
            <YStack
              key={r.id}
              render="button"
              data-slot="role"
              data-role={r.id}
              aria-pressed={chosen}
              onClick={() => choose(r)}
              flexBasis="calc(50% - 4px)"
              grow={1}
              $max-sm={{ flexBasis: '100%' }}
              minW={0}
              minH={56}
              gap="$0.5"
              px="$3"
              py="$2"
              rounded="$4"
              borderWidth={1}
              borderColor={chosen ? 'var(--primary)' : '$borderColor'}
              bg="$raised"
              items="flex-start"
              cursor="pointer"
              hoverStyle={{ bg: '$hover' }}
              focusVisibleStyle={FOCUS_RING}
            >
              <Text fontSize="$2" fontWeight="600" color="$ink">
                {t(r.label)}
              </Text>
              <Text fontSize="$1" color="$soft" text="start">
                {t(r.line)}
              </Text>
            </YStack>
          )
        })}
      </XStack>
      <XStack justify="flex-end">
        <Button type="button" variant="ghost" size="sm" data-slot="role-skip" onClick={skip}>
          {t('Skip')}
        </Button>
      </XStack>
    </YStack>
  )
}

/** The picker in a dialog: what the card, Customize's row and Settings open. */
export function RoleDialog({ open, onOpenChange, go, answer }: { open: boolean; onOpenChange: (open: boolean) => void; go?: (address: string) => void; answer?: Answer }) {
  const { t } = useI18n()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent maxW={560} rounded="$6" gap="$4" p="$5" data-slot="roles">
        <DialogTitle>
          <XStack items="center" gap="$2">
            <Sparkles size={20} color="var(--primary)" aria-hidden />
            <Text fontSize="$5" fontWeight="600" color="$ink">
              {t('Skills for your role')}
            </Text>
          </XStack>
        </DialogTitle>
        {/* Mounted only while open, so each opening starts at the roles. */}
        {open ? <RolePicker go={go} answer={answer} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

/**
 * The new customer's ask, in the sidebar's column: shown to an account made in
 * the last two weeks (`fresh`) until it picks a role or skips, on every machine
 * (the answer is the account's). Nothing for anyone else.
 */
export function RoleCard({ go, mt }: { go?: (address: string) => void; mt?: '$2' }) {
  const { t } = useI18n()
  const { isAuthenticated, accessToken } = useIam()
  const { user } = useAccount()
  const [saved, save, ready] = usePref<string>(ROLE_KEY, '')
  const [open, setOpen] = useState(false)

  const signed = isAuthenticated && Boolean(accessToken)
  if (!signed || !ready || !fresh(user?.joinedDate) || (answered(saved) && !open)) return null

  return (
    <>
      <YStack
        data-slot="role-card"
        mt={mt}
        role="region"
        aria-label={t('Skills for your role')}
        gap="$2"
        p="$3"
        rounded="$4"
        borderWidth={1}
        borderColor="$borderColor"
        bg="$raised"
        width="100%"
        minW={0}
      >
        <XStack items="center" gap="$1.5" minW={0}>
          <Sparkles size={15} color="var(--primary)" aria-hidden />
          <Text fontSize="$2" fontWeight="600" color="$ink" numberOfLines={1}>
            {t('What do you do?')}
          </Text>
        </XStack>
        <Text fontSize="$1" color="$soft">
          {t('Pick your role and Hanzo recommends skills for it.')}
        </Text>
        <XStack gap="$1.5" flexWrap="wrap">
          <Button type="button" size="sm" data-slot="role-card-choose" onClick={() => setOpen(true)}>
            {t('Choose your role')}
          </Button>
          <Button type="button" size="sm" variant="ghost" data-slot="role-card-skip" onClick={() => save(SKIP)}>
            {t('Skip')}
          </Button>
        </XStack>
      </YStack>
      <RoleDialog open={open} onOpenChange={setOpen} go={go} answer={[saved, save]} />
    </>
  )
}
