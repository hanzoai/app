'use client'

// A bot's face, or a person's.
//
// Core team members resolve their memoji portrait via `roleOf(bot.name)` when
// the agent row itself stores no custom avatar URL; people render their own
// avatar or crisp initial disc (ignoring auto-generated Gravatar identicons).

import { useEffect, useState } from 'react'
import type { Agent } from '@hanzo/ai'
import { Text, YStack } from '@hanzo/gui'
import { Star } from 'lucide-react'

import { roleOf } from '../cast'
import { called } from '../team'
import { FLOOR, INK } from './ink'

export function cleanAvatarUrl(url?: string | null): string | undefined {
  if (!url) return undefined
  const u = url.trim()
  if (!u) return undefined
  // Strip auto-generated default Gravatar identicons so Hanzo renders its clean
  // monochrome initial disc without making external gravatar.com requests.
  if (u.includes('gravatar.com/avatar/') && u.includes('d=identicon')) return undefined
  return u
}

export function Face({
  bot,
  size = 36,
  person = false,
  starred = false,
}: {
  bot: Pick<Agent, 'name' | 'avatar' | 'emoji'>
  size?: number
  person?: boolean
  starred?: boolean
}) {
  const round = { width: size, height: size, shrink: 0, rounded: 9999, overflow: 'hidden' } as const
  const candidate = cleanAvatarUrl(bot.avatar) || (!person ? roleOf(bot.name)?.portrait : undefined)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [candidate])

  const src = failed ? undefined : candidate
  const label = person ? (bot.name || '') : called(bot.name || '')
  const words = label.trim().split(/\s+/).filter(Boolean)
  const initials = person && words.length >= 2
    ? `${words[0].charAt(0)}${words[words.length - 1].charAt(0)}`.toUpperCase()
    : (label || '?').trim().charAt(0).toUpperCase()
  const glyph = Math.round(size * (bot.emoji ? 0.5 : person && initials.length > 1 ? 0.36 : 0.42))

  const disc = src ? (
    <YStack
      render="img"
      {...{ src, alt: '', onError: () => setFailed(true) }}
      aria-hidden
      {...round}
      objectFit="cover"
    />
  ) : (
    <YStack
      aria-hidden
      {...round}
      items="center"
      justify="center"
      bg="var(--raised)"
      borderWidth={1}
      borderColor="var(--border)"
      {...{ userSelect: 'none' }}
    >
      <Text color={INK} fontSize={glyph} lineHeight={glyph} fontWeight="600">
        {bot.emoji || initials}
      </Text>
    </YStack>
  )

  if (!starred) return disc

  return (
    <YStack position="relative" width={size} height={size} shrink={0}>
      {disc}
      <YStack
        aria-hidden
        position="absolute"
        r={-1}
        b={-1}
        width={20}
        height={20}
        rounded={9999}
        items="center"
        justify="center"
        bg="var(--warning, var(--chrome-dot-yellow))"
        borderWidth={2}
        borderColor={FLOOR}
      >
        <Star size={10} color="var(--pure-white, var(--foreground))" fill="currentColor" strokeWidth={2} />
      </YStack>
    </YStack>
  )
}
