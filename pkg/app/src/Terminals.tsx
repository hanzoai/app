'use client'

// Tabs in the app: the terminals on the reader's linked machines and cloud workspaces,
// tiled (@hanzo/tabs `Workspace`), wired by `useFleet` with the reader's own
// bearer against this host's cloud. The workspace holds no token; the fleet
// mints each pane's address.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Skeleton, Text, View, XStack, YStack } from '@hanzo/ui'
import { useFleet, Workspace } from '@hanzo/tabs'
import { Loading } from './slow'
import { useI18n } from '@hanzo/i18n/react'
import { Cloud, Globe, Laptop, Monitor, SquareTerminal } from 'lucide-react'
import { api } from './lib/api'
import { enter, LOGIN } from './lib/destination'
import { useDeviceNames } from '@hanzo/build/names'
import { useDevMode } from './lib/dev-mode'
import { showDevice } from './lib/devices'
import { InfoHint } from './lib/info-hint'
import { bearer } from './lib/session'

type LaunchKind = 'dev' | 'desktop' | 'browser'

function TerminalsSkeleton({ label, onRetry }: { label: string; onRetry?: () => void }) {
  return (
    <YStack
      aria-busy={true}
      flex={1}
      minH={0}
      minW={0}
      overflowY="auto"
      overflowX="hidden"
    >
      <YStack
        width="100%"
        maxW={760}
        mx="auto"
        my="auto"
        px="$5"
        pt="$6"
        pb="$12"
        $max-sm={{ px: '$3', pt: '$5', pb: '$8' }}
        gap="$6"
      >
        {/* The wait in words, where the title will stand: the cards alone said nothing for 10 to 15 s. */}
        <Loading label={label} onRetry={onRetry} />
        <View
          display="grid"
          gridTemplateColumns="repeat(3, minmax(0, 1fr))"
          $max-md={{ gridTemplateColumns: 'minmax(0, 1fr)' }}
          gap="$3"
        >
          {[0, 1, 2].map((idx) => (
            <YStack
              key={idx}
              p="$4"
              rounded="$5"
              bg="$panel"
              borderWidth={1}
              borderColor="$edge"
              gap="$4"
            >
              <XStack items="center" justify="space-between">
                <Skeleton layout="block" width={34} height={34} rounded="$3" />
              </XStack>
              <YStack gap="$1.5">
                <Skeleton layout="block" width={88} height={16} rounded="$2" />
                <Skeleton layout="block" width="92%" height={13} rounded="$2" />
                <Skeleton layout="block" width="74%" height={13} rounded="$2" />
              </YStack>
              <Skeleton layout="block" width="100%" height={36} rounded="$3" />
            </YStack>
          ))}
        </View>
        <YStack gap="$2">
          <Skeleton layout="block" width={140} height={13} rounded="$2" />
          <YStack p="$3.5" rounded="$4" bg="$panel" borderWidth={1} borderColor="$edge">
            <XStack items="center" justify="space-between" gap="$3">
              <Skeleton layout="block" width={150} height={14} rounded="$2" />
              <Skeleton layout="block" width={56} height={13} rounded="$2" />
            </XStack>
          </YStack>
        </YStack>
      </YStack>
    </YStack>
  )
}

