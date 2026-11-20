'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Copy,
  Check,
  Plus,
  Calendar,
  ExternalLink,
  Bot,
  Volume2,
  Square,
  Send,
  UserPlus,
  Tv,
  LayoutGrid,
  ArrowRight,
  Captions,
} from 'lucide-react'
import { Text, View, XStack, YStack } from '@hanzo/gui'
import { Button, toast } from '@hanzo/ui'
import { useIamToken } from '@hanzo/iam/react'
import { phrase, type Say } from '@hanzo/i18n'
import { refused, speech, useTranscript, useVoice } from '@hanzo/voice'
import { Face, voiceOf } from './cast'
import { useI18n } from '@hanzo/i18n/react'
import { member } from './team'
import { cleanForSpeech, speakAgent, stopAgentSpeech, AudioWave, useAgentSpeech } from './speech'
import { GOOD } from './lib/mix'
import { api } from './lib/api'
import { ENSO, base } from './lib/ai'

export interface MeetingAgent {
  id: string
  name: string
  role: string
  voice: string
}

/** A team member as a meeting seats them: the team's name and part, the cast's voice. */
const seated = (id: string): MeetingAgent => {
  const one = member(id)!
  return { id, name: one.name, role: one.role, voice: voiceOf(id) }
}

export const AVAILABLE_MEETING_AGENTS: MeetingAgent[] = [
  { id: 'hanzo-coder', name: 'Hanzo Coder', role: phrase('Engineering Lead & Coder'), voice: voiceOf('Hanzo Coder') },
  { id: 'hanzo-researcher', name: 'Hanzo Researcher', role: phrase('Research & DeSci Scientist'), voice: voiceOf('Hanzo Researcher') },
  seated('opera'),
  seated('des'),
  seated('vi'),
  seated('su'),
  seated('law'),
  { id: 'zach', name: 'Zach', role: phrase('Quantitative Analyst'), voice: voiceOf('zach') },
]

interface ScheduledMeeting {
  id: string
  title: string
  call: string
  time: string
  date: string
  duration: string
  host: string
  hostName?: string
  participants: string[]
  agents: string[]
  botInvited: boolean
  url: string
}

const DEFAULT_MEETINGS: ScheduledMeeting[] = [
  {
    id: 'meet-1',
    title: phrase('AI Platform Architecture & LLM Inference Sync'),
    call: 'platform-architecture',
    time: '18:00 - 18:45',
    date: phrase('Today'),
    duration: '45m',
    host: phrase('{name} (You)'),
    hostName: 'Alex',
    participants: ['Alex', 'Zach'],
    agents: ['Hanzo Coder', 'Vi'],
    botInvited: true,
    url: 'https://meet.hanzo.ai/platform-architecture',
  },
  {
    id: 'meet-2',
    title: phrase('Research Review'),
    call: 'research-review',
    time: '20:00 - 21:00',
    date: phrase('Today'),
    duration: '60m',
    host: phrase('Research'),
    participants: ['Alex', 'Research Team'],
    agents: ['Hanzo Researcher', 'Opera'],
    botInvited: true,
    url: 'https://meet.hanzo.ai/research-review',
  },
  {
    id: 'meet-3',
    title: phrase('Security & Compliance Sync'),
    call: 'security-sync',
    time: '11:00 - 11:30',
    date: phrase('Tomorrow'),
    duration: '30m',
    host: phrase('Security'),
    participants: ['Alex', 'Core Developers'],
    agents: ['Des', 'Law'],
    botInvited: false,
    url: 'https://meet.hanzo.ai/security-sync',
  },
]

/**
 * The co-pilot's answer to one thing said in the call, in a sentence or two a
 * voice can read. Asked of the gateway as the reader (`token`, from
 * `useIamToken`) through the one API host; a refusal is thrown with what the
 * gateway said, never answered with a line nobody wrote.
 */
