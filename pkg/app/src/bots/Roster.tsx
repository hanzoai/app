'use client'

// The roster: search and new at the top, the bots as a grid of faces, the rest
// as rows with the last thing each said, and the reader at the foot.
//
// The grid holds twelve, four rows of three, in the order the bots were made, so
// a face does not move once you know where it is. A bot past the twelfth is a
// row, newest conversation first, which is where a bot you are busy with is.

import { useMemo, useState } from 'react'
import type { Agent, AgentRun } from '@hanzo/ai'
import { useI18n } from '@hanzo/i18n/react'
import { Input, Text, XStack, YStack } from '@hanzo/gui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@hanzo/ui'
import { BUSINESS_APPS } from '@hanzo/ui/product'
import { LayoutGrid, Plus, Search, X } from 'lucide-react'
import { useSignOut } from '../lib/signout'
import { Face } from './face'
import { CLIP, PILL, ROUND, WORD } from './kit'
import { DIM, INK, LINE, PICKED, RAISED } from './ink'
import { lastWord, split } from './grid'

interface Me {
  name?: string
  displayName?: string
  email?: string
  avatar?: string
}

export function Roster({
  bots,
  last,
  open,
  unread,
  me,
  onPick,
  onMake,
  disabled,
}: {
  bots: Agent[] | null
  last: ReadonlyMap<string, AgentRun>
  open: string | null
  unread: string | null
  me: unknown
  onPick: (name: string) => void
  onMake: () => void
  disabled: boolean
}) {
  const { t } = useI18n()
  const [seeking, setSeeking] = useState(false)
  const [query, setQuery] = useState('')

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = bots ?? []
    return q ? all.filter((b) => b.name.toLowerCase().includes(q) || (b.description ?? '').toLowerCase().includes(q)) : all
  }, [bots, query])
  const { grid, rows } = useMemo(() => split(shown, last), [shown, last])

  return (
    <YStack flex={1} minH={0}>
      <XStack data-parity-key="bots.roster.bar" height={58} shrink={0} px={16} items="center" justify="flex-end" gap={11}>
        <XStack
          {...ROUND}
          aria-label={t(seeking ? 'Close search' : 'Search bots')}
          aria-pressed={seeking}
          onClick={() => {
            setSeeking(!seeking)
            setQuery('')
          }}
        >
          {seeking ? <X size={16} color={INK} aria-hidden /> : <Search size={16} color={INK} aria-hidden />}
        </XStack>
        <XStack {...ROUND} aria-label={t('New bot')} onClick={onMake} disabled={disabled} opacity={disabled ? 0.5 : 1}>
          <Plus size={18} color={INK} aria-hidden />
        </XStack>
      </XStack>

      {seeking ? (
        <XStack px={12} pb={10} shrink={0}>
          <Input
            unstyled
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('Search')}
            aria-label={t('Search bots')}
            width="100%"
            height={36}
            px={14}
            rounded={999}
            bg={RAISED}
            borderWidth={1}
            borderColor={LINE}
            color={INK}
            fontSize={15}
            placeholderTextColor="$placeholderColor"
          />
        </XStack>
      ) : null}

      <YStack flex={1} minH={0} overflowY="auto" overflowX="hidden">
        {unread ? (
          <Text render="p" px={18} py={10} fontSize={13} lineHeight={18} color={DIM}>
            {unread}
          </Text>
        ) : null}

        {bots && bots.length === 0 && !unread && !disabled ? (
          // A phone shows the roster alone, so the first bot is asked for here; from
          // a tablet up the thread beside it asks.
          <YStack display="none" $max-md={{ display: 'flex' }} items="center" gap={16} pt={160} px={24}>
            <Text render="h1" m={0} fontSize={22} lineHeight={28} fontWeight="500" color={INK}>
              {t('Make your first bot')}
            </Text>
            <XStack {...PILL} onClick={onMake}>
              <Text {...WORD}>{t('New bot')}</Text>
            </XStack>
          </YStack>
        ) : null}

        {grid.length ? (
          <XStack
            data-parity-key="bots.grid"
            role="list"
            aria-label={t('Bots')}
            flexWrap="wrap"
            px={9}
            pt={9}
            columnGap={3}
            rowGap={13}
            $max-md={{ px: 12, columnGap: 0, justify: 'space-between' }}
          >
            {grid.map((b) => {
              const here = b.name === open
              return (
                <YStack
                  key={b.id || b.name}
                  role="listitem"
                  render="button"
                  {...{ type: 'button' }}
                  data-parity-key="bots.tile"
                  data-name={b.name}
                  aria-current={here}
                  aria-label={b.name}
                  onClick={() => onPick(b.name)}
                  width={83}
                  height={91}
                  rounded={12}
                  items="center"
                  pt={6}
                  gap={6}
                  bg={here ? PICKED : 'transparent'}
                  borderWidth={0}
                  cursor="pointer"
                  hoverStyle={{ bg: here ? PICKED : 'var(--muted)' }}
                  focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: '$outlineColor' }}
                  $max-md={{ width: '33%' }}
                >
                  <Face bot={b} size={60} />
                  <Text {...CLIP} maxW={77} fontSize={13} lineHeight={17} color={INK}>
                    {b.name}
                  </Text>
                </YStack>
              )
            })}
          </XStack>
        ) : null}

        {rows.length ? (
          <YStack data-parity-key="bots.rows" role="list" aria-label={t('More bots')} pt={17} pb={8}>
            {rows.map((b) => {
              const here = b.name === open
              const word = lastWord(last.get(b.name)) || b.description || ''
              return (
                <XStack
                  key={b.id || b.name}
                  role="listitem"
                  render="button"
                  {...{ type: 'button' }}
                  data-parity-key="bots.row"
                  data-name={b.name}
                  aria-current={here}
                  onClick={() => onPick(b.name)}
                  height={58}
                  mx={6}
                  px={13}
                  gap={10}
                  items="center"
                  rounded={10}
                  bg={here ? PICKED : 'transparent'}
                  borderWidth={0}
                  cursor="pointer"
                  hoverStyle={{ bg: here ? PICKED : 'var(--muted)' }}
                  focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: '$outlineColor' }}
                >
                  <Face bot={b} size={36} />
                  <YStack flex={1} minW={0} items="flex-start">
                    <Text {...CLIP} maxW="100%" fontSize={15} lineHeight={20} color={INK}>
                      {b.name}
                    </Text>
                    {word ? (
                      <Text {...CLIP} maxW="100%" fontSize={13} lineHeight={18} color={DIM}>
                        {word}
                      </Text>
                    ) : null}
                  </YStack>
                </XStack>
              )
            })}
          </YStack>
        ) : null}
      </YStack>

      <Foot me={me as Me | null} />
    </YStack>
  )
}

