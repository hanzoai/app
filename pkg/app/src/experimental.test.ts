// @vitest-environment happy-dom
import { createElement, type ReactNode } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, test, vi } from 'vitest'

const state = vi.hoisted(() => ({
  iam: { isAuthenticated: true },
  held: { on: false, blocked: false, public: [] as string[] },
  opt: vi.fn(),
}))

// The drawing libraries are not under test: each element draws its children and its
// data-* marks; the switch is a button that says whether it is on and whether it is held.
const draw = ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) =>
  createElement('div', Object.fromEntries(Object.entries(props).filter(([k]) => k.startsWith('data-'))), children)
vi.mock('@hanzo/ui', () => ({
  Text: draw,
  XStack: draw,
  YStack: draw,
  Switch: ({ checked, disabled, onCheckedChange, 'aria-label': label }: { checked: boolean; disabled: boolean; onCheckedChange: (on: boolean) => void; 'aria-label': string }) =>
    createElement('button', { role: 'switch', 'aria-checked': String(checked), 'aria-label': label, disabled, onClick: () => onCheckedChange(!checked) }),
}))
vi.mock('@hanzo/iam/react', () => ({ useIam: () => state.iam }))
vi.mock('./lib/optin', () => ({ optin: async () => state.held, opt: (on: boolean) => state.opt(on) }))

async function draws() {
  const { Experimental } = await import('./experimental')
  const at = document.createElement('div')
  document.body.append(at)
  const root = createRoot(at)
  await act(async () => root.render(createElement(Experimental)))
  await act(async () => new Promise((r) => setTimeout(r, 0)))
  return { at, done: async () => (await act(async () => root.unmount()), at.remove()) }
}

const flip = (at: HTMLElement) => at.querySelector<HTMLButtonElement>('[role="switch"]')

afterEach(() => {
  state.iam = { isAuthenticated: true }
  state.held = { on: false, blocked: false, public: [] }
  state.opt.mockReset()
})

describe('the experimental opt-in switch', () => {
  test('says exactly what it does, and turning it on opts the reader in', async () => {
    state.opt.mockResolvedValue({ on: true, blocked: false, public: ['koma'] })
    const { at, done } = await draws()
    expect(at.textContent).toContain('Automatically opt-in for future experimental features')
    expect(at.textContent).toContain('Automatically opt into new experimental features, unless disabled by your team or organization')
    const s = flip(at)!
    expect(s.getAttribute('aria-checked')).toBe('false')
    expect(s.disabled).toBe(false)
    await act(async () => s.click())
    expect(state.opt).toHaveBeenCalledWith(true)
    expect(flip(at)!.getAttribute('aria-checked')).toBe('true')
    await done()
  })

  test('held off with a note when the team or organization turned it off', async () => {
    state.held = { on: true, blocked: true, public: [] }
    const { at, done } = await draws()
    const s = flip(at)!
    expect(s.disabled).toBe(true)
    expect(s.getAttribute('aria-checked')).toBe('false')
    expect(at.querySelector('[data-slot="optin-blocked"]')?.textContent).toBe('Turned off by your team or organization.')
    await done()
  })

  test('a refused change is said in words, and the switch stays as it was', async () => {
    state.opt.mockRejectedValue(new Error('Your team or organization has turned experimental features off.'))
    const { at, done } = await draws()
    await act(async () => flip(at)!.click())
    expect(at.textContent).toContain('Your team or organization has turned experimental features off.')
    expect(flip(at)!.getAttribute('aria-checked')).toBe('false')
    await done()
  })

  test('signed out, there is nothing to choose and nothing is drawn', async () => {
    state.iam = { isAuthenticated: false }
    const { at, done } = await draws()
    expect(at.innerHTML).toBe('')
    await done()
  })
})
