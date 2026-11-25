import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import type { Agent, AgentRun } from '@hanzo/ai'

const { part } = vi.hoisted(() => {
  type Props = {
    children?: ReactNode
    render?: string | unknown
    'data-slot'?: string
    'data-parity-key'?: string
    'data-run-id'?: string
    'data-status'?: string
    'aria-label'?: string
  }
  const part = ({
    children,
    render,
    'data-slot': slot,
    'data-parity-key': parity,
    'data-run-id': runId,
    'data-status': status,
    'aria-label': ariaLabel,
  }: Props) => {
    const attrs: Record<string, unknown> = {}
    if (slot !== undefined) attrs['data-slot'] = slot
    if (parity !== undefined) attrs['data-parity-key'] = parity
    if (runId !== undefined) attrs['data-run-id'] = runId
    if (status !== undefined) attrs['data-status'] = status
    if (ariaLabel !== undefined) attrs['aria-label'] = ariaLabel
    return createElement(typeof render === 'string' ? render : 'div', attrs, children)
  }
  return { part }
})

vi.mock('@hanzo/i18n/react', () => ({
  useI18n: () => ({
    locale: 'en-US',
    t: (s: string, v?: Record<string, unknown>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v?.[k] ?? '')),
  }),
}))
vi.mock('@hanzo/gui', () => ({ Input: part, Text: part, XStack: part, YStack: part }))
vi.mock('@hanzo/ui', () => ({
  Button: part,
  Dialog: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  DialogContent: part,
  DialogTitle: part,
  DropdownMenu: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  DropdownMenuContent: part,
  DropdownMenuItem: part,
  DropdownMenuTrigger: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
}))
vi.mock('lucide-react', () => {
  const icon = () => createElement('svg')
  return {
    ChevronDown: icon,
    ChevronRight: icon,
    Clock: icon,
    ExternalLink: icon,
    FileText: icon,
    Image: icon,
    KeyRound: icon,
    Layers: icon,
    Play: icon,
    Plus: icon,
    RefreshCw: icon,
    Star: icon,
    Trash2: icon,
    X: icon,
    Zap: icon,
  }
})
vi.mock('../kept', () => ({
  useKept: <T,>(_key: string, initial: T): [T, (next: T) => void] => [initial, () => {}],
}))
vi.mock('../lib/api', () => ({ api: () => 'https://api.hanzo.ai' }))
vi.mock('../lib/ai', () => ({ useAi: () => ({ client: null }) }))
vi.mock('../failure', () => ({ say: (e: unknown) => String(e) }))
vi.mock('../network', () => ({
  Network: () => createElement('span'),
  of: (id: string) => ({ name: id }),
}))
vi.mock('../team', () => ({ called: (s: string) => s }))
vi.mock('../vault', () => ({
  VaultDialog: () => null,
  readVault: async () => ({ items: [], providers: {}, secretKeys: [] }),
}))
vi.mock('./ComputerDialog', () => ({ ComputerDialog: () => null }))
vi.mock('./ConnectorsDialog', () => ({ ConnectorsDialog: () => null }))
vi.mock('./face', () => ({ Face: () => createElement('div', { 'data-slot': 'face' }) }))
vi.mock('../Confirm', () => ({
  Confirm: () => null,
  useSpend: () => ({ dialog: null, ask: (fn: () => void) => fn() }),
}))

import { Panel, recentResults, summarizeRun } from './Panel'

const t = (s: string, v?: Record<string, unknown>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v?.[k] ?? ''))

const bot: Agent = {
  id: 'agt_dev',
  name: 'dev',
  model: 'enso',
  createdAt: '2026-10-01T09:00:00Z',
}

function renderPanel(runs: AgentRun[]) {
  return renderToStaticMarkup(
    createElement(Panel, {
      bot,
      groups: [],
      runs,
      kept: '',
      onClose: () => {},
      onSchedule: async () => {},
      onDelete: async () => {},
    }),
  )
}

