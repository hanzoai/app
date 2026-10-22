'use client'

/**
 * The bar over a focused page: the organization chooser, the way in, the way to
 * pay, a beta application. One bar for all of them, so none draws its own.
 *
 * The brand at the start (`HanzoLockup`: the mark and `brand()`), going to this
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
import { useIam } from '@hanzo/iam/react'
import { Text, View, XStack, YStack } from '@hanzo/gui'
import { Avatar, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@hanzo/ui'
import { HanzoLockup } from '@hanzogui/shell'
import { rememberDestination } from './lib/destination'
import { named } from './lib/session'
import { useSignOut } from './lib/signout'
import { brand } from './where'

/** The bar's height under the notch: hanzo.ai's masthead's. */
const HEIGHT = 60
/** The notch's inset. gui carries a CSS function to the page unchanged; its types only name custom properties. */
const NOTCH = 'env(safe-area-inset-top)' as `var(--${string})`

export function Chrome({ back }: { back?: ReactNode }) {
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
      position="sticky"
      t={0}
      z="var(--z-header)"
      shrink={0}
      boxSizing="content-box"
      height={HEIGHT}
      pt={NOTCH}
      px="var(--page-gutter, 20px)"
      gap={12}
      items="center"
      bg="var(--background)"
      borderBottomWidth={1}
      borderColor="var(--border)"
    >
      <Text
        render={<a href="/" aria-label={`${brand()} home`} />}
        display="flex"
        items="center"
        shrink={0}
        color="var(--foreground)"
        textDecorationLine="none"
      >
        <HanzoLockup label={brand()} size={22} />
      </Text>
      {back}
      <View flex={1} />
      {signed ? (
        <>
          <XStack render="section" aria-label="Account" items="center" gap={12} minW={0} $max-md={{ display: 'none' }}>
            <Avatar src={avatar || null} name={who} alt="" />
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
            <Button variant="ghost" size="sm" onClick={other}>
              Use another account
            </Button>
            <Button variant="ghost" size="sm" onClick={out}>
              Log out
            </Button>
          </XStack>
          <View display="none" $max-md={{ display: 'flex' }}>
            <DropdownMenu placement="bottom-end" offset={8}>
              <DropdownMenuTrigger asChild>
                <XStack
                  render="button"
                  aria-label={`Account: ${who}`}
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
              <DropdownMenuContent minW={240} maxW="calc(100vw - 16px)" aria-labelledby={undefined} aria-label="Account">
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
                <DropdownMenuItem onSelect={other}>
                  <Text fontSize="$3" color="$ink">
                    Use another account
                  </Text>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={out}>
                  <Text fontSize="$3" color="$ink">
                    Log out
                  </Text>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </View>
        </>
      ) : null}
    </XStack>
  )
}
