'use client'

// The room while a settings row is open: every section's screen (Settings.tsx
// holds the rows). Loaded when a row is chosen, never with the room.

import { useMemo, useState } from 'react'
import { ArrowUpRight, ExternalLink } from 'lucide-react'
import {
  Box,
  Button,
  Separator,
  Text,
  XStack,
  YStack,
} from '@hanzo/ui'
import { tap } from './lib/tap'
import { useIam, useIamIdentity, useOrganizations } from '@hanzo/iam/react'
import { useSignOut } from './lib/signout'
import { useModels } from '@hanzo/ai/react'
import { ModelPicker } from '@hanzo/ui/models'
import { parseModels } from '@hanzo/ui/models/catalog'
import { UsagePanel } from '@hanzo/usage/panel'
import { administers, Credits, label, Plan, Title, useChoice } from '@hanzo/build'
import { Catalog } from './Directory'
import { payPage } from './lib/pay'
import { api } from './lib/api'
import { renewal, useSubscription, useTier } from './lib/tier'
import { spendShown, useLimits } from './lib/limits'
import { showSettings } from './open'
import { Look } from './look'
import { ProviderMark } from './ProviderMark'
import { bearer, org, pick } from './lib/session'
import { site } from './where'
import { ROWS } from './Settings'

/** A choice among a few: a hairline edge and a corner. The fill and the edge's
 *  ink are the call site's, because they say which one is chosen. */
const CHOICE = { rounded: 8, borderWidth: 1, borderStyle: 'solid', cursor: 'pointer' } as const

/**
 * The room, while a settings row is open.
 *
 * It scrolls itself, the way the column beside a room does: `main` gives its
 * child a floor and no overflow, so a pane that did not would push the whole
 * shell down the page.
 */
export function SettingsPane({ id }: { id: string }) {
  const row = ROWS.find((r) => r.id === id)

  return (
    <YStack flex={1} minH={0} overflowY="auto" overflowX="hidden">
      <YStack p="$5" gap="$4" maxW={860}>
        <Text fontSize="$6" fontWeight="600" color="$ink">
          {row?.label ?? 'Settings'}
        </Text>
        <Pane id={id} note={row?.note} />
      </YStack>
    </YStack>
  )
}

/** One pane. */
function Pane({ id, note }: { id: string; note?: string }) {
  if (id === 'apps' || id === 'channels') return <Catalog tab={id} />
  if (id === 'general') return <Look />
  if (id === 'account') return <Account />
  if (id === 'billing') return <Billing />
  if (id === 'usage') return <Usage />
  if (id === 'model') return <Model />
  if (id === 'models') return <Served />
  if (id === 'agent') return <AgentSettings />
  if (id === 'capabilities') return <Capabilities />
  if (id === 'memory') return <MemorySettings />

  return (
    <Text fontSize="$3" color="$soft">
      {note ?? 'Nothing to configure here yet.'}
    </Text>
  )
}

/**
 * One default in one place; agents may still bring their own model. A premium
 * model is never a default: it is picked per conversation, in the composer, so
 * this picker offers the rest of the catalog.
 */
function Model() {
  const { models: served } = useModels()
  const models = useMemo(() => parseModels(served).filter((m) => m.class !== 'premium'), [served])
  // The one choice Chat and Dev share (@hanzo/build): changed here, changed in both composers.
  const [choice, choose] = useChoice()

  return (
    <YStack gap="$3" maxW={420}>
      <Text fontSize="$3" color="$soft">
        Used for new chats and new runs. An agent with its own model keeps that choice. Premium models are picked per
        conversation in the composer.
      </Text>
      <XStack self="flex-start">
        <ModelPicker models={models} scope="chat" value={choice.model} onChange={(id) => choose({ model: id })} size="sm" />
      </XStack>
    </YStack>
  )
}

/**
 * WHAT THE GATEWAY SERVES, read from the same `/v1/models` the rooms read.
 *
 * Counted, never typed: the catalog moves without this file, so a number written
 * here is wrong by the next deploy. An empty answer says the account reaches
 * nothing rather than drawing a zero, and the mark comes from the model's own
 * id so a family wears the logo of the lab that makes it.
 */
