// Linked sources in a browser, against a fake api: populated and empty, desktop
// and phone width, light and dark, the range, Revoke with its confirmation, an
// error that retries, and the org admin's People tab.
//
//   pnpm exec playwright test        (screenshots land in E2E_SHOTS, default test-results/shots)
import { expect, test, type Page } from '@playwright/test'

const SHOTS = process.env.E2E_SHOTS ?? 'test-results/shots'
const DESKTOP = { width: 1280, height: 1000 }
const PHONE = { width: 390, height: 844 }

const jwt = (role: string) => {
  const b = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b({ alg: 'none' })}.${b({ name: 'zed', orgs: [{ org: 'acme', role }] })}.x`
}

const ago = (ms: number) => new Date(Date.now() - ms).toISOString()
const ahead = (ms: number) => new Date(Date.now() + ms).toISOString()

const SOURCES = [
  {
    id: 'src_mac', kind: 'desktop', name: "Zed's MacBook Pro", os: 'darwin', arch: 'arm64', version: '1.8.4', state: 'online',
    last_seen: ago(20_000), linked_at: ago(9 * 86_400_000),
    providers: [
      { provider: 'claude', instance: 'claude-1', kind: 'login', state: 'ready', plan: 'max' },
      { provider: 'anthropic', instance: 'key-1', kind: 'key', state: 'ready' },
    ],
  },
  {
    id: 'src_chrome', kind: 'browser', name: 'Chrome on Studio', os: 'Chrome 142', version: '1.8.4', state: 'offline',
    last_seen: ago(3 * 3_600_000), linked_at: ago(20 * 86_400_000),
    providers: [{ provider: 'chatgpt', instance: 'default', kind: 'login', state: 'needs_login', plan: 'plus' }],
  },
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
  source: { rows: [row('src_mac', 1_200_000, 300_000, 4_000_000, 18.4), row('src_chrome', 40_000, 9_000, 0, 0.9)], snapshots: [] },
  user: { rows: [row('alice', 900_000, 200_000, 2_000_000, 12.2), row('bob', 340_000, 109_000, 2_000_000, 7.1)], snapshots: [] },
}

function row(key: string, inputTokens: number, outputTokens: number, cacheTokens: number, costUsd: number) {
  return { key, inputTokens, outputTokens, cacheTokens, costUsd }
}

interface Fake {
  calls: { method: string; url: URL }[]
  sources: unknown[]
}

/** Signs in as `role`, and answers /v1/sources from `fake`; `fail` makes every read 500 until cleared. */
async function arrange(page: Page, role: 'member' | 'admin', fake: Fake, state: { fail: boolean }) {
  await page.addInitScript((token) => localStorage.setItem('hanzo_iam_access_token', token), jwt(role))
  await page.route('**/v1/sources**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    fake.calls.push({ method: req.method(), url })
    if (state.fail) return route.fulfill({ status: 500, body: 'no' })
    if (req.method() === 'DELETE') {
      const id = decodeURIComponent(url.pathname.split('/').pop()!)
      fake.sources = fake.sources.map((s) => ((s as { id: string }).id === id ? { ...(s as object), state: 'revoked' } : s))
      return route.fulfill({ status: 204 })
    }
    if (url.pathname === '/v1/sources/usage') {
      const by = url.searchParams.get('by')!
      const populated = fake.sources.length > 0
      return route.fulfill({ json: populated ? USAGE[by] : { rows: [], snapshots: [] } })
    }
    return route.fulfill({ json: { sources: fake.sources } })
  })
}

const fresh = (sources: unknown[] = SOURCES): Fake => ({ calls: [], sources })

for (const [label, size] of [['desktop', DESKTOP], ['phone', PHONE]] as const) {
  test.describe(label, () => {
    test.use({ viewport: size })

    test('populated: sources, routes, windows, credits, models', async ({ page }) => {
      const fake = fresh()
      await arrange(page, 'member', fake, { fail: false })
      await page.goto('/')

      const mac = page.locator('[data-slot="source"][data-id="src_mac"]')
      await expect(mac).toContainText("Zed's MacBook Pro")
      await expect(mac.locator('[data-state="online"]').first()).toBeVisible()
      await expect(mac).toContainText('online now')
      await expect(mac.locator('[data-slot="source-provider"]').filter({ hasText: 'claude' })).toContainText('On this device only')
      await expect(mac.locator('[data-slot="source-provider"]').filter({ hasText: 'anthropic' })).toContainText('API key')

      const chrome = page.locator('[data-slot="source"][data-id="src_chrome"]')
      await expect(chrome).toContainText('Browser')
      await expect(chrome).toContainText('last seen 3h ago')
      await expect(chrome.locator('[data-state="offline"]').first()).toBeVisible()

      const claude = page.locator('[data-slot="provider"][data-provider="claude"]')
      await expect(claude).toContainText('5.5M tokens')
      await expect(claude).toContainText('$18.40')
      await expect(claude.getByRole('progressbar', { name: '5-hour: 62% used' })).toBeVisible()
      await expect(claude.getByRole('progressbar', { name: 'Weekly: 93% used' })).toBeVisible()
      await expect(claude).toContainText('resets in 3d')
      await expect(claude.locator('[data-slot="credits"]')).toContainText('Balance $42.50')

      await expect(page.locator('[data-slot="model"]')).toHaveCount(3)
      await expect(page.locator('[data-slot="model"]').first()).toContainText('claude-sonnet-4-5')
      await expect(page.locator('[data-slot="sources-copy"]')).toContainText('Never your prompts, replies or code')
      // A member has no People tab.
      await expect(page.getByRole('tab', { name: 'People' })).toHaveCount(0)

      await page.screenshot({ path: `${SHOTS}/populated-${label}-light.png`, fullPage: true })
    })

    test('populated in dark', async ({ page }) => {
      await arrange(page, 'member', fresh(), { fail: false })
      await page.goto('/?theme=dark')
      await expect(page.locator('[data-slot="source"]')).toHaveCount(2)
      await page.screenshot({ path: `${SHOTS}/populated-${label}-dark.png`, fullPage: true })
    })

    test('empty: nothing linked says how to link', async ({ page }) => {
      await arrange(page, 'member', fresh([]), { fail: false })
      await page.goto('/')
      const empty = page.locator('[data-slot="sources-empty"]')
      await expect(empty).toContainText('Nothing is linked yet')
      await expect(empty).toContainText('Hanzo Dev desktop app or the Hanzo browser extension')
      await page.screenshot({ path: `${SHOTS}/empty-${label}-light.png`, fullPage: true })
    })
  })
}

test('the range asks the cloud for 7 days, then 30', async ({ page }) => {
  const fake = fresh()
  await arrange(page, 'member', fake, { fail: false })
  await page.goto('/')
  await expect(page.locator('[data-slot="provider"]').first()).toBeVisible()
  const span = (url: URL) => Math.round((Date.parse(url.searchParams.get('to')!) - Date.parse(url.searchParams.get('from')!)) / 86_400_000)
  const usage = () => fake.calls.filter((c) => c.url.pathname === '/v1/sources/usage')
  expect(new Set(usage().map((c) => span(c.url)))).toEqual(new Set([7]))
  expect(new Set(usage().map((c) => c.url.searchParams.get('by')))).toEqual(new Set(['provider', 'model', 'source']))

  await page.getByRole('tab', { name: '30 days' }).click()
  await expect(page.getByText('Usage by provider · last 30 days')).toBeVisible()
  expect(usage().some((c) => span(c.url) === 30)).toBe(true)
})

test('revoke asks first, and only a confirmed one reaches the cloud', async ({ page }) => {
  const fake = fresh()
  await arrange(page, 'member', fake, { fail: false })
  await page.goto('/')
  const mac = page.locator('[data-slot="source"][data-id="src_mac"]')

  await mac.getByRole('button', { name: "Revoke Zed's MacBook Pro" }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText("Revoke Zed's MacBook Pro?")
  await page.screenshot({ path: `${SHOTS}/revoke-confirm.png` })
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toHaveCount(0)
  expect(fake.calls.filter((c) => c.method === 'DELETE')).toHaveLength(0)

  await mac.getByRole('button', { name: "Revoke Zed's MacBook Pro" }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Revoke' }).click()
  await expect(mac).toHaveAttribute('data-state', 'revoked')
  expect(fake.calls.filter((c) => c.method === 'DELETE').map((c) => c.url.pathname)).toEqual(['/v1/sources/src_mac'])
  await expect(mac.getByRole('button', { name: /^Revoke/ })).toHaveCount(0)
})

test('an unreachable cloud says so and Try again reads again', async ({ page }) => {
  const state = { fail: true }
  await arrange(page, 'member', fresh(), state)
  await page.goto('/')
  await expect(page.locator('[data-slot="sources-error"]')).toContainText('could not read your linked sources (500)')
  await page.screenshot({ path: `${SHOTS}/error-desktop.png` })
  state.fail = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.locator('[data-slot="source"]')).toHaveCount(2)
})

test('an org admin sees per-person totals and nothing about their sources', async ({ page }) => {
  const fake = fresh()
  await arrange(page, 'admin', fake, { fail: false })
  await page.goto('/')
  await page.getByRole('tab', { name: 'People' }).click()
  const people = page.locator('[data-slot="person"]')
  await expect(people).toHaveCount(2)
  await expect(people.first()).toContainText('alice')
  await expect(people.first()).toContainText('3.1M tokens')
  await expect(people.first()).toContainText('$12.20')
  await expect(page.locator('[data-slot="sources-people"]')).toContainText('never sees another person')
  await expect(page.locator('[data-slot="source"]')).toHaveCount(0)
  expect(fake.calls.some((c) => c.url.searchParams.get('by') === 'user')).toBe(true)
  await page.screenshot({ path: `${SHOTS}/people-desktop.png`, fullPage: true })
})
