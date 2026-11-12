'use client'

// The thread with the open bot: its pill and Share in the bar, what was said
// with a stamp wherever the conversation paused, and the composer.
//
// A message is a run the platform recorded: your words are its input, the bot's
// its output (or the error its model returned). A run another bot asked for is
// marked as that bot's message. Nothing here is drawn that the runs do not say.

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { Agent, AgentRun } from '@hanzo/ai'
import { navigable } from '@hanzo/ui/product/limits'
import { useI18n } from '@hanzo/i18n/react'
import { useIamToken } from '@hanzo/iam/react'
import { Text, XStack, YStack } from '@hanzo/gui'
import { Caret } from '@hanzo/ui/chat'
import { Composer, Control, Field } from '@hanzo/composer'
import { speech, useDictation, useVoice, Voice } from '@hanzo/voice'
import { ArrowLeft, ArrowUp, Gauge, Mic, Plus, X } from 'lucide-react'
import { base } from '../lib/ai'
import { Prose } from '../Prose'
import { Face } from './face'
import { CLIP, PILL, ROUND, WORD } from './kit'
import { DIM, EDGE, INK, LINE, MINE, RAISED } from './ink'
import { instant } from './time'
import { lines, type Pending } from './said'
import { compose, fits, MAX, texty, type File } from './carry'
import { PARAM } from './api'
import type { Notice } from './refusal'


/** The widest a conversation reads, as the desktop app draws it. */
const MEASURE = 960


/** "It resets in 3 days." from the instant a refusal lifts, in the reader's calendar days. */
function lifts(iso: string | null, now: number, t: (s: string, v?: Record<string, unknown>) => string): string {
  const at = instant(iso ?? undefined)
  if (at === null || at <= now) return ''
  const hours = Math.ceil((at - now) / 3_600_000)
  if (hours < 24 && new Date(at).getDate() === new Date(now).getDate())
    return hours === 1 ? t('It resets in an hour.') : t('It resets in {n} hours.', { n: hours })
  const day = (n: number) => new Date(new Date(n).getFullYear(), new Date(n).getMonth(), new Date(n).getDate()).getTime()
  const days = Math.round((day(at) - day(now)) / 86_400_000)
  return days === 1 ? t('It resets tomorrow.') : t('It resets in {n} days.', { n: days })
}

