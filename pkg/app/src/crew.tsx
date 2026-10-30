'use client'

// Who a conversation can hold, and the sheet that makes one more.
//
// The composer's `+` › Agents (`useAgentShelf`) lists the org's agents, the
// default cast first: the core team hanzoai/personas publishes (team.ts), drawn
// for an org that keeps no row of its own for a member. Picking one adds it to
// the conversation that is open, and the reply comes back in each voice in the
// room; picking it again lets it out. The page does not move. Create agent and
// Browse personas open the sheet (`Hire`, mounted once by `AgentMaker`); Manage
// agents is Dev's Customize › Agents.
//
// The crew strip (`Crew`) is the same list as faces, on Home: pressing one opens
// a chat with that character there (`to`).
//
// Its words go through `t`; an agent's name, a persona's name and line, and the
// core team's parts (team.ts) are drawn as they are written. The spending limit
// is one sentence with its fields in it (`Sentence`), so a translation places
// the fields where its own word order puts them.

import { phrase, pieces, type Say } from '@hanzo/i18n'
import { useI18n } from '@hanzo/i18n/react'
import { Fragment, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useRooms } from './host'
import { ArrowLeft, Camera, Check, Plus, Sparkles, Upload, Users } from 'lucide-react'
import { generateImages } from '@hanzo/ai'
import { useAgents, useModels } from '@hanzo/ai/react'
import { Box, Button, Input, Text, Textarea, View, XStack, YStack } from '@hanzo/ui'
import { useAi } from './lib/ai'
import { mark } from './lib/mark'
import { reach } from './lib/reach'
import { Face } from './cast'
import { useOpen } from './open'
import { TEAM, called, member } from './team'
import { FIGURES, MEMOJI, PAINTER, draft, line, ordered, title, type Figure, type Shelf } from './agents'
import { app, go } from './lib/host'
import { site } from './where'
import { bare } from './lib/bare'
import { BAD, mix } from './lib/mix'

/** One disc's edge, and the name under it. */
const DISC = 48

const FIELD = {
  width: '100%',
  bg: 'transparent',
  borderWidth: 1,
  borderColor: 'var(--border)',
  rounded: 'var(--radius-md)',
  px: 10,
  py: 8,
  outlineStyle: 'none',
  color: 'inherit',
  fontSize: '$2',
} as const
/** The camera's veil over a face already chosen. */
const VEIL = mix('var(--pure-black)', 55, 'srgb')

/** Fired on `window` when the sheet below makes an agent. */
const MADE = 'hanzo:agent:made'

/**
 * The org's agents, read again whenever the sheet makes one. `useAgents` holds
 * one list per caller, so the strip, the chat header and the sheet each hold
 * their own; the event is how a new agent reaches every one of them.
 */
export function useCrew(): ReturnType<typeof useAgents> {
  const agents = useAgents()
  const { reload } = agents
  useEffect(() => {
    window.addEventListener(MADE, reload)
    return () => window.removeEventListener(MADE, reload)
  }, [reload])
  return agents
}

/** The house crew's names, which a reply may be split by even after one has left the room. */
export const HOUSE: readonly string[] = TEAM.map((one) => one.name)

/** Two names for one agent differ only in case ("Dev" and "dev"). */
const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()

// THE SHEET IS OPENED FROM A MENU AND DRAWN BESIDE THE COMPOSER, two places
// that share no parent, so whether it is open lives here, outside React, the
// way open.ts keeps the conversation.
let making: 'new' | 'persona' | null = null
const heard = new Set<() => void>()
const listen = (f: () => void) => {
  heard.add(f)
  return () => void heard.delete(f)
}

/** Opens the New agent sheet, blank or on its persona list; null shuts it. */
export function make(how: 'new' | 'persona' | null): void {
  making = how
  for (const f of heard) f()
}

/**
 * The New agent sheet, wherever the host mounts this once (beside the
 * composer). It is drawn while `make` holds it open, and an agent it makes joins
 * the conversation that is open.
 */