/** You, at the foot: your account, and the other Hanzo apps a press away. */
function Foot({ me }: { me: Me | null }) {
  const { t } = useI18n()
  const leave = useSignOut()
  const name = me?.displayName || me?.name || ''
  if (!me) return null
  return (
    <XStack data-parity-key="bots.me" height={68} shrink={0} px={15} items="center" gap={10}>
      <DropdownMenu placement="top-start" offset={8}>
        <DropdownMenuTrigger asChild>
          <XStack
            render="button"
            {...{ type: 'button' }}
            aria-label={t('Account: {name}', { name })}
            flex={1}
            minW={0}
            items="center"
            gap={10}
            bg="transparent"
            borderWidth={0}
            p={0}
            cursor="pointer"
          >
            <Face bot={{ name, avatar: me.avatar }} size={36} />
            <Text {...CLIP} fontSize={15} lineHeight={20} color={INK}>
              {name}
            </Text>
          </XStack>
        </DropdownMenuTrigger>
        <DropdownMenuContent minW={240} aria-label={t('Account')}>
          <DropdownMenuLabel>
            <YStack minW={0} gap={2}>
              <Text fontSize="$3" color="$ink" numberOfLines={1}>
                {name}
              </Text>
              {me.email ? (
                <Text fontSize="$2" color="$soft" numberOfLines={1}>
                  {me.email}
                </Text>
              ) : null}
            </YStack>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void leave()}>
            <Text fontSize="$3" color="$ink">
              {t('Log out')}
            </Text>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu placement="top-end" offset={8}>
        <DropdownMenuTrigger asChild>
          <XStack {...ROUND} aria-label={t('Hanzo apps')}>
            <LayoutGrid size={16} color={INK} aria-hidden />
          </XStack>
        </DropdownMenuTrigger>
        <DropdownMenuContent minW={240} maxH={420} aria-label={t('Hanzo apps')}>
          {BUSINESS_APPS.map((app) => (
            <DropdownMenuItem key={app.id} onSelect={() => window.location.assign(app.href)}>
              <YStack minW={0}>
                <Text fontSize="$3" color="$ink" numberOfLines={1}>
                  {app.productTitle}
                </Text>
                <Text fontSize="$1" color="$soft" numberOfLines={1}>
                  {app.description}
                </Text>
              </YStack>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </XStack>
  )
}
