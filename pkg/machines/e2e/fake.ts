// A fake /v1/machines for the browser tests: nothing reaches Hanzo.
import type { Page } from '@playwright/test'

export const SHOTS = process.env.E2E_SHOTS ?? 'test-results/shots'
export const DESKTOP = { width: 1280, height: 1000 }
export const PHONE = { width: 390, height: 844 }

const ago = (ms: number) => new Date(Date.now() - ms).toISOString()
const ahead = (ms: number) => new Date(Date.now() + ms).toISOString()
const row = (key: string, inputTokens: number, outputTokens: number, cacheTokens: number, costUsd: number) => ({ key, inputTokens, outputTokens, cacheTokens, costUsd })

export const MACHINES = [
  { id: 'src_mac', kind: 'desktop', origin: 'linked', name: "Zed's MacBook Pro", os: 'darwin', arch: 'arm64', version: '1.8.4', state: 'online', last_seen: ago(20_000), linked_at: ago(9 * 86_400_000), providers: [] },
  { id: 'src_studio', kind: 'desktop', origin: 'linked', name: 'Studio Mac', os: 'darwin', arch: 'arm64', version: '1.8.4', state: 'offline', last_seen: ago(3 * 3_600_000), linked_at: ago(12 * 86_400_000), providers: [] },
  { id: 'src_chrome', kind: 'browser', origin: 'linked', name: 'Chrome on Studio', os: 'Chrome 142', version: '1.8.4', state: 'online', last_seen: ago(40_000), linked_at: ago(20 * 86_400_000), providers: [] },
  { id: 'src_old', kind: 'desktop', origin: 'linked', name: 'Old Laptop', os: 'linux', version: '1.7.0', state: 'revoked', last_seen: ago(30 * 86_400_000), linked_at: ago(60 * 86_400_000), providers: [] },
]

export const ACCOUNTS = [
  { id: 'acc_key', provider: 'anthropic', kind: 'key', label: 'work', fingerprint: 'a1b2c3d4', created: ago(86_400_000), classes: ['key'] },
  { id: 'acc_claude', provider: 'claude', kind: 'login', classes: ['local', 'desktop'], sourceId: 'src_mac', instance: 'claude-1', state: 'ready', plan: 'max', shared: true },
  { id: 'acc_codex', provider: 'codex', kind: 'login', classes: ['local', 'desktop'], sourceId: 'src_mac', instance: 'codex-1', state: 'ready', plan: 'plus', shared: false },
  { id: 'acc_copilot', provider: 'copilot', kind: 'login', classes: ['local', 'desktop'], sourceId: 'src_studio', instance: 'copilot-1', state: 'ready', shared: true },
  { id: 'acc_gemini', provider: 'gemini', kind: 'login', classes: ['local'], sourceId: 'src_mac', instance: 'gemini-1', state: 'ready' },
  { id: 'acc_chatgpt', provider: 'chatgpt', kind: 'login', classes: ['local'], sourceId: 'src_chrome', instance: 'default', state: 'needs_login', plan: 'plus' },
  { id: 'acc_old', provider: 'cursor', kind: 'login', classes: ['local'], sourceId: 'src_old', instance: 'cursor-1', state: 'ready' },
]

const SNAPSHOTS = [
  {
    sourceId: 'src_mac', provider: 'claude', fetchedAt: ago(60_000), source: 'oauth', plan: 'max',
    windows: [
      { kind: 'session', label: '5-hour', usedPercent: 62, resetsAt: ahead(2 * 3_600_000 + 60_000) },
      { kind: 'weekly', label: 'Weekly', usedPercent: 93, resetsAt: ahead(3 * 86_400_000 + 60_000) },
    ],
    credits: { currency: 'USD', balance: 42.5, spent: 7.25 },
  },
  { sourceId: 'src_chrome', provider: 'chatgpt', fetchedAt: ago(3 * 3_600_000), source: 'local', windows: [{ kind: 'daily', label: 'Daily', usedPercent: 20 }] },
]

const USAGE: Record<string, unknown> = {
  provider: { rows: [row('claude', 1_200_000, 300_000, 4_000_000, 18.4), row('chatgpt', 40_000, 9_000, 0, 0.9)], snapshots: SNAPSHOTS },
  model: { rows: [row('claude-sonnet-4-5', 1_000_000, 250_000, 3_900_000, 15.1), row('gpt-5', 40_000, 9_000, 0, 0.9), row('claude-haiku-4-5', 200_000, 50_000, 100_000, 3.3)], snapshots: [] },
  machine: { rows: [row('src_mac', 1_200_000, 300_000, 4_000_000, 18.4), row('src_chrome', 40_000, 9_000, 0, 0.9)], snapshots: [] },
  user: { rows: [row('alice', 900_000, 200_000, 2_000_000, 12.2), row('bob', 340_000, 109_000, 2_000_000, 7.1)], snapshots: [] },
}

export interface Fake {
  calls: { method: string; url: URL }[]
  machines: unknown[]
  accounts: unknown[]
  /** Every read answers 500 while set. */
  fail: boolean
}

export const fresh = (over: Partial<Fake> = {}): Fake => ({ calls: [], machines: MACHINES, accounts: ACCOUNTS, fail: false, ...over })

/** Holds an IAM token in the page and answers /v1/machines* from `fake`. */
export async function arrange(page: Page, fake: Fake, token = 'iam-token') {
  await page.addInitScript((t) => t && localStorage.setItem('token', t), token)
  await page.route('**/v1/machines**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    fake.calls.push({ method: req.method(), url })
    if (fake.fail) return route.fulfill({ status: 500, body: 'no' })
    if (req.method() === 'DELETE') {
      const id = decodeURIComponent(url.pathname.split('/').pop()!)
      fake.machines = fake.machines.map((m) => ((m as { id: string }).id === id ? { ...(m as object), state: 'revoked' } : m))
      return route.fulfill({ status: 204 })
    }
    if (url.pathname === '/v1/machines/usage') {
      const populated = fake.machines.length > 0
      return route.fulfill({ json: populated ? USAGE[url.searchParams.get('by')!] : { rows: [], snapshots: [] } })
    }
    if (url.pathname === '/v1/machines/accounts') return route.fulfill({ json: { accounts: fake.accounts } })
    return route.fulfill({ json: { machines: fake.machines } })
  })
}

export const picks = (page: Page): Promise<unknown[]> => page.evaluate(() => (window as unknown as { __picks: unknown[] }).__picks)
