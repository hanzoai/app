'use client'

// The roster: search, + Group, and + New bot at the top; Primary Bot ("hanzo")
// leading the 3x4 grid of faces; layered Bot Groups (Layer 1, Layer 2+) with
// policy badges; the remaining bots as rows with their last word; and the reader
// + Connectors + Preferences at the foot.

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
import { Grid2x2Plus, Layers, Plus, Search, SlidersHorizontal, Users, X } from 'lucide-react'
import { useSignOut } from '../lib/signout'
import { PreferencesDialog } from '../PreferencesDialog'
import { called } from '../team'
import { ConnectorsDialog } from './ConnectorsDialog'
import { Face } from './face'
import { PRIMARY_BOT, toGroupRef, type BotAgent, type BotGroup } from './api'
import { CLIP, PILL, ROUND, WORD } from './kit'
import { DIM, FLOOR, INK, LINE, PICKED, RAISED } from './ink'
import { isStarredBot, lastWord, policyBadge, sortGroupsByLayer, split } from './grid'

interface Me {
  name?: string
  displayName?: string
  email?: string
  avatar?: string
}

export function Roster({
  bots,
  groups = [],
  last,
  open,
  unread,
  me,
  onPick,
  onMake,
  onMakeGroup,
  disabled,
}: {
  bots: Agent[] | null
  groups?: readonly BotGroup[]
  last: ReadonlyMap<string, AgentRun>
  open: string | null
  unread: string | null
  me: unknown
  onPick: (name: string) => void
  onMake: () => void
  onMakeGroup?: () => void
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

  const shownGroups = useMemo(() => {
    const sorted = sortGroupsByLayer(groups)
    const q = query.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.description ?? '').toLowerCase().includes(q) ||
        policyBadge(g.policy).toLowerCase().includes(q),
    )
  }, [groups, query])

  const { grid, rows } = useMemo(() => split(shown, last), [shown, last])

  return (
    <YStack flex={1} minH={0} position="relative">
      <XStack data-parity-key="bots.roster.bar" height={46} shrink={0} px={12} items="center" justify="space-between" gap={8}>
        <XStack items="center" gap={6} pl={2}>
          <Text fontSize={12} lineHeight={16} fontWeight="600" color={DIM}>
            {t('hanzo.bot')}
          </Text>
        </XStack>
        <XStack items="center" gap={6}>
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
          {onMakeGroup ? (
            <XStack
              {...ROUND}
              aria-label={t('New bot group')}
              onClick={onMakeGroup}
              disabled={disabled}
              opacity={disabled ? 0.5 : 1}
            >
              <Users size={15} color={INK} aria-hidden />
            </XStack>
          ) : null}
          <XStack {...ROUND} aria-label={t('New bot')} onClick={onMake} disabled={disabled} opacity={disabled ? 0.5 : 1}>
            <Plus size={18} color={INK} aria-hidden />
          </XStack>
        </XStack>
      </XStack>

      {seeking ? (
        <XStack px={10} pb={8} shrink={0}>
          <Input
            unstyled
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('Search bots & groups')}
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
                const ext = b as BotAgent
                const here = b.name === open
                const isPrimary = Boolean(ext.isPrimary || b.name.toLowerCase() === PRIMARY_BOT)
                const label = called(b.name)
                return (
                  <YStack
                    key={b.id || b.name}
                    render="button"
                    {...{ type: 'button' }}
                    data-parity-key="bots.tile"
                    data-name={b.name}
                    data-primary={isPrimary ? 'true' : undefined}
                    aria-current={here}
                    aria-label={isPrimary ? `${label} (${t('Primary Bot')})` : label}
                    onClick={() => onPick(b.name)}
                    width={78}
                    height={92}
                    rounded={11}
                    items="center"
                    pt={5}
                    gap={4}
                    bg={here ? PICKED : 'transparent'}
                    borderWidth={0}
                    cursor="pointer"
                    hoverStyle={{ bg: here ? PICKED : 'var(--rail-hover, var(--muted))' }}
                    focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: '$outlineColor' }}
                    $max-md={{ width: '33%' }}
                  >
                    <Face bot={b} size={54} starred={isStarredBot(b)} />
                    <Text {...CLIP} maxW={72} fontSize={13} lineHeight={16} fontWeight={here || isPrimary ? '600' : '400'} color={INK}>
                      {label}
                    </Text>
                    {isPrimary ? (
                      <Text fontSize={10} lineHeight={11} color={DIM}>
                        {t('Primary')}
                      </Text>
                    ) : null}
                  </YStack>
                )
              })}
            </XStack>
          ) : null}

          {shownGroups.length > 0 || (onMakeGroup && !disabled) ? (
            <YStack data-parity-key="bots.groups" role="group" aria-label={t('Bot groups')} pt={14} pb={6}>
              <XStack px={16} pb={6} items="center" justify="space-between">
                <XStack items="center" gap={5}>
                  <Layers size={12} color={DIM} aria-hidden />
                  <Text fontSize={11} lineHeight={15} fontWeight="600" color={DIM}>
                    {t('GROUPS & LAYERS')}
                  </Text>
                </XStack>
                {onMakeGroup && !disabled ? (
                  <XStack
                    render="button"
                    {...{ type: 'button' }}
                    onClick={onMakeGroup}
                    items="center"
                    gap={3}
                    px={6}
                    py={2}
                    rounded={6}
                    bg="transparent"
                    borderWidth={0}
                    cursor="pointer"
                    hoverStyle={{ bg: PICKED }}
                  >
                    <Plus size={11} color={DIM} aria-hidden />
                    <Text fontSize={11} lineHeight={15} color={DIM}>
                      {t('Group')}
                    </Text>
                  </XStack>
                ) : null}
              </XStack>

              {shownGroups.length === 0 && onMakeGroup && !disabled ? (
                <XStack
                  render="button"
                  {...{ type: 'button' }}
                  onClick={onMakeGroup}
                  mx={10}
                  px={11}
                  py={8}
                  rounded={10}
                  items="center"
                  gap={9}
                  bg={RAISED}
                  borderWidth={1}
                  borderColor={LINE}
                  cursor="pointer"
                  hoverStyle={{ bg: PICKED }}
                >
                  <Users size={15} color={DIM} aria-hidden />
                  <YStack flex={1} minW={0} items="flex-start">
                    <Text {...CLIP} fontSize={12} lineHeight={16} fontWeight="500" color={INK}>
                      {t('Create a Bot Group')}
                    </Text>
                    <Text {...CLIP} fontSize={11} lineHeight={15} color={DIM}>
                      {t('Leader, Lux Quasar, or Majority layers')}
                    </Text>
                  </YStack>
                </XStack>
              ) : null}

              {shownGroups.map((g) => {
                const ref = toGroupRef(g.name)
                const here = open === ref
                return (
                  <XStack
                    key={g.id || g.name}
                    render="button"
                    {...{ type: 'button' }}
                    data-parity-key="bots.group.row"
                    data-group={g.name}
                    aria-current={here}
                    onClick={() => onPick(ref)}
                    height={52}
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
                    <YStack
                      width={34}
                      height={34}
                      rounded={10}
                      shrink={0}
                      items="center"
                      justify="center"
                      bg={RAISED}
                      borderWidth={1}
                      borderColor={LINE}
                    >
                      <Users size={15} color={INK} aria-hidden />
                    </YStack>
                    <YStack flex={1} minW={0} items="flex-start">
                      <XStack items="center" gap={6} maxW="100%">
                        <Text {...CLIP} fontSize={13} lineHeight={18} fontWeight="500" color={INK}>
                          {g.name}
                        </Text>
                        <Text fontSize={10} lineHeight={14} color={DIM}>
                          {`L${g.layer || 1}`}
                        </Text>
                      </XStack>
                      <Text {...CLIP} maxW="100%" fontSize={11} lineHeight={15} color={DIM}>
                        {`${policyBadge(g.policy)} · ${g.members.length} bots`}
                      </Text>
                    </YStack>
                  </XStack>
                )
              })}
            </YStack>
          ) : null}

          {rows.length ? (
            <YStack data-parity-key="bots.rows" role="group" aria-label={t('More bots')} pt={10} pb={22}>
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
