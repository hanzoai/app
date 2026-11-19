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
// WHICH ARE PUBLIC is lib/optin's answer: a public beta is one an admin promoted,
// on for a reader who opted in to experimental features unless their
// organization turned that off. The cloud still says who is in, through the same
// GET /v1/flag/platform, so `opens` stays the one predicate; a public beta only
// reads as one, and says how to turn it on instead of asking for access.
//
// Signed out, still loading, or on any error nothing is open: a flags outage
// cannot leak an unfinished app.

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { ArrowUpRight, Compass, FlaskConical } from 'lucide-react'
import { useI18n } from '@hanzo/i18n/react'
import { useIam } from '@hanzo/iam/react'
import { Button, Dialog, DialogContent, DialogTitle, Text, XStack, YStack } from '@hanzo/ui'
import { api } from './lib/api'
import { BETAS, GROUPS, HEADING, opens, type Beta } from './lib/betas'
import { useHydrated } from './lib/hydrated'
import { bearer, scope, superAdmin } from './lib/session'
import { hosted } from './lib/host'
import { CHANGED, optin } from './lib/optin'

/** What the cloud said for one token: the switches in force and what was asked for. */
interface Said {
  flags: Record<string, boolean>
  asked: string[]
  /** The public betas' ids, and the reader's opt-in as the cloud holds it. */
  public: string[]
  blocked: boolean
}

const NONE: Said = { flags: {}, asked: [], public: [], blocked: false }

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
    optin().catch(() => null),
  ])
    .then(([f, b, o]) => {
      held = { token, said: { flags: f?.flags ?? {}, asked: b?.betas ?? [], public: o?.public ?? [], blocked: o?.blocked ?? false }, at: Date.now() }
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
  /** Whether it is a public beta, one an admin promoted (lib/optin). */
  promoted: (id: string) => boolean
  /** Their organization turned experimental features off. */
  blocked: boolean
  /** Ask for these apps. */
  request: (ids: string[]) => Promise<void>
  /** The cloud has answered for this reader. */
  ready: boolean
} {
  const { t } = useI18n()
  const { accessToken } = useIam()
  const hydrated = useHydrated()
  const [adminRev, setAdminRev] = useState(0)
  const local = hydrated && here()
  const sudo = hydrated && superAdmin()
  const token = accessToken ? bearer() ?? '' : ''
  const now = useSyncExternalStore(subscribe, () => held, () => null)
  useEffect(() => {
    if (token && (!held || held.token !== token || Date.now() - held.at > FRESH)) void read(token)
  }, [token])
  // A change of the opt-in or admin beta override changes what opens: read it all again.
  useEffect(() => {
    const again = () => {
      setAdminRev((n) => n + 1)
      if (token) void read(token)
    }
    window.addEventListener(CHANGED, again)
    window.addEventListener('storage', again)
    return () => {
      window.removeEventListener(CHANGED, again)
      window.removeEventListener('storage', again)
    }
  }, [token])
  const said = token && now?.token === token ? now.said : NONE
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const open = useCallback((id: string) => opens(id, said.flags, sudo, local), [said, sudo, local, adminRev])
  const asked = useCallback((id: string) => said.asked.includes(id), [said])
  const promoted = useCallback((id: string) => said.public.includes(id), [said])
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
  return { open, asked, promoted, blocked: said.blocked, request, ready: Boolean(token) && now?.token === token }
}

/**
 * Whether this page is served from a developer's own machine, where every app
 * opens: an app nobody can open is an app nobody can work on. The ORIGIN, which
 * no deployment can acquire by configuration.
 */
function here(): boolean {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.local') || /^10\./.test(host) || /^192\.168\./.test(host)
}

/** One app's action: Open where it may (in the app, for one that draws inside it), Requested once asked, else Request access. */
export function Ask({ beta, go }: { beta: Beta; go?: (href: string) => void }) {
  const { t } = useI18n()
  const { open, asked, promoted, blocked, request } = useBetas()
  const [busy, setBusy] = useState(false)
  const [wrong, setWrong] = useState<string | null>(null)
  if (open(beta.id)) {
    const to = beta.embed !== undefined ? hosted(beta.id) : beta.href
    return to && go ? (
      <Button
        size="sm"
        variant="secondary"
        rounded="$3"
        minH={36}
        borderColor="var(--border-strong)"
        focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
        $max-sm={{ minH: 44 }}
        onPress={() => go(to)}
        data-slot="beta-open"
      >
        {t('Open')}
      </Button>
    ) : (
      <XStack items="center" gap="$1.5" px="$2.5" py="$1" rounded={999} bg="$raised" borderWidth={1} borderColor="$edge" data-slot="beta-on">
        <YStack width={7} height={7} rounded={999} bg="var(--state-online)" aria-hidden />
        <Text fontSize="$1" fontWeight="500" color="$ink">
          {t('You’re in')}
        </Text>
      </XStack>
    )
  }
  if (promoted(beta.id)) {
    return (
      <Text fontSize="$1" color="$soft" data-slot="beta-optin">
        {t(blocked ? 'Turned off by your organization' : 'Turn on experimental features in Settings')}
      </Text>
    )
  }
  if (asked(beta.id)) {
    return (
      <XStack items="center" gap="$1.5" px="$2.5" py="$1" rounded={999} bg="$raised" borderWidth={1} borderColor="$edge" data-slot="beta-requested">
        <YStack width={6} height={6} rounded={999} bg="$soft" aria-hidden />
        <Text fontSize="$1" fontWeight="500" color="$aside">
          {t('Requested')}
        </Text>
      </XStack>
    )
  }
  return (
    <YStack items="flex-start" gap="$1">
      <Button
        size="sm"
        rounded="$3"
        minH={36}
        variant="outline"
        borderColor="var(--border-strong)"
        focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
        $max-sm={{ minH: 44 }}
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
        <Text role="alert" fontSize="$1" color="var(--state-error)">
          {wrong}
        </Text>
      ) : null}
    </YStack>
  )
}

