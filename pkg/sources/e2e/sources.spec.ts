// The sources view in a browser, mounted the way a host with no React mounts it,
// against a fake api: populated and empty, desktop and phone width, light and
// dark, the range, Revoke with its confirmation, an error that retries, signed
// out, and the org admin's People tab.
import { expect, test } from '@playwright/test'
import { arrange, DESKTOP, fresh, PHONE, SHOTS } from './fake'

for (const [label, size] of [['desktop', DESKTOP], ['phone', PHONE]] as const) {
  test.describe(label, () => {
    test.use({ viewport: size })

    test('populated: sources, accounts on their devices, windows, credits, totals', async ({ page }) => {
      await arrange(page, fresh())
      await page.goto('/?pick=0')

      const mac = page.locator('[data-slot="source"][data-id="src_mac"]')
      await expect(mac).toContainText("Zed's MacBook Pro")
      await expect(mac.locator('[data-state="online"]').first()).toBeVisible()
      await expect(mac).toContainText('online now')
      const chrome = page.locator('[data-slot="source"][data-id="src_chrome"]')
      await expect(chrome).toContainText('Browser')
      const studio = page.locator('[data-slot="source"][data-id="src_studio"]')
      await expect(studio).toContainText('last seen 3h ago')
      await expect(studio.locator('[data-state="offline"]').first()).toBeVisible()

      const claude = page.locator('[data-slot="account"][data-id="acc_claude"]')
      await expect(claude).toContainText("on Zed's MacBook Pro")
      await expect(claude).toContainText('max')
      await expect(claude).toContainText('ready')
      await expect(claude.getByRole('progressbar', { name: '5-hour: 62% used' })).toBeVisible()
      await expect(claude.getByRole('progressbar', { name: 'Weekly: 93% used' })).toBeVisible()
      await expect(claude).toContainText('resets in 3d')
      await expect(claude.locator('[data-slot="credits"]')).toContainText('Balance $42.50')
      await expect(claude).toContainText('Shared with my other devices')
      await expect(page.locator('[data-slot="account"][data-id="acc_gemini"]')).toContainText('On this device only')
      await expect(page.locator('[data-slot="account"][data-id="acc_key"]')).toContainText('API key in Hanzo KMS')

      await expect(page.locator('[data-slot="model"]')).toHaveCount(3)
      await expect(page.locator('[data-slot="model"]').first()).toContainText('claude-sonnet-4-5')
      await expect(page.locator('[data-slot="sources-copy"]')).toContainText('Never your prompts, replies or code')
      await expect(page.getByRole('tab', { name: 'People' })).toHaveCount(0)
      await page.screenshot({ path: `${SHOTS}/view-populated-${label}-light.png`, fullPage: true })
    })

    test('populated in dark', async ({ page }) => {
      await arrange(page, fresh())
      await page.goto('/?theme=dark')
      await expect(page.locator('[data-slot="source"]')).toHaveCount(4)
      await page.screenshot({ path: `${SHOTS}/view-populated-${label}-dark.png`, fullPage: true })
    })

    test('empty: nothing linked says how to link', async ({ page }) => {
      await arrange(page, fresh({ sources: [], accounts: [] }))
      await page.goto('/')
      const empty = page.locator('[data-slot="sources-empty"]')
      await expect(empty).toContainText('Nothing is linked yet')
      await expect(empty).toContainText('Download Hanzo Desktop')
      await expect(empty.locator('a[href="https://hanzo.ai/download"]')).toBeVisible()
      await page.screenshot({ path: `${SHOTS}/view-empty-${label}-light.png`, fullPage: true })
    })
  })
}

test('signed out: one button to https://hanzo.ai/login, and nothing is asked of the cloud', async ({ page }) => {
  const fake = fresh()
  await arrange(page, fake, '')
  await page.goto('/')
  await expect(page.locator('a[href="https://hanzo.ai/login"]')).toContainText('Sign in')
  expect(fake.calls).toHaveLength(0)
})

test('the range asks the cloud for 7 days, then 30', async ({ page }) => {
  const fake = fresh()
  await arrange(page, fake)
  await page.goto('/')
  await expect(page.locator('[data-slot="account"]').first()).toBeVisible()
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
  await arrange(page, fake)
  await page.goto('/')
  const mac = page.locator('[data-slot="source"][data-id="src_mac"]')
  await mac.getByRole('button', { name: "Revoke Zed's MacBook Pro" }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText("Revoke Zed's MacBook Pro?")
  await page.screenshot({ path: `${SHOTS}/view-revoke-confirm.png` })
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
  const fake = fresh({ fail: true })
  await arrange(page, fake)
  await page.goto('/')
  await expect(page.locator('[data-slot="sources-error"]')).toContainText('could not read your linked machines (500)')
  await page.screenshot({ path: `${SHOTS}/view-error-desktop.png` })
  fake.fail = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.locator('[data-slot="source"]')).toHaveCount(4)
})

test('an org admin sees per-person totals and nothing about their sources', async ({ page }) => {
  const fake = fresh()
  await arrange(page, fake)
  await page.goto('/?admin=1')
  await page.getByRole('tab', { name: 'People' }).click()
  const people = page.locator('[data-slot="person"]')
  await expect(people).toHaveCount(2)
  await expect(people.first()).toContainText('alice')
  await expect(people.first()).toContainText('3.1M tokens')
  await expect(people.first()).toContainText('$12.20')
  await expect(page.locator('[data-slot="sources-people"]')).toContainText('never sees another person')
  await expect(page.locator('[data-slot="source"]')).toHaveCount(0)
  expect(fake.calls.some((c) => c.url.searchParams.get('by') === 'user')).toBe(true)
  await page.screenshot({ path: `${SHOTS}/view-people-desktop.png`, fullPage: true })
})
