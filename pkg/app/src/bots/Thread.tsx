'use client'

// The thread with the open bot: floating frosted bot pill and circular Share
// button over the scrolling messages, structured attachment/image cards,
// timestamps wherever the conversation paused, and the pill composer.

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { Agent, AgentRun } from '@hanzo/ai'
import { navigable } from '@hanzo/ui/product/limits'
import { useI18n } from '@hanzo/i18n/react'
import { useIamToken } from '@hanzo/iam/react'
import { Text, XStack, YStack } from '@hanzo/gui'
import { Caret } from '@hanzo/ui/chat'
import { Composer, Control, Field } from '@hanzo/composer'
import { speech, useDictation, useVoice, Voice } from '@hanzo/voice'
import { ArrowLeft, ArrowUp, AudioLines, Check, Gauge, Mic, Plus, Share, X } from 'lucide-react'
import { base } from '../lib/ai'
import { Prose } from '../Prose'
import { called } from '../team'
import { Face } from './face'
import { CLIP, PILL, ROUND, WORD } from './kit'
import { DIM, EDGE, GROUND, INK, LINE, MINE, RAISED } from './ink'
import { instant } from './time'
import { lines, partsOf, type Pending } from './said'
import { compose, fits, MAX, texty, type File } from './carry'
import { PARAM } from './api'
import type { Notice } from './refusal'

