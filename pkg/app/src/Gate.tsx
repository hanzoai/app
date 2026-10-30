'use client'

// The organization comes first.
//
// An organization owns every agent, credit and member. A signed-in reader who
// has none is shown one thing: make one. A reader with several picks the one
// they are working in when they arrive. Past both the app renders, and every
// request under it then carries that organization (lib/auth/session.ts
// `scope`, hooks/useAi.ts).
//
// NO PLAN STANDS IN FRONT OF CHAT OR DEV. Off the workspace every
// organization opens, whatever its plan: what it may spend is the API's to
// meter, per plan, on every call. The per-seat Team plan is the workspace's to
// ask for, on its host (hanzo.team) and behind its front door, and nowhere
// else. It used to be asked of every organization that was not personal and
// not on a live plan, on every host, which put each member of a team on Free,
// and every account filed in the shared sign-up organization, in front of a
// wall at hanzo.ai/chat. Plans are
// the catalog's, read live and seeded from @hanzo/plans for first paint.
// Checkout is hanzo.ai/pay in this tab; it returns here, and the tier is read
// again on return.
//
// THE FRONT DOOR. A workspace rooted at `/` (hanzo.team) draws its host's
// Landing for a stranger at Home (`front`) and its host's Signup at /start
// (`signup`). Behind either, a reader with no team names one, invites people
// and takes the per-seat plan (`Start`, `Plan`) instead of the create dialog;
// a team without a live plan is offered that plan, a personal organization on
// Free is offered a team, and an open one is sent on (`forward`). Behind the
// door, and only there, nothing opens without a live plan.

import { dev } from './lib/host'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useIam } from '@hanzo/iam/react'
import { phrase, english, type Say } from '@hanzo/i18n'
import { useI18n } from '@hanzo/i18n/react'
import { Text, View, XStack, YStack } from '@hanzo/gui'
import { Avatar, Button, Tag } from '@hanzo/ui'
import { SearchInput } from '@hanzo/ui/product/Filters'
import { label, said as spoken } from '@hanzo/build/plan'
import { Check, Minus, Plus, X } from 'lucide-react'
import { Waiting } from './waiting'
import { LOGIN, enter } from './lib/destination'
import { useAi } from './lib/ai'
import { useHostname } from './lib/hostname'
import { useHydrated } from './lib/hydrated'
import { api } from './lib/api'
import { usePersonal, useTier } from './lib/tier'
import { CHOOSE, ORG, assumed, bearer, hasSession, org, orgs as claimed, pick, renew, reopen, role, scope, superAdmin, support } from './lib/session'
import { matches, refusal, slugify } from './lib/orgname'
import { team as workspace } from './lib/host'
import { checkoutUrl, money } from './lib/pay'
import { cartUrl, charge, priced, usePlan, usePlans, type Interval, type SubscriptionPlan } from './lib/plans'
import { createInvitation, inviteLink, setOrganizationProfile } from './lib/invite'
import { createOrg, say } from './lib/org'
import { countSignup } from './lib/intent'
import { BAD, mix } from './lib/mix'
import { useHost } from './host'
import { Accounts } from './Accounts'
import { Header } from './Header'
import { site, where } from './where'

/** A template to set up once the organization is live. */
const SETUP = 'hanzo:org:template'

interface Template { slug: string; title?: string; name?: string; category?: string; description?: string }

/** Checkout for a plan, coming back to this page. */
function checkout(plan: SubscriptionPlan): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://hanzo.ai'
  const path = typeof window !== 'undefined' ? window.location.pathname : '/chat'
  return checkoutUrl(plan.id, `${origin}${path}`)
}

export function Gate({
  children,
  front = false,
  forward,
  signup = false,
}: {
  children: ReactNode
  /** Home at `/`: a stranger meets the host's Landing, a member with no team `<Landing member />`. */
  front?: boolean
  /** Where an open organization is sent instead of drawing `children`: /start sends it Home. */
  forward?: string
  /** A stranger is shown the host's Signup rather than the sign-in: /start. */
  signup?: boolean
}) {
  const hydrated = useHydrated()
  const { isAuthenticated, isLoading, accessToken } = useIam()
  const { Landing, Signup, team } = where()
  // The front door's own flow: naming a team, inviting it, the per-seat plan —
  // at hanzo.ai's Home and /start, and in every app of hanzo.team.
  const door = front || signup || Boolean(team)
  const arriving = useArrival(door, hydrated, isLoading, isAuthenticated)
  const members = useMemo(() => claimed(), [accessToken]) // eslint-disable-line react-hooks/exhaustive-deps
  const [current, setCurrent] = useState<string | null>(() => org())
  useEffect(() => {
    setCurrent(org())
    const on = () => setCurrent(org())
    window.addEventListener(ORG, on)
    window.addEventListener('storage', on)
    return () => {
      window.removeEventListener(ORG, on)
      window.removeEventListener('storage', on)
    }
  }, [accessToken])
  // The team being set up in this page. Once its name is taken the setup owns
  // the screen until checkout, whatever `Gate` reads of the new organization.
  const [founding, setFounding] = useState<string | null>(null)
  // The workspace asks for the plan, on its host and behind its front door, and
  // only there is it read: nowhere else does it decide anything.
  const onTeam = workspace(useHostname())
  const asks = door || onTeam
  const { tier, wrong, reload } = useTier(Boolean(asks && isAuthenticated && current), current)
  // A plan is live when billing READ one for this organization and it is not the free rung.
  const live = Boolean(tier?.tier && tier.tier.name !== FREE_TIER)
  // Behind the front door every organization without a live plan is read for
  // its kind: a team is offered the plan, a personal one is offered a team.
  const free = door && Boolean(tier) && !live
  const personal = usePersonal(current, free)
  // A SuperAdmin IAM stepped into this organization sees its apps whatever its
  // plan: support is there to see what the organization has, and what it spends
  // is billed to the operator's own books, never the organization's.
  const supporting = Boolean(current) && assumed() === current
  const open = !asks || live || supporting
  const { client } = useAi()


  // Back from checkout: the plan may be live now.
  useEffect(() => {
    const back = () => {
      if (document.visibilityState === 'visible') reload()
    }
    document.addEventListener('visibilitychange', back)
    window.addEventListener('focus', back)
    return () => {
      document.removeEventListener('visibilitychange', back)
      window.removeEventListener('focus', back)
    }
  }, [reload])

  // The chooser over the app, asked for from the account menu (session.ts `choose`).
  const [choosing, setChoosing] = useState(false)
  useEffect(() => {
    const ask = () => setChoosing(true)
    window.addEventListener(CHOOSE, ask)
    return () => window.removeEventListener(CHOOSE, ask)
  }, [])

  const choose = useCallback((o: string) => {
    pick(o)
    setChoosing(false)
  }, [])

  // The organization a link arrives for. hanzo.ai opens the workspace at
  // `?signin&org=<the org it is working in>` (Account.tsx); once signed in, an org
  // the token's `orgs` names is chosen and the parameter leaves the address, the
  // way `?signin` does. An org the token does not name is ignored.
  useEffect(() => {
    if (!door || !hydrated || isLoading || !isAuthenticated) return
    const url = new URL(window.location.href)
    const asked = url.searchParams.get('org')
    if (asked === null) return
    url.searchParams.delete('org')
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    if (members.includes(asked)) choose(asked)
  }, [door, hydrated, isLoading, isAuthenticated, members, choose])

  // The template chosen at creation, set up once the organization opens.
  useEffect(() => {
    if (!open || !client) return
    let slug: string | null
    try {
      slug = localStorage.getItem(SETUP)
      if (slug) localStorage.removeItem(SETUP)
    } catch {
      return
    }
    if (!slug) return
    client.http
      .json<{ id?: string }>({ method: 'POST', path: '/v1/project/fork', body: { slug } })
      .then((made) => {
        if (made?.id) window.location.assign(dev())
      })
      .catch(() => {})
  }, [open, client])

  // NOTHING PRODUCT-SHAPED IS IN THE EXPORTED MARKUP. This branch is what the
  // static file holds and what hydration's first render must agree with, so
  // whatever it returns is what a reader sees before any answer exists. It used
  // to return the app, which put the whole paid interface on disk: the browser
  // painted it from the file, the SDK settled, billing answered, and only then
  // did the ask appear over the top of a product the reader had already been
  // shown. The veil is the same element in both renders, so there is no
  // mismatch and there is nothing to see. Home at `/` ships the host's Landing
  // instead, which is what a stranger there is shown and what a crawler reads.
  if (!hydrated) return front && Landing ? <Landing /> : <Veil />
  // Past hydration the app keeps its place in the tree in every branch that
  // draws it — `Held`, the veil AFTER it — so a token refresh mid-session never
  // remounts what the reader had open. The veil is unconditional now: it was
  // hung only when a token was already in hand, which left a visitor arriving
  // without one looking at the app while the SDK decided. Under it the app is
  // inert: it takes no key or press until the gate has decided.
  if (isLoading) return front && Landing && !hasSession() && !arriving ? <Landing /> : <><Held veiled>{children}</Held><Veil /></>
  if (arriving && !isAuthenticated) return <SignIn to={LOGIN} />
  if (!isAuthenticated) return front && Landing ? <Landing /> : signup && Signup ? <Signup /> : <SignIn />
  if (founding) return <Start founded={founding} onFounded={setFounding} first={members.length === 0} />
  if (members.length === 0) {
    if (front && Landing) return <Landing member />
    return door ? <Start onFounded={setFounding} first /> : <Create />
  }
  // The organization this browser works in is the choice (session.ts `org`: the
  // SDK's selection when the token names it, else the person's only one). Only a
  // browser working in none of the person's is asked, so a sign-in goes straight
  // to the app in the organization the person last worked in, and the account
  // menu switches it (`choosing`).
  if (!current) return <Pick members={members} current={current} onPick={choose} />
  // Asked for over an open app, the app keeps its place under the chooser and closing it goes back;
  // asked for from a plan's page (`swap`), the chooser stands alone, since that app is not open.
  if (choosing) return <>{open ? <Held veiled>{children}</Held> : null}<Pick members={members} current={current} onPick={choose} onClose={() => setChoosing(false)} /></>
  if (open) return forward ? <Forward to={forward} /> : <><Held veiled={false}>{children}</Held></>
  // IN THE WORKSPACE NOTHING OPENS WITHOUT A LIVE PLAN. Every branch here
  // used to hand the app over when the answer was anything but a plain
  // "free": an error of any kind, a read still in flight, a document with no
  // plan in it. Each was a way in without paying — a refusal, a slow network,
  // or devtools blocking one request all read as permission. The default is the
  // ask, and the app is the exception rather than the fallback.
  if (!tier && !wrong) return <><Held veiled>{children}</Held><Veil /></>
  if (free && personal === null) return <><Held veiled>{children}</Held><Veil /></>
  const swap = () => setChoosing(true)
  if (door) {
    // A billing OUTAGE is ours; the plan is still the condition.
    if (!tier) return <Plan org={current} members={members} onSwitch={swap} outage={outage(wrong)} onRetry={reload} />
    if (personal) {
      if (front && Landing) return <Landing member />
      return <Start onFounded={setFounding} first={false} members={members} onSwitch={swap} />
    }
    return <Plan org={current} members={members} onSwitch={swap} />
  }
  // The workspace's host off its front door: no live plan, or none read, does
  // not open the app.
  return <Subscribe org={current} members={members} onSwitch={swap} />
}