describe('recentResults & summarizeRun', () => {
  test('sorts runs newest-first and limits to the latest 5', () => {
    const runs: AgentRun[] = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
      id: `run-${n}`,
      status: 'ok',
      output: `Output ${n}`,
      createdAt: `2026-11-25T0${n}:00:00Z`,
    }))
    const latest = recentResults(runs, 5)
    expect(latest.map((r) => r.id)).toEqual(['run-7', 'run-6', 'run-5', 'run-4', 'run-3'])
  })

  test('formats completed, failed, and running runs with timestamps and safe fallbacks', () => {
    const now = Date.parse('2026-11-25T12:00:00Z')

    const ok = summarizeRun(
      { id: 'r1', status: 'ok', output: 'Deployed\n  v1.2', createdAt: '2026-11-25T11:30:00Z', durationMs: 1500 },
      now,
      'en-US',
      t,
    )
    expect(ok).toMatchObject({ id: 'r1', status: 'ok', statusLabel: 'Done', summary: 'Deployed v1.2', failed: false })
    expect(ok.meta).toContain('Done')
    expect(ok.meta).toContain('1.5s')

    const err = summarizeRun(
      { id: 'r2', status: 'error', output: 'partial', error: 'Quota exceeded', createdAt: 'bad-date' },
      now,
      'en-US',
      t,
    )
    expect(err).toMatchObject({ id: 'r2', status: 'error', statusLabel: 'Failed', summary: 'Quota exceeded', failed: true })
    expect(err.meta).toBe('Failed')
    expect(err.meta).not.toContain('Invalid Date')

    const active = summarizeRun({ id: 'r3', status: 'running', input: 'Syncing repo' }, now, 'en-US', t)
    expect(active).toMatchObject({ id: 'r3', status: 'running', statusLabel: 'Running', summary: 'Syncing repo', failed: false })
  })
})

describe('Bots Panel Activity Recent results', () => {
  test('renders empty state inside bots.panel.results when there are no runs', () => {
    const html = renderPanel([])
    expect(html).toContain('data-parity-key="bots.panel.results"')
    expect(html).toContain('Recent results')
    expect(html).toContain('data-slot="bots-results-empty"')
    expect(html).toContain('No recent runs yet')
    expect(html).not.toContain('data-slot="bots-result-row"')
  })

  test('renders the latest 5 runs in newest-first order with status and error text', () => {
    const runs: AgentRun[] = [
      { id: 'r1', status: 'ok', output: 'Oldest run 1', createdAt: '2026-11-20T01:00:00Z' },
      { id: 'r2', status: 'ok', output: 'Oldest run 2', createdAt: '2026-11-20T02:00:00Z' },
      { id: 'r3', status: 'ok', output: 'Run 3 summary', createdAt: '2026-11-20T03:00:00Z' },
      { id: 'r4', status: 'error', error: 'Upstream 502', createdAt: '2026-11-20T04:00:00Z' },
      { id: 'r5', status: 'ok', output: 'Run 5 summary', createdAt: '2026-11-20T05:00:00Z' },
      { id: 'r6', status: 'running', input: 'Run 6 in flight', createdAt: '2026-11-20T06:00:00Z' },
      { id: 'r7', status: 'ok', output: 'Newest run 7', createdAt: '2026-11-20T07:00:00Z', durationMs: 420 },
    ]
    const html = renderPanel(runs)
    const sectionIdx = html.indexOf('data-parity-key="bots.panel.results"')
    expect(sectionIdx).toBeGreaterThanOrEqual(0)

    const slice = html.slice(sectionIdx)
    const rowIds = [...slice.matchAll(/data-run-id="([^"]+)"/g)].map((m) => m[1])
    expect(rowIds).toEqual(['r7', 'r6', 'r5', 'r4', 'r3'])
    expect(slice).not.toContain('Oldest run 1')
    expect(slice).not.toContain('Oldest run 2')
    expect(slice).toContain('Newest run 7')
    expect(slice).toContain('420ms')
    expect(slice).toContain('Upstream 502')
    expect(slice).toContain('Failed')
    expect(slice).toContain('Run 6 in flight')
    expect(slice).toContain('Running')
    expect(slice).not.toContain('data-slot="bots-results-empty"')
  })
})