function DocBadge({ ext }: { ext: string }) {
  const accent =
    ext === 'pdf'
      ? 'var(--destructive)'
      : ext === 'ppt' || ext === 'pptx'
        ? 'var(--warning, var(--chrome-dot-yellow))'
        : 'var(--info, var(--muted-foreground))'
  return (
    <YStack
      aria-hidden
      width={40}
      height={44}
      shrink={0}
      rounded={9}
      overflow="hidden"
      bg="var(--secondary)"
      borderWidth={1}
      borderColor={LINE}
    >
      <YStack flex={1} px={7} pt={7} gap={4} justify="center">
        <XStack gap={3}>
          <YStack width={9} height={9} rounded={2} bg="var(--muted-foreground)" opacity={0.4} />
          <YStack flex={1} gap={3} justify="center">
            <YStack height={3} rounded={2} bg="var(--muted-foreground)" opacity={0.4} />
            <YStack height={3} width="75%" rounded={2} bg="var(--muted-foreground)" opacity={0.3} />
          </YStack>
        </XStack>
        <YStack height={3} rounded={2} bg="var(--muted-foreground)" opacity={0.34} />
      </YStack>
      <YStack height={12} bg={accent} />
    </YStack>
  )
}

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

  const { token } = useIamToken()
  const ear = useMemo(() => speech({ ...base(), ...(token ? { token } : {}) }), [token])
  const voice = useVoice({ speech: ear, ...useDictation(draft, setDraft) })

  const now = Date.now()
  const said = useMemo(
    () => (bot ? lines(runs ?? [], bots, bot.name, pending, now, locale, t) : []),
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

  const displayName = bot ? called(bot.name) : ''

  const share = async () => {
    if (!bot) return
    const url = new URL(window.location.href)
    url.searchParams.set(PARAM, bot.name)
    const link = url.toString()
    const nav = navigator as Navigator & { share?: (d: { url: string; title?: string }) => Promise<void> }
    try {
      if (nav.share && window.matchMedia('(pointer: coarse)').matches) await nav.share({ url: link, title: displayName })
      else await navigator.clipboard.writeText(link)
      setShared(t('Link copied'))
    } catch (e) {
      if ((e as { name?: string } | null)?.name === 'AbortError') return
      setShared(t('Copy failed'))
    }
    window.setTimeout(() => setShared(null), 2000)
  }

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
    void onSend(input).then((ok) => {
      if (ok) return
      setDraft((d) => d || words)
      setFile((f) => f ?? held)
    })
  }

  const hasDraft = Boolean(draft.trim() || file)

  return (
    <YStack flex={1} minH={0} position="relative">
      <XStack
        data-parity-key="bots.bar"
        position="absolute"
        t={0}
        l={0}
        r={0}
        z={4}
        height={46}
        px={14}
        items="center"
        gap={8}
        pointerEvents="none"
        $platform-web={{
          backgroundImage: `linear-gradient(to bottom, ${GROUND} 18%, color-mix(in srgb, ${GROUND} 68%, transparent) 64%, transparent)`,
        }}
      >
        <XStack flex={1} minW={0} items="center">
          <XStack
            {...ROUND}
            pointerEvents="auto"
            aria-label={t('All bots')}
            onClick={onBack}
            display="none"
            $max-md={{ display: 'flex' }}
          >
            <ArrowLeft size={16} color={INK} aria-hidden data-i18n-mirror />
          </XStack>
        </XStack>
        {bot ? (
          <XStack
            {...PILL}
            pointerEvents="auto"
            data-parity-key="bots.pill"
            aria-label={t('{name}’s details', { name: displayName })}
            aria-expanded={side}
            onClick={onSide}
            height={36}
            pl={6}
            pr={13}
            maxW="60%"
            bg={RAISED}
            $platform-web={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
          >
            <Face bot={bot} size={24} />
            <Text {...WORD} {...CLIP}>
              {displayName}
            </Text>
          </XStack>
        ) : null}
        <XStack flex={1} minW={0} items="center" justify="flex-end">
          {bot ? (
            <XStack
              {...ROUND}
              pointerEvents="auto"
              data-parity-key="bots.share"
              aria-label={shared ?? t('Share')}
              onClick={share}
              $platform-web={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
            >
              {shared ? <Check size={15} color={INK} aria-hidden /> : <Share size={15} color={INK} aria-hidden />}
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
          <YStack width="100%" px={18} pt={52} pb={14} $max-md={{ px: 12 }}>
            {said.map((line, i) => {
              const prev = said[i - 1]
              const gap = !prev ? 0 : line.kind === prev.kind && (line.kind === 'mine' || line.kind === 'theirs') ? 6 : 14
              if (line.kind === 'stamp')
                return (
                  <Text key={line.key} self="center" mt={i ? 18 : 4} mb={4} fontSize={12} lineHeight={17} color={DIM}>
                    {line.text}
                  </Text>
                )
              if (line.kind === 'from')
                return (
                  <XStack key={line.key} self="center" mt={gap} items="center" gap={6}>
                    <Text fontSize={12} lineHeight={17} color={DIM}>
                      {t('Message from')}
                    </Text>
                    <Face bot={line.bot} size={16} />
                    <Text fontSize={12} lineHeight={17} color={DIM}>
                      {called(line.bot.name)}
                    </Text>
                  </XStack>
                )
              if (line.kind === 'mine')
                return (
                  <YStack key={line.key} self="flex-end" items="flex-end" maxW="76%" mt={gap}>
                    <Text
                      data-parity-key="bots.mine"
                      render="div"
                      px={14}
                      py={8}
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
                    aria-label={t('{name} is working', { name: displayName })}
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

              if (line.kind === 'theirs' && line.failed)
                return (
                  <YStack
                    key={line.key}
                    data-parity-key="bots.theirs"
                    self="flex-start"
                    maxW={680}
                    mt={gap}
                    px={15}
                    py={11}
                    rounded={18}
                    bg={RAISED}
                    borderWidth={1}
                    borderColor={LINE}
                    $max-md={{ maxW: '92%' }}
                  >
                    <Text fontSize={15} lineHeight={22} color={DIM}>
                      {line.text}
                    </Text>
                  </YStack>
                )

              const parts = partsOf(line.text)
              return (
                <YStack
                  key={line.key}
                  data-parity-key={line.kind === 'other' ? 'bots.other' : 'bots.theirs'}
                  self="flex-start"
                  items="flex-start"
                  gap={10}
                  maxW="100%"
                  mt={gap}
                >
                  {parts.map((part, idx) => {
                    if (part.kind === 'doc') {
                      const inner = (
                        <XStack
                          px={12}
                          py={10}
                          gap={12}
                          items="center"
                          rounded={16}
                          bg={RAISED}
                          borderWidth={1}
                          borderColor={LINE}
                          maxW={290}
                        >
                          <DocBadge ext={part.ext} />
                          <YStack flex={1} minW={0}>
                            <Text {...CLIP} fontSize={14} lineHeight={19} fontWeight="500" color={INK}>
                              {part.name}
                            </Text>
                            {part.size ? (
                              <Text fontSize={12} lineHeight={17} color={DIM}>
                                {part.size}
                              </Text>
                            ) : null}
                          </YStack>
                        </XStack>
                      )
                      return part.href ? (
                        <YStack
                          key={idx}
                          render="a"
                          {...{ href: part.href, target: '_blank', rel: 'noopener noreferrer' }}
                          $platform-web={{ textDecoration: 'none' }}
                        >
                          {inner}
                        </YStack>
                      ) : (
                        <YStack key={idx}>{inner}</YStack>
                      )
                    }
                    if (part.kind === 'image') {
                      return (
                        <YStack
                          key={idx}
                          width={172}
                          rounded={14}
                          overflow="hidden"
                          bg={RAISED}
                          borderWidth={1}
                          borderColor={LINE}
                        >
                          <YStack render="img" {...{ src: part.src, alt: part.alt }} width="100%" height="auto" display="block" />
                        </YStack>
                      )
                    }
                    return (
                      <YStack
                        key={idx}
                        maxW={680}
                        px={15}
                        py={11}
                        rounded={18}
                        bg={RAISED}
                        borderWidth={1}
                        borderColor={LINE}
                        $max-md={{ maxW: '92%' }}
                      >
                        <Prose text={part.text} />
                      </YStack>
                    )
                  })}
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
        <YStack width="100%" px={16} pb={12} gap={8} shrink={0} $max-md={{ px: 8, pb: 8 }}>
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
              height={46}
              pl={7}
              pr={7}
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
                placeholder={t('Message {name}', { name: displayName })}
                aria-label={t('Message {name}', { name: displayName })}
                disabled={!live}
                fontSize={15}
                px={4}
              />
              <Control asChild>
                <Voice voice={voice} disabled={!live}>
                  {(state) => <Mic size={15} fill={state === 'idle' ? 'none' : 'currentColor'} />}
                </Voice>
              </Control>
              {hasDraft ? (
                <Control type="submit" aria-label={t('Send')} fill disabled={!live || Boolean(pending)}>
                  <ArrowUp size={15} strokeWidth={2.5} />
                </Control>
              ) : (
                <Voice voice={voice} disabled={!live}>
                  {() => (
                    <XStack
                      width={32}
                      height={32}
                      rounded={999}
                      items="center"
                      justify="center"
                      bg={INK}
                      opacity={live ? 1 : 0.45}
                    >
                      <AudioLines size={15} color="var(--background)" strokeWidth={2.2} aria-hidden />
                    </XStack>
                  )}
                </Voice>
              )}
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