/**
 * A link that asks to arrive signed in.
 *
 * A workspace on its own origin keeps its own session, so a person signed in on
 * hanzo.ai arrives there signed out and would meet the landing. hanzo.ai's
 * Workspace row sends `?signin` (lib/host `ENTRY`), and behind the front door
 * that draws the sign-in in place of the landing; the sign-in returns to this
 * page, which opens the workspace. The flag leaves the address at once, so the
 * page the sign-in returns to does not ask again.
 */
function useArrival(door: boolean, hydrated: boolean, isLoading: boolean, isAuthenticated: boolean): boolean {
  const [arriving, setArriving] = useState(false)
  useEffect(() => {
    if (!door || !hydrated) return
    const url = new URL(window.location.href)
    if (!url.searchParams.has('signin')) return
    url.searchParams.delete('signin')
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    setArriving(true)
  }, [door, hydrated])
  useEffect(() => {
    if (arriving && !isLoading && isAuthenticated) setArriving(false)
  }, [arriving, isLoading, isAuthenticated])
  return arriving
}

// ── the screens ────────────────────────────────────────────────────────────────

/** Every screen here is one sheet over the app, ten above its modals, and the create dialog ten above that.
 *  gui carries a `calc()` to the page unchanged; its types only name custom properties. */
const SHEET = 'calc(var(--z-modal) + 10)' as `var(--${string})`
const DIALOG = 'calc(var(--z-modal) + 20)' as `var(--${string})`
/** The sheet's top inset: a share of the window's height, held between two lengths. */
const TOP = 'clamp(72px, 12vh, 120px)' as `var(--${string})`
const muted = 'var(--muted-foreground)'
/** The black that veils and shadows, at a share of itself. */
const shade = (share: number) => mix('var(--pure-black)', share, 'srgb')
/** A field in the create dialog. */
const FIELD = {
  width: '100%',
  fontSize: '$6',
  px: 16,
  py: 14,
  rounded: 12,
  borderWidth: 1,
  borderColor: 'var(--border)',
  bg: 'var(--background)',
  color: 'var(--foreground)',
} as const

/**
 * The sheet every screen stands on: the whole viewport, scrolling, its column
 * centred, under the focused pages' one bar (`Header`) once someone is signed
 * in. "Signing you in" stands alone.
 */
function Page({ label, children }: { label: string; children: ReactNode }) {
  const { isAuthenticated } = useIam()
  return (
    <YStack position="fixed" inset={0} z={SHEET} overflowY="auto" bg="var(--background)" role="region" aria-label={label}>
      {isAuthenticated ? <Header /> : null}
      <YStack pt={TOP} px={20} pb={48}>
        {children}
      </YStack>
    </YStack>
  )
}

/** The column a screen's words sit in. */
function Column({ children }: { children: ReactNode }) {
  return (
    <YStack width="100%" maxW={640} mx="auto">
      {children}
    </YStack>
  )
}

/** A hairline between the parts of a screen. */
function Rule({ mt = 20, mb = 20 }: { mt?: number; mb?: number }) {
  return <View height={1} bg="var(--border)" mt={mt} mb={mb} />
}

/** A screen's heading and the line under it; `lead` is the line's leading where it states one. */
function Heading({ title, lede, lead }: { title: ReactNode; lede?: ReactNode; lead?: number }) {
  return (
    <>
      <Text render="h1" fontSize="$10" fontWeight="500" letterSpacing={-0.32} color="var(--text-primary)">
        {title}
      </Text>
      {lede ? (
        <Text render="p" mt={6} fontSize="$4" lineHeight={lead} color={muted}>
          {lede}
        </Text>
      ) : null}
    </>
  )
}

/** The app, held back until the organization is known. */
function Veil() {
  return <View aria-hidden position="fixed" inset={0} z={SHEET} bg="var(--background)" />
}

