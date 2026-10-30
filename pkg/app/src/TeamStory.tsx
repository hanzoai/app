'use client'

import { ArrowUpRight } from 'lucide-react'
import { phrase } from '@hanzo/i18n'
import { useI18n } from '@hanzo/i18n/react'
import { Text, View, XStack, YStack } from '@hanzo/ui'

/**
 * Hanzo Team's story, told once for both pages that tell it: hanzo.team's
 * landing and hanzo.ai/team. Each draws it in its own chrome (its bar, its
 * bands, its heading type) around `TeamPreview`; the words, the three points and
 * where each one leads are here, so the two cannot drift.
 *
 * Every sentence states something the product does: organizations and channels
 * (the switcher, the channels), agents with roles and spending limits (an agent's
 * settings: a period cap and the most one task may spend, docs "Budgets"),
 * agents handing work to agents (Hanzo Bot's multi-agent sessions), and the
 * approval mode (Auto, which the app also calls autonomous, or Manual,
 * supervised). The preview is sample data and says so (`TEAM.note`).
 */

const CONTACT = 'https://hanzo.ai/contact-sales'

export const TEAM = {
  name: 'Hanzo Team',
  /** The page's one heading: the owner's words on hanzo.team. */
  title: phrase('The playground for humans + AI'),
  lede: phrase('Your people and your AI agents plan, build, and ship together — in one connected workspace.'),
  line: phrase('Agents pass work to each other in your channels and bring a person in only when a decision is theirs.'),
  /** Where a reader who wants a person goes. */
  contact: { label: phrase('Talk to us'), href: CONTACT },
  /** Under the preview: what it is, so nobody reads sample data as a claim. */
  note: phrase('Illustrative preview: a sample workspace with sample people, agents and companies. Nothing in it runs.'),
  how: {
    eyebrow: phrase('How it works'),
    title: phrase('Agents do the work. People make the calls.'),
    sub: phrase('Every agent works for the people who hand it work. They share your channels, pass work along, and stop for a person when a decision is theirs.'),
  },
  points: [
    {
      title: phrase('A team that works for you'),
      body: phrase('Each agent has a name, a role and its own spending limits, and works in your channels beside the people who hand it work.'),
      link: { label: phrase('Meet the AI teammates'), href: 'https://hanzo.team/agents' },
    },
    {
      title: phrase('Handoffs without a meeting'),
      body: phrase('One agent hands work to another with a message, so the channel is the record. Routine back-and-forth never waits on a person.'),
      link: { label: phrase('How agents work together'), href: 'https://docs.hanzo.bot/docs/concepts/multi-agent' },
    },
    {
      title: phrase('Only the decisions that need you'),
      body: phrase('Choose autonomous, where agents run tools on their own and stop for anything risky, or supervised, where they ask first. Budgets hold either way.'),
      link: { label: phrase('Budgets in the docs'), href: 'https://docs.hanzo.ai/docs/concepts/budgets' },
    },
  ],
  close: {
    title: phrase('One place for your team and its agents.'),
    line: phrase('Every organization you belong to, every channel, every agent, on one rail.'),
  },
} as const

/** The three points, numbered, each ending in where to read more. */
export function TeamPoints() {
  const { t } = useI18n()
  return (
    <View
      render="ol"
      display="grid"
      gridTemplateColumns="minmax(0, 1fr)"
      gap={32}
      m={0}
      p={0}
      $md={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 24 }}
      $platform-web={{ listStyle: 'none', textAlign: 'start' }}
    >
      {TEAM.points.map((p, i) => (
        <YStack key={p.title} render="li" gap={10} pt={16} borderTopWidth={1} borderColor="$edge">
          <Text fontFamily="$mono" fontSize="$2" color="$soft" data-i18n-ltr>
            {String(i + 1).padStart(2, '0')}
          </Text>
          <Text render="h3" m={0} fontSize="$6" lineHeight="$6" fontWeight="600" color="$ink">
            {t(p.title)}
          </Text>
          <Text render="p" m={0} fontSize="$3" lineHeight="$4" color="$soft">
            {t(p.body)}
          </Text>
          <XStack render={<a href={p.link.href} />} items="center" gap={6} mt={4} self="flex-start" hoverStyle={{ opacity: 0.8 }} $platform-web={{ textDecoration: 'none' }}>
            <Text fontSize="$2" fontWeight="600" color="$ink">
              {t(p.link.label)}
            </Text>
            <ArrowUpRight size={14} color="var(--foreground)" aria-hidden data-i18n-mirror />
          </XStack>
        </YStack>
      ))}
    </View>
  )
}

/** The line under the preview that says it is sample data. */
export function TeamNote() {
  const { t } = useI18n()
  return (
    <Text render="p" m={0} mt={12} fontSize="$1" lineHeight="$2" color="$soft" $platform-web={{ textAlign: 'center' }}>
      {t(TEAM.note)}
    </Text>
  )
}