function Served() {
  const { models, loading, error } = useModels()

  if (loading) {
    return <Text fontSize="$3" color="$soft">Reading the catalog.</Text>
  }
  if (error) {
    return <Text fontSize="$3" color="$soft">The catalog did not answer: {error.message}</Text>
  }
  if (models.length === 0) {
    return (
      <Text fontSize="$3" color="$soft">
        No model answers on this account. Sign in to reach the ones your org opens.
      </Text>
    )
  }

  return (
    <YStack gap="$3">
      <Text fontSize="$3" color="$soft">
        {models.length} models answer at /v1/models on this account.
      </Text>
      <YStack>
        {models.map((m) => (
          <XStack
            key={m.id}
            items="center"
            gap="$2.5"
            py="$2"
            borderBottomWidth={1}
            borderColor="$borderColor"
          >
            <ProviderMark model={m.id} org={m.owned_by} size={16} ink />
            <Text fontSize="$2" color="$ink" flex={1}>{m.id}</Text>
            {m.owned_by ? <Text fontSize="$1" color="$soft">{m.owned_by}</Text> : null}
          </XStack>
        ))}
      </YStack>
      <XStack>
        <Box render={<a href={site('/models')} />} {...tap}>
          <XStack items="center" gap="$2" py="$2">
            <Text fontSize="$3" color="$ink">Browse the model catalog</Text>
            <ArrowUpRight size={13} aria-hidden />
          </XStack>
        </Box>
      </XStack>
    </YStack>
  )
}

/** Who is signed in, and where they can act. */
function Account() {
  const identity = useIamIdentity()
  const { isAuthenticated } = useIam()
  const logout = useSignOut()
  const { organizations, currentOrgId, currentRole, switchOrg } = useOrganizations()

  if (!isAuthenticated || !identity) {
    return <Text fontSize="$3" color="$soft">Sign in to see your account.</Text>
  }

  return (
    <YStack gap="$4">
      <XStack items="center" gap="$3">
        <YStack
          width={44}
          height={44}
          rounded={22}
          bg="$borderColor"
          items="center"
          justify="center"
        >
          <Text fontSize="$3" color="$ink">{identity.initials}</Text>
        </YStack>
        <YStack gap="$1" flex={1} minW={0}>
          <Text fontSize="$4" color="$ink">{identity.name}</Text>
          {identity.email ? <Text fontSize="$2" color="$soft">{identity.email}</Text> : null}
        </YStack>
      </XStack>

      <Separator />

      <YStack gap="$2">
        <Text fontSize="$2" color="$soft">Organizations</Text>
        {organizations.length === 0 ? (
          <Text fontSize="$3" color="$soft">You are not a member of an organization.</Text>
        ) : (
          organizations.map((o) => {
            const here = o.name === currentOrgId
            return (
              <Box render={<button type="button" />} key={o.name} onClick={() => { pick(o.name); switchOrg(o.name) }} {...tap}>
                <XStack items="center" justify="space-between" py="$2" width="100%" gap="$2">
                  <Text fontSize="$3" color={here ? '$ink' : '$soft'}>{o.displayName || o.name}</Text>
                  {here && currentRole ? <Text fontSize="$2" color="$soft">{currentRole}</Text> : null}
                </XStack>
              </Box>
            )
          })
        )}
      </YStack>

      <Separator />

      <XStack>
        <Button size="sm" onClick={() => logout()}>Sign out</Button>
      </XStack>
    </YStack>
  )
}

/** Where the plan's and billing's reads go: this browser's bearer, in its organization. */
function useTarget() {
  const scoped = org()
  return useMemo(() => ({ api: api(), token: bearer, org: scoped }), [scoped])
}

/**
 * The plan and its term, then the credits — @hanzo/build's `Credits`, the one
 * view every Billing page draws: the balance, grants, auto-reload, this month's
 * spend and its limit, said to be separate from the plan's usage. Money moves on
 * the payment host, so adding funds and a card both open it.
 */
function Billing() {
  const { isAuthenticated } = useIam()
  const t = useTarget()
  const { tier } = useTier(isAuthenticated, org())
  const sub = useSubscription(isAuthenticated, org())
  if (!isAuthenticated) return <Text fontSize="$3" color="$soft">Sign in to see billing.</Text>
  // WHAT THE CUSTOMER BOUGHT, by its family: `Max` with `20x` beside it.
  const plan = tier ? label(tier.plan, tier.tier.name) ?? { name: 'Free', tag: '' } : null
  return (
    <YStack gap="$5">
      {plan ? (
        <YStack gap="$1" data-slot="billing-plan">
          <Title label={plan} size="$5" />
          <Text fontSize="$2" color="$soft">
            {sub ? renewal(sub) : tier?.plan ? 'Your plan.' : 'No paid plan. Usage is paid from credits.'}
          </Text>
        </YStack>
      ) : (
        <Text fontSize="$3" color="$soft">Reading your plan…</Text>
      )}
      <Credits target={t} admin={administers(bearer(), org())} add={payPage()} />
      <Separator />
      <YStack gap="$2">
        <Text fontSize="$2" color="$soft">Payment</Text>
        <Text fontSize="$3" color="$soft">
          A card is entered on the payment host and nowhere else, so this is the one
          control here that opens another surface.
        </Text>
        <XStack>
          <Box render={<a href={payPage()} target="_blank" rel="noreferrer" />} {...tap}>
            <XStack items="center" gap="$2" py="$2">
              <Text fontSize="$3" color="$ink">Manage plan, payment method and invoices</Text>
              <ExternalLink size={13} aria-hidden />
            </XStack>
          </Box>
        </XStack>
      </YStack>
    </YStack>
  )
}