/**
 * The app, in the one place every branch that draws it puts it. Under the veil
 * it is inert and hidden from assistive technology, so what the veil covers
 * takes no focus, key or press: a team on Free cannot type and send before its
 * ask is drawn. It lays out as its children do.
 */
function Held({ veiled, children }: { veiled: boolean; children: ReactNode }) {
  return (
    <View render={<div data-slot="held" inert={veiled} aria-hidden={veiled || undefined} />} display="contents">
      {children}
    </View>
  )
}

/** An open organization, sent on. */
function Forward({ to }: { to: string }) {
  const { router } = useHost()
  useEffect(() => router.replace(to), [router, to])
  return <Veil />
}

/** Which step of the setup this is, of how many. */
function Step({ at, of }: { at: number; of: number }) {
  const { t } = useI18n()
  return (
    <Text render="p" mb={10} fontSize="$2" fontFamily="$mono" color="$soft">
      {t('Step {at} of {of}', { at, of })}
    </Text>
  )
}

/** The free rung's name in the billing catalog. */
const FREE_TIER = 'free'

/**
 * Whether a failed tier read is OUR fault. A 5xx or a network error is an
 * outage; a 401, 403 or 404 is an answer, and an answer that is not a paid plan
 * is not a reason to open the app.
 */
function outage(wrong: unknown): boolean {
  const status = (wrong as { status?: number } | null)?.status
  return status == null || status >= 500
}

/**
 * SIGNED OUT IS A TRIP TO SIGN IN, and nothing else.
 *
 * IAM owns every credential, so this gate draws no form of its own: it sends
 * the reader to this site's sign-in (destination.ts `enter`), which asks
 * hanzo.id for a session first and draws IAM's form only when there is none.
 * `Shell` wrote the address down on mount, so the sign-in returns to this page,
 * `?q=` included.
 */
function SignIn({ to }: { to?: string }) {
  const { t } = useI18n()
  useEffect(() => enter(to), [to])
  return (
    <Page label={t('Sign in')}>
      <Waiting title={t('Signing you in')} lede={t('One moment.')} />
    </Page>
  )
}

/** No organization yet: the one thing to do. */
function Create() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [details, setDetails] = useState(false)
  return (
    <Page label={t('Organizations')}>
      <Column>
        <XStack items="flex-start" justify="space-between" gap={16} flexWrap="wrap">
          <YStack>
            <Text render="h1" fontSize="$10" fontWeight="500" letterSpacing={-0.32} color="var(--text-primary)">
              {t('Organizations')}
            </Text>
            <Text render="p" mt={6} fontSize="$4" color={muted}>
              {t('You do not belong to one yet.')}
            </Text>
          </YStack>
          <Button variant="primary" size="lg" onClick={() => setOpen(true)}>
            <Plus size={16} aria-hidden />
            {t('New organization')}
          </Button>
        </XStack>
        <Rule />
        <YStack items="center" py={28}>
          <Text render="p" fontSize="$6" fontWeight="500" color="var(--foreground)" text="center">
            {t('No organizations yet')}
          </Text>
          <Button variant="linkMuted" size="sm" mt={8} onClick={() => setDetails((d) => !d)}>
            {t(details ? '- Details' : '+ Details')}
          </Button>
          {details ? (
            <Text render="p" mt={12} maxW={440} fontSize="$4" color={muted} lineHeight={23.25} text="center">
              {t('An organization owns every agent, credit and member. Create one and you are its owner.')}
            </Text>
          ) : null}
        </YStack>
        <Rule />
      </Column>
      {open ? <CreateDialog onClose={() => setOpen(false)} /> : null}
    </Page>
  )
}

