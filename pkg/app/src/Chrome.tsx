'use client'

/**
 * The bar over a focused page: the organization chooser, the way in, the way to
 * pay, a beta application. One bar for all of them, so none draws its own.
 *
 * The brand at the start (`HanzoWordmark`: `brand()` in words, as the site's own bar sets it), going to this
 * host's root; then the host's `back`, where the page has a step to go back to.
 * At the end, once someone is signed in, who it is: the face, the name and the
 * address, with Use another account and Log out. Signed out, nothing but the
 * brand. Under gui's `md` the account folds into its face, a menu of the address
 * and the same two ways out.
 *
 * Use another account writes this page down first (destination.ts
 * `rememberDestination`), so the sign-in that follows comes back to it, as
 * hanzo.ai's /join does. Log out is the account menu's own (lib/signout). The
 * session is IAM's: the host mounts `IamProvider`.
 */

import type { ReactNode } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { useIam } from '@hanzo/iam/react'
import { Text, View, XStack, YStack } from '@hanzo/gui'
import { Avatar, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@hanzo/ui'
import { HanzoWordmark } from '@hanzogui/shell'
import { rememberDestination } from './lib/destination'
import { named } from './lib/session'
import { useSignOut } from './lib/signout'
import { brand, site } from './where'
import { dragWindow, toggleWindowMaximize, WindowControls } from './WindowControls'

/** The bar's height under the notch: hanzo.ai's masthead's. */
const HEIGHT = 60
/** The notch's inset. gui carries a CSS function to the page unchanged; its types only name custom properties. */
const NOTCH = 'env(safe-area-inset-top)' as `var(--${string})`

export function Chrome({ back }: { back?: ReactNode }) {
  const { t, dir } = useI18n()
  const { user, isAuthenticated } = useIam()
  const signOut = useSignOut()
  const claimed = named()
  const u = user as { displayName?: string; name?: string; email?: string; avatar?: string } | null
  const name = u?.displayName || u?.name || claimed?.name || ''
  const email = u?.email || claimed?.email || ''
  const avatar = typeof u?.avatar === 'string' && u.avatar.startsWith('https://') ? u.avatar : ''
  const who = name || email
  const other = () => {
    rememberDestination()
    void signOut()
  }
  const out = () => void signOut()
  const signed = isAuthenticated && Boolean(who)
  return (
    <XStack
      render="header"
      data-slot="masthead"
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
      px={20}
      gap={12}
      items="center"
      bg="var(--background)"
      borderBottomWidth={1}
      borderColor="var(--border)"
    >
      <Text
        render={
          <a
            href="/"
            aria-label={t('{brand} home', { brand: brand() })}
            data-tauri-drag-region="deep"
            onClick={(e) => {
              if (typeof document !== 'undefined' && document.documentElement.getAttribute('data-desktop') === 'true') {
                e.preventDefault()
              }
            }}
          />
        }
        display="flex"
        items="center"
        shrink={0}
        color="var(--foreground)"
        textDecorationLine="none"
        data-tauri-drag-region="deep"
      >
        <HanzoWordmark label={brand()} size={22} data-tauri-drag-region="deep" />
      </Text>
      {back}
      <View flex={1} data-tauri-drag-region="deep" />
      {signed ? (
        <View render="section" aria-label={t('Account')} display="flex">
          {/* Under the face, flush with the bar's end edge. */}
          <DropdownMenu placement={dir === 'rtl' ? 'bottom-start' : 'bottom-end'} offset={8}>
            <DropdownMenuTrigger asChild>
              <XStack
                render="button"
                aria-label={t('Account: {name}', { name: who })}
                width={40}
                height={40}
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
              <DropdownMenuItem onSelect={other}>
                <Text fontSize="$3" color="$ink">
                  {t('Use another account')}
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
