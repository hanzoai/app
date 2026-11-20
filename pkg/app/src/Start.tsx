'use client'

import { useCallback, useEffect, useState } from 'react'
import { phrase } from '@hanzo/i18n'
import { useI18n } from '@hanzo/i18n/react'
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Text,
  XStack,
  YStack,
} from '@hanzo/ui'
import { Composer } from '@hanzo/ui/chat'
import { ArrowUpRight, Cloud, FolderOpen, Laptop } from 'lucide-react'
import { useOpen } from './open'
import {
  CodingRefusal,
  dispatchable,
  listTargets,
  startCoding,
  type Target,
} from './lib/coding'
import {
  getLocalWorkspaces,
  pickLocalFolder,
  runLocalDev,
  type LocalWorkspace,
} from './lib/local-fs'
import { deviceKey, useDeviceNames } from '@hanzo/build/names'
import { formatDeviceLabel, useDevMode } from './lib/dev-mode'
import { InfoHint } from './lib/info-hint'

const SOFT = '$soft'

/** Empty target routes to Hanzo's managed cloud workspace. */
const SANDBOX = ''
const CLOUD_VALUE = '__cloud__'

const STARTER_PROMPTS: readonly { id: string; title: string; summary: string; prompt: string }[] = [
  {
    id: 'bugfix',
    title: phrase('Fix a bug and add regression tests'),
    summary: phrase('Trace the failing path, patch the root cause, and verify with focused unit tests.'),
    prompt: phrase('Find the root cause of the failing test, implement a minimal fix, and add a regression test covering the edge case.'),
  },
  {
    id: 'review',
    title: phrase('Audit a branch before shipping'),
    summary: phrase('Inspect recent changes for race conditions, accessibility gaps, and unhandled errors.'),
    prompt: phrase('Review the latest changes on this branch for correctness, edge cases, error handling, and accessibility issues.'),
  },
  {
    id: 'feature',
    title: phrase('Build a responsive view from a spec'),
    summary: phrase('Scaffold the layout, wire state cleanly, and verify mobile and desktop breakpoints.'),
    prompt: phrase('Implement the requested screen with clean semantic tokens, keyboard focus states, and responsive mobile stacking.'),
  },
]

