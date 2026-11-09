'use client'

/**
 * The account chooser: who is signed in on this browser, and a press to be any one
 * of them. One view for every site that signs people in on its own origin.
 *
 * IAM holds a session for each person signed in here and lists them (`GET
 * /v1/iam/accounts`, lib/accounts); this draws that list and decides nothing.
 *
 *   a row                the sign-in for that account: the host's `pick` (IAM's
 *                        `resume` with the account named, then on to the code it
 *                        answers)
 *   Sign out             that account alone (IAM's `logout_hint`); the page is drawn
 *                        again from what IAM still holds
 *   Use another account  the sign-in form (`onOther`), which keeps these sessions
 *   Sign out of all      every account, and the page the person was on
 *
 * What differs by site is handed in: `pick` (analytics, an app's request being
 * answered), `frame` (the card around the rows) and `refusal` (how a refusal is
 * said). A tab that holds tokens for an account IAM lists no session for is offered
 * as the one row (`listed` false), and its Sign out is the whole sign-out.
 */

import { useState, type ComponentType, type ReactNode } from 'react'
import { useIam } from '@hanzo/iam/react'
import { useI18n } from '@hanzo/i18n/react'
import { Text, XStack, YStack } from '@hanzo/gui'
import { Avatar, Button } from '@hanzo/ui'
import { TextLink } from '@hanzo/ui/marketing'
import { label, type Account, type Accounts } from './lib/accounts'
import { useSignOut } from './lib/signout'

/** The card the rows sit in; the page's own (hanzo.ai's Sheet), else a plain column. */
export type Frame = ComponentType<{ label: string; children: ReactNode }>

/** How a refusal is said; the page's own, else plain text in the alert role. */
export type Refusal = ComponentType<{ text: string | null }>

const Plain: Frame = ({ label: name, children }) => (
  <YStack render="section" aria-label={name} width="100%" maxW={420} mx="auto" gap="$4">
    {children}
  </YStack>
)

const Said: Refusal = ({ text }) =>
  text ? (
    <Text role="alert" fontSize="$3" color="$ink" text="center">
      {text}
    </Text>
  ) : null

/** Where this page is, the request included: what a sign-out comes back to, so the page's own request is still the page's. */
const here = (): string => `${window.location.pathname}${window.location.search}`

export interface ChooseProps {
  /** The accounts to choose among: IAM's list, else this tab's own. */
  rows: Account[]
  /** Whether `rows` is IAM's list, each with a session to end alone. */
  listed: boolean
  known: Pick<Accounts, 'leave'>
  /** The sign-in form instead. */
  onOther: () => void
  /**
   * Be the account pressed: true once it is on its way, false where IAM has no
   * session to spend for it (the form is then asked for the credential).
   */
  pick: (account: Account) => Promise<boolean>
  frame?: ComponentType<{ label: string; children: ReactNode }>
  refusal?: Refusal
  /** Said above the rows (another app's request being answered). */
  note?: ReactNode
}

export function Choose({ rows, listed, known, onOther, pick, frame: Frame = Plain, refusal: Wrong = Said, note }: ChooseProps) {
  const { t } = useI18n()
  const { user } = useIam()
  const out = useSignOut(typeof window === 'undefined' ? undefined : here())
  const [busy, setBusy] = useState(false)
  const [wrong, setWrong] = useState<string | null>(null)
  const signedIn = user as { id?: string; email?: string } | null

  async function go(a: Account) {
    setBusy(true)
    setWrong(null)
    try {
      if (!(await pick(a))) onOther()
    } catch {
      setWrong(t('Something went wrong. Try again.'))
      setBusy(false)
    }
  }

  async function leave(a: Account) {
    setBusy(true)
    setWrong(null)
    if (!listed) return void out()
    if (!(await known.leave(a, here()))) setWrong(t('Something went wrong. Try again.'))
    setBusy(false)
  }

  return (
    <Frame label={t('Accounts')}>
      {note}
      <YStack render="ul" aria-label={t('Signed in on this browser')} m={0} p={0} gap="$2">
        {rows.map((a) => {
          const { title, line } = label(a)
          const who = a.email || title
          return (
            <XStack key={a.sub} render="li" items="center" gap="$2">
              <XStack
                render={<button type="button" />}
                disabled={busy}
                onClick={() => void go(a)}
                aria-label={t('Continue as {who}', { who })}
                aria-current={signedIn && (a.sub === signedIn.id || a.email === signedIn.email) ? true : undefined}
                flex={1}
                minW={0}
                items="center"
                gap="$3"
                px="$3"
                py="$2.5"
                rounded="$4"
                borderWidth={1}
                borderColor="$edge"
                bg="transparent"
                cursor="pointer"
                hoverStyle={{ bg: '$hover' }}
              >
                <Avatar src={a.avatar || null} name={title} colorSeed={a.sub} alt="" size={36} width={36} height={36} rounded={999} />
                <YStack flex={1} minW={0} gap={2}>
                  <Text fontSize="$3" fontWeight="600" color="$ink" numberOfLines={1} text="start">
                    {title}
                  </Text>
                  {line || a.owner ? (
                    <Text fontSize="$2" color="$soft" numberOfLines={1} text="start">
                      {[line, a.owner].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                </YStack>
              </XStack>
              <Button type="button" size="xs" variant="ghost" disabled={busy} aria-label={t('Sign out {name}', { name: title })} onClick={() => void leave(a)}>
                {t('Sign out')}
              </Button>
            </XStack>
          )
        })}
      </YStack>
      <Wrong text={wrong} />
      <TextLink onPress={onOther}>{t('Use another account')}</TextLink>
      {rows.length > 1 ? <TextLink onPress={() => void out()}>{t('Sign out of all accounts')}</TextLink> : null}
    </Frame>
  )
}