async function generateAgentMeetingResponse(prompt: string, agentName: string, token: string | null, t: Say): Promise<string> {
  if (!token) throw new Error(t('Sign in to ask the co-pilot.'))
  const res = await fetch(`${api()}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      model: ENSO,
      messages: [
        {
          role: 'system',
          content: `You are ${agentName}, participating in a live Hanzo Meet video call. Respond succinctly, conversationally, and informatively in 1 to 2 sentences suitable for voice synthesis.`,
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 150,
    }),
  })
  if (!res.ok) throw new Error(t('The co-pilot is unavailable ({status}).', { status: res.status }))
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error(t('The co-pilot answered with nothing.'))
  return text
}

/** The invited agents and the co-pilot after `name` is asked or sent away: the co-pilot is the first one asked, and when it leaves the next in line takes over. */
export function invited(agents: string[], copilot: string | null, name: string): { invited: string[]; copilot: string | null } {
  if (agents.includes(name)) {
    const rest = agents.filter((a) => a !== name)
    return { invited: rest, copilot: copilot === name ? (rest[0] ?? null) : copilot }
  }
  return { invited: [...agents, name], copilot: copilot ?? name }
}

export function Meet() {
  const { t, locale } = useI18n()
  const [activeCall, setActiveCall] = useState<string | null>(null)
  const [callInput, setCallInput] = useState('')
  const [copied, setCopied] = useState(false)
  const [cameraOn, setCameraOn] = useState(true)
  const [micOn, setMicOn] = useState(true)
  const [botAssisting, setBotAssisting] = useState(true)
  // Below md the co-pilot is a sheet over the stage, opened from the bar.
  const [copilot, setCopilot] = useState(false)
  const [meetings] = useState<ScheduledMeeting[]>(DEFAULT_MEETINGS)

  // Agent Invitation and Active Call Participation
  const [invitedAgents, setInvitedAgents] = useState<string[]>(['Hanzo Coder', 'Hanzo Researcher'])
  const [activeCoPilotAgent, setActiveCoPilotAgent] = useState<string | null>('Hanzo Coder')
  const coPilotName = activeCoPilotAgent ?? 'Hanzo Coder'
  const [showAgentPicker, setShowAgentPicker] = useState(false)
  const [meetingView, setMeetingView] = useState<'iframe' | 'grid'>('iframe')
  const [agentQuestion, setAgentQuestion] = useState('')

  // Agent Speech in Call
  const { token } = useIamToken()
  const { speaking, speak, toggle } = useAgentSpeech(coPilotName)
  const [audioTesting, setAudioTesting] = useState(false)

  // The call's notes: what was said and answered here, and nothing before it.
  const [liveNotes, setLiveNotes] = useState<string[]>([])

  const videoRef = useRef<HTMLVideoElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (activeCall) {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop())
        localStreamRef.current = null
      }
      return
    }

    if (cameraOn && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: false })
        .then((stream) => {
          localStreamRef.current = stream
          if (videoRef.current) {
            videoRef.current.srcObject = stream
          }
        })
        .catch(() => {})
    } else {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop())
        localStreamRef.current = null
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    }

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [cameraOn, activeCall])

  // Stop speech when meeting closes
  useEffect(() => {
    return () => {
      stopAgentSpeech()
    }
  }, [])

  const startInstantMeeting = () => {
    const randomId = `hanzo-${Math.random().toString(36).slice(2, 8)}`
    setActiveCall(randomId)
  }

  const joinCustomMeeting = () => {
    if (!callInput.trim()) return
    let clean = callInput.trim()
    if (clean.includes('meet.hanzo.ai/')) {
      clean = clean.split('meet.hanzo.ai/')[1].split('?')[0].split('#')[0]
    }
    setActiveCall(clean)
  }

  const handleCopyLink = (call: string) => {
    const link = `https://meet.hanzo.ai/${call}`
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      toast.error(t('Could not copy'))
      return
    }
    void navigator.clipboard
      .writeText(link)
      .then(() => {
        setCopied(true)
        toast.success(t('Copied'))
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {
        toast.error(t('Could not copy'))
      })
  }

  const toggleAgentInvite = (agentName: string) => {
    const next = invited(invitedAgents, activeCoPilotAgent, agentName)
    setInvitedAgents(next.invited)
    setActiveCoPilotAgent(next.copilot)
  }

  const testAudioSpeaker = () => {
    if (audioTesting) {
      stopAgentSpeech()
      setAudioTesting(false)
      return
    }
    setAudioTesting(true)
    speakAgent(
      t("Welcome to Hanzo Meet. This is {agent}'s voice. If you can hear this, your speakers are working.", {
        agent: coPilotName,
      }),
      {
        agent: coPilotName,
        token,
        onEnd: () => setAudioTesting(false),
        onError: () => setAudioTesting(false),
      },
    )
  }

  // HANDS-FREE is one spoken conversation with the co-pilot, on @hanzo/voice:
  // the mic records, each pause goes to Hanzo's /v1/audio/transcriptions, the
  // utterance is answered, and the answer is read in the co-pilot's cast voice
  // by /v1/audio/speech. Speaking over the reply stops it (the machine's
  // barge-in). Every browser that can record takes part, not only the ones with
  // a working SpeechRecognition — Chromium on Linux and Firefox have none.
  const ear = useMemo(() => speech({ ...base(), ...(token ? { token } : { public: true }) }), [token])
  const handsFree = useVoice({
    speech: ear,
    onUtterance: (transcript) => void handleSpokenInput(transcript),
  })
  const handsFreeSay = handsFree.say

  // LIVE TRANSCRIPT: what is said in the call lands in its notes as it settles,
  // on Hanzo's growing transcript (/v1/audio/transcript), and the line under the
  // notes shows the words still being decoded. Silence is neither decoded nor
  // billed. No SpeechRecognition anywhere, so every browser that can record
  // takes part.
  const [caption, setCaption] = useState('')
  const transcriber = useTranscript({
    speech: ear,
    onPartial: setCaption,
    onSettled: (text) => setLiveNotes((prev) => [...prev, t('{time}: You: {text}', { time: clock(locale), text })]),
  })
  const transcriberNote = transcriber.reason ?? (transcriber.refusal ? refused(transcriber.refusal) : null)

  const handleSpokenInput = useCallback(
    async (transcript: string) => {
      const time = clock(locale)
      setLiveNotes((prev) => [...prev, t('{time}: You (voice): {text}', { time, text: transcript })])
      try {
        const reply = await generateAgentMeetingResponse(transcript, coPilotName, token, t)
        setLiveNotes((prev) => [...prev, t('{time}: {agent} (AI): {reply}', { time, agent: coPilotName, reply })])
        void handsFreeSay(cleanForSpeech(reply), voiceOf(coPilotName))
      } catch (err) {
        setLiveNotes((prev) => [
          ...prev,
          t('{time}: {agent} did not answer: {reason}', { time, agent: coPilotName, reason: (err as Error).message }),
        ])
      }
    },
    [coPilotName, token, handsFreeSay, t, locale],
  )

  const handleAskAgent = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = agentQuestion.trim()
    if (!q) return
    setAgentQuestion('')
    const time = clock(locale)
    setLiveNotes((prev) => [...prev, t('{time}: You: {text}', { time, text: q })])
    try {
      const reply = await generateAgentMeetingResponse(q, coPilotName, token, t)
      setLiveNotes((prev) => [...prev, t('{time}: {agent} (AI): {reply}', { time, agent: coPilotName, reply })])
      speak(reply, coPilotName)
    } catch (err) {
      setLiveNotes((prev) => [
        ...prev,
        t('{time}: {agent} did not answer: {reason}', { time, agent: coPilotName, reason: (err as Error).message }),
      ])
    }
  }

  // The briefing is the call's own notes, read aloud; with none there is nothing to brief.
  const handleReadBriefing = () => {
    if (!liveNotes.length) return
    const call = activeCall || t('this call')
    toggle(t('Briefing for {call}. {notes}', { call, notes: liveNotes.join('. ') }), coPilotName)
  }

  // What the hands-free control says: why it cannot run, or that Hanzo's speech
  // refused and the browser stood in (or could not) — never silence.
  const handsFreeNote = handsFree.reason ?? (handsFree.refusal ? refused(handsFree.refusal) : null)

  return (
    <YStack width="100%" height="100%" bg="$background" overflowX="hidden" overflowY="auto">
      {/* Top Header: one row from a laptop; on a phone the controls wrap under the title rather than clip it. */}
      <XStack
        minH={56}
        px="$5"
        py="$2"
        $max-sm={{ px: '$4' }}
        gap="$3"
        flexWrap="wrap"
        bg="$panel"
        borderBottomWidth={1}
        borderBottomColor="$borderColor"
        items="center"
        justify="space-between"
      >
        {/* Every part of this bar gives way on a phone, as a block box would: shrinking, never below its content. */}
        <XStack items="center" gap="$3" shrink={1} minW={0}>
          <XStack width={32} height={32} rounded="$3" bg="$raised" items="center" justify="center" shrink={0}>
            <Video size={17} color="var(--foreground)" aria-hidden />
          </XStack>
          <YStack shrink={1} minW={0} gap="$0.5">
            <XStack items="center" gap="$2" flexWrap="wrap">
              <Text fontSize="$3" fontWeight="600" color="$ink">
                Hanzo Meet
              </Text>
              {activeCall ? (
                <Text
                  fontSize="$1"
                  fontWeight="500"
                  bg="$hover"
                  color="$soft"
                  borderWidth={1}
                  borderColor="$borderColor"
                  px="$1.5"
                  py="$0.5"
                  rounded="$xs"
                >
                  {t('Live · {site}', { site: 'meet.hanzo.ai' })}
                </Text>
              ) : null}
            </XStack>
            <Text fontSize="$1" color="$soft" numberOfLines={1}>
              {t('WebRTC video calls with AI meeting transcription and voice')}
            </Text>
          </YStack>
        </XStack>

        {activeCall ? (
          <XStack items="center" gap="$2" shrink={1} minW={0} flexWrap="wrap">
            <XStack bg="$hover" rounded="$3" p={2} gap={2} borderWidth={1} borderColor="var(--border-strong)" shrink={1} minW={0}>
              {([
                ['iframe', t('Stage'), Tv],
                ['grid', t('Agent grid'), LayoutGrid],
              ] as const).map(([view, label, Icon]) => (
                <Button
                  key={view}
                  size="sm"
                  variant={meetingView === view ? 'secondary' : 'ghost'}
                  {...(meetingView === view ? null : { color: '$soft' })}
                  aria-pressed={meetingView === view}
                  onClick={() => setMeetingView(view)}
                >
                  <Icon size={12} />
                  {label}
                </Button>
              ))}
            </XStack>

            {/* On a phone the co-pilot folds into a sheet over the stage, and this opens it. */}
            {botAssisting ? (
              <View display="none" $max-md={{ display: 'flex' }}>
                <Button
                  size="sm"
                  variant={copilot ? 'secondary' : 'outline'}
                  borderColor="var(--border-strong)"
                  onClick={() => setCopilot((v) => !v)}
                  aria-label={t('Co-pilot')}
                  aria-expanded={copilot}
                  aria-controls="meet-copilot"
                >
                  <Bot size={13} />
                  {t('Co-pilot')}
                </Button>
              </View>
            ) : null}
            <Button size="sm" variant="outline" borderColor="var(--border-strong)" onClick={() => handleCopyLink(activeCall)}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {t(copied ? 'Link copied' : 'Copy meeting link')}
            </Button>
            <View display="none" $sm={{ display: 'flex' }} width={1} height={20} bg="$borderColor" mx="$1" />
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                stopAgentSpeech()
                // Leaving the call hangs up the hands-free conversation and
                // settles the transcript with it.
                if (handsFree.open) handsFree.toggle()
                if (transcriber.open) transcriber.toggle()
                setActiveCall(null)
              }}
            >
              <PhoneOff size={14} />
              {t('Leave call')}
            </Button>
          </XStack>
        ) : (
          <XStack items="center" gap="$2" shrink={1} minW="auto">
            <Button asChild variant="linkMuted" size="sm" px={0}>
              <a href="https://meet.hanzo.ai" target="_blank" rel="noopener noreferrer">
                meet.hanzo.ai
                <ExternalLink size={12} />
              </a>
            </Button>
          </XStack>
        )}
      </XStack>

      {/* Main Content */}
      {activeCall ? (
        /* Active Video Call Screen */
        <XStack flex={1} overflow="hidden" position="relative">
          {/* The stage gives way only down to what it holds, as a block box would: the grid keeps its 280px tiles. */}
          <XStack flex={1} minW="auto" position="relative" bg="$sunken">
            {/* Keyed apart: one gui View in one place that changes `render` changes the hooks it runs. */}
            {meetingView === 'iframe' ? (
              <View
                key="stage"
                render={
                  <iframe
                    src={`https://meet.hanzo.ai/${activeCall}#config.prejoinPageEnabled=false&config.startWithAudioMuted=${!micOn}&config.startWithVideoMuted=${!cameraOn}`}
                    allow="camera; microphone; display-capture; autoplay; clipboard-write; speaker-selection; screen-wake-lock"
                    title={t('Hanzo Meet: {call}', { call: activeCall })}
                  />
                }
                width="100%"
                height="100%"
                borderWidth={0}
                bg="$sunken"
              />
            ) : (
              /* Agent Grid View */
              <View
                key="grid"
                flex={1}
                display="grid"
                gridTemplateColumns="repeat(auto-fit, minmax(280px, 1fr))"
                gap={12}
                p={16}
                overflowY="auto"
                bg="$background"
              >
                {/* User Camera Tile */}
                <YStack
                  bg="$panel"
                  rounded="$5"
                  borderWidth={1}
                  borderColor="$borderColor"
                  position="relative"
                  overflow="hidden"
                  items="center"
                  justify="center"
                  p="$5"
                  gap="$2.5"
                  minH={220}
                >
                  <YStack
                    width={72}
                    height={72}
                    rounded={9999}
                    bg="$raised"
                    items="center"
                    justify="center"
                  >
                    <Text fontSize="$6" fontWeight="600" color="$ink">
                      {t('You')}
                    </Text>
                  </YStack>
                  <YStack items="center" gap="$1">
                    <Text fontSize="$3" fontWeight="600" color="$ink">
                      {t('{name} (Host)', { name: 'Alex' })}
                    </Text>
                    <Text fontSize="$1" color={micOn ? GOOD : '$soft'}>
                      {t(micOn ? 'Mic active' : 'Muted')}
                    </Text>
                  </YStack>
                </YStack>

                {/* AI Agents Tiles */}
                {invitedAgents.map((agentName) => {
                  const voice = voiceOf(agentName)
                  const isThisSpeaking =
                    (speaking || handsFree.state === 'speaking') && activeCoPilotAgent?.toLowerCase() === agentName.toLowerCase()

                  return (
                    <YStack
                      key={agentName}
                      bg="$panel"
                      rounded="$5"
                      borderWidth={isThisSpeaking ? 2 : 1}
                      borderColor={isThisSpeaking ? 'var(--state-success)' : '$borderColor'}
                      position="relative"
                      overflow="hidden"
                      items="center"
                      justify="center"
                      p="$5"
                      gap="$2.5"
                      minH={220}
                      transition="200ms"
                    >
                      <View position="relative">
                        <Face name={agentName} size={72} />
                        {isThisSpeaking ? (
                          <View
                            position="absolute"
                            b={-4}
                            r={-4}
                            bg="var(--popover)"
                            borderWidth={1}
                            borderColor="var(--state-success)"
                            rounded={9999}
                            p={4}
                          >
                            <Volume2 size={12} color={GOOD} />
                          </View>
                        ) : null}
                      </View>

                      <YStack items="center" gap="$0.5">
                        <Text fontSize="$3" fontWeight="600" color="$ink">
                          {agentName}
                        </Text>
                        <Text fontSize="$1" color="$soft">
                          {t('Voice: {voice}', { voice })}
                        </Text>
                      </YStack>

                      <XStack
                        items="center"
                        gap="$1.5"
                        bg="$hover"
                        px="$2.5"
                        py="$1"
                        rounded="$5"
                      >
                        {isThisSpeaking ? (
                          <>
                            <AudioWave active={true} color="var(--state-success)" />
                            <Text fontSize="$1" fontWeight="500" color={GOOD}>
                              {t('Speaking in call')}
                            </Text>
                          </>
                        ) : (
                          <>
                            <Bot size={12} color="var(--muted-foreground)" aria-hidden />
                            <Text fontSize="$1" fontWeight="500" color="$soft">
                              {t('AI agent · in call')}
                            </Text>
                          </>
                        )}
                      </XStack>
                    </YStack>
                  )
                })}
              </View>
            )}
          </XStack>

          {/* AI Bot Meeting Co-pilot Sidebar */}
          {botAssisting ? (
            <YStack
              id="meet-copilot"
              width={360}
              minW={360}
              bg="$panel"
              borderLeftWidth={1}
              borderLeftColor="$borderColor"
              p={16}
              gap={12}
              $max-md={{
                display: copilot ? 'flex' : 'none',
                position: 'absolute',
                t: 0,
                r: 0,
                b: 0,
                l: 0,
                width: 'auto',
                minW: 0,
                z: 'var(--z-sheet)',
                borderLeftWidth: 0,
              }}
            >
              {/* Co-pilot Header & Agent Picker */}
              <XStack items="center" justify="space-between" gap="$2">
                <XStack items="center" gap="$2" minW={0} flex={1}>
                  <Face name={coPilotName} size={28} />
                  <YStack minW={0} flex={1} gap="$0.5">
                    <Text fontSize="$3" fontWeight="600" color="$ink" numberOfLines={1}>
                      {activeCoPilotAgent ?? t('No co-pilot selected')}
                    </Text>
                    <Text fontSize="$1" color="$soft" numberOfLines={1}>
                      {t('AI co-pilot · Voice: {voice}', { voice: voiceOf(coPilotName) })}
                    </Text>
                  </YStack>
                </XStack>
                <Text
                  fontSize="$1"
                  fontWeight="500"
                  color={GOOD}
                  bg="$hover"
                  px="$2"
                  py="$0.5"
                  rounded="$xs"
                  shrink={0}
                >
                  {t('Live in call')}
                </Text>
              </XStack>

              {/* Agent switcher chips */}
              <XStack gap={4} flexWrap="wrap">
                {invitedAgents.map((agent) => (
                  <Button
                    key={agent}
                    size="sm"
                    variant={activeCoPilotAgent === agent ? 'secondary' : 'ghost'}
                    color={activeCoPilotAgent === agent ? '$ink' : '$soft'}
                    aria-pressed={activeCoPilotAgent === agent}
                    onClick={() => setActiveCoPilotAgent(agent)}
                  >
                    {agent}
                  </Button>
                ))}
              </XStack>

              {/* Voice Actions: Briefing & Hands-Free Mode */}
              <XStack gap={8}>
                <Button
                  size="sm"
                  flex={1}
                  variant={speaking ? 'secondary' : 'default'}
                  disabled={!speaking && !liveNotes.length}
                  onClick={handleReadBriefing}
                >
                  {speaking ? (
                    <>
                      <AudioWave active={true} color="var(--state-success)" />
                      {t('Stop briefing')}
                      <Square size={11} fill="currentColor" />
                    </>
                  ) : (
                    <>
                      <Volume2 size={14} />
                      {t('Briefing')}
                    </>
                  )}
                </Button>

                <Button
                  size="sm"
                  variant={handsFree.open ? 'secondary' : 'default'}
                  data-testid="hands-free-voice-toggle"
                  data-state={handsFree.state}
                  data-refusal={handsFree.refusal ? handsFree.refusal.service : undefined}
                  aria-pressed={handsFree.open}
                  disabled={!!handsFree.blocked}
                  title={
                    handsFreeNote ??
                    t(
                      handsFree.open
                        ? 'Hands-free voice active (speaks and interrupts on voice)'
                        : 'Enable hands-free voice mode',
                    )
                  }
                  onClick={handsFree.toggle}
                >
                  <Mic size={14} color={handsFree.open ? 'var(--state-success)' : 'currentColor'} />
                  {t(handsFree.open ? 'Hands-free on' : 'Hands-free')}
                </Button>

                <Button
                  size="sm"
                  variant={transcriber.open ? 'secondary' : 'default'}
                  data-testid="live-transcript-toggle"
                  data-state={transcriber.state}
                  data-refusal={transcriber.refusal ? transcriber.refusal.service : undefined}
                  aria-pressed={transcriber.open}
                  disabled={!!transcriber.blocked}
                  title={
                    transcriberNote ??
                    t(transcriber.open ? 'Transcribing — click to stop' : 'Transcribe what is said into the notes')
                  }
                  onClick={transcriber.toggle}
                >
                  <Captions size={14} color={transcriber.open ? 'var(--state-success)' : 'currentColor'} />
                  {t(transcriber.open ? 'Transcribing' : 'Transcribe')}
                </Button>
              </XStack>
              {handsFreeNote ? (
                <Text fontSize="$1" color="$soft" role="status">
                  {handsFreeNote}
                </Text>
              ) : null}
              {transcriberNote ? (
                <Text fontSize="$1" color="$soft" role="status">
                  {transcriberNote}
                </Text>
              ) : null}

              {/* Real-time Notes Stream */}
              <YStack
                flex={1}
                overflowY="auto"
                bg="$background"
                rounded="$3"
                borderWidth={1}
                borderColor="$borderColor"
                p="$3"
                gap="$2"
              >
                {liveNotes.length === 0 && !caption ? (
                  <Text fontSize="$2" color="$soft" lineHeight="$3">
                    {t('Notes from this call appear here. Ask {agent} below or turn on Transcribe.', { agent: coPilotName })}
                  </Text>
                ) : null}
                {liveNotes.map((note, i) => (
                  <Text
                    key={i}
                    fontSize="$2"
                    color="$ink"
                    lineHeight="$3"
                    pb="$2"
                    borderBottomWidth={i === liveNotes.length - 1 ? 0 : 1}
                    borderBottomColor="$borderColor"
                  >
                    {note}
                  </Text>
                ))}
                {transcriber.open && caption ? (
                  <Text data-testid="live-caption" fontSize="$2" color="$soft" lineHeight="$3" aria-live="polite">
                    {caption}
                  </Text>
                ) : null}
              </YStack>

              {/* Ask Agent Question during Call */}
              <XStack render="form" {...{ onSubmit: handleAskAgent }} gap="$1.5" items="center">
                <Text
                  render={
                    <input
                      type="text"
                      value={agentQuestion}
                      onChange={(e) => setAgentQuestion(e.target.value)}
                      placeholder={t('Ask {agent} in meeting...', { agent: coPilotName })}
                    />
                  }
                  flex={1}
                  minW={0}
                  minH={36}
                  $max-sm={{ minH: 44 }}
                  bg="$background"
                  borderWidth={1}
                  borderColor="var(--border-control)"
                  focusStyle={{ borderColor: 'var(--ring)' }}
                  rounded="$2"
                  px={10}
                  py={8}
                  color="$ink"
                  fontSize="$2"
                  outlineStyle="none"
                />
                <Button type="submit" variant="primary" size="icon-sm" minH={36} minW={36} $max-sm={{ minH: 44, minW: 44 }} disabled={!agentQuestion.trim()} aria-label={t('Ask')}>
                  <Send size={13} />
                </Button>
              </XStack>

              {/* Quick Actions */}
              <XStack gap="$2">
                <Button
                  size="sm"
                  variant="outline"
                  borderColor="var(--border-strong)"
                  flex={1}
                  minH={36}
                  $max-sm={{ minH: 44 }}
                  disabled={!agentQuestion.trim()}
                  title={t('Add what is typed above to the notes, without asking the co-pilot')}
                  onClick={() => {
                    const note = agentQuestion.trim()
                    if (!note) return
                    setAgentQuestion('')
                    setLiveNotes((prev) => [...prev, t('{time}: You (note): {note}', { time: clock(locale), note })])
                  }}
                >
                  {t('+ Add live note')}
                </Button>
                <Button
                  variant="outline"
                  borderColor="var(--border-strong)"
                  size="sm"
                  minH={36}
                  $max-sm={{ minH: 44 }}
                  disabled={!liveNotes.length}
                  onClick={() => {
                    const text = liveNotes.join('\n')
                    if (typeof navigator === 'undefined' || !navigator.clipboard) {
                      toast.error(t('Could not copy'))
                      return
                    }
                    void navigator.clipboard
                      .writeText(text)
                      .then(() => toast.success(t('Copied')))
                      .catch(() => toast.error(t('Could not copy')))
                  }}
                >
                  {t('Copy summary')}
                </Button>
              </XStack>
            </YStack>
          ) : null}
        </XStack>
      ) : (
        /* Meeting Lobby & Schedule Hub. Two columns from a laptop; below one the
           pane beside the sidebar is too narrow for two, so the columns stack,
           each as tall as what it holds, and the lobby scrolls as one page. */
        <XStack
          flex={1}
          minH={0}
          overflow="hidden"
          $max-lg={{ flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden' }}
        >
          {/* Left Hero: Instant Join & Pre-flight Camera Check */}
          <YStack
            flex={1}
            minW={0}
            p="$6"
            overflowY="auto"
            overflowX="hidden"
            $max-lg={{ p: '$5', flexBasis: 'auto', grow: 0, shrink: 0, overflowY: 'visible', overflowX: 'hidden' }}
            $max-sm={{ p: '$4' }}
          >
            <YStack width="100%" maxW={640} gap="$6" $max-sm={{ gap: '$5' }}>
              <YStack gap="$1.5" maxW={560}>
                <Text
                  render="h1"
                  m={0}
                  fontSize="$8"
                  lineHeight="$8"
                  $max-sm={{ fontSize: '$7', lineHeight: '$7' }}
                  fontWeight="600"
                  color="$ink"
                  letterSpacing={-0.5}
                >
                  {t('Secure, high-definition video calls')}
                </Text>
                <Text fontSize="$3" color="$soft" lineHeight="$4">
                  {t('Powered by native Hanzo Meet ({link}). Connect with team members, clients, and autonomous AI agents.', {
                    link: (
                      <Text
                        render={<a href="https://meet.hanzo.ai" target="_blank" rel="noopener noreferrer" />}
                        color="$ink"
                        textDecorationLine="none"
                      >
                        meet.hanzo.ai
                      </Text>
                    ),
                  })}
                </Text>
              </YStack>

              {/* Quick Actions Row */}
              <XStack gap="$3" flexWrap="wrap" items="center" $max-sm={{ gap: '$2' }}>
                <Button variant="primary" size="lg" minH={42} $max-sm={{ minH: 44, width: '100%' }} onClick={startInstantMeeting}>
                  <Plus size={16} />
                  {t('Start instant meeting')}
                </Button>

                <XStack
                  items="center"
                  gap="$1.5"
                  bg="$panel"
                  borderWidth={1}
                  borderColor="var(--border-strong)"
                  focusWithinStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                  rounded="$3"
                  px="$1"
                  minH={42}
                  minW={0}
                  maxW="100%"
                  $max-sm={{ width: '100%', minH: 44 }}
                >
                  <Text
                    render={
                      <input
                        type="text"
                        value={callInput}
                        onChange={(e) => setCallInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && joinCustomMeeting()}
                        placeholder={t('Enter meeting code or link')}
                        aria-label={t('Meeting code or link')}
                      />
                    }
                    flex={1}
                    minW={0}
                    bg="transparent"
                    borderWidth={0}
                    outlineStyle="none"
                    color="$ink"
                    fontSize="$2"
                    width={210}
                    $max-sm={{ width: 'auto' }}
                    px={8}
                  />
                  <Button variant="secondary" size="sm" minH={34} $max-sm={{ minH: 36 }} disabled={!callInput.trim()} onClick={joinCustomMeeting}>
                    {t('Join')}
                  </Button>
                </XStack>

                <Button
                  size="lg"
                  minH={42}
                  $max-sm={{ minH: 44 }}
                  variant={showAgentPicker ? 'secondary' : 'outline'}
                  borderColor="var(--border-strong)"
                  aria-expanded={showAgentPicker}
                  onClick={() => setShowAgentPicker(!showAgentPicker)}
                >
                  <UserPlus size={14} />
                  {t('Invite agents ({count})', { count: invitedAgents.length.toLocaleString(locale) })}
                </Button>
              </XStack>

              {/* Agent Picker Panel */}
              {showAgentPicker ? (
                <YStack
                  bg="$panel"
                  borderWidth={1}
                  borderColor="var(--border-strong)"
                  rounded="$5"
                  p="$4"
                  gap="$3"
                  width="100%"
                >
                  <YStack gap="$1">
                    <Text fontSize="$3" fontWeight="600" color="$ink">
                      {t('Select AI agents to attend meetings')}
                    </Text>
                    <Text fontSize="$2" color="$soft">
                      {t('Each agent joins the call with voice synthesis and pair programming.')}
                    </Text>
                  </YStack>

                  <View display="grid" gridTemplateColumns="repeat(auto-fill, minmax(min(220px, 100%), 1fr))" gap="$2">
                    {AVAILABLE_MEETING_AGENTS.map((agent) => {
                      const isInvited = invitedAgents.includes(agent.name)
                      return (
                        <XStack
                          key={agent.id}
                          render={<button type="button" />}
                          aria-pressed={isInvited}
                          onClick={() => toggleAgentInvite(agent.name)}
                          items="center"
                          gap="$2.5"
                          px="$2.5"
                          py="$2"
                          $max-sm={{ minH: 48 }}
                          rounded="$3"
                          bg={isInvited ? '$raised' : '$hover'}
                          borderWidth={1}
                          borderColor={isInvited ? 'var(--border-selected)' : '$borderColor'}
                          cursor="pointer"
                          transition="quickest"
                          focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                        >
                          <Face name={agent.name} size={32} />
                          <YStack flex={1} minW={0} items="flex-start" gap="$0.5">
                            <Text fontSize="$2" fontWeight="600" color="$ink" text="start" numberOfLines={1}>
                              {agent.name}
                            </Text>
                            <Text fontSize="$1" color="$soft" text="start" numberOfLines={1}>
                              {t('{role} · {voice}', { role: t(agent.role), voice: agent.voice })}
                            </Text>
                          </YStack>
                          <View
                            width={16}
                            height={16}
                            rounded="$xs"
                            shrink={0}
                            borderWidth={isInvited ? 0 : 1}
                            borderColor="var(--border-selected)"
                            bg={isInvited ? 'var(--foreground)' : 'transparent'}
                            items="center"
                            justify="center"
                          >
                            {isInvited ? <Check size={11} strokeWidth={3} color="var(--background)" /> : null}
                          </View>
                        </XStack>
                      )
                    })}
                  </View>
                </YStack>
              ) : null}

              {/* Camera & Hardware Pre-flight Test Box */}
              <YStack
                bg="$panel"
                borderWidth={1}
                borderColor="$borderColor"
                rounded="$5"
                overflow="hidden"
                width="100%"
              >
              <XStack height={280} $max-sm={{ height: 240 }} bg="$sunken" position="relative" items="center" justify="center">
                {cameraOn ? (
                  <View
                    render={<video ref={videoRef} autoPlay playsInline muted />}
                    width="100%"
                    height="100%"
                    objectFit="cover"
                  />
                ) : (
                  <YStack items="center" gap={8}>
                    <XStack width={64} height={64} rounded={9999} bg="$raised" items="center" justify="center">
                      <VideoOff size={28} color="var(--muted-foreground)" />
                    </XStack>
                    <Text fontSize="$2" color="$soft">{t('Camera is off')}</Text>
                  </YStack>
                )}

                {/* Overlay Controls */}
                {/* A Button's label never wraps, so the bar does: on a narrow stage the toggles take a second row. */}
                <XStack
                  position="absolute"
                  b={12}
                  maxW="calc(100% - 16px)"
                  items="center"
                  justify="center"
                  flexWrap="wrap"
                  gap={6}
                  bg="var(--surface-overlay)"
                  backdropFilter="blur(8px)"
                  px={10}
                  py={6}
                  rounded={20}
                  borderWidth={1}
                  borderColor="var(--border-strong)"
                >
                  <Button
                    size="icon"
                    rounded={9999}
                    variant={cameraOn ? 'default' : 'destructive'}
                    aria-label={t(cameraOn ? 'Turn camera off' : 'Turn camera on')}
                    title={t(cameraOn ? 'Turn camera off' : 'Turn camera on')}
                    onClick={() => setCameraOn(!cameraOn)}
                  >
                    {cameraOn ? <Video size={16} /> : <VideoOff size={16} />}
                  </Button>

                  <Button
                    size="icon"
                    rounded={9999}
                    variant={micOn ? 'default' : 'destructive'}
                    aria-label={t(micOn ? 'Mute mic' : 'Unmute mic')}
                    title={t(micOn ? 'Mute mic' : 'Unmute mic')}
                    onClick={() => setMicOn(!micOn)}
                  >
                    {micOn ? <Mic size={14} strokeWidth={1.75} /> : <MicOff size={14} strokeWidth={1.75} />}
                  </Button>

                  {/* Speaker & Audio Test Button */}
                  <Button
                    size="sm"
                    rounded={9999}
                    variant={audioTesting ? 'secondary' : 'default'}
                    title={t('Test agent voice and audio output')}
                    onClick={testAudioSpeaker}
                  >
                    {audioTesting ? (
                      <>
                        <AudioWave active={true} color="var(--state-success)" />
                        {t('Testing audio…')}
                      </>
                    ) : (
                      <>
                        <Volume2 size={12} strokeWidth={1.75} />
                        {t('Test audio')}
                      </>
                    )}
                  </Button>

                  <Button
                    size="sm"
                    rounded={9999}
                    variant={botAssisting ? 'secondary' : 'default'}
                    aria-pressed={botAssisting}
                    onClick={() => setBotAssisting(!botAssisting)}
                  >
                    <Bot size={13} />
                    {t(botAssisting ? 'AI co-pilot on' : 'AI co-pilot off')}
                  </Button>
                </XStack>
              </XStack>

              <XStack p="$3" gap="$3" flexWrap="wrap" items="center" justify="space-between" bg="$panel">
                <Text fontSize="$1" color="$soft" flex={1} minW={0}>
                  {t('Readiness: Camera {camera} · Mic {mic} · Audio {audio}', {
                    camera: t(cameraOn ? 'active' : 'muted'),
                    mic: t(micOn ? 'active' : 'muted'),
                    audio: t(audioTesting ? 'testing' : 'ready'),
                  })}
                </Text>
                <Text fontSize="$1" color="$soft" fontWeight="500" shrink={0}>
                  {t('HD 1080p ready')}
                </Text>
              </XStack>
              </YStack>
            </YStack>
          </YStack>

          {/* Right Column: Scheduled Meetings & Cal Sync */}
          <YStack
            grow={1}
            shrink={1}
            flexBasis={380}
            minW={0}
            maxW="100%"
            bg="$panel"
            borderLeftWidth={1}
            borderLeftColor="$borderColor"
            p="$5"
            $max-sm={{ p: '$4' }}
            gap="$5"
            overflowY="auto"
            overflowX="hidden"
            $max-lg={{
              width: '100%',
              grow: 0,
              shrink: 0,
              flexBasis: 'auto',
              borderLeftWidth: 0,
              borderTopWidth: 1,
              borderTopColor: '$borderColor',
              overflowY: 'visible',
              overflowX: 'hidden',
            }}
          >
            <XStack items="center" justify="space-between" gap="$2" flexWrap="wrap">
              <Text render="h2" m={0} fontSize="$4" fontWeight="600" color="$ink">
                {t('Upcoming meetings')}
              </Text>
              <Text fontSize="$1" color="$soft">
                {t('Synced with Calendar')}
              </Text>
            </XStack>

            <YStack gap="$3">
              {meetings.map((m) => (
                <YStack
                  key={m.id}
                  bg="$background"
                  borderWidth={1}
                  borderColor="$borderColor"
                  rounded="$4"
                  p="$3.5"
                  gap="$3"
                >
                  <YStack gap="$1.5">
                    <XStack items="center" justify="space-between" gap="$1.5" flexWrap="wrap">
                      <Text
                        fontSize="$1"
                        fontWeight="500"
                        bg="$raised"
                        color="$ink"
                        px="$1.5"
                        py="$0.5"
                        rounded="$xs"
                      >
                        {t('{date} · {time}', { date: t(m.date), time: m.time })}
                      </Text>
                      {m.botInvited ? (
                        <XStack items="center" gap="$1">
                          <Bot size={12} color="var(--muted-foreground)" aria-hidden />
                          <Text fontSize="$1" color="$soft" fontWeight="500">{t('Agents attending')}</Text>
                        </XStack>
                      ) : null}
                    </XStack>

                    <Text fontSize="$3" fontWeight="600" color="$ink" lineHeight="$3">
                      {t(m.title)}
                    </Text>

                    {/* Attendees & Agents row */}
                    <XStack items="center" gap="$1.5" flexWrap="wrap">
                      <Text fontSize="$1" color="$soft">
                        {t('Host: {host}', { host: m.hostName ? t(m.host, { name: m.hostName }) : t(m.host) })}
                      </Text>
                      {m.agents && m.agents.length > 0 ? (
                        <XStack display="inline-flex" items="center" gap="$1">
                          <Text fontSize="$1" color="$soft">·</Text>
                          <Text fontSize="$1" color="$soft">
                            {m.agents.join(', ')}
                          </Text>
                        </XStack>
                      ) : null}
                    </XStack>
                  </YStack>

                  <XStack gap="$2">
                    <Button
                      variant="outline"
                      borderColor="var(--border-strong)"
                      size="sm"
                      flex={1}
                      minH={36}
                      $max-sm={{ minH: 44 }}
                      onClick={() => {
                        if (m.agents) {
                          setInvitedAgents(m.agents)
                          if (m.agents[0]) setActiveCoPilotAgent(m.agents[0])
                        }
                        setActiveCall(m.call)
                      }}
                    >
                      <Video size={13} />
                      {t('Join call')}
                    </Button>
                    <Button
                      variant="outline"
                      borderColor="var(--border-strong)"
                      size="icon-sm"
                      minH={36}
                      minW={36}
                      $max-sm={{ minH: 44, minW: 44 }}
                      aria-label={t('Copy invite link')}
                      title={t('Copy invite link')}
                      onClick={() => handleCopyLink(m.call)}
                    >
                      <Copy size={13} />
                    </Button>
                  </XStack>
                </YStack>
              ))}
            </YStack>

            {/* Schedule Meeting Callout linking to /cal */}
            <YStack
              mt="auto"
              p="$3.5"
              bg="$background"
              rounded="$4"
              borderWidth={1}
              borderColor="$borderColor"
              gap="$2"
            >
              <YStack gap="$1">
                <XStack items="center" gap="$2">
                  <Calendar size={14} color="var(--muted-foreground)" aria-hidden />
                  <Text fontSize="$3" fontWeight="600" color="$ink">{t('Need to book a slot?')}</Text>
                </XStack>
                <Text fontSize="$2" color="$soft" lineHeight="$3">
                  {t('Use Hanzo Calendar to coordinate available times across team members and bots.')}
                </Text>
              </YStack>
              <Button asChild variant="link" size="sm" px={0} justify="flex-start">
                <a href="/cal">
                  {t('Open calendar scheduler')}
                  <ArrowRight size={12} />
                </a>
              </Button>
            </YStack>
          </YStack>
        </XStack>
      )}
    </YStack>
  )
}

/** A note's time, as the reader's clock shows it: 4:22 PM, never "4:22:". */
function clock(locale: string): string {
  return new Date().toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
}
