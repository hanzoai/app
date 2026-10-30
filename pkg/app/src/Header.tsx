'use client'

/**
 * The bar over a focused page: the organization chooser, the way in, the way to
 * pay, a beta application. One bar for all of them, so none draws its own.
 *
 * The brand at the start (`HanzoWordmark`: `brand()` in words, as the site's own bar sets it), going to this
 * host's root; then the host's `back`, where the page has a step to go back to.
 * At the end, once someone is signed in, who it is: the face, the name and the
 * address, the other accounts signed in on this browser to be one tap away
 * (lib/accounts), Add account and Log out. Signed out, nothing but the brand. Under gui's `md` the account folds into its face, a menu of the address
 * and the same two ways out. A host with an account control of its own hands it
 * in as `account`, and the bar draws that in this one's place (null: none).
 *
 * THE WORDMARK STANDS WHERE THE MARKETING BAR'S DOES: the bar's side is the
 * page's gutter (@hanzo/design `--page-gutter`), 60px tall, and the name is a
 * pill whose 12px of padding the bar takes back with a -12px start margin, the
 * shape hanzo.ai's own bar gives it. So the name's first letter is at the gutter
 * on every page of every host, the focused ones and the marketing ones alike.
 * Under a pointer or keyboard focus the pill takes the bar's one highlight, the
 * `$hover` ground and no outline or border, as every control on hanzo.ai's bar
 * does, and an arrow opens before the name: this goes back to the site.
 * Keyboard focus keeps its ring as well.
 *
 * Being another account, and adding one, write this page down first
 * (destination.ts `rememberDestination`), so the sign-in that follows comes back
 * to it, as hanzo.ai's /join does, and neither ends a session. Log out is the
 * account menu's own (lib/signout) and ends every one. The session is IAM's: the
 * host mounts `IamProvider`.
 */

