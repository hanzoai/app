'use client'

/**
 * The account menu's rows for the accounts signed in on this browser: each other
 * account one press away, Add account, Sign out of this one alone when there are
 * others, and the way out of all of them (Log out when there is one). They go
 * inside a host's own `DropdownMenuContent`, after its own rows; what a press does
 * is lib/accounts' unless the host hands its own (`pick`, `add`), for a site whose
 * sign-in page is its own.
 */

import { LogOut, UserPlus } from 'lucide-react'
import { useI18n } from '@hanzo/i18n/react'
import { Text, XStack, YStack } from '@hanzo/gui'
import { Avatar, DropdownMenuItem } from '@hanzo/ui'
import { label, useAccounts, type Account } from './lib/accounts'

export function Others({ out, pick, add }: { out: () => void | Promise<void>; pick?: (account: Account) => void | Promise<void>; add?: () => void | Promise<void> }) {
  const { t } = useI18n()
  const { accounts, current, switchTo, add: start, leave } = useAccounts()
  const others = accounts.filter((a) => a.sub !== current?.sub)
  return (
    <>
      {others.map((a) => {
        const { title, line } = label(a)
        return (
          <DropdownMenuItem key={a.sub} onSelect={() => void (pick ?? switchTo)(a)}>
            <XStack items="center" gap={8} width="100%">
              <Avatar src={a.avatar || null} name={title} colorSeed={a.sub} alt="" size={22} width={22} height={22} rounded={999} />
              <YStack minW={0} flex={1}>
                <Text fontSize="$2" color="$ink" numberOfLines={1}>
                  {title}
                </Text>
                {line ? (
                  <Text fontSize="$1" color="$soft" numberOfLines={1}>
                    {line}
                  </Text>
                ) : null}
              </YStack>
            </XStack>
          </DropdownMenuItem>
        )
      })}

      <DropdownMenuItem onSelect={() => void (add ?? start)()}>
        <XStack items="center" gap={8} width="100%">
          <UserPlus size={15} color="var(--muted-foreground)" aria-hidden />
          <Text fontSize="$2" color="$ink">
            {t('Add account')}
          </Text>
        </XStack>
      </DropdownMenuItem>

      {others.length > 0 && current ? (
        <DropdownMenuItem onSelect={() => void leave(current)}>
          <XStack items="center" gap={8} width="100%">
            <LogOut size={15} color="var(--muted-foreground)" aria-hidden />
            <Text fontSize="$2" color="$ink">
              {t('Sign out {name}', { name: label(current).title })}
            </Text>
          </XStack>
        </DropdownMenuItem>
      ) : null}

      <DropdownMenuItem onSelect={() => void out()}>
        <XStack items="center" gap={8} width="100%">
          <LogOut size={15} color="var(--destructive)" aria-hidden />
          <Text fontSize="$2" color="var(--destructive)">
            {others.length > 0 ? t('Sign out of all accounts') : t('Log out')}
          </Text>
        </XStack>
      </DropdownMenuItem>
    </>
  )
}
