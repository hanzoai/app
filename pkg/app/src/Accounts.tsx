'use client'

/**
 * The accounts signed in on this browser, as a list: who they are, which one is
 * this one, a tap to be another, and one to add. Log out is IAM's, and ends every
 * one of them (lib/accounts), so it is said once, for all.
 */

import { Check, Plus } from 'lucide-react'
import { useI18n } from '@hanzo/i18n/react'
import { Text, View, XStack, YStack } from '@hanzo/gui'
import { Avatar, Button } from '@hanzo/ui'
import { label, useAccounts, type Account } from './lib/accounts'
import { useSignOut } from './lib/signout'

/** One account's face and words, the same wherever it is drawn. */
export function Face({ account }: { account: Account }) {
  const { title, line } = label(account)
  return (
    <>
      <Avatar src={account.avatar || null} name={title} colorSeed={account.sub} alt="" />
      <YStack flex={1} minW={0} gap={2}>
        <Text fontSize="$4" fontWeight="500" color="$ink" numberOfLines={1} text="start">
          {title}
        </Text>
        {line ? (
          <Text fontSize="$2" color="$soft" numberOfLines={1} text="start">
            {line}
          </Text>
        ) : null}
      </YStack>
    </>
  )
}

export function Accounts() {
  const { t } = useI18n()
  const out = useSignOut()
  const { accounts, current, switchTo, add } = useAccounts()
  if (accounts.length === 0) return null
  return (
    <YStack render="section" aria-label={t('Accounts')} mt={36}>
      <Text render="h2" fontSize="$6" fontWeight="500" color="$ink">
        {t('Accounts')}
      </Text>
      <YStack render="ul" aria-label={t('Signed in on this browser')} m={0} p={0} mt={14} gap={8}>
        {accounts.map((a) => {
          const here = a.sub === current?.sub
          return (
            <View key={a.sub} render="li" display="block">
              <XStack
                render="button"
                onClick={here ? undefined : () => void switchTo(a)}
                aria-current={here || undefined}
                width="100%"
                items="center"
                gap={12}
                px={12}
                py={10}
                rounded={12}
                borderWidth={1}
                borderColor={here ? '$ink' : '$edge'}
                bg="transparent"
                cursor={here ? 'default' : 'pointer'}
                hoverStyle={here ? undefined : { bg: '$hover' }}
              >
                <Face account={a} />
                {here ? <Check size={16} aria-label={t('Current')} /> : null}
              </XStack>
            </View>
          )
        })}
      </YStack>
      <XStack mt={14} gap={8} flexWrap="wrap">
        <Button type="button" variant="outline" onClick={() => void add()}>
          <Plus size={16} aria-hidden />
          {t('Add account')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => void out()}>
          {t('Log out')}
        </Button>
      </XStack>
    </YStack>
  )
}
