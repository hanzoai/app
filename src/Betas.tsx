'use client'

// The apps in beta: which this reader may open, and the list they ask from.
//
// WHO MAY OPEN ONE is the cloud's answer, never this page's. Each app in beta is a
// principal switch, `beta.<id>`, decided per caller from the validated org and
// person (cloud apps/flags), and GET /v1/flag/platform answers every one for the
// signed-in caller. A SuperAdmin grants one to a person from their CRM record.
// `opens` (lib/betas) reads that answer, the one predicate every caller asks.
//
// WHAT THEY ASKED FOR is their CRM record's, apps/marketing's beta record:
// GET /v1/marketing/beta reads it and POST /v1/marketing/beta/request adds to it,
// stamped with the time and stated on the event plane under the person and the
// org, so the request reaches the team where it works the person.
//
// Signed out, still loading, or on any error nothing is open: a flags outage
// cannot leak an unfinished app.

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { phrase } from '@hanzo/i18n'
import { useI18n } from '@hanzo/i18n/react'
import { useIam } from '@hanzo/iam/react'
import { Button, Dialog, DialogContent, DialogTitle, Text, XStack, YStack } from '@hanzo/ui'
import { api } from './lib/api'
import { BETAS, GROUPS, opens, type Beta, type Group } from './lib/betas'
import { bearer, scope, superAdmin } from './lib/session'

/** What the cloud said for one token: the switches in force and what was asked for. */
interface Said {
  flags: Record<string, boolean>
  asked: string[]
}

const NONE: Said = { flags: {}, asked: [] }

/** A group's heading as the list draws it: authored English, drawn through `t`. */
const HEADING: Record<Group, string> = {
  Business: phrase('Business'),
  Data: phrase('Data'),
  Agents: phrase('Agents'),
  'Build & run': phrase('Build & run'),
  Security: phrase('Security'),
  Creative: phrase('Creative'),
}

/** One read per token, shared by every caller on the page. */
let held: { token: string; said: Said; at: number } | null = null
let reading: Promise<void> | null = null
const listeners = new Set<() => void>()
const tell = () => listeners.forEach((f) => f())

/** A switch read this long ago is read again on the next mount. */
const FRESH = 30_000

async function get<T>(path: string): Promise<T | null> {
  const r = await fetch(`${api()}${path}`, { headers: scope() })
  return r.ok ? ((await r.json()) as T) : null
}

function read(token: string): Promise<void> {
  if (reading) return reading
  reading = Promise.all([
    get<{ flags?: Record<string, boolean> }>('/v1/flag/platform').catch(() => null),
    get<{ betas?: string[] }>('/v1/marketing/beta').catch(() => null),
  ])
    .then(([f, b]) => {
      held = { token, said: { flags: f?.flags ?? {}, asked: b?.betas ?? [] }, at: Date.now() }
    })
    .finally(() => {
      reading = null
      tell()
    })
  return reading
}

const subscribe = (f: () => void) => {
  listeners.add(f)
  return () => listeners.delete(f)
}

/** The apps in beta as this reader stands: which open, which they asked for, and the ask. */
export function useBetas(): {
  /** The one predicate: whether this reader may open the app `id`. */
  open: (id: string) => boolean
  /** Whether they asked for it. */
  asked: (id: string) => boolean
  /** Ask for these apps. */
  request: (ids: string[]) => Promise<void>
  /** The cloud has answered for this reader. */
  ready: boolean
} {
  const { t } = useI18n()
  const { accessToken } = useIam()
  const [sudo, setSudo] = useState(false)
  const [local, setLocal] = useState(false)
  // Facts only the browser holds arrive after mount, so the first render
  // matches the HTML it hydrates.
  useEffect(() => setLocal(here()), [])
  useEffect(() => setSudo(superAdmin()), [accessToken])
  const token = accessToken ? bearer() ?? '' : ''
  const now = useSyncExternalStore(subscribe, () => held, () => null)
  useEffect(() => {
    if (token && (!held || held.token !== token || Date.now() - held.at > FRESH)) void read(token)
  }, [token])
  const said = token && now?.token === token ? now.said : NONE
  const open = useCallback((id: string) => opens(id, said.flags, sudo || local), [said, sudo, local])
  const asked = useCallback((id: string) => said.asked.includes(id), [said])
  const request = useCallback(
    async (ids: string[]) => {
      const r = await fetch(`${api()}/v1/marketing/beta/request`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...scope() },
        body: JSON.stringify({ betas: ids }),
      })
      if (!r.ok) throw new Error(r.status === 401 ? t('Sign in to ask for access.') : t('The request was not taken ({status}).', { status: r.status }))
      const record = (await r.json()) as { betas?: string[] }
      if (held && held.token === token) {
        held = { ...held, said: { ...held.said, asked: record.betas ?? [...held.said.asked, ...ids] } }
        tell()
      }
    },
    [token, t],
  )
  return { open, asked, request, ready: Boolean(token) && now?.token === token }
}

