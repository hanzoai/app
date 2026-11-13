'use client'

// The roster: search and new at the top, the bots as a 3x4 grid of faces, the
// rest as rows with the last thing each said, and the reader + Preferences at
// the foot.

import { useEffect, useMemo, useState } from 'react'
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
import { Grid2x2Plus, Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import { useSignOut } from '../lib/signout'
import { PreferencesDialog } from '../PreferencesDialog'
import { called, member } from '../team'
import { ConnectorsDialog } from './ConnectorsDialog'
import { Face } from './face'
import { CLIP, PILL, ROUND, WORD } from './kit'
import { DIM, FLOOR, INK, LINE, PICKED, RAISED } from './ink'
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
    return q
      ? all.filter(
          (b) =>
            b.name.toLowerCase().includes(q) ||
            called(b.name).toLowerCase().includes(q) ||
            (b.description ?? '').toLowerCase().includes(q),
        )
      : all
  }, [bots, query])
  const { grid, rows } = useMemo(() => split(shown, last), [shown, last])

  return (
    <YStack flex={1} minH={0} position="relative">
      <XStack data-parity-key="bots.roster.bar" height={46} shrink={0} px={12} items="center" justify="flex-end" gap={8}>
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
        <XStack px={10} pb={8} shrink={0}>
          <Input
            unstyled
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('Search')}
            aria-label={t('Search bots')}
            width="100%"
            height={34}
            px={12}
            rounded={999}
            bg={RAISED}
            borderWidth={1}
            borderColor={LINE}
            color={INK}
            fontSize={14}
            placeholderTextColor="$placeholderColor"
          />
        </XStack>
      ) : null}

      <YStack flex={1} minH={0} position="relative">
        <YStack flex={1} minH={0} overflowY="auto" overflowX="hidden">
          {unread ? (
            <Text render="p" px={16} py={8} fontSize={13} lineHeight={18} color={DIM}>
              {unread}
            </Text>
          ) : null}

          {bots && bots.length === 0 && !unread && !disabled ? (
            <YStack display="none" $max-md={{ display: 'flex' }} items="center" gap={16} pt={140} px={20}>
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
              role="group"
              aria-label={t('Bots')}
              flexWrap="wrap"
              px={9}
              pt={4}
              columnGap={3}
              rowGap={10}
              $max-md={{ px: 12, columnGap: 0, justify: 'space-between' }}
            >
              {grid.map((b) => {
                const here = b.name === open
                const label = called(b.name)
                return (
                  <YStack
                    key={b.id || b.name}
                    render="button"
                    {...{ type: 'button' }}
                    data-parity-key="bots.tile"
                    data-name={b.name}
                    aria-current={here}
                    aria-label={label}
                    onClick={() => onPick(b.name)}
                    width={78}
                    height={88}
                    rounded={11}
                    items="center"
                    pt={5}
                    gap={5}
                    bg={here ? PICKED : 'transparent'}
                    borderWidth={0}
                    cursor="pointer"
                    hoverStyle={{ bg: here ? PICKED : 'var(--rail-hover, var(--muted))' }}
                    focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: '$outlineColor' }}
                    $max-md={{ width: '33%' }}
                  >
                    <Face bot={b} size={56} starred={member(b.name)?.seat === 1} />
                    <Text {...CLIP} maxW={72} fontSize={13} lineHeight={17} fontWeight={here ? '500' : '400'} color={INK}>
                      {label}
                    </Text>
                  </YStack>
                )
              })}
            </XStack>
          ) : null}

          {rows.length ? (
            <YStack data-parity-key="bots.rows" role="group" aria-label={t('More bots')} pt={16} pb={22}>
              {rows.map((b) => {
                const here = b.name === open
                const label = called(b.name)
                const word = lastWord(last.get(b.name)) || b.description || ''
                return (
                  <XStack
                    key={b.id || b.name}
                    render="button"
                    {...{ type: 'button' }}
                    data-parity-key="bots.row"
                    data-name={b.name}
                    aria-current={here}
                    onClick={() => onPick(b.name)}
                    height={56}
                    mx={6}
                    px={12}
                    gap={10}
                    items="center"
                    rounded={10}
                    bg={here ? PICKED : 'transparent'}
                    borderWidth={0}
                    cursor="pointer"
                    hoverStyle={{ bg: here ? PICKED : 'var(--rail-hover, var(--muted))' }}
                    focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: '$outlineColor' }}
                  >
                    <Face bot={b} size={36} />
                    <YStack flex={1} minW={0} items="flex-start">
                      <Text {...CLIP} maxW="100%" fontSize={14} lineHeight={19} fontWeight="500" color={INK}>
                        {label}
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

        {rows.length ? (
          <YStack
            aria-hidden
            pointerEvents="none"
            position="absolute"
            l={0}
            r={0}
            b={0}
            height={28}
            $platform-web={{ backgroundImage: `linear-gradient(to bottom, transparent, ${FLOOR})` }}
          />
        ) : null}
      </YStack>

      <Foot me={me as Me | null} />
    </YStack>
  )
}

/** You, at the foot: your account, external Connectors, and unified Hanzo Preferences. */
function Foot({ me }: { me: Me | null }) {
  const { t } = useI18n()
  const leave = useSignOut()
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [connectorsOpen, setConnectorsOpen] = useState(false)
  const name = me?.displayName || me?.name || ''

  useEffect(() => {
    if (!me) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        setPrefsOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [me])

  if (!me) return null
  return (
    <>
      <XStack data-parity-key="bots.me" height={52} shrink={0} px={12} items="center" gap={6} borderTopWidth={1} borderColor={LINE}>
        <DropdownMenu placement="top-start" offset={8}>
          <DropdownMenuTrigger asChild>
            <XStack
              render="button"
              {...{ type: 'button' }}
              aria-label={t('Account: {name}', { name })}
              flex={1}
              minW={0}
              items="center"
              gap={9}
              bg="transparent"
              borderWidth={0}
              p={0}
              cursor="pointer"
            >
              <Face bot={{ name, avatar: me.avatar }} size={30} person />
              <Text {...CLIP} fontSize={14} lineHeight={19} fontWeight="500" color={INK}>
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
            <DropdownMenuItem onSelect={() => setConnectorsOpen(true)}>
              <Text fontSize="$3" color="$ink">
                {t('Connectors')}
              </Text>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setPrefsOpen(true)}>
              <Text fontSize="$3" color="$ink">
                {t('Preferences')}
              </Text>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void leave()}>
              <Text fontSize="$3" color="$ink">
                {t('Log out')}
              </Text>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <XStack {...ROUND} aria-label={t('Connectors')} onClick={() => setConnectorsOpen(true)}>
          <Grid2x2Plus size={16} color={INK} aria-hidden />
        </XStack>

        <XStack {...ROUND} aria-label={t('Preferences')} onClick={() => setPrefsOpen(true)}>
          <SlidersHorizontal size={15} color={INK} aria-hidden />
        </XStack>
      </XStack>

      <ConnectorsDialog open={connectorsOpen} onOpenChange={setConnectorsOpen} />
      <PreferencesDialog open={prefsOpen} onOpenChange={setPrefsOpen} />
    </>
  )
}
