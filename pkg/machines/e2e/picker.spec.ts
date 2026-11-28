// The account picker against the availability table, in a browser: usable,
// greyed with its reason, offline, not shared, browser account, revoked; on the
// web surface, the extension and the desktop; desktop and phone width.
import { expect, test } from '@playwright/test'
import { arrange, DESKTOP, fresh, PHONE, picks, SHOTS } from './fake'

const row = (page: import('@playwright/test').Page, id: string) => page.locator(`[data-slot="account"][data-id="${id}"]`)

for (const [label, size] of [['desktop', DESKTOP], ['phone', PHONE]] as const) {
  test.describe(`picker on the web, ${label}`, () => {
    test.use({ viewport: size })

    test('every row of the table: usable, or greyed with its reason', async ({ page }) => {
      await arrange(page, fresh())
      await page.goto('/?mode=picker&surface=web')
      await expect(row(page, 'cell')).toHaveAttribute('data-usable', 'true')

      // key: usable
      await expect(row(page, 'acc_key')).toHaveAttribute('data-usable', 'true')
      // login, desktop class, shared, online: Run on <device>
      const claude = row(page, 'acc_claude')
      await expect(claude).toHaveAttribute('data-usable', 'true')
      await expect(claude.getByRole('button', { name: "Run on Zed's MacBook Pro" })).toBeVisible()
      // not shared
      await expect(row(page, 'acc_codex')).toHaveAttribute('data-usable', 'false')
      await expect(row(page, 'acc_codex').locator('[data-slot="reason"]')).toHaveText("Turn on Share on Zed's MacBook Pro")
      // offline
      await expect(row(page, 'acc_copilot').locator('[data-slot="reason"]')).toHaveText('Studio Mac is offline')
      // only local
      await expect(row(page, 'acc_gemini').locator('[data-slot="reason"]')).toHaveText("Stays on Zed's MacBook Pro: its terms do not allow remote use")
      // browser account
      await expect(row(page, 'acc_chatgpt').locator('[data-slot="reason"]')).toHaveText('Browser accounts are view-only')
      // revoked source
      await expect(row(page, 'acc_old').locator('[data-slot="reason"]')).toHaveText('Old Laptop was unlinked')

      // greyed rows offer nothing to press; usable ones sort first
      for (const id of ['acc_codex', 'acc_copilot', 'acc_gemini', 'acc_chatgpt', 'acc_old']) await expect(row(page, id).getByRole('button')).toHaveCount(0)
      const order = await page.locator('[data-slot="account"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-usable')))
      expect(order).toEqual([...order].sort().reverse())
      await expect(row(page, 'acc_claude')).toContainText("on Zed's MacBook Pro")
      await page.screenshot({ path: `${SHOTS}/picker-web-${label}.png`, fullPage: true })
    })

    test('pressing a usable row returns the account and its route', async ({ page }) => {
      await arrange(page, fresh())
      await page.goto('/?mode=picker&surface=web')
      await row(page, 'acc_claude').getByRole('button').click()
      await row(page, 'acc_key').getByRole('button').click()
      await row(page, 'cell').getByRole('button').click()
      expect(await picks(page)).toEqual([
        { via: 'desktop', account: 'acc_claude', choice: { via: 'desktop', source: 'src_mac', instance: 'claude-1' } },
        { via: 'key', account: 'acc_key', choice: { via: 'key', account: 'acc_key' } },
        { via: 'cell', account: null, choice: { via: 'cell' } },
      ])
    })
  })
}

test.describe('picker on the extension', () => {
  test.use({ viewport: PHONE })
  test('a key is greyed and says where it runs; nothing offers a desktop route', async ({ page }) => {
    await arrange(page, fresh())
    await page.goto('/?mode=picker&surface=extension&device=src_chrome')
    await expect(row(page, 'acc_key')).toHaveAttribute('data-usable', 'false')
    await expect(row(page, 'acc_key').locator('[data-slot="reason"]')).toHaveText('Runs from Hanzo Dev or hanzo.app')
    await expect(row(page, 'acc_claude').locator('[data-slot="reason"]')).toHaveText('Runs from Hanzo Dev or hanzo.app')
    await expect(row(page, 'acc_chatgpt').locator('[data-slot="reason"]')).toHaveText('Browser accounts are view-only')
    await page.screenshot({ path: `${SHOTS}/picker-extension-phone.png`, fullPage: true })
  })
})

test.describe('picker on the desktop', () => {
  test.use({ viewport: DESKTOP })
  test('a login on this very device is usable here and returns no route', async ({ page }) => {
    await arrange(page, fresh())
    await page.goto('/?mode=picker&surface=desktop&device=src_mac')
    const gemini = row(page, 'acc_gemini')
    await expect(gemini).toHaveAttribute('data-usable', 'true')
    await gemini.getByRole('button', { name: 'Use here' }).click()
    expect(await picks(page)).toEqual([{ via: 'local', account: 'acc_gemini', choice: null }])
    await page.screenshot({ path: `${SHOTS}/picker-desktop-desktop.png`, fullPage: true })
  })
})

test('a person with no accounts still has the Hanzo cell', async ({ page }) => {
  await arrange(page, fresh({ machines: [], accounts: [] }))
  await page.goto('/?mode=picker&surface=web')
  await expect(row(page, 'cell')).toBeVisible()
  await expect(page.getByText('No provider accounts yet')).toBeVisible()
})