export function AgentMaker() {
  const how = useSyncExternalStore(listen, () => making, () => null)
  const { agents: room, openAgent } = useOpen()
  if (!how) return null
  return (
    <Hire
      start={how === 'persona'}
      onClose={() => make(null)}
      onMade={(name) => {
        if (!room.some((there) => same(there, name))) openAgent(name)
      }}
    />
  )
}

/**
 * The composer's `+` › Agents: the org's agents, the default cast first, each
 * by its face; on is in the open conversation, and a pick toggles it there.
 */
export function useAgentShelf(): Shelf {
  const { t } = useI18n()
  const { agents, loading, error } = useCrew()
  const { agents: room, openAgent } = useOpen()
  const pathed = useRooms().path !== null
  return {
    rows: ordered(agents).map((one) => ({
      id: one.name,
      label: called(one.name),
      icon: <Face src={one.avatar} emoji={(one as { emoji?: string }).emoji} name={one.name} size={16} />,
      note: member(one.name)?.role ?? (one as { description?: string }).description,
      on: room.some((there) => same(there, one.name)),
    })),
    pick: (id) => openAgent(called(id)),
    loading,
    error: error ? reach(error) : null,
    search: t('Search agents'),
    empty: t('No agents yet. Add the default team from Manage agents.'),
    create: { label: t('Create agent'), onPress: () => make('new') },
    // Dev's Customize › Agents: a move inside the app where the host reads the
    // path (hanzo.ai), else Dev on hanzo.ai, as Chat's Create file or site goes.
    manage: { label: t('Manage agents'), onPress: () => (pathed ? go(app('-/customize/agents')) : window.location.assign(site(app('-/customize/agents')))) },
    browse: { label: t('Browse personas'), onPress: () => make('persona') },
  }
}

/**
 * `to` is the chat a press opens, for a strip on a page that is not one. Absent,
 * the strip sits under a chat and a press changes who is in it.
 */
export function Crew({ to }: { to?: string } = {}) {
  const { t } = useI18n()
  const { agents } = useCrew()
  const { agents: room, openAgent, withAgents } = useOpen()
  const { router, route } = useRooms()
  const here = route
  const [hiring, setHiring] = useState(false)

  const talk = (name: string) => {
    if (!to) return openAgent(name)
    withAgents([name])
    if (here !== to) router.push(to)
  }

  return (
    <>
      <XStack
        items="flex-start"
        flexWrap="nowrap"
        overflowX="auto"
        overflowY="hidden"
        gap="$2.5"
        px="$4"
        py="$3"
        width="100%"
        maxW={820}
        mx="auto"
        data-slot="crew"
        {...bare}
        role="group"
        aria-label={t('Agents')}
      >
        {ordered(agents).map((one) => {
          const name = called(one.name)
          const on = room.some((there) => there.toLowerCase() === one.name.toLowerCase())
          return (
            <Box
              key={one.id || one.name}
              render="button"
              onClick={() => talk(name)}
              aria-pressed={on}
              aria-label={t('Chat with {name}', { name })}
              title={to ? t('Chat with {name}', { name }) : on ? t('Remove {name} from this chat', { name }) : t('Add {name} to this chat', { name })}
              shrink={0}
            >
              <YStack items="center" gap="$1.5" width={68}>
                <YStack
                  position="relative"
                  rounded={DISC / 2 + 2}
                  p={2}
                  borderWidth={1.5}
                  borderColor={on ? '$ink' : 'transparent'}
                  hoverStyle={{ borderColor: on ? '$ink' : '$borderColor' }}
                >
                  <Face
                    src={(one as { avatar?: string }).avatar}
                    emoji={(one as { emoji?: string }).emoji}
                    name={one.name}
                    size={DISC}
                  />
                  {/* In the chat: a mark on the disc as well as the ring, so the
                      state is not carried by one outline alone. */}
                  {on ? (
                    <YStack
                      aria-hidden
                      position="absolute"
                      b={-2}
                      insetInlineEnd={-2}
                      width={18}
                      height={18}
                      rounded={9}
                      bg="$ink"
                      borderWidth={2}
                      borderColor="$background"
                      items="center"
                      justify="center"
                    >
                      <Check size={10} strokeWidth={3} color="var(--background)" />
                    </YStack>
                  ) : null}
                </YStack>
                <Text fontSize="$1" color={on ? '$ink' : '$soft'} numberOfLines={1} maxW={68}>
                  {name}
                </Text>
              </YStack>
            </Box>
          )
        })}
        {/* The outline that makes one more comes after the team, not before it. */}
        <Box
          render="button"
          onClick={() => setHiring(true)}
          aria-label={t('New agent')}
          aria-haspopup="dialog"
          shrink={0}
        >
          <YStack items="center" gap="$1.5" width={68}>
            <YStack
              width={DISC}
              height={DISC}
              rounded={DISC / 2}
              borderWidth={1.5}
              borderStyle="dashed"
              borderColor="$soft"
              items="center"
              justify="center"
              hoverStyle={{ borderColor: '$ink', bg: '$raised' }}
            >
              <Plus size={18} aria-hidden />
            </YStack>
            <Text fontSize="$1" color="$soft" numberOfLines={1}>
              {t('New')}
            </Text>
          </YStack>
        </Box>
      </XStack>
      {hiring ? <Hire onClose={() => setHiring(false)} onMade={talk} /> : null}
    </>
  )
}