/**
 * Whether this page is served from a developer's own machine, where every app
 * opens: a room nobody can open is a room nobody can work on. The ORIGIN, which
 * no deployment can acquire by configuration.
 */
function here(): boolean {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.local') || /^10\./.test(host) || /^192\.168\./.test(host)
}

/** One app's action: Open where it may, Requested once asked, else Request access. */
function Ask({ beta, go }: { beta: Beta; go?: (href: string) => void }) {
  const { t } = useI18n()
  const { open, asked, request } = useBetas()
  const [busy, setBusy] = useState(false)
  const [wrong, setWrong] = useState<string | null>(null)
  if (open(beta.id)) {
    return beta.href && go ? (
      <Button size="sm" rounded={999} onPress={() => go(beta.href as string)} data-slot="beta-open">
        {t('Open')}
      </Button>
    ) : (
      <Text fontSize="$2" color="$color11" data-slot="beta-on">
        {t('You’re in')}
      </Text>
    )
  }
  if (asked(beta.id)) {
    return (
      <Text fontSize="$2" color="$color11" data-slot="beta-requested">
        {t('Requested')}
      </Text>
    )
  }
  return (
    <YStack items="flex-end" gap="$1">
      <Button
        size="sm"
        rounded={999}
        variant="outline"
        disabled={busy}
        data-slot="beta-request"
        onPress={() => {
          setBusy(true)
          setWrong(null)
          request([beta.id])
            .catch((e: unknown) => setWrong(e instanceof Error ? e.message : String(e)))
            .finally(() => setBusy(false))
        }}
      >
        {t(busy ? 'Requesting…' : 'Request access')}
      </Button>
      {wrong ? (
        <Text fontSize="$1" color="$red10">
          {wrong}
        </Text>
      ) : null}
    </YStack>
  )
}

/** Every app in beta, by group, each with its action. */
export function BetasList({ go }: { go?: (href: string) => void }) {
  const { t } = useI18n()
  return (
    <YStack gap="$4" data-slot="betas">
      {GROUPS.map((group) => (
        <YStack key={group} gap="$2">
          <Text fontSize="$1" color="$color10" textTransform="uppercase" letterSpacing={0.6}>
            {t(HEADING[group])}
          </Text>
          {BETAS.filter((b) => b.group === group).map((b) => (
            <XStack key={b.id} items="center" gap="$3" data-beta={b.id}>
              <YStack flex={1} minW={0}>
                <Text fontSize="$3" fontWeight="500">
                  {b.name}
                </Text>
                <Text fontSize="$2" color="$color11">
                  {t(b.line)}
                </Text>
              </YStack>
              <Ask beta={b} go={go} />
            </XStack>
          ))}
        </YStack>
      ))}
    </YStack>
  )
}

/** The Betas list in a dialog, from the rail's More. */
export function BetasDialog({ open, onOpenChange, go }: { open: boolean; onOpenChange: (open: boolean) => void; go?: (href: string) => void }) {
  const { t } = useI18n()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent maxW={520} rounded="$6" gap="$3">
        <DialogTitle>{t('Betas')}</DialogTitle>
        <Text fontSize="$2" color="$color11">
          {t('Apps we have not opened to everyone yet. Ask for the ones you want and we will let you in.')}
        </Text>
        <YStack maxH="60vh" overflowY="auto" overflowX="hidden" paddingInlineEnd="$2">
          <BetasList go={go} />
        </YStack>
      </DialogContent>
    </Dialog>
  )
}
