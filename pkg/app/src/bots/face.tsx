'use client'

// A bot's face, or a person's.
//
// Core team members resolve their memoji portrait via `roleOf(bot.name)` when
// the agent row itself stores no custom avatar URL; people render their own
// avatar or crisp initial disc. Lead seat #1 (`starred`) wears the subtle star
// badge in the 3x4 roster grid.

import type { Agent } from '@hanzo/ai'
import { Text, YStack } from '@hanzo/gui'
import { Star } from 'lucide-react'

import { roleOf } from '../cast'
import { called } from '../team'
import { FLOOR, INK } from './ink'

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
  const src = bot.avatar || (!person ? roleOf(bot.name)?.portrait : undefined)
  const label = person ? (bot.name || '') : called(bot.name || '')
  const glyph = Math.round(size * (bot.emoji ? 0.5 : 0.42))

  const disc = src ? (
    <YStack render="img" {...{ src, alt: '' }} aria-hidden {...round} objectFit="cover" />
  ) : (
    <YStack
      aria-hidden
      {...round}
      items="center"
      justify="center"
      bg={person ? 'var(--info, var(--secondary))' : 'var(--secondary)'}
      {...{ userSelect: 'none' }}
    >
      <Text color={person ? 'var(--pure-white, var(--foreground))' : INK} fontSize={glyph} lineHeight={glyph} fontWeight="600">
        {bot.emoji || (label || '?').trim().charAt(0).toUpperCase()}
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