/** Name it, pick what it runs and its plan: a paid plan goes to checkout, Free goes straight in. */
function CreateDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const team = usePlan('team')
  // The personal ladder, Free first. hanzo.team offers no personal organization:
  // every app there runs on a paid plan.
  const ladder = usePlans('personal')
  const alone = !workspace(useHostname())
  const [rung, setRung] = useState<string | null>(null)
  const chosen = ladder.find((p) => p.id === rung) ?? ladder.find((p) => !p.priceMonthly) ?? ladder[0] ?? null
  const personal = priced(chosen)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'org' | 'personal'>('org')
  // A team organization runs on the per-seat Team plan; a personal one on the
  // rung chosen below, Free unless another is. Checkout sets the seats and the term.
  const { plan, price } = kind === 'org' ? team : personal
  const paid = (plan?.priceMonthly ?? 0) > 0
  // A row on the landing carries its template in the address, across sign-in.
  const [template, setTemplate] = useState(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('template') ?? ''
  })
  const [templates, setTemplates] = useState<Template[]>([])
  const [busy, setBusy] = useState(false)
  const [refused, setRefused] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${api()}/v1/templates`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { data?: Template[] } | null) => {
        if (Array.isArray(d?.data)) setTemplates(d.data.filter((row) => row?.slug))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!plan || busy) return
    if (kind === 'org' && !name.trim()) {
      setRefused(t('Give it a name.'))
      return
    }
    setBusy(true)
    setRefused(null)
    try {
      const r = await fetch(`${api()}/v1/account/orgs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...scope() },
        body: JSON.stringify(kind === 'org' ? { name: name.trim() } : { personal: true }),
      })
      if (!r.ok) {
        let why = t('Could not create it ({status}).', { status: r.status })
        try {
          const body = (await r.json()) as { detail?: string; error?: string; message?: string }
          why = body.detail || body.error || body.message || why
        } catch {
          /* no body worth showing */
        }
        setRefused(why)
        setBusy(false)
        return
      }
      const made = (await r.json()) as { org?: string }
      try {
        if (template) localStorage.setItem(SETUP, template)
      } catch {
        /* the next load re-derives both */
      }
      if (made?.org) pick(made.org)
      // Only a reader with no organization is offered this form, so its first
      // success is the account becoming a customer: the ONE sign-up conversion,
      // Free included — our signup_completed, GA4's sign_up, Meta's
      // CompleteRegistration (lib/analytics/tags.ts).
      countSignup()
      // The token in hand predates the organization; the next load mints one
      // that carries it. A paid plan is bought first, and checkout charges the
      // organization it names; Free goes straight in.
      renew()
      if (paid) window.location.assign(checkout(plan))
      else window.location.reload()
    } catch (err) {
      setRefused(err instanceof Error ? err.message : t('Could not create it.'))
      setBusy(false)
    }
  }

  return (
    <YStack
      role="dialog"
      aria-modal
      aria-label={t('Create an organization')}
      position="fixed"
      inset={0}
      z={DIALOG}
      bg={shade(28)}
      overflowY="auto"
      py="6vh"
      px={16}
      onClick={onClose}
    >
      <YStack
        render="form"
        {...{ onSubmit: submit }}
        onClick={(e) => e.stopPropagation()}
        width="100%"
        maxW={640}
        mx="auto"
        bg="var(--background)"
        rounded={16}
        boxShadow={`0 24px 64px ${shade(28)}`}
        pt={28}
        px={28}
        pb={20}
      >
        <XStack items="flex-start" justify="space-between" gap={12}>
          <YStack shrink={1} minW="auto">
            <Text render="h2" fontSize="$8" fontWeight="500" color="var(--text-primary)">
              {t('Create an organization')}
            </Text>
            <Text render="p" mt={8} fontSize="$4" color={muted} lineHeight={22.5}>
              {t('You are its owner. Agents, credits and members all hang off it; you can switch between organizations from the rail.')}
            </Text>
          </YStack>
          <Button type="button" variant="ghost" size="icon-sm" marginInlineEnd={-8} onClick={onClose} aria-label={t('Close')}>
            <X size={16} aria-hidden />
          </Button>
        </XStack>

        <View render="fieldset" display="block" borderWidth={0} p={0} m={0} mt={22}>
          <Text render="legend" display="block" fontSize="$4" fontWeight="500" mb={10} color="var(--foreground)">
            {t('Plan')}
          </Text>
          <View display="grid" gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap={10}>
            {(
              [
                ['org', phrase('Organization'), phrase('A team. Invite members, share agents and credit.'), team],
                ['personal', phrase('Personal'), phrase('Just you. Named after your account.'), personal],
              ] as const
            ).filter(([k]) => alone || k === 'org').map(([k, label, hint, offer]) => (
              <XStack
                key={k}
                render="label"
                gap={10}
                items="flex-start"
                px={14}
                py={12}
                rounded={12}
                borderWidth={1}
                borderColor={kind === k ? 'var(--foreground)' : 'var(--border)'}
                cursor="pointer"
              >
                <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} />
                <YStack shrink={1}>
                  <Text fontSize="$4" fontWeight="500" color="var(--foreground)">
                    {t(label)}
                    {offer.plan ? (
                      <Text color={muted} fontWeight="400">
                        {' '}—{' '}
                        {offer.plan.priceMonthly
                          ? offer.plan.pricePerUser
                            ? t('{price} / seat / month', { price: offer.price })
                            : t('{price} / month', { price: offer.price })
                          : offer.plan.name}
                      </Text>
                    ) : null}
                  </Text>
                  <Text fontSize="$3" color={muted} mt={2}>
                    {t(hint)}
                  </Text>
                </YStack>
              </XStack>
            ))}
          </View>
        </View>

        {kind === 'personal' && ladder.length > 1 ? (
          <View render="fieldset" display="block" borderWidth={0} p={0} m={0} mt={20}>
            <Text render="legend" display="block" fontSize="$4" fontWeight="500" mb={10} color="var(--foreground)">
              {t('Personal plan')}
            </Text>
            <View display="grid" gap={8}>
              {ladder.map((p) => (
                <XStack
                  key={p.id}
                  render="label"
                  gap={10}
                  items="center"
                  px={14}
                  py={10}
                  rounded={12}
                  borderWidth={1}
                  borderColor={chosen?.id === p.id ? 'var(--foreground)' : 'var(--border)'}
                  cursor="pointer"
                >
                  <input type="radio" name="rung" value={p.id} checked={chosen?.id === p.id} onChange={() => setRung(p.id)} />
                  <Text fontSize="$4" fontWeight="500" color="var(--foreground)">
                    {p.name}
                  </Text>
                  {p.priceMonthly ? (
                    <Text marginInlineStart="auto" fontSize="$3" color={muted}>
                      {t('{price} / month', { price: priced(p).price })}
                    </Text>
                  ) : null}
                </XStack>
              ))}
            </View>
          </View>
        ) : null}

        {kind === 'org' ? (
          <View render="label" display="block" mt={20}>
            <Text display="block" fontSize="$4" fontWeight="500" mb={8} color="var(--foreground)">
              {t('Name')}
            </Text>
            <Text render={<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme" autoFocus />} {...FIELD} />
            <Text display="block" fontSize="$3" color={muted} mt={8}>
              {t('What the rail and every invoice call it.')}
            </Text>
          </View>
        ) : null}

        {templates.length > 0 ? (
          <View render="label" display="block" mt={20}>
            <Text display="block" fontSize="$4" fontWeight="500" mb={8} color="var(--foreground)">
              {t('Template')}
            </Text>
            <Text
              render={<select value={template} onChange={(e) => setTemplate(e.target.value)} />}
              {...FIELD}
            >
              <option value="">{t('None — start empty')}</option>
              {templates.map((row) => (
                <option key={row.slug} value={row.slug}>
                  {row.title || row.name || row.slug}
                  {row.category ? ` · ${row.category}` : ''}
                </option>
              ))}
            </Text>
            <Text display="block" fontSize="$3" color={muted} mt={8}>
              {t('What it runs, set up as soon as the organization opens. Choose none to start empty.')}
            </Text>
          </View>
        ) : null}

        {plan && !paid ? (
          <Text render="p" mt={22} fontSize="$4" color={muted} lineHeight={23.25}>
            {t('A personal organization starts on {plan} and opens as soon as it is made. Choose a paid plan above to go to checkout instead.', { plan: plan.name })}
          </Text>
        ) : plan ? (
          <Text render="p" mt={22} fontSize="$4" color={muted} lineHeight={23.25}>
            {plan.pricePerUser
              ? t('A team organization runs on {plan} at {price} per seat a month, at least {seats} seats.', { plan: plan.name, price, seats: Number(plan.limits?.minSeats ?? 1) })
              : t('A personal organization runs on {plan} at {price} a month.', { plan: plan.name, price })}{' '}
            {t('Nothing in it works until that plan is live, so creating one takes you straight to checkout, where you choose the seats and the term.')}{' '}
            {t('Each plan includes session and daily usage limits; usage never draws your credit balance.')}{' '}
            {t("Payment is on the provider's hosted page.")}
          </Text>
        ) : null}

        {refused ? (
          <Text render="p" role="alert" mt={14} fontSize="$3" color="var(--foreground)">
            {refused}
          </Text>
        ) : null}

        {/* A Button's label never wraps, and the paid one is wider than a phone's column: the row wraps, and this label is a Text that does. */}
        <XStack justify="flex-end" gap={10} mt={24} flexWrap="wrap">
          <Button type="button" size="lg" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button type="submit" variant="primary" size="lg" shrink={1} py="$2" disabled={!plan || busy}>
            <Text fontFamily="$body" fontSize="$3" color="inherit" text="center">
              {busy
                ? t('Creating…')
                : paid
                  ? plan?.pricePerUser
                    ? t('Create and subscribe — {price} / seat / month', { price })
                    : t('Create and subscribe — {price} / month', { price })
                  : t('Create')}
            </Text>
          </Button>
        </XStack>
        <Rule mt={18} mb={8} />
        <Text render="p" text="end" fontSize="$2" color={muted} fontFamily="$mono">
          {t('Esc to close')}
        </Text>
      </YStack>
    </YStack>
  )
}

// ── the chooser ────────────────────────────────────────────────────────────────

/** One organization as IAM's list answers it: its name and how it appears. */
interface Listed {
  name: string
  displayName?: string
  /** The square mark: an image, or one emoji, never both (IAM `Organization.avatar`, `.emoji`). */
  avatar?: string
  emoji?: string
  /** The wordmark a sign-in screen draws, the mark where no square one is set. */
  logo?: string
}

/** One page of IAM's organization list and the cursor that continues it. */
interface Listing {
  organizations?: Listed[]
  cursor?: string
}

/**
 * A page of IAM's organization list (`GET /v1/iam/organizations`): the reader's
 * own organizations whole on the first page, then, for a SuperAdmin only, every
 * other one, newest first. `q` narrows it by name or display name on the server;
 * `cursor` continues it. IAM decides the scope from the bearer, so this asks the
 * same thing for everyone.
 */
async function listing(q: string, cursor: string, limit: number, signal?: AbortSignal, t: Say = english): Promise<Listing> {
  const query = new URLSearchParams({ limit: String(limit) })
  if (q.trim()) query.set('q', q.trim())
  if (cursor) query.set('cursor', cursor)
  const res = await fetch(`${api()}/v1/iam/organizations?${query}`, {
    headers: { Authorization: `Bearer ${bearer() ?? ''}` },
    signal,
  })
  if (!res.ok) throw new Error(t('IAM answered {status}.', { status: res.status }))
  return (await res.json()) as Listing
}