export default function Terminals() {
  const { t } = useI18n()
  const [devMode] = useDevMode()
  const token = bearer()
  const fleet = useFleet(token, api())
  const [launchingKind, setLaunchingKind] = useState<LaunchKind | null>(null)
  const [launchError, setLaunchError] = useState<string | null>(null)
  const [openedWorkspace, setOpenedWorkspace] = useState(false)
  const [pendingAction, setPendingAction] = useState<{ kind: 'shell' | 'page' | 'desktop'; machine: string } | null>(null)
  const launching = launchingKind !== null

  // The names a person gave their devices (kept on their account; the sidebar renames them).
  const names = useDeviceNames()

  // Each machine as a person reads it: "Alex's MacBook Pro", its hardware and hostname beneath (hanzo-inc/app issue 311).
  // `label` came from the fleet as the hardware; it is the name now, for the workspace's panes.
  const hosts = useMemo(
    () =>
      fleet.hosts.map((h) => {
        const shown = showDevice({ machine: h.machine, hardware: h.label, sandbox: Boolean(h.sandbox) }, names, devMode, t)
        return {
          ...h,
          hardware: h.label,
          label: shown.title,
          title: shown.title,
          detail: shown.detail,
        }
      }),
    [fleet.hosts, names, devMode, t],
  )

  const liveHosts = useMemo(
    () => hosts.filter((h) => (h.base || h.sandbox) && h.status !== 'offline'),
    [hosts],
  )

  const linkedLocalHosts = useMemo(
    () => hosts.filter((h) => !h.sandbox),
    [hosts],
  )

  const startWorkspace = useCallback(
    async (kind: LaunchKind = 'dev') => {
      if (!token) {
        enter(LOGIN)
        return
      }
      if (launchingKind !== null) return
      setLaunchingKind(kind)
      setLaunchError(null)
      try {
        const machine = await fleet.launch(kind)
        setPendingAction({
          kind: kind === 'dev' ? 'shell' : kind === 'browser' ? 'page' : 'desktop',
          machine,
        })
        setOpenedWorkspace(true)
      } catch (e: unknown) {
        setLaunchError(e instanceof Error ? e.message : t('Could not start a cloud workspace.'))
      } finally {
        setLaunchingKind(null)
      }
    },
    [token, launchingKind, fleet, t],
  )

  useEffect(() => {
    if (typeof window === 'undefined' || !fleet.read) return
    try {
      // What the sidebar lists under Tabs: the machine as the fleet names it and its hardware, so the sidebar draws the
      // same name and a rename shows there at once.
      const lite = liveHosts.map((h) => ({
        machine: h.machine,
        hardware: h.hardware || undefined,
        sandbox: Boolean(h.sandbox) || undefined,
        status: h.status,
        desktop: Boolean(h.screen),
      }))
      window.localStorage.setItem('hanzo.tabs.fleet', JSON.stringify(lite))
      window.dispatchEvent(new CustomEvent('hanzo:tabs-fleet', { detail: lite }))
    } catch {
      // ignore storage errors
    }
  }, [liveHosts, fleet.read])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onTabsAction = (ev: Event) => {
      const detail = (ev as CustomEvent<{ kind?: string }>).detail
      if (!detail?.kind) return
      if (liveHosts.length === 0 && !openedWorkspace) {
        if (detail.kind === 'desktop') void startWorkspace('desktop')
        else if (detail.kind === 'page') void startWorkspace('browser')
        else if (detail.kind === 'shell' || detail.kind === 'cloud') void startWorkspace('dev')
        else setOpenedWorkspace(true)
      }
    }
    window.addEventListener('hanzo:tabs-action', onTabsAction)
    return () => window.removeEventListener('hanzo:tabs-action', onTabsAction)
  }, [liveHosts.length, openedWorkspace, startWorkspace])

  const showCalmEmpty = (!token || (fleet.read && !fleet.error && liveHosts.length === 0)) && !openedWorkspace

  useEffect(() => {
    if (!pendingAction || showCalmEmpty || !(fleet.read || fleet.error)) return
    const action = pendingAction
    if (typeof window === 'undefined') return
    const id = window.setTimeout(() => {
      setPendingAction(null)
      window.dispatchEvent(new CustomEvent('hanzo:tabs-action', { detail: action }))
    }, 0)
    return () => window.clearTimeout(id)
  }, [pendingAction, showCalmEmpty, fleet.read, fleet.error])

  const launchers = [
    {
      kind: 'dev' as const,
      title: t('Terminal'),
      summary: t('Run commands, git and builds in a cloud terminal that keeps your files.'),
      info: t('A cloud terminal for running scripts, git, builds and local servers, with your files kept between sessions.'),
      action: !token ? t('Sign in') : launchingKind === 'dev' ? t('Starting…') : t('Open terminal'),
      primary: true,
      icon: <SquareTerminal size={17} color="var(--foreground)" aria-hidden />,
    },
    {
      kind: 'desktop' as const,
      title: t('Desktop'),
      summary: t('View and control a full visual desktop in your browser.'),
      info: t('A full visual cloud desktop you can view and control right inside your browser.'),
      action: !token ? t('Sign in') : launchingKind === 'desktop' ? t('Starting…') : t('Open desktop'),
      primary: false,
      icon: <Monitor size={17} color="var(--foreground)" aria-hidden />,
    },
    {
      kind: 'browser' as const,
      title: t('Browser'),
      summary: t('Preview apps and browse in an isolated workspace tab.'),
      info: t('An isolated workspace browser tab for previewing web apps, testing flows, or browsing alongside agents.'),
      action: !token ? t('Sign in') : launchingKind === 'browser' ? t('Starting…') : t('Open browser'),
      primary: false,
      icon: <Globe size={17} color="var(--foreground)" aria-hidden />,
    },
  ]

  return (
    <YStack data-slot="terminals" flex={1} minH={0} minW={0} bg="$background">
      {fleet.error ? (
        <XStack
          role="alert"
          px="$4"
          py="$2.5"
          gap="$3"
          items="center"
          justify="space-between"
          flexWrap="wrap"
          bg="$panel"
          borderBottomWidth={1}
          borderColor="$edge"
        >
          <Text fontSize="$2" color="var(--state-error)" flex={1} minW={0}>
            {devMode
              ? t('The machines could not be read: {error}', { error: fleet.error })
              : t('Could not load your workspaces right now: {error}', { error: fleet.error })}
          </Text>
          <Button
            size="sm"
            variant="outline"
            rounded="$3"
            minH={36}
            borderColor="var(--border-strong)"
            focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
            $max-sm={{ minH: 44 }}
            onClick={() => fleet.refresh()}
          >
            {t('Try again')}
          </Button>
        </XStack>
      ) : null}

      {showCalmEmpty ? (
        <YStack
          data-slot="terminals-empty"
          flex={1}
          minH={0}
          minW={0}
          overflowY="auto"
          overflowX="hidden"
        >
          <YStack
            width="100%"
            maxW={760}
            mx="auto"
            my="auto"
            px="$5"
            pt="$6"
            pb="$12"
            $max-sm={{ px: '$3', pt: '$5', pb: '$8' }}
            gap="$6"
          >
            <YStack gap="$1.5" maxW={580}>
              <Text
                render="h1"
                m={0}
                fontSize="$7"
                lineHeight="$8"
                fontWeight="600"
                letterSpacing={-0.42}
                color="$ink"
              >
                {t('Tabs')}
              </Text>
              <Text fontSize="$3" color="$soft" lineHeight="$4">
                {!token
                  ? t('Sign in to open a cloud terminal, visual desktop, or isolated browser tab — everything stays saved in your workspace.')
                  : t('Open a cloud terminal, visual desktop, or isolated browser tab — everything stays saved in your workspace.')}
              </Text>
            </YStack>

            {launchError ? (
              <Text role="alert" fontSize="$2" color="var(--state-error)">
                {launchError}
              </Text>
            ) : null}

            <View
              data-slot="terminals-launchers"
              display="grid"
              gridTemplateColumns="repeat(3, minmax(0, 1fr))"
              $max-md={{ gridTemplateColumns: 'minmax(0, 1fr)' }}
              gap="$3"
              minW={0}
            >
              {launchers.map((card) => (
                <YStack
                  key={card.kind}
                  data-launcher={card.kind}
                  p="$4"
                  rounded="$5"
                  bg="$panel"
                  borderWidth={1}
                  borderColor="$edge"
                  gap="$4"
                  justify="space-between"
                  minW={0}
                  transition="quickest"
                  hoverStyle={{ bg: '$hover', borderColor: 'var(--border-strong)' }}
                >
                  <YStack gap="$3" minW={0}>
                    <YStack
                      width={34}
                      height={34}
                      rounded="$3"
                      bg="$raised"
                      borderWidth={1}
                      borderColor="$edge"
                      items="center"
                      justify="center"
                      shrink={0}
                    >
                      {card.icon}
                    </YStack>

                    <YStack gap="$1" minW={0}>
                      <Text fontSize="$4" fontWeight="600" color="$ink">
                        {card.title}
                      </Text>
                      <Text fontSize="$2" color="$soft" lineHeight="$3">
                        {card.summary}
                      </Text>
                    </YStack>
                  </YStack>

                  <Button
                    size="sm"
                    variant={card.primary ? 'default' : 'outline'}
                    {...(card.primary
                      ? { bg: 'var(--primary)', color: 'var(--primary-foreground)', hoverStyle: { bg: 'var(--primary-hover, var(--primary))' } }
                      : { borderColor: 'var(--border-strong)' })}
                    rounded="$3"
                    width="100%"
                    minH={36}
                    $max-sm={{ minH: 44 }}
                    focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                    disabled={launching}
                    data-slot={card.primary ? 'terminals-empty-cta' : `terminals-launch-${card.kind}`}
                    onClick={() => void startWorkspace(card.kind)}
                  >
                    {card.action}
                  </Button>
                </YStack>
              ))}
            </View>

            <YStack gap="$2.5" minW={0} data-slot="terminals-environments">
              <XStack items="center" gap="$1.5">
                <Text fontSize="$2" fontWeight="600" color="$soft">
                  {t('Available environments')}
                </Text>
                <InfoHint
                  text={t('Cloud workspaces start on demand. Linked local computers stay ready here whenever hanzo link is running.')}
                  size={13}
                  side="top"
                />
              </XStack>

              <YStack rounded="$4" bg="$panel" borderWidth={1} borderColor="$edge" overflow="hidden">
                <XStack
                  render={<button type="button" />}
                  onClick={() => void startWorkspace('dev')}
                  disabled={launching}
                  width="100%"
                  minW={0}
                  minH={44}
                  px="$3.5"
                  py="$2.5"
                  gap="$3"
                  items="center"
                  justify="space-between"
                  bg="transparent"
                  borderWidth={0}
                  cursor="pointer"
                  transition="quickest"
                  hoverStyle={{ bg: '$hover' }}
                  focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)', outlineOffset: -2 }}
                >
                  <XStack items="center" gap="$2.5" flex={1} minW={0}>
                    <Cloud size={15} color="var(--muted-foreground)" aria-hidden />
                    <YStack flex={1} minW={0} items="flex-start" gap="$0.5">
                      <Text fontSize="$2" fontWeight="500" color="$ink" numberOfLines={1} text="start">
                        {t('Auto (Cloud)')}
                      </Text>
                      <Text fontSize="$1" color="$soft" numberOfLines={1} text="start">
                        {t('Managed cloud workspace · persistent storage')}
                      </Text>
                    </YStack>
                  </XStack>
                  <XStack items="center" gap="$1.5" shrink={0}>
                    <YStack
                      width={7}
                      height={7}
                      rounded={9999}
                      bg={token ? 'var(--state-online)' : '$edge'}
                      aria-hidden
                    />
                    <Text fontSize="$1" color="$soft">
                      {token ? t('Ready') : t('Sign in')}
                    </Text>
                  </XStack>
                </XStack>

                {linkedLocalHosts.map((host) => {
                  const online = host.status !== 'offline'
                  return (
                    <XStack
                      key={host.machine}
                      render={<button type="button" />}
                      onClick={() => {
                        if (online) setOpenedWorkspace(true)
                      }}
                      disabled={!online}
                      width="100%"
                      minW={0}
                      minH={44}
                      px="$3.5"
                      py="$2.5"
                      gap="$3"
                      items="center"
                      justify="space-between"
                      bg="transparent"
                      borderWidth={0}
                      borderTopWidth={1}
                      borderTopColor="$edge"
                      cursor={online ? 'pointer' : 'default'}
                      opacity={online ? 1 : 0.65}
                      transition="quickest"
                      {...(online ? { hoverStyle: { bg: '$hover' } } : null)}
                      focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)', outlineOffset: -2 }}
                    >
                      <XStack items="center" gap="$2.5" flex={1} minW={0}>
                        <Laptop size={15} color="var(--muted-foreground)" aria-hidden />
                        <YStack flex={1} minW={0} items="flex-start" gap="$0.5">
                          <Text fontSize="$2" fontWeight="500" color="$ink" numberOfLines={1} text="start">
                            {host.title || host.machine}
                          </Text>
                          <Text fontSize="$1" color="$soft" numberOfLines={1} text="start">
                            {host.detail || t('Connected local machine')}
                          </Text>
                        </YStack>
                      </XStack>
                      <XStack items="center" gap="$1.5" shrink={0}>
                        <YStack
                          width={7}
                          height={7}
                          rounded={9999}
                          bg={online ? 'var(--state-online)' : '$edge'}
                          aria-hidden
                        />
                        <Text fontSize="$1" color="$soft">
                          {online ? t('Online') : t('Offline')}
                        </Text>
                      </XStack>
                    </XStack>
                  )
                })}

                {devMode && linkedLocalHosts.length === 0 ? (
                  <XStack
                    px="$3.5"
                    py="$2.5"
                    borderTopWidth={1}
                    borderTopColor="$edge"
                    items="center"
                    gap="$2"
                  >
                    <Laptop size={14} color="var(--muted-foreground)" aria-hidden />
                    <Text fontSize="$1" color="$soft">
                      {t('Run hanzo link to add a local machine to Hanzo Link')}
                    </Text>
                  </XStack>
                ) : null}
              </YStack>
            </YStack>
          </YStack>
        </YStack>
      ) : fleet.read || fleet.error ? (
        <Workspace
          hosts={hosts}
          mint={fleet.mint}
          onLaunch={fleet.launch}
          agent={fleet.agent}
        />
      ) : (
        <TerminalsSkeleton label={devMode ? t('Reading your machines…') : t('Loading your machines…')} onRetry={() => fleet.refresh()} />
      )}
    </YStack>
  )
}