/**
 * Usage: @hanzo/build's `Plan`, the one view every Usage page draws — the plan's
 * windows and each class of model's share, as shares; the free allowance on
 * Free; the balance with no plan — and the choice of paying from credits once
 * the allowance runs out. A reader with no paid plan also sees what was spent,
 * over time (@hanzo/usage), because money is their meter.
 */
function Usage() {
  const { accessToken, isAuthenticated } = useIam()
  const t = useTarget()
  const read = useLimits(isAuthenticated, org())

  if (!isAuthenticated || !accessToken) {
    return <Text fontSize="$3" color="$soft">Sign in to see your usage.</Text>
  }
  const plan = <Plan target={t} onPlans={() => window.location.assign(site('/pricing'))} onBilling={() => showSettings('billing')} />
  if (!spendShown(read)) return plan
  // The address is read HERE rather than at import: the panel sends the bearer
  // with every read, and a credentialed read to an absolute address from a page
  // the gateway does not admit dies in preflight — which drew this panel as an
  // account that had spent nothing.
  return (
    <YStack gap="$6">
      {plan}
      <UsagePanel baseUrl={api()} token={accessToken} upgrade={payPage()} title="Spend" />
    </YStack>
  )
}

const HISTORICAL_PERSONAS = [
  { id: 'architect', name: 'Software Architect', role: 'Full-stack & systems design' },
  { id: 'satoshi', name: 'Satoshi Nakamoto', role: 'Distributed cryptography & consensus' },
  { id: 'turing', name: 'Alan Turing', role: 'Algorithmic logic & formal verification' },
  { id: 'ada', name: 'Ada Lovelace', role: 'Computational precision & analysis' },
  { id: 'davinci', name: 'Leonardo da Vinci', role: 'Polymathic engineering & design' },
]

function AgentSettings() {
  const [instructions, setInstructions] = useState(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('hanzo.agent.instructions') || 'You are an autonomous AI software engineer at Hanzo. Think step-by-step and write robust code.'
  })
  const [persona, setPersona] = useState(() => {
    if (typeof window === 'undefined') return 'architect'
    return localStorage.getItem('hanzo.agent.persona') || 'architect'
  })
  const [autonomy, setAutonomy] = useState<'supervised' | 'autonomous'>(() => {
    if (typeof window === 'undefined') return 'autonomous'
    return (localStorage.getItem('hanzo.agent.autonomy') as any) || 'autonomous'
  })
  const [saved, setSaved] = useState(false)

  const save = () => {
    localStorage.setItem('hanzo.agent.instructions', instructions)
    localStorage.setItem('hanzo.agent.persona', persona)
    localStorage.setItem('hanzo.agent.autonomy', autonomy)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <YStack gap="$4" maxW={480}>
      <Text fontSize="$3" color="$soft">
        Nothing is bound to this surface yet — when you bind a personal agent, its persona, tools and memory live here rather than in a shared team.
      </Text>
      <YStack gap="$1.5">
        <Text fontSize="$3" fontWeight="600" color="$ink">Persona & Historical Character</Text>
        <Text fontSize="$2" color="$soft">
          Pick an intellectual archetype for agent reasoning and tone.
        </Text>
        <XStack flexWrap="wrap" gap="$2" pt="$1">
          {HISTORICAL_PERSONAS.map((p) => {
            const active = persona === p.id
            return (
              <Box
                render={<button type="button" />}
                key={p.id}
                {...tap}
                onClick={() => setPersona(p.id)}
                {...CHOICE}
                bg={active ? 'var(--edge, var(--white-14))' : 'transparent'}
                borderColor={active ? 'var(--borderColor, var(--white-22))' : 'var(--white-08)'}
                py={6}
                px={12}
              >
                <Text fontSize="$2" fontWeight={active ? '600' : '400'} color={active ? '$ink' : '$soft'}>
                  {p.name}
                </Text>
              </Box>
            )
          })}
        </XStack>
      </YStack>

      <Separator />

      <YStack gap="$1.5">
        <Text fontSize="$3" fontWeight="600" color="$ink">System Prompt Instructions</Text>
        <Text fontSize="$2" color="$soft">
          Custom system directions prepended to all coding and research runs.
        </Text>
        <Text
          render={<textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} />}
          width="100%"
          bg="var(--panel, color-mix(in srgb, var(--pure-black) 30%, transparent))"
          color="inherit"
          borderWidth={1}
          borderColor="var(--borderColor, var(--white-15))"
          rounded={8}
          p={10}
          fontSize="$2"
          fontFamily="$mono"
        />
      </YStack>

      <Separator />

      <YStack gap="$1.5">
        <Text fontSize="$3" fontWeight="600" color="$ink">Autonomy & Permissions</Text>
        <XStack gap="$2">
          <Box
            render={<button type="button" />}
            {...tap}
            onClick={() => setAutonomy('autonomous')}
            {...CHOICE}
            flex={1}
            p={10}
            bg={autonomy === 'autonomous' ? 'var(--edge, var(--white-14))' : 'transparent'}
            borderColor={autonomy === 'autonomous' ? 'var(--borderColor, var(--white-22))' : 'var(--white-08)'}
          >
            <Text fontSize="$2" fontWeight="600" color="$ink">Autonomous</Text>
            <Text fontSize="$1" color="$soft">Executes tools & writes code without interrupting.</Text>
          </Box>
          <Box
            render={<button type="button" />}
            {...tap}
            onClick={() => setAutonomy('supervised')}
            {...CHOICE}
            flex={1}
            p={10}
            bg={autonomy === 'supervised' ? 'var(--edge, var(--white-14))' : 'transparent'}
            borderColor={autonomy === 'supervised' ? 'var(--borderColor, var(--white-22))' : 'var(--white-08)'}
          >
            <Text fontSize="$2" fontWeight="600" color="$ink">Supervised</Text>
            <Text fontSize="$1" color="$soft">Requests confirmation before file writes and commands.</Text>
          </Box>
        </XStack>
      </YStack>

      <XStack self="flex-start" pt="$2">
        <Button size="sm" onClick={save}>
          {saved ? 'Saved' : 'Save agent preferences'}
        </Button>
      </XStack>
    </YStack>
  )
}

