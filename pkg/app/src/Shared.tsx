'use client'

// A conversation someone shared, read at /chat/shared.
//
// Opened from a link (`/chat/shared#<token>`), the token has already left the
// address by the time this runs (lib/share.ts `SEAL`) and waits in this tab.
// Signed out, the platform answers the title alone and the page asks the reader
// to sign in or sign up — through this site's /login and /signup, which hand off
// to Hanzo IAM and come back to /chat/shared, where the token is still waiting.
// Signed in, from any organization, the reader is first told who shared it and
// that opening it shows that person their name; one press opens it, records
// them as a viewer, and the address becomes `/chat/shared?s=<share>`: the chat
// is theirs to open again from Shared with you, and the token is forgotten.
// Nothing about their organization is read or changed here (lib/share.ts). A
// link that opens nothing says so.

import { useEffect, useState } from 'react'
import { useIam } from '@hanzo/iam/react'
import { useI18n } from '@hanzo/i18n/react'
import { Anchor, Button, Text, XStack, YStack } from '@hanzo/ui'
import { brand } from './where'
import { useHydrated } from './lib/hydrated'
import { enter, LOGIN, signUp } from './lib/destination'
import { Prose } from './Prose'
import { address, opened, opening, read, readShared, take, type Shared as Answer } from './lib/share'

type State =
  | { kind: 'reading' }
  | { kind: 'missing' }
  | { kind: 'gone' }
  | { kind: 'ask' }
  | { kind: 'wrong'; said: string }
  | { kind: 'read'; shared: Answer }

/** What the page is opening: a token this tab is holding, or a share id in the query. */
type Target = { token: string } | { share: string } | null

function target(): Target {
  const token = opening()
  if (token) return { token }
  const share = new URLSearchParams(window.location.search).get('s')?.trim()
  return share ? { share } : null
}

const MEASURE = 'var(--container-prose, 48rem)'