/** How each of the reader's organizations appears, by name, from IAM's rows: the first page carries all of them. */
function useMarks(members: string[]): Record<string, Listed> {
  const [rows, setRows] = useState<Record<string, Listed>>({})
  const key = members.join(',')
  useEffect(() => {
    if (!key) return
    const stop = new AbortController()
    listing('', '', 1, stop.signal)
      .then((page) => {
        if (!stop.signal.aborted) setRows(Object.fromEntries((page.organizations ?? []).map((o) => [o.name, o])))
      })
      .catch(() => {})
    return () => stop.abort()
  }, [key])
  return rows
}

/** Each organization's plan by its family (`Max 20x`), billing asked in its name; absent where it names none. */
function useBilled(members: string[]): Record<string, string> {
  const [plans, setPlans] = useState<Record<string, string>>({})
  const key = members.join(',')
  useEffect(() => {
    const stop = new AbortController()
    for (const o of key.split(',').filter(Boolean)) {
      fetch(`${api()}/v1/billing/tier`, { headers: { ...scope(), 'X-Org-Id': o }, signal: stop.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((t: { plan?: string; tier?: { name?: string } } | null) => {
          const plan = t ? spoken(label(t.plan, t.tier?.name)) : ''
          if (plan && !stop.signal.aborted) setPlans((had) => ({ ...had, [o]: plan }))
        })
        .catch(() => {})
    }
    return () => stop.abort()
  }, [key])
  return plans
}

/** The roles IAM signs into the token, as a person reads them. */
const ROLES: Record<string, string> = { owner: phrase('Owner'), admin: phrase('Admin'), member: phrase('Member') }

/** A role as a person reads it: `owner` → Owner; one IAM adds later is shown as it signs it, capitalised. */
const said = (role: string, t: Say): string =>
  ROLES[role] ? t(ROLES[role]) : role ? role.charAt(0).toUpperCase() + role.slice(1) : ''

/** One organization as a row draws it. */
interface Shown {
  name: string
  display: string
  mark: Listed | undefined
  role?: string
  plan?: string
}

/** An organization's mark: its image, else its emoji, else its initial in its own hue (keyed on the slug, so a rename keeps it). */
function Mark({ org }: { org: Shown }) {
  const emoji = org.mark?.avatar ? '' : org.mark?.emoji
  return (
    <Avatar
      size="xl"
      shape="rounded"
      src={org.mark?.avatar || (emoji ? null : org.mark?.logo) || null}
      name={org.display}
      colorSeed={org.name}
      icon={emoji ? <Text fontSize="$7">{emoji}</Text> : undefined}
      alt=""
    />
  )
}

/** One organization: its mark, its name and slug, the reader's role and its plan; the current one checked. */
function Choice({ org, current = false, note, disabled, onPress }: { org: Shown; current?: boolean; note?: string; disabled?: boolean; onPress: () => void }) {
  const { t } = useI18n()
  return (
    <View render="li" display="block">
      <XStack
        render="button"
        onClick={onPress}
        disabled={disabled}
        aria-current={current || undefined}
        width="100%"
        items="center"
        gap={12}
        px={12}
        py={10}
        rounded={12}
        borderWidth={1}
        borderColor={current ? '$ink' : '$edge'}
        bg="transparent"
        cursor="pointer"
        hoverStyle={{ bg: '$hover' }}
      >
        <Mark org={org} />
        <YStack flex={1} minW={0} gap={4}>
          <Text fontSize="$4" fontWeight="500" color="$ink" numberOfLines={1} text="start">
            {org.display}
          </Text>
          <XStack items="center" gap={6} flexWrap="wrap">
            <Text fontSize="$2" fontFamily="$mono" color="$soft" numberOfLines={1} {...{ 'data-i18n-ltr': '' }}>
              {org.name}
            </Text>
            {org.role ? <Tag variant="outline">{said(org.role, t)}</Tag> : null}
            {org.plan ? <Tag>{org.plan}</Tag> : null}
            {note ? (
              <Text fontSize="$2" color="$soft">
                {note}
              </Text>
            ) : null}
          </XStack>
        </YStack>
        {current ? <Check size={16} aria-label={t('Current')} /> : null}
      </XStack>
    </View>
  )
}

/**
 * WHICH ORGANIZATION, THIS TIME — and, for a SuperAdmin, any organization.
 *
 * The reader's organizations are the token's `orgs` (no other list is theirs),
 * drawn with IAM's rows beside them: the mark, the display name, the role the
 * token signs and the plan billing reads in each one's name. The search filters
 * them as it is typed, by slug or display name. A person founds another here
 * (`Found`); a SuperAdmin, whom IAM never lets own a customer organization, is
 * shown every organization instead (`Everyone`), stepped into through IAM.
 */
function Pick({
  members,
  current,
  onPick,
  onClose,
}: {
  members: string[]
  current: string | null
  onPick: (o: string) => void
  /** Opened over an app the reader is in: closing goes back to it. */
  onClose?: () => void
}) {
  // IAM's verdict as it signed it into the token (authz `Claims.Sudo`). It only
  // decides what is drawn: IAM answers anyone else's list with their own
  // organizations and refuses them the step in.
  const sudo = superAdmin()
  const { t } = useI18n()
  const [q, setQ] = useState('')
  const [founding, setFounding] = useState(false)
  const marks = useMarks(members)
  const plans = useBilled(members)
  const mine: Shown[] = members.map((name) => ({
    name,
    display: marks[name]?.displayName || name,
    mark: marks[name],
    role: role(name) ?? '',
    plan: plans[name],
  }))
  const shown = mine.filter((o) => matches(o, q))

  useEffect(() => {
    if (!onClose || founding) return
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose, founding])

  return (
    <Page label={t('Choose an organization')}>
      <Column>
        <XStack items="flex-start" justify="space-between" gap={12}>
          <YStack flex={1} minW={0}>
            <Heading title={t('Choose an organization')} />
          </YStack>
          {onClose ? (
            <Button variant="ghost" size="icon-sm" marginInlineEnd={-8} onClick={onClose} aria-label={t('Close')}>
              <X size={16} aria-hidden />
            </Button>
          ) : null}
        </XStack>
        <Rule />
        {/* Enter opens the first organization the search leaves. */}
        <XStack
          render="form"
          {...{
            onSubmit: (e: React.FormEvent) => {
              e.preventDefault()
              if (shown[0]) onPick(shown[0].name)
            },
          }}
        >
          <SearchInput
            name="organizations"
            value={q}
            onChange={setQ}
            placeholder={t(sudo ? 'Search every organization' : 'Find an organization')}
            actions={
              sudo ? null : (
                <Button type="button" onClick={() => setFounding(true)}>
                  <Plus size={16} aria-hidden />
                  {t('New organization')}
                </Button>
              )
            }
          />
        </XStack>
        <YStack render="ul" aria-label={t('Your organizations')} m={0} p={0} mt={14} gap={8}>
          {shown.map((o) => (
            <Choice key={o.name} org={o} current={o.name === current} onPress={() => onPick(o.name)} />
          ))}
        </YStack>
        {shown.length === 0 ? (
          <Text render="p" mt={14} fontSize="$3" color="$soft">
            {t('None of yours matches “{query}”.', { query: q.trim() })}
          </Text>
        ) : null}
        {sudo ? <Everyone q={q} skip={members} /> : null}
        <Accounts />
      </Column>
      {founding ? <Found onClose={() => setFounding(false)} /> : null}
    </Page>
  )
}

/**
 * EVERY ORGANIZATION, for a SuperAdmin to step into.
 *
 * The list and the search are IAM's, a page at a time, and IAM records each new
 * search under the operator's name. Opening one is IAM's `assume` (session.ts
 * `support`): the operator's own token re-scoped to it and the step recorded in
 * that organization's audit log. Nobody is made a member of anything.
 */
function Everyone({ q, skip }: { q: string; skip: string[] }) {
  const { t } = useI18n()
  const [rows, setRows] = useState<Listed[]>([])
  const [cursor, setCursor] = useState('')
  const [loading, setLoading] = useState(false)
  const [refused, setRefused] = useState<string | null>(null)
  const [stepping, setStepping] = useState<string | null>(null)
  // Only the newest read lands: a search typed while a page is in flight
  // supersedes it, so a slow answer to an old query never overwrites the new one.
  const asked = useRef(0)

  const load = useCallback(async (query: string, from: string) => {
    const mine = ++asked.current
    setLoading(true)
    setRefused(null)
    try {
      const next = await listing(query, from, 20, undefined, t)
      if (mine !== asked.current) return
      setRows((had) => {
        // IAM's cursor is a position, so an org created mid-walk can shift a row
        // across a page edge; each org is kept once.
        const all = from ? [...had, ...(next.organizations ?? [])] : next.organizations ?? []
        return all.filter((o, i) => all.findIndex((x) => x.name === o.name) === i)
      })
      setCursor(next.cursor ?? '')
    } catch (e) {
      if (mine === asked.current) setRefused(e instanceof Error ? e.message : t('The list did not load.'))
    } finally {
      if (mine === asked.current) setLoading(false)
    }
  }, [t])

  useEffect(() => {
    const id = setTimeout(() => void load(q, ''), 250)
    return () => clearTimeout(id)
  }, [q, load])

  const enter = (org: string) => {
    setStepping(org)
    setRefused(null)
    support(org).catch((e: unknown) => {
      setRefused(e instanceof Error ? e.message : t('IAM did not step in.'))
      setStepping(null)
    })
  }

  const others = rows.filter((o) => !skip.includes(o.name))
  return (
    <YStack render="section" aria-label={t('All organizations')} mt={36}>
      <Text render="h2" fontSize="$6" fontWeight="500" color="$ink">
        {t('All organizations')}
      </Text>
      <Text render="p" mt={4} fontSize="$3" color="$soft" lineHeight={21}>
        {t('Support mode. Step into any organization to see it as it does; IAM records every step under your name.')}
      </Text>
      <YStack render="ul" aria-label={t('Every organization')} m={0} p={0} mt={14} gap={8}>
        {others.map((o) => (
          <Choice
            key={o.name}
            org={{ name: o.name, display: o.displayName || o.name, mark: o }}
            note={stepping === o.name ? t('Stepping in…') : undefined}
            disabled={stepping !== null}
            onPress={() => enter(o.name)}
          />
        ))}
      </YStack>
      {!loading && others.length === 0 && !refused ? (
        <Text render="p" mt={8} fontSize="$3" color="$soft">
          {t('No organization matches.')}
        </Text>
      ) : null}
      {refused ? (
        <Text render="p" role="alert" mt={8} fontSize="$3" color={BAD}>
          {refused}
        </Text>
      ) : null}
      {cursor ? (
        <Button self="flex-start" mt={10} onClick={() => void load(q, cursor)} disabled={loading}>
          {t(loading ? 'Loading…' : 'More')}
        </Button>
      ) : null}
    </YStack>
  )
}

/**
 * FOUND AN ORGANIZATION: its name, then the slug IAM keys it by.
 *
 * The slug follows the name the way IAM's onboarding makes it, until it is typed
 * over; a slug typed is IAM's to take as it is, so one IAM would not keep is
 * refused here with the rule, never rewritten. The create is the one every
 * surface uses, `POST /v1/account/orgs` (lib/org.ts `createOrg`): it files the
 * organization in IAM and records the reader as its owner through IAM's
 * membership API, the account untouched. IAM's own `/v1/iam/onboard` is not
 * reachable from here: the edge answers no app origin's CORS on it, because it
 * re-keys the session (cloud cors_origin.go `sessionRoutes`). It is sent the
 * name when the name makes the slug, and the slug when the slug was typed, the
 * display name then written on the row (lib/invite.ts `setOrganizationProfile`).
 * The token in hand predates it, so it is refreshed, and the organization opens on
 * a load: @hanzo/iam's `useOrganizations` reads the token once per mount, and an
 * instance the app mounts on the old token writes its home (the token's first
 * org) back over the pick, which left the app unscoped after one request.
 */
function Found({ onClose }: { onClose: () => void }) {
  const { sdk } = useIam()
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [typed, setTyped] = useState<string | null>(null)
  const slug = typed ?? slugify(name)
  const wrong = slug ? refusal(slug, t) : null
  const [busy, setBusy] = useState(false)
  const [refused, setRefused] = useState<string | null>(null)

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const display = name.trim()
    if (busy) return
    if (!display) return setRefused(t('Give it a name.'))
    if (wrong) return setRefused(wrong)
    setBusy(true)
    setRefused(null)
    try {
      const named = slugify(display) === slug
      const made = await createOrg(named ? display : slug)
      renew()
      await sdk.refreshAccessToken().catch(() => null)
      if (!named) {
        await setOrganizationProfile('admin', made, { displayName: display }).catch((err: unknown) => {
          throw new Error(t('{org} is made, and it is still called {org}: {reason}', { org: made, reason: say(err, t) }))
        })
      }
      reopen(made)
    } catch (err) {
      setRefused(say(err, t))
      setBusy(false)
    }
  }

  return (
    <YStack
      role="dialog"
      aria-modal
      aria-label={t('New organization')}
      position="fixed"
      inset={0}
      z={DIALOG}
      bg={shade(28)}
      overflowY="auto"
      py="6vh"
      px={16}
      onClick={onClose}
    >
      <YStack
        render="form"
        {...{ onSubmit: submit }}
        onClick={(e) => e.stopPropagation()}
        width="100%"
        maxW={480}
        mx="auto"
        bg="var(--background)"
        rounded={16}
        borderWidth={1}
        borderColor="$edge"
        boxShadow={`0 24px 64px ${shade(28)}`}
        pt={24}
        px={24}
        pb={20}
      >
        <XStack items="flex-start" justify="space-between" gap={12}>
          <YStack shrink={1} minW="auto">
            <Text render="h2" fontSize="$8" fontWeight="500" color="$ink">
              {t('New organization')}
            </Text>
            <Text render="p" mt={6} fontSize="$3" color="$soft" lineHeight={21}>
              {t('You own it. Its agents, credit and members are its own.')}
            </Text>
          </YStack>
          <Button type="button" variant="ghost" size="icon-sm" marginInlineEnd={-8} onClick={onClose} aria-label={t('Close')}>
            <X size={16} aria-hidden />
          </Button>
        </XStack>
        <View render="label" display="block" mt={20}>
          <Text display="block" fontSize="$4" fontWeight="500" mb={8} color="$ink">
            {t('Name')}
          </Text>
          <Text render={<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme" maxLength={100} autoFocus />} {...FIELD} />
        </View>
        <View render="label" display="block" mt={16}>
          <Text display="block" fontSize="$4" fontWeight="500" mb={8} color="$ink">
            {t('Slug')}
          </Text>
          <Text
            render={
              <input
                data-i18n-ltr=""
                value={slug}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="acme"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                aria-invalid={Boolean(slug && wrong) || undefined}
              />
            }
            {...FIELD}
            fontFamily="$mono"
          />
          <Text display="block" fontSize="$3" color={slug && wrong ? BAD : '$soft'} mt={8}>
            {slug && wrong ? wrong : t('How every request names it: lowercase letters, digits and hyphens. It does not change.')}
          </Text>
        </View>
        {refused ? (
          <Text render="p" role="alert" mt={14} fontSize="$3" color={BAD}>
            {refused}
          </Text>
        ) : null}
        <XStack justify="flex-end" gap={10} mt={22} flexWrap="wrap">
          <Button type="button" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={busy || !name.trim() || Boolean(wrong)}>
            {t(busy ? 'Creating…' : 'Create and open')}
          </Button>
        </XStack>
      </YStack>
    </YStack>
  )
}

/** On the workspace's host, an organization whose plan is not live: it is offered the per-seat Team plan. */
function Subscribe({
  org,
  members,
  onSwitch,
}: {
  org: string
  members: string[]
  onSwitch: () => void
}) {
  const { t } = useI18n()
  const { plan, price } = usePlan('team')
  return (
    <Page label={t('Subscribe')}>
      <Column>
        <Heading
          title={org}
          lead={22.5}
          lede={
            !plan
              ? t('Its plan is not live yet.')
              : plan.pricePerUser
                ? t('This organization runs on the {plan} plan at {price} / seat / month, and nothing in it works until that plan is live.', { plan: plan.name, price })
                : t('This organization runs on the {plan} plan at {price} / month, and nothing in it works until that plan is live.', { plan: plan.name, price })
          }
        />
        <Rule />
        <XStack gap={10} flexWrap="wrap">
          {plan ? (
            <Button asChild variant="primary" size="lg">
              <a href={checkout(plan)}>{plan.pricePerUser ? t('Subscribe — {price} / seat / month', { price }) : t('Subscribe — {price} / month', { price })}</a>
            </Button>
          ) : null}
          {members.length > 1 ? (
            <Button size="lg" onClick={onSwitch}>
              {t('Switch organization')}
            </Button>
          ) : null}
        </XStack>
      </Column>
    </Page>
  )
}

// ── the front door's setup ─────────────────────────────────────────────────────

/**
 * CREATE YOUR TEAM: its name, then who else is in it, then its plan.
 *
 * The name makes the organization (`POST /v1/account/orgs`). The access token
 * in hand predates it, so it is expired and refreshed at once, which mints one
 * that carries the new organization, and the organization is selected: the
 * invitations that follow are filed against it. Invitations are optional, one
 * single-use link per address. The plan step is `Plan`, the same one a team on
 * Free is shown.
 */
function Start({
  founded = null,
  onFounded,
  first,
  members = [],
  onSwitch,
}: {
  /** The organization this setup already made, when it is past its first step. */
  founded?: string | null
  onFounded: (org: string) => void
  /** The reader belongs to no organization yet, so this one is their sign-up. */
  first: boolean
  members?: string[]
  onSwitch?: () => void
}) {
  const { sdk } = useIam()
  const { t } = useI18n()
  const [step, setStep] = useState<'name' | 'invite' | 'plan'>(founded ? 'invite' : 'name')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [refused, setRefused] = useState<string | null>(null)
  const [emails, setEmails] = useState('')
  const [sent, setSent] = useState<{ email: string; link?: string; refused?: string }[]>([])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!name.trim()) {
      setRefused(t('Give it a name.'))
      return
    }
    setBusy(true)
    setRefused(null)
    try {
      const r = await fetch(`${api()}/v1/account/orgs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...scope() },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!r.ok) {
        let why = t('Could not create it ({status}).', { status: r.status })
        try {
          const body = (await r.json()) as { detail?: string; error?: string; message?: string }
          why = body.detail || body.error || body.message || why
        } catch {
          /* no body worth showing */
        }
        setRefused(why)
        setBusy(false)
        return
      }
      const made = (await r.json()) as { org?: string }
      if (!made?.org) {
        setRefused(t('The organization was made but its name did not come back. Reload to find it.'))
        setBusy(false)
        return
      }
      // The first organization is the account becoming a customer: the ONE
      // sign-up conversion, as the create dialog counts it.
      if (first) countSignup()
      renew()
      await sdk.refreshAccessToken().catch(() => null)
      pick(made.org)
      onFounded(made.org)
      setBusy(false)
      setStep('invite')
    } catch (err) {
      setRefused(err instanceof Error ? err.message : t('Could not create it.'))
      setBusy(false)
    }
  }

  const invite = async (e: React.FormEvent) => {
    e.preventDefault()
    const list = [...new Set(emails.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean))]
    if (list.length === 0 || !founded) {
      setStep('plan')
      return
    }
    setBusy(true)
    const out = await Promise.all(
      list.map(async (email) => {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { email, refused: t('Not an email address.') }
        try {
          const made = await createInvitation(founded, email)
          return { email, link: inviteLink(made.owner || founded, made.code) }
        } catch (err) {
          return { email, refused: err instanceof Error ? err.message : t('Could not invite.') }
        }
      }),
    )
    setSent(out)
    setBusy(false)
  }

  if (step === 'plan' && founded) return <Plan org={founded} members={[founded]} seats={1 + sent.filter((s) => s.link).length} setup />

  return (
    <Page label={t('Create your team')}>
      <Column>
        {step === 'name' ? (
          <YStack render="form" {...{ onSubmit: create }}>
            <Step at={1} of={3} />
            <Heading title={t('Create your team')} lede={t('A team owns its agents, credit and members. You are its owner.')} />
            <Rule />
            <View render="label" display="block">
              <Text display="block" fontSize="$4" fontWeight="500" mb={8} color="$ink">
                {t('Team name')}
              </Text>
              <Text render={<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme" autoFocus />} {...FIELD} />
              <Text display="block" fontSize="$3" color="$soft" mt={8}>
                {t('What the rail and every invoice call it.')}
              </Text>
            </View>
            {refused ? (
              <Text render="p" role="alert" mt={14} fontSize="$3" color={BAD}>
                {refused}
              </Text>
            ) : null}
            <XStack gap={10} flexWrap="wrap" mt={24}>
              <Button type="submit" variant="primary" size="lg" disabled={busy}>
                {t(busy ? 'Creating…' : 'Continue')}
              </Button>
              {members.length > 1 && onSwitch ? (
                <Button type="button" size="lg" onClick={onSwitch}>
                  {t('Switch organization')}
                </Button>
              ) : null}
            </XStack>
            <Rule />
            <Text render="p" fontSize="$3" color="$soft">
              {t('Just you? Hanzo Chat is free for personal use at {link}.', {
                link: (
                  <Text render={<a href={site('/chat')} />} color="$ink" textDecorationLine="underline">
                    hanzo.ai/chat
                  </Text>
                ),
              })}
            </Text>
          </YStack>
        ) : (
          <YStack render="form" {...{ onSubmit: invite }}>
            <Step at={2} of={3} />
            <Heading
              title={t('Invite your teammates')}
              lede={t('Each address gets its own single-use link to join. You can skip this and invite people later.')}
            />
            <Rule />
            <View render="label" display="block">
              <Text display="block" fontSize="$4" fontWeight="500" mb={8} color="$ink">
                {t('Email addresses')}
              </Text>
              <Text
                render={<textarea data-i18n-ltr="" value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="ada@acme.com, alan@acme.com" rows={3} />}
                {...FIELD}
              />
              <Text display="block" fontSize="$3" color="$soft" mt={8}>
                {t('Separate them with commas, spaces or new lines.')}
              </Text>
            </View>
            {sent.length ? (
              <YStack render="ul" gap={8} m={0} p={0} mt={18} aria-label={t('Invitations')}>
                {sent.map((s) => {
                  const email = (
                    <Text fontWeight="500" color="$ink">
                      {s.email}
                    </Text>
                  )
                  return (
                    <YStack render="li" key={s.email}>
                      <Text fontSize="$3" color="$soft" wordWrap="break-word">
                        {s.link ? (
                          t('{email} invited. Their link: {link}', {
                            email,
                            link: (
                              <Text render={<a href={s.link} />} color="$ink" textDecorationLine="underline">
                                {s.link}
                              </Text>
                            ),
                          })
                        ) : (
                          <>
                            {email}{' '}
                            <Text role="alert" color={BAD}>
                              {s.refused}
                            </Text>
                          </>
                        )}
                      </Text>
                    </YStack>
                  )
                })}
              </YStack>
            ) : null}
            <XStack gap={10} flexWrap="wrap" mt={24}>
              {sent.length ? (
                <Button type="button" variant="primary" size="lg" onClick={() => setStep('plan')}>
                  {t('Continue')}
                </Button>
              ) : (
                <>
                  <Button type="submit" variant="primary" size="lg" disabled={busy}>
                    {busy ? t('Inviting…') : emails.trim() ? t('Invite and continue') : t('Continue')}
                  </Button>
                  <Button type="button" size="lg" onClick={() => setStep('plan')}>
                    {t('Skip for now')}
                  </Button>
                </>
              )}
            </XStack>
          </YStack>
        )}
      </Column>
    </Page>
  )
}

/** Where a checkout from the setup returns: Home, on this origin. */
const home = (): string => `${window.location.origin}${where().home}`

/**
 * THE PLAN: how many seats, billed monthly or annually, then checkout.
 *
 * The prices are the catalog's Team row, never typed: its monthly price per
 * seat, and a year as the catalog states it (`charge`). The seat floor is the
 * row's `minSeats`. Checkout is hanzo.ai/pay's cart (`cartUrl`), charged to this
 * organization and returning Home.
 */
function Plan({
  org,
  members,
  onSwitch,
  outage,
  onRetry,
  seats: wanted = 1,
  setup = false,
}: {
  org: string
  members: string[]
  onSwitch?: () => void
  /** Billing could not be READ. The app still does not open, and the reader is told it is ours to fix. */
  outage?: boolean
  onRetry?: () => void
  /** The seats the setup already knows it needs. */
  seats?: number
  /** Part of creating the team, so it is its third step. */
  setup?: boolean
}) {
  const { t, locale } = useI18n()
  const { plan } = usePlan('team')
  const floor = Math.max(1, Number(plan?.limits?.minSeats ?? 1))
  // The count asked for, held above the floor: the floor arrives with the live
  // catalog row and can rise after the first paint.
  const [asked, setSeats] = useState(wanted)
  const seats = Math.max(floor, asked)
  const [term, setTerm] = useState<Interval>('year')
  const monthly = (plan && charge(plan, 'month')) ?? 0
  const yearly = plan ? charge(plan, 'year') : null
  const each = term === 'year' && yearly ? yearly : monthly
  const terms: [Interval, string, string][] = [
    ['month', t('Monthly'), t('{price} / seat / month', { price: money(monthly, locale) })],
    ...(yearly ? [['year', t('Annual'), t('{price} / seat, billed once a year', { price: money(yearly, locale) })] as [Interval, string, string]] : []),
  ]
  // What the seats come to, bold inside the sentence that adds them up.
  const total = (
    <Text fontWeight="500" color="$ink">
      {term === 'year' ? t('{amount} a year', { amount: money(seats * each, locale) }) : t('{amount} a month', { amount: money(seats * each, locale) })}
    </Text>
  )
  const sum =
    term === 'year'
      ? seats === 1
        ? t('1 seat at {price} a year is {total}.', { price: money(each, locale), total })
        : t('{seats} seats at {price} a year is {total}.', { seats, price: money(each, locale), total })
      : seats === 1
        ? t('1 seat at {price} a month is {total}.', { price: money(each, locale), total })
        : t('{seats} seats at {price} a month is {total}.', { seats, price: money(each, locale), total })
  return (
    <Page label={t('Choose your plan')}>
      <Column>
        {setup ? <Step at={3} of={3} /> : null}
        <Heading
          title={org}
          lead={22.5}
          lede={
            outage
              ? t('Billing could not be read just now, so this team cannot open yet. That is ours to fix.')
              : plan
                ? t('A team runs on the {plan} plan, and nothing in it works until that plan is live.', { plan: plan.name })
                : t('Its plan is not live yet.')
          }
        />
        {outage && onRetry ? (
          <XStack mt={16}>
            <Button size="lg" onClick={onRetry}>
              {t('Try again')}
            </Button>
          </XStack>
        ) : null}
        <Rule />
        {plan ? (
          <>
            <View render="fieldset" display="block" borderWidth={0} p={0} m={0}>
              <Text render="legend" display="block" p={0} fontSize="$4" fontWeight="500" mb={10} color="$ink">
                {t('Seats')}
              </Text>
              <XStack items="center" gap={10}>
                <Button type="button" size="icon" aria-label={t('One seat fewer')} disabled={seats <= floor} onClick={() => setSeats(Math.max(floor, seats - 1))}>
                  <Minus size={16} aria-hidden />
                </Button>
                <Text
                  render={
                    <input
                      aria-label={t('Seats')}
                      type="number"
                      inputMode="numeric"
                      min={floor}
                      value={seats}
                      onChange={(e) => setSeats(Math.max(floor, Math.floor(Number(e.target.value) || floor)))}
                    />
                  }
                  {...FIELD}
                  width={80}
                  height={36}
                  py={0}
                  fontSize="$4"
                  rounded="$3"
                  text="center"
                />
                <Button type="button" size="icon" aria-label={t('One seat more')} onClick={() => setSeats(seats + 1)}>
                  <Plus size={16} aria-hidden />
                </Button>
              </XStack>
              <Text display="block" fontSize="$3" color="$soft" mt={8}>
                {floor === 1
                  ? t('At least 1 seat. Each person in the team takes one.')
                  : t('At least {seats} seats. Each person in the team takes one.', { seats: floor })}
              </Text>
            </View>

            <View render="fieldset" display="block" borderWidth={0} p={0} m={0} mt={24}>
              <Text render="legend" display="block" p={0} fontSize="$4" fontWeight="500" mb={10} color="$ink">
                {t('Billing')}
              </Text>
              <View display="grid" gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap={10}>
                {terms.map(([value, label, price]) => (
                  <XStack
                    key={value}
                    render="label"
                    gap={10}
                    items="flex-start"
                    px={14}
                    py={12}
                    rounded="$3"
                    borderWidth={1}
                    borderColor={term === value ? '$ink' : '$edge'}
                    cursor="pointer"
                  >
                    <input type="radio" name="term" value={value} checked={term === value} onChange={() => setTerm(value)} />
                    <YStack shrink={1}>
                      <Text fontSize="$4" fontWeight="500" color="$ink">
                        {label}
                      </Text>
                      <Text fontSize="$3" color="$soft" mt={2}>
                        {price}
                      </Text>
                    </YStack>
                  </XStack>
                ))}
              </View>
            </View>

            <Text render="p" mt={22} fontSize="$4" color="$soft" lineHeight={23.25}>
              {sum} {t("Payment is on the provider's hosted page.")}
            </Text>
          </>
        ) : null}

        <XStack gap={10} flexWrap="wrap" mt={24}>
          {plan ? (
            <Button asChild variant="primary" size="lg">
              <a href={cartUrl(plan.id, seats, term, org, home())}>{t('Continue to checkout')}</a>
            </Button>
          ) : null}
          {members.length > 1 && onSwitch ? (
            <Button size="lg" onClick={onSwitch}>
              {t('Switch organization')}
            </Button>
          ) : null}
        </XStack>
      </Column>
    </Page>
  )
}
