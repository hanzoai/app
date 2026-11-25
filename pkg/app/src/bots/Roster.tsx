'use client'

// The roster: search, density/column menu, + Group, and + New bot at the top;
// Pinned Bots in a 1→2→3 column resizable grid with 4 avatar sizes (xs/sm/md/lg);
// a monochrome hairline divider; layered Bot Groups (GROUPS & LAYERS); unpinned
// bots in single-column rows; a subtle /flow Workflows entry; and the reader +
// Connectors + Preferences at the foot.

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import {
  ArrowLeft,
  Check,
  Grid2x2Plus,
  Layers,
  LayoutGrid,
  Pin,
  PinOff,
  Plus,
  Search,
  SlidersHorizontal,
  Users,
  Workflow,
  X,
} from 'lucide-react'
import { useKept } from '../kept'
import { FLOW } from '../lib/host'
import { useSignOut, useSigningOut } from '../lib/signout'
import { PreferencesDialog } from '../PreferencesDialog'
import { called } from '../team'
import { ConnectorsDialog } from './ConnectorsDialog'
import { Face } from './face'
import { PRIMARY_BOT, toGroupRef, type BotAgent, type BotGroup } from './api'
import { CLIP, PILL, ROUND, WORD } from './kit'
import { DIM, FLOOR, INK, LINE, PICKED, RAISED } from './ink'
import {
  avatarSizePx,
  BOT_AVATAR_PX,
  BOT_ICON_SIZES,
  defaultPinnedNames,
  isBotIconSize,
  isStarredBot,
  lastWord,
  partitionPinned,
  policyBadge,
  resolveColumns,
  ROSTER_WIDTH_DEFAULT,
  sortGroupsByLayer,
  togglePinnedBot,
  type BotIconSize,
  type RosterColumnPref,
} from './grid'

interface Me {
  name?: string
  displayName?: string
  email?: string
  avatar?: string
}

const SIZE_LABELS: Record<BotIconSize, string> = {
  xs: 'XS',
  sm: 'SM',
  md: 'MD',
  lg: 'LG',
}

const COL_OPTIONS: readonly RosterColumnPref[] = ['auto', 1, 2, 3] as const