export function Shared() {
  const { t } = useI18n()
  const hydrated = useHydrated()
  const { isLoading, isAuthenticated, accessToken } = useIam()
  const [aim, setAim] = useState<Target | undefined>(undefined)
  const [agreed, setAgreed] = useState(false)
  const [state, setState] = useState<State>({ kind: 'reading' })

  // A link pasted into this tab while the page is open arrives as a new
  // fragment: it is taken out of the address exactly as the head does.
  useEffect(() => {
    if (!hydrated) return
    const on = () => {
      take()
      setAim(target())
    }
    on()
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [hydrated])

  // Read once IAM has settled, and again when the session changes: signing in
  // turns the title into the chat. Only a signed-in reader reads by share id.
  useEffect(() => {
    if (!hydrated || isLoading || !aim) return
    if (!('token' in aim) && !isAuthenticated) return
    let on = true
    const got = 'token' in aim ? read(aim.token, agreed) : readShared(aim.share)
    got
      .then((shared) => {
        if (!on) return
        if (shared?.full && shared.share && 'token' in aim) {
          opened()
          history.replaceState(null, '', address(shared.share))
        }
        setState(shared ? { kind: 'read', shared } : { kind: 'gone' })
      })
      .catch((e) => on && setState({ kind: 'wrong', said: e instanceof Error ? e.message : t('This chat could not be read. Try again.') }))
    return () => {
      on = false
    }
  }, [hydrated, isLoading, aim, agreed, isAuthenticated, accessToken])

  const shown: State =
    hydrated && aim === null
      ? { kind: 'missing' }
      : hydrated && !isLoading && aim && !('token' in aim) && !isAuthenticated
        ? { kind: 'ask' }
        : state

  return (
    <YStack role="main" height="100dvh" overflowY="auto" bg="$background">
      <XStack height={48} px="$4" items="center" justify="space-between" borderBottomWidth={1} borderColor="$borderColor" shrink={0}>
        <Anchor href="/" aria-label={brand()}>
          <Text fontSize="$4" fontWeight="600" color="$ink">
            {brand()}
          </Text>
        </Anchor>
        {shown.kind === 'read' && shown.shared.full ? (
          <Text fontSize="$1" color="$soft">
            {t('Shared with you · Read only')}
          </Text>
        ) : null}
      </XStack>
      <YStack width="100%" maxW={MEASURE} mx="auto" px="$4" py="$6" gap="$4">
        <Body state={shown} signedIn={Boolean(isAuthenticated)} onOpen={() => setAgreed(true)} />
      </YStack>
    </YStack>
  )
}

function Body({ state, signedIn, onOpen }: { state: State; signedIn: boolean; onOpen: () => void }) {
  const { t } = useI18n()
  if (state.kind === 'reading') {
    return (
      <Text fontSize="$3" color="$soft" aria-live="polite">
        {t('Opening the chat.')}
      </Text>
    )
  }
  if (state.kind === 'missing' || state.kind === 'gone') {
    return (
      <YStack gap="$3" items="flex-start">
        <Text render="h1" fontSize="$7" fontWeight="600" color="$ink">
          {t('This chat is no longer shared.')}
        </Text>
        <Text fontSize="$3" color="$soft">
          {state.kind === 'missing' ? t('The link is incomplete. Ask for it again.') : t('The link was turned off, or it was never a link to a chat.')}
        </Text>
        <Anchor href="/">
          <Button size="sm" variant="outline">
            {t('Go to {brand}', { brand: brand() })}
          </Button>
        </Anchor>
      </YStack>
    )
  }
  if (state.kind === 'ask') {
    return <Ask signedIn={signedIn} />
  }
  if (state.kind === 'wrong') {
    return (
      <YStack gap="$3" items="flex-start">
        <Text render="h1" fontSize="$6" fontWeight="600" color="$ink">
          {t('This chat could not be opened.')}
        </Text>
        <Text role="alert" fontSize="$3" color="$soft">
          {state.said}
        </Text>
        <Button size="sm" onClick={() => window.location.reload()}>
          {t('Try again')}
        </Button>
      </YStack>
    )
  }
  const { shared } = state
  const by = shared.by || t('The person who shared it')
  if (!shared.full) {
    return (
      <>
        <Text render="h1" fontSize="$7" lineHeight="$7" fontWeight="600" color="$ink">
          {shared.title}
        </Text>
        {shared.confirm ? (
          <YStack gap="$3" p="$4" rounded="$4" borderWidth={1} borderColor="$borderColor" bg="$backgroundHover" role="region" aria-label={t('Open the chat')}>
            <Text fontSize="$4" fontWeight="600" color="$ink">
              {shared.by ? t('{name} shared this chat with you', { name: shared.by }) : t('This chat was shared with you')}
            </Text>
            <Text fontSize="$2" color="$soft">
              {shared.by
                ? t('Opening it shows {name} the name you signed in with, and keeps it under Shared with you.', { name: shared.by })
                : t('Opening it shows them the name you signed in with, and keeps it under Shared with you.')}
            </Text>
            <XStack>
              <Button size="sm" onClick={onOpen}>
                {t('Open — {name} will see your name', { name: by })}
              </Button>
            </XStack>
          </YStack>
        ) : (
          <Ask signedIn={signedIn} />
        )}
      </>
    )
  }
  return (
    <>
      <Text render="h1" fontSize="$7" lineHeight="$7" fontWeight="600" color="$ink">
        {shared.title}
      </Text>
      {shared.by ? (
        <Text fontSize="$2" color="$soft">
          {t('Shared by {name}', { name: shared.by })}
        </Text>
      ) : null}
      {/* Each `li` is a gui stack, so it draws no marker: the list needs no list-style of its own. */}
      <YStack gap="$4" render="ol" m={0} p={0} aria-label={t('Messages')}>
        {shared.messages.map((turn, i) => (
          <YStack render="li" key={i} gap="$1">
            <Text fontSize="$1" color="$soft" textTransform="uppercase">
              {turn.role === 'user' ? t('Asked') : turn.model ? t('Answered · {model}', { model: turn.model }) : t('Recorded by the person who shared this')}
            </Text>
            {turn.role === 'assistant' && turn.model ? (
              <Prose text={turn.content} />
            ) : (
              <Text fontSize="$3" color="$ink" whiteSpace="pre-wrap">
                {turn.content}
              </Text>
            )}
          </YStack>
        ))}
      </YStack>
    </>
  )
}

/**
 * What a reader who is not signed in is shown under the title: sign up or sign
 * in, and come back here. A reader who is signed in and still not shown the
 * chat holds a session the platform did not accept, so they are asked to sign
 * in again.
 */
function Ask({ signedIn }: { signedIn: boolean }) {
  const { t } = useI18n()
  if (signedIn) {
    return (
      <YStack gap="$3" p="$4" rounded="$4" borderWidth={1} borderColor="$borderColor" bg="$backgroundHover" role="region" aria-label={t('Sign in to read the chat')}>
        <Text fontSize="$4" fontWeight="600" color="$ink">
          {t('Sign in again to read this chat')}
        </Text>
        <Text fontSize="$2" color="$soft">
          {t('Your session has ended; signing in brings you straight back here. The person who shared it will see that you opened it.')}
        </Text>
        <XStack gap="$2">
          <Button size="sm" onClick={() => enter(LOGIN)}>
            {t('Sign in')}
          </Button>
        </XStack>
      </YStack>
    )
  }
  return (
    <YStack gap="$3" p="$4" rounded="$4" borderWidth={1} borderColor="$borderColor" bg="$backgroundHover" role="region" aria-label={t('Sign in to read the chat')}>
      <Text fontSize="$4" fontWeight="600" color="$ink">
        {t('Sign in to read this chat')}
      </Text>
      <Text fontSize="$2" color="$soft">
        {t('A free Hanzo account opens it, and you come straight back here. The person who shared it will see that you opened it.')}
      </Text>
      <XStack gap="$2" flexWrap="wrap">
        <Button size="sm" onClick={() => enter(signUp())}>
          {t('Sign up to view')}
        </Button>
        <Button size="sm" variant="outline" onClick={() => enter(LOGIN)}>
          {t('Sign in')}
        </Button>
      </XStack>
    </YStack>
  )
}