export function Thread({
  bot,
  bots,
  runs,
  pending,
  notice,
  wrong,
  side,
  live,
  loaded,
  onSend,
  onDismiss,
  onSide,
  onBack,
  onMake,
}: {
  bot: Agent | null
  bots: readonly Agent[]
  runs: AgentRun[] | null
  pending: Pending | null
  notice: Notice | null
  wrong: string | null
  side: boolean
  live: boolean
  /** The roster has answered, so an empty one is an empty org and not a slow one. */
  loaded: boolean
  onSend: (input: string) => Promise<boolean>
  onDismiss: () => void
  onSide: () => void
  onBack: () => void
  onMake: () => void
}) {
  const { t, locale } = useI18n()
  const [draft, setDraft] = useState('')
  const [shared, setShared] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const foot = useRef<HTMLDivElement>(null)
  const pick = useRef<HTMLInputElement>(null)

  // Dictation through Hanzo's own ear, as Chat's composer does: each pause is
  // transcribed and lands after what the draft already held.
  const { token } = useIamToken()
  const ear = useMemo(() => speech({ ...base(), ...(token ? { token } : {}) }), [token])
  const voice = useVoice({ speech: ear, ...useDictation(draft, setDraft) })

  const now = Date.now()
  const said = useMemo(
    () => (bot ? lines(runs ?? [], bots, bot.name, pending, now, locale, t) : []),
    // `now` moves every render; the stamps only need it when the thread does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bot, runs, bots, pending, locale, t],
  )

  useEffect(() => {
    foot.current?.scrollIntoView({ block: 'end' })
  }, [said, notice])

  useEffect(() => {
    setDraft('')
    setFile(null)
    setNote(null)
  }, [bot?.name])

  /** The address of this bot's conversation, whatever the address bar says now. */
  const share = async () => {
    if (!bot) return
    const url = new URL(window.location.href)
    url.searchParams.set(PARAM, bot.name)
    const link = url.toString()
    const nav = navigator as Navigator & { share?: (d: { url: string; title?: string }) => Promise<void> }
    try {
      if (nav.share && window.matchMedia('(pointer: coarse)').matches) await nav.share({ url: link, title: bot.name })
      else await navigator.clipboard.writeText(link)
      setShared(t('Link copied'))
    } catch (e) {
      // A share the reader closed is not a failure; a copy the browser refused is.
      if ((e as { name?: string } | null)?.name === 'AbortError') return
      setShared(t('Copy failed'))
    }
    window.setTimeout(() => setShared(null), 2000)
  }

  // A text file goes with the message, held beside the draft until it is sent.
  const carry = async (picked: globalThis.File) => {
    setNote(null)
    try {
      const text = picked.size <= MAX ? await picked.text() : ''
      if (!text || !texty(text)) throw new Error('not text')
      setFile({ name: picked.name, text })
    } catch {
      setNote(t('Only a text file under 128 KB goes with a message to a bot.'))
    }
  }

  const submit = () => {
    const words = draft
    const held = file
    const input = compose(words, held)
    if (!input || !bot || !live || pending) return
    if (!fits(input)) return setNote(t('That message is over the 128 KB a bot reads at once.'))
    setDraft('')
    setFile(null)
    setNote(null)
    void onSend(input).then((said) => {
      // Not recorded: the words and the file come back, unless something new is there.
      if (said) return
      setDraft((d) => d || words)
      setFile((f) => f ?? held)
    })
  }

  return (
    <YStack flex={1} minH={0} position="relative">
      <XStack data-parity-key="bots.bar" height={58} shrink={0} px={13} items="center" gap={8}>
        <XStack flex={1} minW={0} items="center">
          <XStack {...ROUND} aria-label={t('All bots')} onClick={onBack} display="none" $max-md={{ display: 'flex' }}>
            <ArrowLeft size={16} color={INK} aria-hidden data-i18n-mirror />
          </XStack>
        </XStack>
        {bot ? (
          <XStack
            {...PILL}
            data-parity-key="bots.pill"
            aria-label={t('{name}’s details', { name: bot.name })}
            aria-expanded={side}
            onClick={onSide}
            height={40}
            pl={7}
            maxW="60%"
          >
            <Face bot={bot} size={24} />
            <Text {...WORD} {...CLIP}>
              {bot.name}
            </Text>
          </XStack>
        ) : null}
        <XStack flex={1} minW={0} items="center" justify="flex-end">
          {bot ? (
            <XStack {...PILL} data-parity-key="bots.share" px={15} onClick={share}>
              <Text {...WORD}>{shared ?? t('Share')}</Text>
            </XStack>
          ) : null}
        </XStack>
      </XStack>

      {!bot ? (
        <YStack flex={1} items="center" justify="center" gap={16} px={24}>
          {live && loaded && bots.length === 0 ? (
            <>
              <Text render="h1" m={0} fontSize={22} lineHeight={28} fontWeight="500" color={INK}>
                {t('Make your first bot')}
              </Text>
              <XStack {...PILL} onClick={onMake}>
                <Text {...WORD}>{t('New bot')}</Text>
              </XStack>
            </>
          ) : null}
        </YStack>
      ) : (
        <YStack data-parity-key="bots.thread" flex={1} minH={0} overflowY="auto" overflowX="hidden">
          <YStack width="100%" maxW={MEASURE + 48} mx="auto" px={24} pt={12} pb={16} $max-md={{ px: 12 }}>
            {said.map((line, i) => {
              const prev = said[i - 1]
              const gap = !prev ? 0 : line.kind === prev.kind && (line.kind === 'mine' || line.kind === 'theirs') ? 3 : 16
              if (line.kind === 'stamp')
                return (
                  <Text key={line.key} self="center" mt={i ? 22 : 8} mb={2} fontSize={13} lineHeight={18} color={DIM}>
                    {line.text}
                  </Text>
                )
              if (line.kind === 'from')
                return (
                  <XStack key={line.key} self="center" mt={gap} items="center" gap={6}>
                    <Text fontSize={13} lineHeight={18} color={DIM}>
                      {t('Message from')}
                    </Text>
                    <Face bot={line.bot} size={16} />
                    <Text fontSize={13} lineHeight={18} color={DIM}>
                      {line.bot.name}
                    </Text>
                  </XStack>
                )
              if (line.kind === 'mine')
                return (
                  <YStack key={line.key} self="flex-end" items="flex-end" maxW="78%" mt={gap}>
                    <Text
                      data-parity-key="bots.mine"
                      render="div"
                      px={12}
                      py={7}
                      rounded={18}
                      fontSize={15}
                      lineHeight={22}
                      color={INK}
                      whiteSpace="pre-wrap"
                      $platform-web={{ overflowWrap: 'anywhere', backgroundColor: MINE }}
                    >
                      {line.text}
                    </Text>
                  </YStack>
                )
              if (line.kind === 'thinking')
                return (
                  <XStack
                    key={line.key}
                    data-parity-key="bots.thinking"
                    role="status"
                    aria-label={t('{name} is working', { name: bot.name })}
                    self="flex-start"
                    mt={gap}
                    px={14}
                    height={38}
                    items="center"
                    rounded={16}
                    bg={RAISED}
                    borderWidth={1}
                    borderColor={LINE}
                  >
                    <Caret />
                  </XStack>
                )
              return (
                <YStack
                  key={line.key}
                  data-parity-key={line.kind === 'other' ? 'bots.other' : 'bots.theirs'}
                  self="flex-start"
                  maxW={560}
                  mt={gap}
                  px={12}
                  py={10}
                  rounded={16}
                  bg={RAISED}
                  borderWidth={1}
                  borderColor={LINE}
                  $max-md={{ maxW: '88%' }}
                >
                  {line.kind === 'theirs' && line.failed ? (
                    <Text fontSize={15} lineHeight={22} color={DIM}>
                      {line.text}
                    </Text>
                  ) : (
                    <Prose text={line.text} />
                  )}
                </YStack>
              )
            })}
            {wrong ? (
              <Text render="p" self="center" mt={12} fontSize={13} lineHeight={18} color={DIM}>
                {wrong}
              </Text>
            ) : null}
            <div ref={foot} />
          </YStack>
        </YStack>
      )}

      {bot ? (
        <YStack width="100%" maxW={MEASURE + 48} mx="auto" px={24} pb={15} gap={8} shrink={0} $max-md={{ px: 8, pb: 8 }}>
          {notice ? (
            <YStack
              data-parity-key="bots.notice"
              role="alert"
              bg={RAISED}
              borderWidth={1}
              borderColor={LINE}
              rounded={16}
              pt={12}
              pb={10}
              px={14}
              gap={10}
            >
              <XStack items="flex-start" gap={10}>
                <YStack pt={3}>
                  <Gauge size={16} color={DIM} aria-hidden />
                </YStack>
                <YStack flex={1} minW={0}>
                  <Text fontSize={15} lineHeight={22} color={INK}>
                    {notice.message}
                  </Text>
                  {lifts(notice.resets, now, t) ? (
                    <Text fontSize={15} lineHeight={22} color={DIM}>
                      {lifts(notice.resets, now, t)}
                    </Text>
                  ) : null}
                </YStack>
                <XStack {...ROUND} width={28} height={28} bg="transparent" borderWidth={0} aria-label={t('Dismiss')} onClick={onDismiss}>
                  <X size={14} color={DIM} aria-hidden />
                </XStack>
              </XStack>
              {notice.actions.some(navigable) ? (
                <XStack justify="flex-end" gap={8} flexWrap="wrap">
                  {notice.actions.filter(navigable).map((a, i, all) => (
                    <XStack
                      key={`${a.kind}-${a.label}`}
                      {...PILL}
                      render="a"
                      {...{ href: a.url }}
                      height={34}
                      bg={i === all.length - 1 ? INK : RAISED}
                      borderColor={i === all.length - 1 ? INK : LINE}
                      $platform-web={{ textDecoration: 'none' }}
                    >
                      <Text {...WORD} color={i === all.length - 1 ? 'var(--background)' : INK}>
                        {a.label}
                      </Text>
                    </XStack>
                  ))}
                </XStack>
              ) : null}
            </YStack>
          ) : null}

          {file ? (
            <XStack self="flex-start" items="center" gap={6} height={30} pl={12} pr={4} rounded={999} bg={RAISED} borderWidth={1} borderColor={LINE}>
              <Text {...CLIP} maxW={260} fontSize={13} lineHeight={18} color={INK}>
                {file.name}
              </Text>
              <XStack {...ROUND} width={24} height={24} bg="transparent" borderWidth={0} aria-label={t('Remove {name}', { name: file.name })} onClick={() => setFile(null)}>
                <X size={12} color={DIM} aria-hidden />
              </XStack>
            </XStack>
          ) : null}

          {note ? (
            <Text role="alert" fontSize={13} lineHeight={18} color={DIM} px={8}>
              {note}
            </Text>
          ) : null}

          <Composer
            render="form"
            {...{
              onSubmit: (e: FormEvent) => {
                e.preventDefault()
                submit()
              },
            }}
            control={32}
            width="100%"
          >
            <XStack
              data-parity-key="bots.composer"
              height={44}
              pl={6}
              pr={6}
              gap={6}
              items="center"
              rounded={999}
              bg={RAISED}
              borderWidth={1}
              borderColor={EDGE}
              focusWithinStyle={{ borderColor: 'var(--ring)' }}
            >
              <Control type="button" aria-label={t('Add a text file')} onClick={() => pick.current?.click()} disabled={!live}>
                <Plus size={16} />
              </Control>
              <Field
                value={draft}
                onChangeText={setDraft}
                onKeyDown={(e: { key: string; shiftKey?: boolean; nativeEvent?: { isComposing?: boolean }; preventDefault: () => void }) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent?.isComposing) {
                    e.preventDefault()
                    submit()
                  }
                }}
                placeholder={t('Message {name}', { name: bot.name })}
                aria-label={t('Message {name}', { name: bot.name })}
                disabled={!live}
                fontSize={15}
                px={4}
              />
              <Control asChild>
                <Voice voice={voice} disabled={!live}>
                  {(state) => <Mic size={15} fill={state === 'idle' ? 'none' : 'currentColor'} />}
                </Voice>
              </Control>
              <Control type="submit" aria-label={t('Send')} fill disabled={!(draft.trim() || file) || !live || Boolean(pending)}>
                <ArrowUp size={15} strokeWidth={2.5} />
              </Control>
            </XStack>
          </Composer>
          <input
            ref={pick}
            type="file"
            hidden
            accept="text/*,.md,.txt,.csv,.json,.yaml,.yml,.tsv,.log"
            onChange={(e) => {
              const picked = e.target.files?.[0]
              e.target.value = ''
              if (picked) void carry(picked)
            }}
          />
        </YStack>
      ) : null}

    </YStack>
  )
}