/** The agents API's name rule (cloud apps/agents `nameRE`), checked before the request. */
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

/** A dollar amount as the agents API counts money: whole micro-dollars. */
const micro = (dollars: string): number => Math.round(Number(dollars) * 1_000_000)

/** The windows a spending limit resets on (cloud apps/agents `validPeriod`). */
const PERIODS: readonly (readonly ['day' | 'week' | 'month', string])[] = [
  ['day', phrase('a day')],
  ['week', phrase('a week')],
  ['month', phrase('a month')],
]

type Period = (typeof PERIODS)[number][0]

/** The fields of the sheet a refusal can concern. */
type Field = 'name' | 'model' | 'picture' | 'does' | 'budget' | 'form'

/**
 * A refusal from POST /v1/agents, in plain words, and the field it concerns.
 * The platform's sentence is kept where it already reads plainly; the budget's
 * refusals name request fields (`cap_micro_usd`), so those are said in dollars.
 */
function refusal(e: unknown, t: Say): { field: Field; text: string } {
  const text = reach(e)
  const status = (e as { status?: number } | null)?.status
  if (/cap_micro_usd/.test(text)) return { field: 'budget', text: t('Set a spending limit above $0.') }
  if (/max_task_micro_usd cannot exceed/.test(text))
    return { field: 'budget', text: t('The most one task may spend cannot be more than the spending limit.') }
  if (/max_task_micro_usd/.test(text)) return { field: 'budget', text: t('Set the most one task may spend, above $0.') }
  if (/\bperiod\b/.test(text)) return { field: 'budget', text: t('Choose a day, a week or a month for the spending limit.') }
  if (status === 409 || /\bname\b/i.test(text)) return { field: 'name', text }
  if (/\bmodel\b/i.test(text)) return { field: 'model', text }
  if (/avatar|image|emoji/i.test(text)) return { field: 'picture', text }
  if (/instructions/i.test(text)) return { field: 'does', text: t('What it does is too long. Shorten it.') }
  return { field: 'form', text }
}

/**
 * One sentence with fields standing in it — `Up to ${amount} {period}` — drawn
 * in the reader's language: its words as text, each `{name}` the field `fields`
 * names, where the translation puts it. `source` is written through `phrase`.
 */