export function Roster({
  bots,
  groups = [],
  last,
  open,
  unread,
  me,
  width = ROSTER_WIDTH_DEFAULT,
  onPick,
  onMake,
  onMakeGroup,
  onWorkflows,
  disabled,
}: {
  bots: Agent[] | null
  groups?: readonly BotGroup[]
  last: ReadonlyMap<string, AgentRun>
  open: string | null
  unread: string | null
  me: unknown
  /** Live sidebar width in px, driving the 1 → 2 → 3 column Pinned Bots grid. */
  width?: number
  onPick: (name: string) => void
  onMake: () => void
  onMakeGroup?: () => void
  onWorkflows?: () => void
  disabled: boolean
}) {
  const { t } = useI18n()
  const [seeking, setSeeking] = useState(false)
  const [query, setQuery] = useState('')
  const [storedSize, setIconSize] = useKept<BotIconSize>('hanzo.bots.roster.iconSize', 'md')
  const [storedCols, setColPref] = useKept<RosterColumnPref>('hanzo.bots.roster.cols', 'auto')
  const [pinnedNames, setPinnedNames] = useKept<string[] | null>('hanzo.bots.roster.pinned', null)

  const iconSize: BotIconSize = isBotIconSize(storedSize) ? storedSize : 'md'
  const colPref: RosterColumnPref =
    storedCols === 'auto' || storedCols === 1 || storedCols === 2 || storedCols === 3 ? storedCols : 'auto'
  const cols = resolveColumns(width, colPref)
  const avatarPx = avatarSizePx(iconSize)

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

  const { pinned, unpinned } = useMemo(() => partitionPinned(shown, last, pinnedNames), [shown, last, pinnedNames])

  // Real-data-only attention/activity summary from live `last` runs (never fabricated).
  const attentionBots = useMemo(() => {
    const failed: Agent[] = []
    const active: Agent[] = []
    for (const b of bots ?? []) {
      const run = last.get(b.name)
      const st = String(run?.status ?? '').toLowerCase()
      if (st === 'failed' || st === 'error') failed.push(b)
      else if (st === 'running' || st === 'queued' || st === 'in_progress') active.push(b)
    }
    return { failed, active }
  }, [bots, last])

  const togglePin = useCallback(
    (name: string) => {
      const base = pinnedNames ?? defaultPinnedNames(bots ?? [])
      setPinnedNames(togglePinnedBot(base, name))
    },
    [bots, pinnedNames, setPinnedNames],
  )

  const openWorkflows = () => {
    if (onWorkflows) {
      onWorkflows()
      return
    }
    if (typeof window !== 'undefined') window.location.assign(FLOW)
  }

  const showWorkflows = !query.trim() || 'workflows'.includes(query.trim().toLowerCase()) || 'flow'.includes(query.trim().toLowerCase())

  return (
    <YStack flex={1} minH={0} position="relative">
      <XStack
        data-parity-key="bots.roster.bar"
        minH={46}
        $max-sm={{ minH: 52, px: 10 }}
        shrink={0}
        px={12}
        items="center"
        justify="space-between"
        gap={8}
      >
        <XStack items="center" gap={6} pl={2} minW={0}>
          {me ? (
            <XStack
              render={<a href="/chat" aria-label={t('Back to chat')} />}
              items="center"
              gap={6}
              px={6}
              py={4}
              ml={-4}
              rounded={8}
              transition="quickest"
              hoverStyle={{ bg: PICKED }}
              focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
              $max-sm={{ minH: 44 }}
              $platform-web={{ textDecoration: 'none' }}
            >
              <ArrowLeft size={14} color={DIM} aria-hidden />
              <Text {...CLIP} fontSize={13} lineHeight={18} fontWeight="600" color={INK}>
                {t('hanzo.bot')}
              </Text>
            </XStack>
          ) : (
            <Text {...CLIP} fontSize={13} lineHeight={18} fontWeight="600" color={DIM}>
              {t('hanzo.bot')}
            </Text>
          )}
        </XStack>
        <XStack items="center" gap={6} shrink={0}>
          <DropdownMenu placement="bottom-end" offset={6}>
            <DropdownMenuTrigger asChild>
              <XStack
                {...ROUND}
                borderColor="var(--border-strong)"
                focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                $max-sm={{ width: 44, height: 44 }}
                data-slot="bots-density-trigger"
                aria-label={t('Sidebar layout')}
              >
                <LayoutGrid size={14} color={INK} aria-hidden />
              </XStack>
            </DropdownMenuTrigger>
            <DropdownMenuContent minW={196} aria-label={t('Sidebar layout')}>
              <DropdownMenuLabel>
                <Text fontSize={11} color={DIM} fontWeight="600">
                  {t('Avatar size')}
                </Text>
              </DropdownMenuLabel>
              {BOT_ICON_SIZES.map((sz) => {
                const active = iconSize === sz
                return (
                  <DropdownMenuItem key={sz} data-slot={`bots-size-${sz}`} onSelect={() => setIconSize(sz)}>
                    <XStack flex={1} items="center" justify="space-between" gap={8}>
                      <Text fontSize={13} color={INK} fontWeight={active ? '600' : '400'}>
                        {`${SIZE_LABELS[sz]} · ${BOT_AVATAR_PX[sz]}px`}
                      </Text>
                      {active ? <Check size={13} color={INK} aria-hidden /> : null}
                    </XStack>
                  </DropdownMenuItem>
                )
              })}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>
                <Text fontSize={11} color={DIM} fontWeight="600">
                  {t('Pinned columns')}
                </Text>
              </DropdownMenuLabel>
              {COL_OPTIONS.map((opt) => {
                const active = colPref === opt
                const label = opt === 'auto' ? t('Auto (1–3)') : opt === 1 ? t('1 column') : t('{n} columns', { n: opt })
                return (
                  <DropdownMenuItem key={String(opt)} data-slot={`bots-cols-${opt}`} onSelect={() => setColPref(opt)}>
                    <XStack flex={1} items="center" justify="space-between" gap={8}>
                      <Text fontSize={13} color={INK} fontWeight={active ? '600' : '400'}>
                        {label}
                      </Text>
                      {active ? <Check size={13} color={INK} aria-hidden /> : null}
                    </XStack>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <XStack
            {...ROUND}
            borderColor="var(--border-strong)"
            focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
            $max-sm={{ width: 44, height: 44 }}
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
              borderColor="var(--border-strong)"
              focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
              $max-sm={{ width: 44, height: 44 }}
              aria-label={t('New bot group')}
              onClick={onMakeGroup}
              disabled={disabled}
              opacity={disabled ? 0.5 : 1}
            >
              <Users size={15} color={INK} aria-hidden />
            </XStack>
          ) : null}
          <XStack
            {...ROUND}
            borderColor="var(--border-strong)"
            focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
            $max-sm={{ width: 44, height: 44 }}
            aria-label={t('New bot')}
            onClick={onMake}
            disabled={disabled}
            opacity={disabled ? 0.5 : 1}
          >
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
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSeeking(false)
                setQuery('')
              }
            }}
            placeholder={t('Search bots & groups')}
            aria-label={t('Search bots')}
            width="100%"
            height={34}
            $max-sm={{ minH: 44 }}
            px={12}
            rounded={999}
            bg={RAISED}
            borderWidth={1}
            borderColor="var(--border-strong)"
            focusStyle={{ borderColor: 'var(--ring)' }}
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
            <YStack
              display="none"
              $max-md={{ display: 'flex' }}
              flex={1}
              items="center"
              justify="center"
              gap={18}
              pt={24}
              pb={64}
              px={20}
            >
              <YStack items="center" gap={6} maxW={320}>
                <Text render="h2" m={0} fontSize={21} lineHeight={26} fontWeight="600" letterSpacing={-0.42} color={INK} text="center">
                  {t('Make your first bot')}
                </Text>
                <Text fontSize={14} lineHeight={20} color={DIM} text="center">
                  {t('Give it instructions and tools, then message it right here.')}
                </Text>
              </YStack>
              <XStack
                {...PILL}
                bg={INK}
                borderColor={INK}
                minH={38}
                $max-sm={{ minH: 44, px: 18 }}
                hoverStyle={{ opacity: 0.9 }}
                focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                onClick={onMake}
              >
                <Text {...WORD} fontWeight="600" color="var(--background)">
                  {t('New bot')}
                </Text>
              </XStack>
            </YStack>
          ) : null}

          {!query.trim() && (attentionBots.failed.length > 0 || attentionBots.active.length > 0) ? (
            <YStack
              data-slot="bots-attention"
              mx={10}
              mb={8}
              p={9}
              rounded={10}
              bg={RAISED}
              borderWidth={1}
              borderColor={LINE}
              gap={6}
            >
              <XStack items="center" justify="space-between" gap={6}>
                <Text fontSize={11} lineHeight={15} fontWeight="600" color={DIM}>
                  {attentionBots.failed.length > 0 ? t('NEEDS ATTENTION') : t('ACTIVE NOW')}
                </Text>
                <Text fontSize={11} lineHeight={15} color={DIM}>
                  {[
                    attentionBots.failed.length > 0
                      ? t('{n} failed', { n: attentionBots.failed.length })
                      : null,
                    attentionBots.active.length > 0
                      ? t('{n} running', { n: attentionBots.active.length })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </XStack>
              <XStack gap={6} flexWrap="wrap">
                {attentionBots.failed.map((b) => (
                  <XStack
                    key={`fail-${b.name}`}
                    render={<button type="button" />}
                    data-slot="bots-attention-item"
                    data-status="failed"
                    onClick={() => onPick(b.name)}
                    items="center"
                    gap={5}
                    px={8}
                    py={4}
                    rounded={999}
                    bg={FLOOR}
                    borderWidth={1}
                    borderColor="var(--state-error)"
                    cursor="pointer"
                    focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                  >
                    <YStack width={6} height={6} rounded={999} bg="var(--state-error)" aria-hidden />
                    <Text fontSize={12} lineHeight={15} color={INK}>
                      {called(b.name)}
                    </Text>
                  </XStack>
                ))}
                {attentionBots.active.map((b) => (
                  <XStack
                    key={`act-${b.name}`}
                    render={<button type="button" />}
                    data-slot="bots-attention-item"
                    data-status="running"
                    onClick={() => onPick(b.name)}
                    items="center"
                    gap={5}
                    px={8}
                    py={4}
                    rounded={999}
                    bg={FLOOR}
                    borderWidth={1}
                    borderColor={LINE}
                    cursor="pointer"
                    focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                  >
                    <YStack width={6} height={6} rounded={999} bg="var(--state-online)" aria-hidden />
                    <Text fontSize={12} lineHeight={15} color={INK}>
                      {called(b.name)}
                    </Text>
                  </XStack>
                ))}
              </XStack>
            </YStack>
          ) : null}

          {pinned.length ? (
            <YStack
              data-slot="bots-pinned"
              data-cols={cols}
              data-icon-size={iconSize}
              data-avatar-px={avatarPx}
              pt={2}
              pb={10}
            >
              <XStack px={14} pb={6} items="center" justify="space-between">
                <XStack items="center" gap={5}>
                  <Pin size={11} color={DIM} aria-hidden />
                  <Text fontSize={11} lineHeight={15} fontWeight="600" color={DIM}>
                    {t('PINNED')}
                  </Text>
                </XStack>
                <Text fontSize={10} lineHeight={14} color={DIM}>
                  {`${SIZE_LABELS[iconSize]} · ${cols}c`}
                </Text>
              </XStack>

              <YStack
                data-parity-key="bots.grid"
                role="group"
                aria-label={t('Pinned bots')}
                display="grid"
                gridTemplateColumns={`repeat(${cols}, minmax(0, 1fr))`}
                $max-md={colPref === 'auto' ? { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' } : undefined}
                px={8}
                gap={cols === 1 ? 4 : 6}
                minW={0}
              >
                {pinned.map((b) => {
                  const ext = b as BotAgent
                  const here = b.name === open
                  const isPrimary = Boolean(ext.isPrimary || b.name.toLowerCase() === PRIMARY_BOT)
                  const label = called(b.name)
                  const nameFont = iconSize === 'xs' ? 11 : iconSize === 'sm' ? 12 : 13
                  if (cols === 1) {
                    return (
                      <XStack
                        key={b.id || b.name}
                        data-parity-key="bots.tile"
                        data-name={b.name}
                        data-primary={isPrimary ? 'true' : undefined}
                        items="center"
                        gap={8}
                        px={8}
                        py={iconSize === 'xs' ? 5 : 6}
                        rounded={10}
                        bg={here ? PICKED : 'transparent'}
                        borderWidth={1}
                        borderColor={here ? 'var(--border-strong)' : 'transparent'}
                        transition="quickest"
                        hoverStyle={{ bg: here ? PICKED : 'var(--rail-hover, var(--muted))' }}
                      >
                        <XStack
                          render={<button type="button" />}
                          aria-current={here}
                          aria-label={isPrimary ? `${label} (${t('Primary bot')})` : label}
                          onClick={() => onPick(b.name)}
                          flex={1}
                          minW={0}
                          items="center"
                          gap={8}
                          p={0}
                          bg="transparent"
                          borderWidth={0}
                          cursor="pointer"
                          focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                        >
                          <Face bot={b} size={avatarPx} starred={isStarredBot(b)} />
                          <YStack flex={1} minW={0} items="flex-start">
                            <Text {...CLIP} maxW="100%" fontSize={nameFont} lineHeight={16} fontWeight={here || isPrimary ? '600' : '500'} color={INK}>
                              {label}
                            </Text>
                            {isPrimary ? (
                              <Text fontSize={11} lineHeight={13} color={DIM}>
                                {t('Primary')}
                              </Text>
                            ) : null}
                          </YStack>
                        </XStack>
                        <XStack
                          render={<button type="button" />}
                          data-slot="bots-unpin"
                          aria-label={t('Unpin {name}', { name: label })}
                          onClick={() => togglePin(b.name)}
                          width={22}
                          height={22}
                          shrink={0}
                          rounded={6}
                          items="center"
                          justify="center"
                          bg="transparent"
                          borderWidth={0}
                          cursor="pointer"
                          opacity={0.55}
                          transition="quickest"
                          hoverStyle={{ opacity: 1, bg: PICKED }}
                          focusVisibleStyle={{ opacity: 1, outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                        >
                          <PinOff size={11} color={DIM} aria-hidden />
                        </XStack>
                      </XStack>
                    )
                  }
                  return (
                    <YStack
                      key={b.id || b.name}
                      position="relative"
                      data-parity-key="bots.tile"
                      data-name={b.name}
                      data-primary={isPrimary ? 'true' : undefined}
                      rounded={11}
                      bg={here ? PICKED : 'transparent'}
                      borderWidth={1}
                      borderColor={here ? 'var(--border-strong)' : 'transparent'}
                      transition="quickest"
                      hoverStyle={{ bg: here ? PICKED : 'var(--rail-hover, var(--muted))' }}
                    >
                      <YStack
                        render={<button type="button" />}
                        aria-current={here}
                        aria-label={isPrimary ? `${label} (${t('Primary bot')})` : label}
                        onClick={() => onPick(b.name)}
                        width="100%"
                        minW={0}
                        rounded={10}
                        items="center"
                        pt={iconSize === 'xs' ? 6 : 8}
                        pb={iconSize === 'xs' ? 5 : 7}
                        px={4}
                        gap={iconSize === 'xs' ? 3 : 5}
                        bg="transparent"
                        borderWidth={0}
                        cursor="pointer"
                        focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                      >
                        <Face bot={b} size={avatarPx} starred={isStarredBot(b)} />
                        <Text {...CLIP} maxW="100%" fontSize={nameFont} lineHeight={16} fontWeight={here || isPrimary ? '600' : '400'} color={INK}>
                          {label}
                        </Text>
                        {isPrimary ? (
                          <Text fontSize={11} lineHeight={13} color={DIM}>
                            {t('Primary')}
                          </Text>
                        ) : null}
                      </YStack>
                      <XStack
                        render={<button type="button" />}
                        data-slot="bots-unpin"
                        aria-label={t('Unpin {name}', { name: label })}
                        onClick={() => togglePin(b.name)}
                        position="absolute"
                        t={3}
                        r={3}
                        width={18}
                        height={18}
                        rounded={5}
                        items="center"
                        justify="center"
                        bg="transparent"
                        borderWidth={0}
                        cursor="pointer"
                        opacity={0.45}
                        transition="quickest"
                        hoverStyle={{ opacity: 1, bg: PICKED }}
                        focusVisibleStyle={{ opacity: 1, outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                      >
                        <PinOff size={10} color={DIM} aria-hidden />
                      </XStack>
                    </YStack>
                  )
                })}
              </YStack>
            </YStack>
          ) : null}

          {pinned.length ? (
            <YStack data-slot="bots-divider" mx={10} borderTopWidth={1} borderColor={LINE} />
          ) : null}

          {query.trim() && shown.length === 0 && shownGroups.length === 0 ? (
            <YStack px={16} py={32} items="center" gap={6}>
              <Text fontSize={13} lineHeight={18} color={DIM} text="center">
                {t('No bots match “{query}”.', { query: query.trim() })}
              </Text>
            </YStack>
          ) : null}

          {shownGroups.length > 0 || (!query.trim() && onMakeGroup && !disabled) ? (
            <YStack
              data-parity-key="bots.groups"
              role="group"
              aria-label={t('Bot groups')}
              mt={pinned.length ? 10 : 4}
              pt={pinned.length ? 8 : 6}
              pb={6}
              gap={4}
            >
              <XStack px={16} pb={4} items="center" justify="space-between">
                <XStack items="center" gap={6}>
                  <Layers size={12} color={DIM} aria-hidden />
                  <Text fontSize={12} lineHeight={16} fontWeight="600" color={DIM}>
                    {t('Groups & layers')}
                  </Text>
                </XStack>
                {onMakeGroup && !disabled ? (
                  <XStack
                    render={<button type="button" />}
                    onClick={onMakeGroup}
                    items="center"
                    gap={4}
                    px={7}
                    py={3}
                    rounded={6}
                    bg="transparent"
                    borderWidth={0}
                    cursor="pointer"
                    transition="quickest"
                    hoverStyle={{ bg: PICKED }}
                    focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                    $max-sm={{ minH: 44, px: 10 }}
                  >
                    <Plus size={12} color={DIM} aria-hidden />
                    <Text fontSize={12} lineHeight={16} color={DIM}>
                      {t('Group')}
                    </Text>
                  </XStack>
                ) : null}
              </XStack>

              {shownGroups.length === 0 && onMakeGroup && !disabled ? (
                <XStack
                  render={<button type="button" />}
                  onClick={onMakeGroup}
                  mx={10}
                  px={12}
                  py={9}
                  $max-sm={{ minH: 48 }}
                  rounded={10}
                  items="center"
                  gap={10}
                  bg={RAISED}
                  borderWidth={1}
                  borderColor={LINE}
                  cursor="pointer"
                  transition="quickest"
                  hoverStyle={{ bg: PICKED, borderColor: 'var(--border-strong)' }}
                  focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                >
                  <Users size={15} color={DIM} aria-hidden />
                  <YStack flex={1} minW={0} items="flex-start" gap={2}>
                    <Text {...CLIP} fontSize={13} lineHeight={17} fontWeight="500" color={INK}>
                      {t('Create a bot group')}
                    </Text>
                    <Text {...CLIP} fontSize={12} lineHeight={16} color={DIM}>
                      {t('Leader, Lux Quasar, or majority layers')}
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
                    render={<button type="button" />}
                    data-parity-key="bots.group.row"
                    data-group={g.name}
                    aria-current={here}
                    onClick={() => onPick(ref)}
                    minH={54}
                    mx={6}
                    px={12}
                    py={8}
                    gap={10}
                    items="center"
                    rounded={10}
                    bg={here ? PICKED : 'transparent'}
                    borderWidth={0}
                    cursor="pointer"
                    transition="quickest"
                    hoverStyle={{ bg: here ? PICKED : 'var(--rail-hover, var(--muted))' }}
                    focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
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
                    <YStack flex={1} minW={0} items="flex-start" gap={2}>
                      <XStack items="center" gap={6} maxW="100%">
                        <Text {...CLIP} fontSize={13} lineHeight={18} fontWeight="500" color={INK}>
                          {g.name}
                        </Text>
                        <Text fontSize={11} lineHeight={15} color={DIM} shrink={0}>
                          {`L${g.layer || 1}`}
                        </Text>
                      </XStack>
                      <Text {...CLIP} maxW="100%" fontSize={12} lineHeight={16} color={DIM}>
                        {`${policyBadge(g.policy)} · ${g.members.length} bots`}
                      </Text>
                    </YStack>
                  </XStack>
                )
              })}
            </YStack>
          ) : null}

          {unpinned.length ? (
            <YStack
              data-slot="bots-unpinned"
              data-parity-key="bots.rows"
              role="group"
              aria-label={t('All bots')}
              mt={10}
              pt={12}
              pb={12}
              borderTopWidth={pinned.length || shownGroups.length || (onMakeGroup && !disabled) ? 1 : 0}
              borderColor={LINE}
              gap={4}
            >
              <XStack px={16} pb={4} items="center">
                <Text fontSize={12} lineHeight={16} fontWeight="600" color={DIM}>
                  {t('BOTS')}
                </Text>
              </XStack>
              {unpinned.map((b) => {
                const here = b.name === open
                const label = called(b.name)
                const word = lastWord(last.get(b.name)) || b.description || ''
                return (
                  <XStack
                    key={b.id || b.name}
                    data-parity-key="bots.row"
                    data-name={b.name}
                    minH={56}
                    mx={6}
                    px={10}
                    py={8}
                    gap={8}
                    items="center"
                    rounded={10}
                    bg={here ? PICKED : 'transparent'}
                    transition="quickest"
                    hoverStyle={{ bg: here ? PICKED : 'var(--rail-hover, var(--muted))' }}
                  >
                    <XStack
                      render={<button type="button" />}
                      aria-current={here}
                      onClick={() => onPick(b.name)}
                      flex={1}
                      minW={0}
                      gap={10}
                      items="center"
                      p={0}
                      bg="transparent"
                      borderWidth={0}
                      cursor="pointer"
                      focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                    >
                      <Face bot={b} size={36} />
                      <YStack flex={1} minW={0} items="flex-start" gap={2}>
                        <Text {...CLIP} maxW="100%" fontSize={14} lineHeight={19} fontWeight="500" color={INK}>
                          {label}
                        </Text>
                        {word ? (
                          <Text {...CLIP} maxW="100%" fontSize={12} lineHeight={17} color={DIM}>
                            {word}
                          </Text>
                        ) : null}
                      </YStack>
                    </XStack>
                    <XStack
                      render={<button type="button" />}
                      data-slot="bots-pin"
                      aria-label={t('Pin {name}', { name: label })}
                      onClick={() => togglePin(b.name)}
                      width={24}
                      height={24}
                      shrink={0}
                      rounded={6}
                      items="center"
                      justify="center"
                      bg="transparent"
                      borderWidth={0}
                      cursor="pointer"
                      opacity={0.5}
                      transition="quickest"
                      hoverStyle={{ opacity: 1, bg: PICKED }}
                      focusVisibleStyle={{ opacity: 1, outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                    >
                      <Pin size={12} color={DIM} aria-hidden />
                    </XStack>
                  </XStack>
                )
              })}
            </YStack>
          ) : null}

          {showWorkflows ? (
            <YStack data-slot="bots-workflows" pt={6} pb={14}>
              <YStack mx={10} mb={8} borderTopWidth={1} borderColor={LINE} />
              <XStack
                render="button"
                {...{ type: 'button' }}
                data-slot="bots-workflows-link"
                aria-label={t('Workflows')}
                onClick={openWorkflows}
                height={38}
                $touchable={{ minH: 44 }}
                mx={6}
                px={12}
                gap={10}
                minW={0}
                items="center"
                rounded={10}
                bg="transparent"
                borderWidth={0}
                cursor="pointer"
                hoverStyle={{ bg: 'var(--rail-hover, var(--muted))' }}
                focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: '$outlineColor' }}
              >
                <Workflow size={15} color={DIM} aria-hidden />
                <Text {...CLIP} flex={1} text="left" fontSize={13} lineHeight={18} fontWeight="500" color={INK}>
                  {t('Workflows')}
                </Text>
                <Text fontSize={11} lineHeight={14} color={DIM}>
                  {FLOW}
                </Text>
              </XStack>
            </YStack>
          ) : null}
        </YStack>

        {unpinned.length ? (
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
  const signingOut = useSigningOut()
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
      <XStack
        data-parity-key="bots.me"
        minH={52}
        $max-sm={{ minH: 56, px: 10 }}
        shrink={0}
        px={12}
        items="center"
        gap={6}
        borderTopWidth={1}
        borderColor={LINE}
      >
        <DropdownMenu placement="top-start" offset={8}>
          <DropdownMenuTrigger asChild>
            <XStack
              render={<button type="button" />}
              aria-label={t('Account: {name}', { name })}
              flex={1}
              minW={0}
              minH={36}
              $max-sm={{ minH: 44 }}
              items="center"
              gap={9}
              px={4}
              rounded={8}
              bg="transparent"
              borderWidth={0}
              cursor="pointer"
              transition="quickest"
              hoverStyle={{ bg: PICKED }}
              focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
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
            <DropdownMenuItem onSelect={() => { window.location.href = '/chat' }}>
              <Text fontSize="$3" color="$ink">
                {t('Chat')}
              </Text>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => { window.location.href = '/home' }}>
              <Text fontSize="$3" color="$ink">
                {t('Team')}
              </Text>
            </DropdownMenuItem>
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
            {/* The one sign-out control here: it stays open, saying so, until the page moves. */}
            <DropdownMenuItem preventCloseOnSelect disabled={signingOut} onSelect={() => void leave()}>
              <Text fontSize="$3" color="$ink">
                {signingOut ? t('Signing out…') : t('Log out')}
              </Text>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <XStack
          {...ROUND}
          borderColor="var(--border-strong)"
          focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
          $max-sm={{ width: 44, height: 44 }}
          aria-label={t('Connectors')}
          onClick={() => setConnectorsOpen(true)}
        >
          <Grid2x2Plus size={16} color={INK} aria-hidden />
        </XStack>

        <XStack
          {...ROUND}
          borderColor="var(--border-strong)"
          focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
          $max-sm={{ width: 44, height: 44 }}
          aria-label={t('Preferences')}
          onClick={() => setPrefsOpen(true)}
        >
          <SlidersHorizontal size={15} color={INK} aria-hidden />
        </XStack>
      </XStack>

      <ConnectorsDialog open={connectorsOpen} onOpenChange={setConnectorsOpen} />
      <PreferencesDialog open={prefsOpen} onOpenChange={setPrefsOpen} />
    </>
  )
}
