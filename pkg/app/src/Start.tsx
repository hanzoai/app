'use client'

// Starting a run from here — the composer /dev's empty state promised and did
// not have.
//
// The pane already said "Describe it. Ship it." over "in your terminal, your
// editor, or right here", and `right here` was the one of the three with nothing
// behind it: the idle state drew install cards and no way to send. The comment
// that stood in for it said "there is no create-a-run route to offer: a run
// begins on a machine". THAT IS NO LONGER TRUE — `POST /v1/agents/coding` starts
// one and answers the session to watch it in, which is the row the working view
// already renders.
//
// WHERE IT RUNS IS THE ONE CHOICE, and it is a field rather than a fork:
//
//   no target   the cloud's own sandbox — what a browser gets, because a
//               browser has no machine to offer
//   a target    a machine this org has claimed, routed by id
//
// Nothing here reads the user agent to decide. The web sends no target because
// it HAS none; a surface running on a claimed machine sends that machine's id.
// One endpoint, one field, and the answer comes back rather than being assumed —
// `routed` says whether a machine actually took it, so asking for one and being
// given a sandbox is reported instead of drawn as success.

import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { Text, XStack, YStack } from '@hanzo/ui'
import { Composer } from '@hanzo/ui/chat'
import { useOpen } from './open'
import {
  CodingRefusal,
  dispatchable,
  listTargets,
  startCoding,
  type Target,
} from './lib/coding'
import { BAD } from './lib/mix'
import {
  getLocalWorkspaces,
  pickLocalFolder,
  runLocalDev,
  type LocalWorkspace,
} from './lib/local-fs'

/** A field of the start row: 32px, outlined, in the row's own ink. */
const FIELD = {
  height: 32,
  rounded: 8,
  borderWidth: 1,
  borderColor: 'var(--white-10)',
  bg: 'transparent',
  color: 'inherit',
  fontSize: '$2',
} as const

const SOFT = '$soft'

/** The sandbox is a destination like any other, and it is the default one. */
const SANDBOX = ''

export function Start() {
  const { t } = useI18n()
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
      .then((t) => live && setTargets(t.filter(dispatchable)))
      .catch(() => {
        /* Listing is an enhancement here; the sandbox needs nothing from it. */
      })
    setLocalWorkspaces(getLocalWorkspaces())
    return () => {
      live = false
    }
  }, [])

  const handleWhereChange = useCallback(
    async (val: string) => {
      if (val === 'action:pick-local') {
        try {
          const ws = await pickLocalFolder()
          if (ws) {
            setLocalWorkspaces((prev) => [ws, ...prev.filter((p) => p.path !== ws.path)])
            setWhere(`local:${ws.path}`)
          }
        } catch (e: any) {
          setErr(e?.message || 'Could not pick folder')
        }
        return
      }
      setWhere(val)
    },
    []
  )

  const send = useCallback(async () => {
    const task = prompt.trim()
    if (!task || busy) return
    setBusy(true)
    setErr(null)
    setLocalMsg(null)

    if (where.startsWith('local:')) {
      const localPath = where.slice(6)
      try {
        setLocalMsg(t('Running local dev agent in {path}…', { path: localPath }))
        const res = await runLocalDev(localPath, task)
        setPrompt('')
        setLocalMsg(res.output?.slice(0, 300) || res.sessionId || t('Completed successfully.'))
      } catch (e: any) {
        setErr(e?.message || t('Local dev execution failed'))
      } finally {
        setBusy(false)
      }
      return
    }

    try {
      const run = await startCoding({
        prompt: task,
        repo: repo.trim() || undefined,
        tool: tool || 'dev',
        targetId: where || undefined,
      })
      setPrompt('')
      // The run is ACCEPTED, not finished. Opening its session is what puts the
      // reader where it narrates itself, which is the view this pane replaces.
      openSession(run.sessionId)
    } catch (e) {
      setErr(e instanceof CodingRefusal ? e.message : t('Could not start the run'))
    } finally {
      setBusy(false)
    }
  }, [prompt, repo, tool, where, busy, openSession, t])

  const isLocal = where.startsWith('local:')

  return (
    <YStack width="100%" gap="$2">
      <Composer
        value={prompt}
        onChange={setPrompt}
        onSend={() => void send()}
        busy={busy}
        placeholder={t('Describe what to build…')}
        label={t('Describe what to build')}
      />

      <XStack gap="$2" items="center" flexWrap="wrap">
        <Text
          render={<select value={tool} onChange={(e) => setTool(e.currentTarget.value)} aria-label={t('Agent Harness')} />}
          {...FIELD}
          px={8}
        >
          <option value="dev">Dev</option>
          <option value="claude">Claude</option>
          <option value="codex">Codex</option>
          <option value="python">Python</option>
        </Text>

        {!isLocal ? (
          <Text
            render={<input data-i18n-ltr="" value={repo} onChange={(e) => setRepo(e.currentTarget.value)} placeholder={t('owner/repo (optional)')} aria-label={t('Repository')} />}
            {...FIELD}
            flex={1}
            minW={160}
            px={10}
            outlineStyle="none"
          />
        ) : (
          <Text
            {...FIELD}
            flex={1}
            minW={160}
            px={10}
            style={{ display: 'flex', alignItems: 'center', opacity: 0.8 }}
          >
            {where.slice(6)}
          </Text>
        )}

        {/* WHERE selector: always provide option to select sandbox, local workspaces, or remote targets */}
        <Text
          render={<select value={where} onChange={(e) => void handleWhereChange(e.currentTarget.value)} aria-label={t('Where to run')} />}
          {...FIELD}
          px={8}
        >
          <option value={SANDBOX}>{t('Cloud Sandbox')}</option>
          {localWorkspaces.map((ws) => (
            <option key={ws.path} value={`local:${ws.path}`}>
              {t('Local: {name}', { name: ws.name })}
            </option>
          ))}
          <option value="action:pick-local">{t('+ Open local folder…')}</option>
          {targets.map((tg) => (
            <option key={tg.id} value={tg.id}>
              {tg.label || tg.host || tg.id}
              {tg.capacity ? ` — ${tg.capacity}` : ''}
            </option>
          ))}
        </Text>
      </XStack>

      {err ? (
        <Text role="alert" fontSize="$2" color={BAD}>
          {err}
        </Text>
      ) : localMsg ? (
        <Text fontSize="$2" color="$color">
          {localMsg}
        </Text>
      ) : (
        <Text fontSize="$2" color={SOFT}>
          {t(
            isLocal
              ? 'Runs locally on your machine with dev agent.'
              : targets.length > 0 && where !== SANDBOX
              ? 'Runs on your linked machine.'
              : 'Runs in an isolated sandbox with Free AI / Enso.'
          )}
        </Text>
      )}
    </YStack>
  )
}