function Sentence({ source, fields }: { source: string; fields: Record<string, ReactNode> }) {
  const { messages } = useI18n()
  return (
    <>
      {pieces(messages, source).map((piece, i) =>
        typeof piece === 'string' ? (
          piece.trim() ? (
            <Text key={i} fontSize="$2" color="$soft">
              {piece.trim()}
            </Text>
          ) : null
        ) : (
          <Fragment key={i}>{fields[piece.name]}</Fragment>
        ),
      )}
    </>
  )
}

/** The budget's two lines, each one sentence around its fields. */
const UP_TO = phrase('Up to ${amount} {period}')
const AT_MOST = phrase('At most ${amount} on one task')

/** A field's own refusal, under it, announced when it appears. */
function Said({ id, text }: { id: string; text: string | null }) {
  if (!text) return null
  return (
    <Text id={id} role="alert" fontSize="$2" color={BAD}>
      {text}
    </Text>
  )
}

/** A file the host serves, as text; a refusal says which and why. */
async function text(path: string): Promise<string> {
  const r = await fetch(path)
  if (!r.ok) throw new Error(`${path} did not load (${r.status}).`)
  return r.text()
}

/** The roster, read once a page when the list first opens; a failed read is asked again next time. */
let roster: Promise<Figure[]> | null = null
const figures = (): Promise<Figure[]> =>
  (roster ??= text(`${FIGURES}/index.json`)
    .then((t) => JSON.parse(t) as Figure[])
    .catch((e) => {
      roster = null
      throw e
    }))

/** How many matches the list draws; typing narrows the rest. */
const SHOWN = 50

/**
 * Start from a persona: @hanzo/personas' figures by name and one line, the ones
 * with a written PERSONA.md first, searched by either.
 */
function Figures({ onPick }: { onPick: (f: Figure) => void }) {
  const { t } = useI18n()
  const [all, setAll] = useState<Figure[] | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [q, setQ] = useState('')
  useEffect(() => {
    let live = true
    figures().then(
      (list) => live && setAll([...list].sort((a, b) => Number(!a.called) - Number(!b.called))),
      (e) => live && setFailed(reach(e)),
    )
    return () => {
      live = false
    }
  }, [])
  const needle = q.trim().toLowerCase()
  const found = (all ?? []).filter((f) => !needle || `${title(f)} ${line(f)}`.toLowerCase().includes(needle))
  return (
    <YStack gap="$2">
      <Input
        value={q}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
        placeholder={all ? t('Search {n} figures', { n: all.length.toLocaleString() }) : t('Search figures')}
        aria-label={t('Search personas')}
        autoFocus
      />
      <YStack maxH={360} overflowY="auto" overflowX="hidden" role="group" aria-label={t('Personas')}>
        {found.slice(0, SHOWN).map((f) => (
          <YStack
            key={f.slug}
            render="button"
            onClick={() => onPick(f)}
            items="flex-start"
            gap={2}
            px="$2"
            py="$2"
            rounded="$3"
            cursor="pointer"
            hoverStyle={{ bg: '$raised' }}
            focusVisibleStyle={{ bg: '$raised' }}
          >
            <Text fontSize="$3" fontWeight="600" color="$ink" numberOfLines={1}>
              {title(f)}
            </Text>
            <Text fontSize="$2" color="$soft" numberOfLines={1}>
              {line(f)}
            </Text>
          </YStack>
        ))}
      </YStack>
      <Text fontSize="$2" color={failed ? BAD : '$soft'} role={failed ? 'alert' : undefined}>
        {failed ??
          (!all
            ? t('Reading the personas…')
            : !found.length
              ? t('No figure matches.')
              : found.length > SHOWN
                ? t('{shown} of {n} shown. Type to narrow them.', { shown: SHOWN, n: found.length.toLocaleString() })
                : null)}
      </Text>
    </YStack>
  )
}

