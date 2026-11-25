'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { XStack, YStack } from '@hanzo/gui'
import { Button, Input, Text } from '@hanzo/ui'
import { Bot, Loader2, LogIn, Send, Sparkles, X } from 'lucide-react'
import { askFacultyTutor } from './api'
import { FACULTY_BOTS, FACULTY_BY_ID } from './catalog'
import type { CourseSpec, CourseTabId, FacultyBotId, FacultyMessage } from './types'

export function FacultySidebar({
  course,
  activeTab,
  activeStepTitle,
  signedIn,
  onSignIn,
  onClose,
}: {
  course: CourseSpec
  activeTab: CourseTabId
  activeStepTitle?: string
  signedIn: boolean
  onSignIn: () => void
  onClose?: () => void
}) {
  const { t } = useI18n()
  const [selectedBotId, setSelectedBotId] = useState<FacultyBotId>(course.defaultFaculty)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState<FacultyMessage[]>([])

  useEffect(() => {
    setSelectedBotId(course.defaultFaculty)
    setMessages([])
  }, [course.slug, course.defaultFaculty])

  const bot = FACULTY_BY_ID[selectedBotId] ?? FACULTY_BOTS[0]!

  const sendPrompt = async (text: string) => {
    const clean = text.trim()
    if (!clean || sending) return
    const now = new Date().toISOString()
    const userMsg: FacultyMessage = {
      id: `u_${Date.now().toString(36)}`,
      role: 'user',
      content: clean,
      botId: bot.id,
      createdAt: now,
    }
    const nextHistory = [...messages, userMsg]
    setMessages(nextHistory)
    setDraft('')
    setSending(true)
    try {
      const res = await askFacultyTutor({
        bot,
        course,
        activeTab,
        activeStepTitle,
        history: messages,
        prompt: clean,
      })
      const assistantMsg: FacultyMessage = {
        id: `a_${Date.now().toString(36)}`,
        role: 'assistant',
        content: res.error ? res.error : res.reply,
        botId: bot.id,
        createdAt: new Date().toISOString(),
        error: res.error,
      }
      setMessages([...nextHistory, assistantMsg])
    } finally {
      setSending(false)
    }
  }

  return (
    <YStack
      data-slot="learn-faculty-sidebar"
      width={340}
      shrink={0}
      minH={0}
      borderInlineStartWidth={1}
      borderColor="$edge"
      bg="var(--card)"
      $max-lg={{
        width: '100%',
        borderInlineStartWidth: 0,
        borderTopWidth: 1,
        maxH: 520,
      }}
    >
      {/* Header */}
      <XStack
        px="$3.5"
        py="$3"
        items="center"
        justify="space-between"
        gap="$2"
        borderBottomWidth={1}
        borderColor="$edge"
        shrink={0}
      >
        <XStack items="center" gap="$2" flex={1} minW={0}>
          <Bot size={16} aria-hidden />
          <YStack minW={0} flex={1}>
            <Text fontSize="$3" fontWeight="600" color="$ink" numberOfLines={1}>
              {t('AI Faculty')} · {bot.handle}
            </Text>
            <Text fontSize="$1" color="$soft" numberOfLines={1}>
              {bot.role}
            </Text>
          </YStack>
        </XStack>
        {onClose ? (
          <XStack
            render={<button type="button" />}
            aria-label={t('Close AI Faculty')}
            onClick={onClose}
            width={26}
            height={26}
            rounded="$2"
            items="center"
            justify="center"
            cursor="pointer"
            hoverStyle={{ bg: '$hover' }}
          >
            <X size={14} aria-hidden />
          </XStack>
        ) : null}
      </XStack>

      {/* Switchable 8-Bot Faculty Rail */}
      <XStack
        data-slot="faculty-bot-switcher"
        px="$3"
        py="$2"
        gap="$1.5"
        flexWrap="wrap"
        borderBottomWidth={1}
        borderColor="$edge"
        shrink={0}
      >
        {FACULTY_BOTS.map((member) => {
          const active = member.id === bot.id
          return (
            <XStack
              key={member.id}
              render={<button type="button" />}
              data-slot={`faculty-bot-${member.id}`}
              aria-pressed={active}
              onClick={() => setSelectedBotId(member.id)}
              px="$2"
              py="$1"
              rounded="$2"
              borderWidth={1}
              borderColor={active ? 'var(--border-strong)' : '$edge'}
              bg={active ? '$raised' : 'transparent'}
              hoverStyle={{ bg: active ? '$raised' : '$hover' }}
              cursor="pointer"
            >
              <Text fontSize="$1" fontFamily="$mono" fontWeight={active ? '600' : '400'} color={active ? '$ink' : '$soft'}>
                {member.handle}
              </Text>
            </XStack>
          )
        })}
      </XStack>

      {/* Context strip */}
      <YStack px="$3.5" py="$2" bg="$background" borderBottomWidth={1} borderColor="$edge" gap="$0.5" shrink={0}>
        <Text fontSize="$1" fontFamily="$mono" color="$soft" numberOfLines={1}>
          {course.code} · {activeTab} · model: enso (/v1/chat/completions)
        </Text>
        <Text fontSize="$1" color="$quiet" numberOfLines={2}>
          {activeStepTitle ? `${t('Active step')}: ${activeStepTitle}` : bot.specialty}
        </Text>
      </YStack>

      {/* Messages or Signed-Out Gate */}
      <YStack flex={1} minH={160} overflowY="auto" p="$3.5" gap="$2.5">
        {!signedIn ? (
          <YStack
            data-slot="faculty-signin-prompt"
            p="$3.5"
            rounded="$3"
            borderWidth={1}
            borderColor="$edge"
            bg="$background"
            gap="$2.5"
          >
            <XStack items="center" gap="$2">
              <Sparkles size={15} aria-hidden />
              <Text fontSize="$2" fontWeight="600" color="$ink">
                {t('Sign in to chat live with')} {bot.handle}
              </Text>
            </XStack>
            <Text fontSize="$2" color="$soft">
              {t('Faculty tutors run live against POST /v1/chat/completions (model: enso) using your Hanzo IAM session — pre-seeded with')} {course.code} {t('and your current lab step.')}
            </Text>
            <Button size="sm" variant="primary" data-slot="faculty-signin-btn" onPress={onSignIn}>
              <LogIn size={13} aria-hidden />
              {t('Sign in with Hanzo IAM')}
            </Button>
          </YStack>
        ) : null}

        {messages.length === 0 ? (
          <YStack gap="$2">
            <Text fontSize="$2" color="$soft">
              {bot.handle} ({bot.role}) — {bot.specialty}.
            </Text>
            <YStack gap="$1.5">
              {bot.quickPrompts.map((qp, idx) => (
                <XStack
                  key={idx}
                  render={<button type="button" />}
                  data-slot={`faculty-quick-${idx}`}
                  onClick={() => (signedIn ? void sendPrompt(qp) : onSignIn())}
                  p="$2.5"
                  rounded="$3"
                  borderWidth={1}
                  borderColor="$edge"
                  bg="$background"
                  hoverStyle={{ bg: '$hover' }}
                  cursor="pointer"
                >
                  <Text fontSize="$2" color="$ink" text="start">
                    {qp}
                  </Text>
                </XStack>
              ))}
            </YStack>
          </YStack>
        ) : (
          messages.map((msg) => (
            <YStack
              key={msg.id}
              data-slot={`faculty-msg-${msg.role}`}
              p="$2.5"
              rounded="$3"
              borderWidth={1}
              borderColor={msg.error ? 'var(--state-error)' : '$edge'}
              bg={msg.role === 'user' ? '$raised' : '$background'}
              gap="$1"
            >
              <Text fontSize="$1" fontFamily="$mono" color="$soft">
                {msg.role === 'user' ? t('You') : FACULTY_BY_ID[msg.botId]?.handle ?? bot.handle}
              </Text>
              <Text fontSize="$2" color={msg.error ? 'var(--state-error)' : '$ink'}>
                {msg.content}
              </Text>
            </YStack>
          ))
        )}
      </YStack>

      {/* Input composer */}
      <XStack
        p="$3"
        gap="$2"
        items="center"
        borderTopWidth={1}
        borderColor="$edge"
        shrink={0}
      >
        <Input
          flex={1}
          minW={0}
          data-slot="faculty-input"
          aria-label={`Ask ${bot.handle}`}
          placeholder={signedIn ? `Ask ${bot.handle} about ${course.code}…` : 'Sign in to ask AI Faculty…'}
          value={draft}
          onChangeText={setDraft}
          onKeyDown={(e: { key?: string; preventDefault?: () => void }) => {
            if (e.key === 'Enter' && signedIn && draft.trim()) {
              e.preventDefault?.()
              void sendPrompt(draft)
            }
          }}
        />
        <Button
          size="sm"
          variant="primary"
          data-slot="faculty-send"
          disabled={sending || (signedIn && !draft.trim())}
          onPress={() => (signedIn ? void sendPrompt(draft) : onSignIn())}
        >
          {sending ? <Loader2 size={14} aria-hidden /> : <Send size={14} aria-hidden />}
        </Button>
      </XStack>
    </YStack>
  )
}