/** Every app in beta, by group, each rendered as a responsive 2-column desktop / 1-column mobile card with status indicator. */
export function BetasList({ go }: { go?: (href: string) => void }) {
  const { t } = useI18n()
  const { open, asked, promoted } = useBetas()
  return (
    <YStack gap="$6" minW={0} data-slot="betas">
      {GROUPS.map((group) => (
        <YStack key={group} gap="$3" minW={0}>
          <Text render="h2" m={0} fontSize="$4" fontWeight="600" color="$ink">
            {t(HEADING[group])}
          </Text>
          <XStack
            display="grid"
            gridTemplateColumns="repeat(2, minmax(0, 1fr))"
            $max-sm={{ gridTemplateColumns: 'minmax(0, 1fr)' }}
            gap="$3"
            minW={0}
          >
            {BETAS.filter((b) => b.group === group).map((b) => {
              const isOpen = open(b.id)
              const isPublic = promoted(b.id)
              const isAsked = asked(b.id)
              return (
                <YStack
                  key={b.id}
                  data-beta={b.id}
                  p="$4"
                  rounded="$5"
                  bg="$panel"
                  borderWidth={1}
                  borderColor="$edge"
                  gap="$4"
                  justify="space-between"
                  minW={0}
                  transition="quickest"
                  hoverStyle={{ bg: '$hover', borderColor: 'var(--border-strong)' }}
                >
                  <YStack gap="$1.5" minW={0}>
                    <XStack items="center" justify="space-between" gap="$2" flexWrap="wrap">
                      <XStack items="center" gap="$2" minW={0} flex={1}>
                        <YStack
                          width={7}
                          height={7}
                          rounded={999}
                          shrink={0}
                          bg={isOpen ? 'var(--state-online)' : isAsked ? '$aside' : '$edge'}
                          aria-hidden
                        />
                        <Text fontSize="$3" fontWeight="600" color="$ink" numberOfLines={1}>
                          {b.name}
                        </Text>
                      </XStack>
                      {isPublic ? (
                        <XStack px="$2" py="$0.5" rounded={999} bg="$raised" borderWidth={1} borderColor="$edge" data-slot="beta-public">
                          <Text fontSize="$1" fontWeight="500" color="$aside">
                            {t('Public beta')}
                          </Text>
                        </XStack>
                      ) : null}
                    </XStack>
                    <Text fontSize="$2" color="$soft" lineHeight="$3">
                      {t(b.line)}
                    </Text>
                  </YStack>
                  <XStack items="center" justify="flex-end" flexWrap="wrap" gap="$2">
                    <Ask beta={b} go={go} />
                  </XStack>
                </YStack>
              )
            })}
          </XStack>
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
      <DialogContent maxW={680} width="calc(100vw - 24px)" rounded="$6" gap="$4">
        <YStack gap="$1.5">
          <DialogTitle>{t('Betas')}</DialogTitle>
          <Text fontSize="$2" color="$soft" lineHeight="$3" maxW={540}>
            {t('Apps we have not opened to everyone yet. Ask for the ones you want and we will let you in.')}
          </Text>
        </YStack>
        <YStack maxH="62vh" overflowY="auto" overflowX="hidden" paddingInlineEnd="$1">
          <BetasList go={go} />
        </YStack>
        <XStack items="center" justify="space-between" pt="$3" borderTopWidth={1} borderColor="$edge" flexWrap="wrap" gap="$3">
          <Text fontSize="$2" color="$soft">
            {t('Looking for community plugins and MCP tools?')}
          </Text>
          <Button
            size="sm"
            variant="outline"
            rounded="$3"
            minH={36}
            borderColor="var(--border-strong)"
            focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
            $max-sm={{ minH: 44 }}
            onPress={() => window.open('https://hanzo.market', '_blank', 'noopener,noreferrer')}
          >
            <XStack items="center" gap="$1.5">
              <Compass size={14} aria-hidden />
              <Text fontSize="$2" color="$ink">{t('Explore on hanzo.market')}</Text>
              <ArrowUpRight size={13} aria-hidden />
            </XStack>
          </Button>
        </XStack>
      </DialogContent>
    </Dialog>
  )
}

/** The Betas view rendered inside the app's main pane under /beta. */
export function BetasPane({ go }: { go?: (href: string) => void }) {
  const { t } = useI18n()
  return (
    <YStack flex={1} minH={0} minW={0} maxW={960} mx="auto" width="100%" px="$4" pt="$6" pb="$9" $max-sm={{ px: '$3', pt: '$4', pb: '$7' }} gap="$6">
      <YStack gap="$1.5" maxW={600}>
        <XStack items="center" gap="$2.5">
          <FlaskConical size={20} color="var(--foreground)" aria-hidden />
          <Text render="h1" m={0} fontSize="$7" lineHeight="$8" fontWeight="600" letterSpacing={-0.42} color="$ink">
            {t('Ecosystem betas & early access')}
          </Text>
        </XStack>
        <Text fontSize="$3" color="$soft" lineHeight="$4">
          {t('Preview upcoming releases, manage early access requests for your account, and explore models and developer tools.')}
        </Text>
      </YStack>

      <BetasList go={go} />
    </YStack>
  )
}