/**
 * WHAT A RUN MAY REACH FOR — the four capabilities, described and not measured.
 *
 * Each row used to carry a badge reading "Enabled", and the MCP row read
 * "Active (:8080/mcp)". Nothing asked. No call stands behind any of the four,
 * so the badges said "on" for a reader whose run had none of it, and the port
 * was one developer's machine printed on everybody's settings pane. A green
 * light nobody wired is worse than no light: it is read as a check that passed.
 *
 * These are facts about the PRODUCT — what a run is allowed to do — which is
 * what this pane is for. Whether a given run got them is a fact about that run,
 * and the run is where it belongs.
 */
function Capabilities() {
  return (
    <YStack gap="$3" maxW={480}>
      <Text fontSize="$3" color="$soft">
        What models and agent swarms are granted access to during tasks.
      </Text>
      <YStack gap="$2" pt="$1">
        {[
          { title: 'Filesystem (Read / Write)', desc: 'Create, modify, and delete workspace files in the target repository.' },
          { title: 'Shell & Terminal Exec', desc: 'Execute build, test, and shell commands in isolated sandbox VMs.' },
          { title: 'Live Web & Search', desc: 'Query internet search APIs and fetch web documentation.' },
          { title: 'MCP Protocol Server', desc: 'Expose local and remote tools via Model Context Protocol at /mcp.' },
        ].map((cap) => (
          <YStack key={cap.title} gap="$0.5" p="$2.5" rounded="$3" borderWidth={1} borderColor="$borderColor">
            <Text fontSize="$3" fontWeight="600" color="$ink">{cap.title}</Text>
            <Text fontSize="$2" color="$soft">{cap.desc}</Text>
          </YStack>
        ))}
      </YStack>
    </YStack>
  )
}

function MemorySettings() {
  const [cleared, setCleared] = useState(false)

  const clearMemory = () => {
    localStorage.removeItem('hanzo.chat.history')
    setCleared(true)
    setTimeout(() => setCleared(false), 2000)
  }

  return (
    <YStack gap="$3" maxW={480}>
      <Text fontSize="$3" color="$soft">
        Semantic memory and conversation recall across sessions.
      </Text>
      {/* Described, not measured — the badge here read "Active (pgvector)" for
          an index nothing had asked about, and named the store it is kept in,
          which is the estate talking to itself. The button below is the one
          thing on this pane that acts, and it acts on this browser. */}
      <YStack gap="$0.5" p="$2.5" rounded="$3" borderWidth={1} borderColor="$borderColor">
        <Text fontSize="$3" fontWeight="600" color="$ink">Semantic Vector Index</Text>
        <Text fontSize="$2" color="$soft">Automatically indexes past workspace sessions into vector memory.</Text>
      </YStack>
      <XStack self="flex-start" pt="$2">
        <Button size="sm" variant="outline" onClick={clearMemory}>
          {cleared ? 'Memory cleared' : 'Clear local memory cache'}
        </Button>
      </XStack>
    </YStack>
  )
}