import { useEffect, useState, type FocusEvent, type PointerEvent, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useI18n } from '@hanzo/i18n/react'
import { useIam } from '@hanzo/iam/react'
import { Text, View, XStack, YStack } from '@hanzo/gui'
import { Avatar, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@hanzo/ui'
import { HanzoWordmark } from '@hanzogui/shell'
import { Face } from './Accounts'
import { useAccounts } from './lib/accounts'
import { named } from './lib/session'
import { useSignOut } from './lib/signout'
import { brand, site } from './where'
import { dragWindow, toggleWindowMaximize, WindowControls } from './WindowControls'

/** The bar's height under the notch: hanzo.ai's masthead's. */
const HEIGHT = 60
/** The bar's side: the page's gutter, as hanzo.ai's marketing bar has it. */
const GUTTER = 'var(--page-gutter, 20px)'
/** The name's pill: its padding, which the bar takes back so the name's first letter is at the gutter. */
const PAD = 12
/** The pill lit: the bar's one highlight, a ground and no outline. */
const LIT = '$hover'
/** The arrow that opens before the name, and the space after it. */
const CUE = 14
const CUE_GAP = 6
/** The bar's ground once the page has moved under it: the page's own, frosted. At rest it has none. */
const GLASS = '$background/72'
const BLUR = 'blur(20px) saturate(1.8)'
/** How far the page moves before the bar takes a ground: a flick is not a scroll. */
const MOVED = 8

/** Whether the page has scrolled past `MOVED`. */
function useMoved(): boolean {
  const [moved, setMoved] = useState(false)
  useEffect(() => {
    const read = () => setMoved((window.scrollY || document.documentElement.scrollTop || 0) > MOVED)
    read()
    window.addEventListener('scroll', read, { passive: true })
    return () => window.removeEventListener('scroll', read)
  }, [])
  return moved
}
/** The notch's inset. gui carries a CSS function to the page unchanged; its types only name custom properties. */
const NOTCH = 'env(safe-area-inset-top)' as `var(--${string})`

export function Header({ back, account }: { back?: ReactNode; account?: ReactNode }) {
  const { t, dir } = useI18n()
  const { user, isAuthenticated } = useIam()
  const signOut = useSignOut()
  const claimed = named()
  const u = user as { displayName?: string; name?: string; email?: string; avatar?: string } | null
  const name = u?.displayName || u?.name || claimed?.name || ''
  const email = u?.email || claimed?.email || ''
  const avatar = typeof u?.avatar === 'string' && u.avatar.startsWith('https://') ? u.avatar : ''
  const who = name || email
  const out = () => void signOut()
  const { accounts, current, switchTo, add } = useAccounts()
  const others = accounts.filter((a) => a.sub !== current?.sub)
  const signed = isAuthenticated && Boolean(who)
  const moved = useMoved()
  return (
    <XStack
      render="header"
      data-slot="masthead"
      data-scrolled={moved ? 'true' : 'false'}
      data-tauri-drag-region="deep"
      onMouseDown={dragWindow}
      onDoubleClick={toggleWindowMaximize}
      position="sticky"
      t={0}
      z="var(--z-header)"
      shrink={0}
      boxSizing="content-box"
      height={HEIGHT}
      pt={NOTCH}
      px={GUTTER}
      gap={12}
      items="center"
      bg={moved ? GLASS : 'transparent'}
      backdropFilter={moved ? BLUR : 'none'}
      transition="quickest"
      borderBottomWidth={0}
    >
      <Home />
      {back}
      <View flex={1} data-tauri-drag-region="deep" />
      {account !== undefined ? account : signed ? (
        <View render="section" aria-label={t('Account')} display="flex">
          {/* Under the face, flush with the bar's end edge. */}
          <DropdownMenu placement={dir === 'rtl' ? 'bottom-start' : 'bottom-end'} offset={8}>
            <DropdownMenuTrigger asChild>
              <XStack
                render="button"
                aria-label={t('Account: {name}', { name: who })}
                width={40}
                height={40}
                // The face on the gutter, as the name is at the start (Home's -PAD): the 40px
                // target reaches 4px past it, never the face.
                marginInlineEnd={-4}
                rounded={999}
                items="center"
                justify="center"
                borderWidth={0}
                bg="transparent"
                hoverStyle={{ bg: '$hover' }}
                focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: '$outlineColor' }}
                cursor="pointer"
              >
                <Avatar src={avatar || null} name={who} alt="" />
              </XStack>
            </DropdownMenuTrigger>
            <DropdownMenuContent minW={240} maxW="calc(100vw - 16px)" aria-labelledby={undefined} aria-label={t('Account')}>
              <DropdownMenuLabel>
                <YStack minW={0} gap={2}>
                  <Text fontSize="$3" fontWeight="500" color="$ink" numberOfLines={1}>
                    {who}
                  </Text>
                  {name && email ? (
                    <Text fontSize="$2" color="$soft" numberOfLines={1}>
                      {email}
                    </Text>
                  ) : null}
                </YStack>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => window.location.assign(site('/support'))}>
                <Text fontSize="$3" color="$ink">
                  {t('Help')}
                </Text>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {others.map((a) => (
                <DropdownMenuItem key={a.sub} onSelect={() => void switchTo(a)}>
                  <XStack items="center" gap={10} minW={0}>
                    <Face account={a} />
                  </XStack>
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onSelect={() => void add()}>
                <Text fontSize="$3" color="$ink">
                  {t('Add account')}
                </Text>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={out}>
                <Text fontSize="$3" color="$ink">
                  {t('Log out')}
                </Text>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </View>
      ) : null}
      <WindowControls />
    </XStack>
  )
}

/**
 * The name, going to this host's root. Lit (the outline and the arrow before the
 * name) under a mouse or pen and under keyboard focus; a finger's tap navigates
 * and is not a hover, so it does not light.
 */
function Home() {
  const { t, dir } = useI18n()
  const [lit, setLit] = useState(false)
  const Arrow = dir === 'rtl' ? ArrowRight : ArrowLeft
  const point = (on: boolean) => (e: PointerEvent) => {
    if (e.pointerType !== 'touch') setLit(on)
  }
  const focus = (e: FocusEvent<HTMLElement>) => setLit(e.currentTarget.matches(':focus-visible'))
  return (
    <Text
      render={
        <a
          href="/"
          aria-label={t('{brand} home', { brand: brand() })}
          data-lit={lit ? 'true' : 'false'}
          data-tauri-drag-region="deep"
          onClick={(e) => {
            if (typeof document !== 'undefined' && document.documentElement.getAttribute('data-desktop') === 'true') {
              e.preventDefault()
            }
          }}
          onPointerEnter={point(true)}
          onPointerLeave={point(false)}
          onFocus={focus}
          onBlur={() => setLit(false)}
        />
      }
      data-slot="home"
      display="flex"
      items="center"
      shrink={0}
      height={34}
      marginInlineStart={-PAD}
      paddingInline={PAD}
      rounded={999}
      color="var(--foreground)"
      textDecorationLine="none"
      bg={lit ? LIT : 'transparent'}
      focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: '$outlineColor', outlineOffset: 2 }}
      transition="quickest"
      data-tauri-drag-region="deep"
    >
      <View
        aria-hidden
        display="flex"
        items="center"
        overflow="hidden"
        width={lit ? CUE : 0}
        marginInlineEnd={lit ? CUE_GAP : 0}
        opacity={lit ? 1 : 0}
        transition="quickest"
      >
        <Arrow size={CUE} strokeWidth={2.2} />
      </View>
      <HanzoWordmark label={brand()} size={22} data-tauri-drag-region="deep" />
    </Text>
  )
}