/**
 * The sheet that makes an agent.
 *
 * A name, a mind and a spending limit are what the agents API requires; what it
 * does becomes its instructions; the likeness is whichever the maker gives — a
 * photo uploaded onto the round picture (pressed, or dropped on), or a face
 * described and drawn by Hanzo's image model (`PAINTER`), one call per press of
 * Draw or Regenerate. An agent created with neither a picture nor an emoji has
 * one drawn then, once, from the description or else its name. Every face goes
 * through `mark`, the one crop every saved face takes, and is kept as the row's
 * `avatar`. The row keeps at most one of a picture and an emoji, so choosing one
 * clears the other here too.
 *
 * Start from a persona fills the name, the instructions and the face's
 * description from a figure of @hanzo/personas' roster (agents.ts `draft`);
 * `start` opens the sheet on that list.
 *
 * Create stays off until the required fields are filled in the API's own
 * terms, and a refusal is said in plain words under the field it concerns.
 *
 * EXPORTED, because Contacts adds agents too and there is one way to make one.
 */
export function Hire({ onClose, onMade, start = false }: { onClose: () => void; onMade: (name: string) => void; start?: boolean }) {
  const { t } = useI18n()
  const { create } = useAgents()
  const { models } = useModels()
  const { client } = useAi()
  const [name, setName] = useState('')
  const [does, setDoes] = useState('')
  const [model, setModel] = useState('enso')
  const [look, setLook] = useState('')
  const [avatar, setAvatar] = useState('')
  const [emoji, setEmoji] = useState('')
  const [cap, setCap] = useState('5')
  const [task, setTask] = useState('1')
  const [period, setPeriod] = useState<Period>('month')
  const [busy, setBusy] = useState<'draw' | 'make' | null>(null)
  const [wrong, setWrong] = useState<{ field: Field; text: string } | null>(null)
  const [over, setOver] = useState(false)
  const [lit, setLit] = useState(false)
  const [choosing, setChoosing] = useState(start)
  /** A drawing failed on Create, so the next press makes the agent without one. */
  const [faceless, setFaceless] = useState(false)
  const picking = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (choosing) setChoosing(false)
      else onClose()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose, choosing])

  // WHAT CREATE WAITS FOR, in the API's own terms, so a request it would refuse
  // is never sent. Each rule names the field it belongs to.
  const called = name.trim()
  const nameWrong = !called ? null : NAME.test(called) ? null : t('Use letters, digits, dots, dashes or underscores, starting with a letter or digit, up to 64.')
  const capOk = Number.isFinite(Number(cap)) && micro(cap) > 0
  const taskOk = Number.isFinite(Number(task)) && micro(task) > 0
  const budgetWrong = !capOk
    ? t('Set a spending limit above $0.')
    : !taskOk
      ? t('Set the most one task may spend, above $0.')
      : micro(task) > micro(cap)
        ? t('The most one task may spend cannot be more than the spending limit.')
        : null
  const ready = Boolean(called) && !nameWrong && !budgetWrong && Boolean(model)
  const shown = (field: Field): string | null => (wrong?.field === field ? wrong.text : null)

  const pick = async (file: File | undefined) => {
    if (!file) return
    setWrong(null)
    try {
      setAvatar(await mark(file))
      setEmoji('')
    } catch (e) {
      setWrong({ field: 'picture', text: reach(e) })
    }
  }

  /** What a drawing is of: the description, else the name. */
  const subject = look.trim() || called

  // One call to the image model; `mark` makes the answer the same 256px square
  // every saved picture is, so a drawn face weighs what an uploaded one weighs.
  const paint = async (): Promise<string> => {
    const [image] = await generateImages(client!, `${subject}, ${MEMOJI}`, { model: PAINTER, n: 1, size: '512x512', response_format: 'b64_json' })
    if (!image?.b64_json) throw new Error(t('The image model answered with no picture.'))
    const bytes = Uint8Array.from(atob(image.b64_json), (c) => c.charCodeAt(0))
    const face = await mark(new File([bytes], 'face.png', { type: 'image/png' }))
    setAvatar(face)
    setEmoji('')
    return face
  }

  const draw = async () => {
    if (!client || !subject || busy) return
    setBusy('draw')
    setWrong(null)
    try {
      await paint()
      setFaceless(false)
    } catch (e) {
      setWrong({ field: 'picture', text: reach(e) })
    } finally {
      setBusy(null)
    }
  }

  // A figure fills the sheet: its PERSONA.md is read where one is written.
  const become = async (f: Figure) => {
    setChoosing(false)
    setWrong(null)
    try {
      const md = f.called ? await text(`${FIGURES}/${f.slug}.md`) : null
      const d = draft(f, md)
      setName(d.name)
      setDoes(d.does)
      setLook(d.look)
      setFaceless(false)
    } catch (e) {
      setWrong({ field: 'form', text: reach(e) })
    }
  }

  const make = async () => {
    if (!ready || busy) return
    setBusy('make')
    setWrong(null)
    // NO PICTURE CHOSEN, SO ONE IS DRAWN, once. A drawing that fails says why,
    // and the next press makes the agent without one.
    let face = avatar
    if (!face && !emoji.trim() && !faceless && client) {
      try {
        face = await paint()
      } catch (e) {
        setWrong({ field: 'picture', text: t('{reason} Press Create again to make {name} without a picture.', { reason: reach(e).replace(/[.!?]?$/, '.'), name: called }) })
        setFaceless(true)
        setBusy(null)
        return
      }
    }
    // The budget fields are the agents API's (cloud apps/agents createAgentIn);
    // @hanzo/ai 0.6.16's AgentCreateParams predates them.
    const body: Parameters<typeof create>[0] & { cap_micro_usd: number; max_task_micro_usd: number; period: Period } = {
      name: called,
      model,
      ...(does.trim() ? { instructions: does.trim() } : {}),
      ...(face ? { avatar: face } : emoji.trim() ? { emoji: emoji.trim() } : {}),
      cap_micro_usd: micro(cap),
      max_task_micro_usd: micro(task),
      period,
    }
    try {
      await create(body)
      window.dispatchEvent(new Event(MADE))
      onMade(called)
      onClose()
    } catch (e) {
      setWrong(refusal(e, t))
    } finally {
      setBusy(null)
    }
  }

  const face = avatar ? (
    <View render={<img src={avatar} alt="" />} width="100%" height="100%" objectFit="cover" />
  ) : emoji ? (
    <Text fontSize={36} lineHeight={40}>
      {emoji}
    </Text>
  ) : null

  return (
    <Box
      position="fixed"
      inset={0}
      z="var(--z-modal)"
      display="flex"
      items="center"
      justify="center"
      p="$4"
      bg="$sunken"
      overflowY="auto"
      onClick={(e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <YStack
        role="dialog"
        aria-modal
        aria-labelledby="hire-title"
        width="100%"
        maxW={460}
        gap="$3"
        p="$5"
        rounded="$6"
        borderWidth={1}
        borderColor="$borderColor"
        bg="$background"
      >
        <XStack items="center" justify="space-between" gap="$2" flexWrap="wrap">
          <Text id="hire-title" render="h2" fontSize="$5" fontWeight="600" color="$ink">
            {t(choosing ? 'Start from a persona' : 'New agent')}
          </Text>
          {choosing ? (
            <Button size="sm" variant="ghost" onClick={() => setChoosing(false)}>
              <ArrowLeft size={14} aria-hidden data-i18n-mirror /> {t('Back')}
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setChoosing(true)}>
              <Users size={14} aria-hidden /> {t('Start from a persona')}
            </Button>
          )}
        </XStack>

        {choosing ? (
          <Figures onPick={(f) => void become(f)} />
        ) : (
          <>
            {/* THE PICTURE. The round is where a photo goes: pressed, it opens the
                file picker; a file dropped on it is taken the same way. The camera
                and the words under it say so before anything is chosen, and once a
                picture is set they say Change photo, with Remove beside it. */}
            <XStack items="center" gap="$4" flexWrap="wrap">
              <Box
                render="button"
                onClick={() => picking.current?.click()}
                onMouseEnter={() => setLit(true)}
                onMouseLeave={() => setLit(false)}
                onFocus={() => setLit(true)}
                onBlur={() => setLit(false)}
                onDragOver={(e: React.DragEvent) => {
                  e.preventDefault()
                  setOver(true)
                }}
                onDragLeave={() => setOver(false)}
                onDrop={(e: React.DragEvent) => {
                  e.preventDefault()
                  setOver(false)
                  void pick(e.dataTransfer.files?.[0])
                }}
                aria-label={t(avatar ? 'Change photo' : 'Upload photo')}
                aria-describedby="hire-picture-hint"
                position="relative"
                width={88}
                height={88}
                rounded={9999}
                overflow="hidden"
                shrink={0}
                items="center"
                justify="center"
                bg="$raised"
                borderWidth={2}
                borderStyle={avatar || emoji ? 'solid' : 'dashed'}
                borderColor={over || lit ? '$ink' : '$soft'}
              >
                {face}
                {!face || lit || over ? (
                  <YStack
                    aria-hidden
                    position="absolute"
                    inset={0}
                    items="center"
                    justify="center"
                    gap="$1"
                    bg={face ? VEIL : undefined}
                  >
                    <Camera size={22} color={face ? 'var(--pure-white)' : 'var(--soft, var(--muted-foreground))'} />
                  </YStack>
                ) : null}
              </Box>
              <input
                ref={picking}
                type="file"
                hidden
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={(e) => {
                  void pick(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
              <YStack flex={1} minW={180} gap="$1.5">
                <XStack gap="$2" items="center" flexWrap="wrap">
                  <Button size="sm" variant="outline" onClick={() => picking.current?.click()}>
                    <Upload size={14} aria-hidden /> {t(avatar ? 'Change photo' : 'Upload photo')}
                  </Button>
                  {avatar ? (
                    <Button size="sm" variant="ghost" onClick={() => setAvatar('')}>
                      {t('Remove')}
                    </Button>
                  ) : null}
                </XStack>
                <Text id="hire-picture-hint" fontSize="$2" color="$soft">
                  {t(over ? 'Drop the photo to use it.' : 'Press the circle or drop a photo on it, or Create draws one.')}
                </Text>
              </YStack>
            </XStack>

            <YStack gap="$1.5">
              <Text render="label" htmlFor="hire-look" fontSize="$2" color="var(--soft, var(--muted-foreground))">
                {t('Or describe a face and press Draw')}
              </Text>
              <XStack gap="$1.5" items="center">
                <Box flex={1}>
                  <Input
                    id="hire-look"
                    value={look}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLook(e.target.value)}
                    onKeyDown={(e: React.KeyboardEvent) => {
                      if (e.key === 'Enter') void draw()
                    }}
                    placeholder={t('A calm engineer with round glasses')}
                  />
                </Box>
                <Button size="sm" variant="outline" disabled={busy !== null || !subject || !client} onClick={() => void draw()}>
                  <Sparkles size={14} aria-hidden /> {t(busy === 'draw' ? 'Drawing…' : avatar ? 'Regenerate' : 'Draw')}
                </Button>
              </XStack>
              <XStack gap="$2" items="center">
                <Text render="label" htmlFor="hire-emoji" fontSize="$2" color="var(--soft, var(--muted-foreground))">
                  {t('Or one emoji')}
                </Text>
                <Box width={64}>
                  <Input
                    id="hire-emoji"
                    value={emoji}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setEmoji(e.target.value)
                      if (e.target.value) setAvatar('')
                    }}
                    aria-describedby="hire-picture-wrong"
                  />
                </Box>
              </XStack>
              <Said id="hire-picture-wrong" text={shown('picture')} />
            </YStack>

            <YStack gap="$1.5">
              <Text render="label" htmlFor="hire-name" fontSize="$2" fontWeight="600">
                {t('Name')}
              </Text>
              <Input
                id="hire-name"
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === 'Enter') void make()
                }}
                placeholder={t('Michael')}
                autoFocus
                aria-required="true"
                aria-invalid={Boolean(nameWrong || shown('name'))}
                aria-describedby="hire-name-wrong"
              />
              <Said id="hire-name-wrong" text={nameWrong ?? shown('name')} />
            </YStack>

            <YStack gap="$1.5">
              <Text render="label" htmlFor="hire-model" fontSize="$2" fontWeight="600">
                {t('Model')}
              </Text>
              <Text
                render={<select id="hire-model" value={model} onChange={(e) => setModel(e.target.value)} aria-describedby="hire-model-wrong" />}
                {...FIELD}
              >
                <option value="enso">enso</option>
                {models.map((one) => (
                  <option key={one.id} value={one.id}>
                    {one.id}
                  </option>
                ))}
              </Text>
              <Said id="hire-model-wrong" text={shown('model')} />
            </YStack>

            <YStack gap="$1.5">
              <Text render="label" htmlFor="hire-does" fontSize="$2" fontWeight="600">
                {t('What it does {optional}', {
                  optional: (
                    <Text fontWeight="400" color="var(--soft, var(--muted-foreground))">
                      {t('— optional')}
                    </Text>
                  ),
                })}
              </Text>
              <Textarea
                id="hire-does"
                value={does}
                onChangeText={setDoes}
                placeholder={t('The work it takes and the voice it answers in')}
                rows={3}
                aria-describedby="hire-does-wrong"
              />
              <Said id="hire-does-wrong" text={shown('does')} />
            </YStack>

            {/* THE SPENDING LIMIT. The agents API requires one on every agent: what
                it may spend in a window, and the most one task may spend. */}
            <View render={<fieldset aria-describedby="hire-budget-wrong" />} display="block" borderWidth={0} p={0} m={0}>
              <Text render="legend" display="block" fontSize="$2" fontWeight="600" mb={6}>
                {t('Spending limit')}
              </Text>
              <YStack gap="$2">
                <XStack gap="$2" items="center" flexWrap="wrap">
                  <Sentence
                    source={UP_TO}
                    fields={{
                      amount: (
                        <Box width={84}>
                          <Input
                            aria-label={t('Spending limit in dollars')}
                            inputMode="decimal"
                            value={cap}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCap(e.target.value)}
                            aria-invalid={!capOk}
                          />
                        </Box>
                      ),
                      period: (
                        <Text
                          render={<select aria-label={t('Spending limit period')} value={period} onChange={(e) => setPeriod(e.target.value as Period)} />}
                          {...FIELD}
                          width="auto"
                        >
                          {PERIODS.map(([value, words]) => (
                            <option key={value} value={value}>
                              {t(words)}
                            </option>
                          ))}
                        </Text>
                      ),
                    }}
                  />
                </XStack>
                <XStack gap="$2" items="center" flexWrap="wrap">
                  <Sentence
                    source={AT_MOST}
                    fields={{
                      amount: (
                        <Box width={84}>
                          <Input
                            aria-label={t('Most one task may spend, in dollars')}
                            inputMode="decimal"
                            value={task}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTask(e.target.value)}
                            aria-invalid={!taskOk}
                          />
                        </Box>
                      ),
                    }}
                  />
                </XStack>
              </YStack>
              <Box mt="$1.5">
                <Said id="hire-budget-wrong" text={budgetWrong ?? shown('budget')} />
              </Box>
            </View>

            <Said id="hire-form-wrong" text={shown('form')} />

            <XStack justify="flex-end" gap="$2">
              <Button size="sm" variant="ghost" onClick={onClose}>
                {t('Cancel')}
              </Button>
              <Button size="sm" disabled={busy !== null || !ready} onClick={() => void make()}>
                {t(busy === 'make' ? 'Creating…' : 'Create')}
              </Button>
            </XStack>
          </>
        )}
      </YStack>
    </Box>
  )
}
