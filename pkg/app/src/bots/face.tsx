'use client'

// A bot's face, or a person's.
//
// Three answers, in the order the record decides them: the image it carries, the
// one glyph somebody picked before it had one, or its initial on a neutral disc.
// The platform's own rule — at most one of avatar/emoji is ever set — so nothing
// here ranks two. Grey, because a face is not a category.

import type { Agent } from '@hanzo/ai'
import { Text, YStack } from '@hanzo/gui'

import { INK } from './ink'

export function Face({ bot, size = 36 }: { bot: Pick<Agent, 'name' | 'avatar' | 'emoji'>; size?: number }) {
  const round = { width: size, height: size, shrink: 0, rounded: 9999, overflow: 'hidden' } as const

  if (bot.avatar) return <YStack render="img" {...{ src: bot.avatar, alt: '' }} aria-hidden {...round} objectFit="cover" />

  // The glyph scales with the disc, so its size is a number of pixels rather
  // than a rung; the leading is the size itself, which centres it.
  const glyph = Math.round(size * (bot.emoji ? 0.5 : 0.42))
  return (
    // `userSelect` is a gui style its types do not list, so it is spread.
    <YStack aria-hidden {...round} items="center" justify="center" bg="var(--secondary)" {...{ userSelect: 'none' }}>
      <Text color={INK} fontSize={glyph} lineHeight={glyph} fontWeight="500">
        {bot.emoji || (bot.name || '?').trim().charAt(0).toUpperCase()}
      </Text>
    </YStack>
  )
}