export function Start() {
  const { t } = useI18n()
  const [devMode] = useDevMode()
  const names = useDeviceNames()
  const { openSession } = useOpen()
  const [prompt, setPrompt] = useState('')
  const [repo, setRepo] = useState('')
  const [where, setWhere] = useState<string>(SANDBOX)
  const [targets, setTargets] = useState<Target[]>([])
  const [localWorkspaces, setLocalWorkspaces] = useState<LocalWorkspace[]>([])
  const [busy, setBusy] = useState(false)
  const [tool, setTool] = useState<string>('dev')
  const [err, setErr] = useState<string | null>(null)
  const [localMsg, setLocalMsg] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    listTargets()
      .then((list) => live && setTargets(list.filter(dispatchable)))
      .catch(() => {
        /* Listing is an enhancement here; cloud workspace needs nothing from it. */
      })
    setLocalWorkspaces(getLocalWorkspaces())
    return () => {
      live = false
    }
  }, [])

  const handleWhereChange = useCallback(async (val: string) => {
    if (val === 'action:pick-local') {
      try {
        const ws = await pickLocalFolder()
        if (ws) {
          setLocalWorkspaces((prev) => [ws, ...prev.filter((p) => p.path !== ws.path)])
          setWhere(`local:${ws.path}`)
        }
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : 'Could not pick folder')
      }
      return
    }
    setWhere(val === CLOUD_VALUE ? SANDBOX : val)
  }, [])

  const send = useCallback(async () => {
    const task = prompt.trim()
    if (!task || busy) return
    setBusy(true)
    setErr(null)
    setLocalMsg(null)

    if (where.startsWith('local:')) {
      const localPath = where.slice(6)
      try {
        setLocalMsg(t('Running in {path}…', { path: localPath }))
        const res = await runLocalDev(localPath, task)
        setPrompt('')
        setLocalMsg(res.output?.slice(0, 300) || res.sessionId || t('Completed.'))
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : t('Local run failed'))
      } finally {
        setBusy(false)
      }
      return
    }

    try {
      const run = await startCoding({
        prompt: task,
        repo: devMode && repo.trim() ? repo.trim() : undefined,
        tool: devMode && tool ? tool : 'dev',
        targetId: where || undefined,
      })
      setPrompt('')
      openSession(run.sessionId)
    } catch (e) {
      setErr(e instanceof CodingRefusal ? e.message : t('Could not start the run'))
    } finally {
      setBusy(false)
    }
  }, [prompt, repo, tool, where, devMode, busy, openSession, t])

  const isLocal = where.startsWith('local:')

  return (
    <YStack width="100%" minW={0} gap="$6">
      <YStack width="100%" minW={0} gap="$2.5">
        <Composer
          value={prompt}
          onChange={setPrompt}
          onSend={() => void send()}
          busy={busy}
          placeholder={t('Describe what to build…')}
          label={t('Describe what to build')}
        />

        <YStack width="100%" minW={0} gap="$1.5">
          <XStack gap="$2" items="center" justify="space-between" flexWrap="wrap" minW={0}>
            <XStack gap="$2" items="center" flexWrap="wrap" minW={0} $max-sm={{ width: '100%' }}>
              <Select value={where || CLOUD_VALUE} onValueChange={(v) => void handleWhereChange(v)}>
                <SelectTrigger
                  size="sm"
                  width={196}
                  minH={36}
                  borderColor="var(--border-strong)"
                  focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                  $max-sm={{ flex: 1, width: 'auto', minW: 0, minH: 44 }}
                  aria-label={t('Where to run')}
                >
                  <SelectValue placeholder={t('Cloud workspace')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CLOUD_VALUE}>
                    <XStack items="center" gap="$2">
                      <Cloud size={13} aria-hidden />
                      <Text fontFamily="$body" fontSize="$2" color="$ink">
                        {t('Cloud workspace')}
                      </Text>
                    </XStack>
                  </SelectItem>
                  {localWorkspaces.map((ws) => (
                    <SelectItem key={ws.path} value={`local:${ws.path}`}>
                      <XStack items="center" gap="$2">
                        <FolderOpen size={13} aria-hidden />
                        <Text fontFamily="$body" fontSize="$2" color="$ink">
                          {ws.name}
                        </Text>
                      </XStack>
                    </SelectItem>
                  ))}
                  <SelectItem value="action:pick-local">
                    <Text fontFamily="$body" fontSize="$2" color="$aside">
                      {t('Open local folder…')}
                    </Text>
                  </SelectItem>
                  {targets.map((tg) => {
                    const formatted = formatDeviceLabel(tg.label || tg.host || tg.id, { devMode, name: names[deviceKey(tg.host, tg.label, tg.id)] })
                    return (
                      <SelectItem key={tg.id} value={tg.id}>
                        <XStack items="center" gap="$2">
                          <Laptop size={13} aria-hidden />
                          <Text fontFamily="$body" fontSize="$2" color="$ink">
                            {devMode && tg.capacity
                              ? `${formatted.title} · ${tg.capacity}`
                              : formatted.title}
                          </Text>
                        </XStack>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>

              <InfoHint
                text={t('Choose whether Hanzo builds in a cloud workspace or inside a folder on your computer.')}
                size={13}
              />
            </XStack>

            {devMode ? (
              <XStack
                gap="$2"
                items="center"
                flex={1}
                minW={0}
                justify="flex-end"
                flexWrap="wrap"
                $max-sm={{ width: '100%', justify: 'flex-start', flexBasis: 'auto', grow: 0 }}
              >
                <Select value={tool} onValueChange={setTool}>
                  <SelectTrigger
                    size="sm"
                    width={120}
                    minH={36}
                    borderColor="var(--border-strong)"
                    focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                    $max-sm={{ minH: 44 }}
                    aria-label={t('Runner')}
                  >
                    <SelectValue placeholder="Dev" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dev">Dev</SelectItem>
                    <SelectItem value="claude">Claude</SelectItem>
                    <SelectItem value="codex">Codex</SelectItem>
                    <SelectItem value="python">Python</SelectItem>
                  </SelectContent>
                </Select>

                {!isLocal ? (
                  <Input
                    size="sm"
                    data-i18n-ltr=""
                    value={repo}
                    onChangeText={setRepo}
                    placeholder={t('owner/repo (optional)')}
                    aria-label={t('Repository')}
                    borderColor="var(--border-strong)"
                    focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                    flex={1}
                    minH={36}
                    minW={140}
                    maxW={260}
                    $max-sm={{ maxW: '100%', minH: 44 }}
                  />
                ) : (
                  <Text fontSize="$1" fontFamily="$mono" color={SOFT} numberOfLines={1} flex={1} minW={0}>
                    {where.slice(6)}
                  </Text>
                )}
              </XStack>
            ) : null}
          </XStack>

          {err ? (
            <Text role="alert" fontSize="$2" color="var(--state-error)">
              {err}
            </Text>
          ) : localMsg ? (
            <Text fontSize="$2" color="$ink">
              {localMsg}
            </Text>
          ) : (
            <Text fontSize="$1" color={SOFT}>
              {t(
                isLocal
                  ? 'Runs in the selected folder on your computer.'
                  : targets.length > 0 && where !== SANDBOX
                    ? 'Runs on your connected computer.'
                    : 'Starts immediately in a cloud workspace.',
              )}
            </Text>
          )}
        </YStack>
      </YStack>

      {!prompt.trim() && !busy ? (
        <YStack gap="$2.5" role="list" aria-label={t('Starter prompts')} data-slot="start-prompts">
          <Text fontSize="$2" fontWeight="600" color="$soft" px="$0.5">
            {t('Starter prompts')}
          </Text>
          <YStack gap="$2.5">
            {STARTER_PROMPTS.map((item) => (
              <XStack
                key={item.id}
                role="listitem"
                render={<button type="button" />}
                data-slot="start-prompt-row"
                onClick={() => {
                  setPrompt(t(item.prompt))
                  setErr(null)
                }}
                width="100%"
                minW={0}
                px="$3.5"
                py="$3"
                rounded="$4"
                bg="$panel"
                borderWidth={1}
                borderColor="$edge"
                items="center"
                justify="space-between"
                gap="$3"
                cursor="pointer"
                transition="quickest"
                hoverStyle={{ bg: '$hover', borderColor: 'var(--border-strong)' }}
                focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                $max-sm={{ minH: 48, px: '$3', py: '$2.5' }}
              >
                <YStack flex={1} minW={0} gap="$1" items="flex-start">
                  <Text fontSize="$3" fontWeight="500" color="$ink" text="start" numberOfLines={1}>
                    {t(item.title)}
                  </Text>
                  <Text fontSize="$2" color="$soft" text="start" lineHeight="$3" numberOfLines={2}>
                    {t(item.summary)}
                  </Text>
                </YStack>
                <YStack shrink={0} items="center" justify="center">
                  <ArrowUpRight size={15} color="var(--muted-foreground)" aria-hidden />
                </YStack>
              </XStack>
            ))}
          </YStack>
        </YStack>
      ) : null}
    </YStack>
  )
}
