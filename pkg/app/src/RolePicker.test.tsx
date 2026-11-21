// @vitest-environment happy-dom
// The picker as a person uses it (hanzo-inc/app issue 323): a role, the skills
// recommended for it, one unticked, one click to add the rest. The kit's parts
// draw as plain elements; the tool plane, the account and the write are stubs.
import { act, createElement as h, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const { state, install } = vi.hoisted(() => ({
  install: vi.fn(async (names: readonly string[]) => names.map((n) => `skill_${n}`)),
  state: {
    prefs: new Map<string, unknown>(),
    joined: '' as string | undefined,
    role: 'owner' as string | null,
    rows: null as { name: string; description: string; activated: boolean }[] | null,
  },
}))

vi.mock('@hanzo/ui', async () => {
  const { createElement } = await import('react')
  type Part = { children?: ReactNode; render?: unknown; onClick?: () => void; [k: string]: unknown }
  const part = (p: Part) => {
    const keep: Record<string, unknown> = { onClick: p.onClick }
    for (const [k, v] of Object.entries(p)) if (k.startsWith('data-') || k.startsWith('aria-') || k === 'role' || k === 'id') keep[k] = v
    return createElement(typeof p.render === 'string' ? p.render : 'div', keep, p.children)
  }
  return {
    Button: ({ children, onClick, disabled, ...rest }: { children?: ReactNode; onClick?: () => void; disabled?: boolean; [k: string]: unknown }) =>
      createElement('button', { type: 'button', onClick, disabled, 'data-slot': rest['data-slot'] }, children),
    Checkbox: ({ checked, disabled, onCheckedChange, id, 'aria-label': label }: { checked?: boolean; disabled?: boolean; onCheckedChange?: (v: boolean) => void; id?: string; 'aria-label'?: string }) =>
      createElement('input', { type: 'checkbox', id, checked, disabled, 'aria-label': label, onChange: (e: { target: { checked: boolean } }) => onCheckedChange?.(e.target.checked) }),
    Dialog: ({ children, open }: { children?: ReactNode; open?: boolean }) => (open ? createElement('div', { 'data-slot': 'dialog' }, children) : null),
    DialogContent: part,
    DialogTitle: part,
    Text: part,
    XStack: part,
    YStack: part,
  }
})
vi.mock('lucide-react', () => ({ Check: () => null, Sparkles: () => null }))
vi.mock('@hanzo/i18n/react', () => ({
  useI18n: () => ({ t: (s: string, v?: Record<string, unknown>) => (v ? s.replace(/{(\w+)}/g, (_, k) => String(v[k] ?? '')) : s) }),
}))
vi.mock('@hanzo/iam/react', () => ({ useIam: () => ({ isAuthenticated: true, accessToken: 'token' }) }))
vi.mock('./pref', () => ({
  usePref: (key: string, initial: unknown) => [state.prefs.has(key) ? state.prefs.get(key) : initial, (v: unknown) => state.prefs.set(key, v), true],
}))
vi.mock('./tools', () => ({ useSkills: () => ({ rows: state.rows, trouble: null }) }))
vi.mock('./connect', () => ({ install }))
vi.mock('./lib/account', () => ({ useAccount: () => ({ user: state.joined === undefined ? null : { joinedDate: state.joined } }) }))
vi.mock('./lib/session', () => ({ org: () => 'acme', role: () => state.role, superAdmin: () => false }))
vi.mock('./lib/host', () => ({ app: (p: string) => `/dev/${p.replace(/^-\//, '')}` }))
vi.mock('./where', () => ({ site: (p: string) => p }))

const { RoleCard, RolePicker, detail } = await import('./RolePicker')
const { ROLE_KEY, SKIP, role } = await import('./roles')

let host: HTMLDivElement
let root: Root

const mount = async (el: ReturnType<typeof h>) => {
  await act(async () => root.render(el))
}
const press = async (slot: string, at: ParentNode = host) => {
  const el = at.querySelector<HTMLElement>(`[data-slot="${slot}"]`)
  expect(el, slot).toBeTruthy()
  await act(async () => el!.click())
}
const pick = (id: string) => host.querySelector<HTMLElement>(`[data-slot="role"][data-role="${id}"]`)
const skills = () => [...host.querySelectorAll<HTMLElement>('[data-slot="role-skill"]')].map((el) => el.dataset.skill)

beforeEach(() => {
  state.prefs.clear()
  state.joined = new Date().toISOString()
  state.role = 'owner'
  state.rows = null
  install.mockClear()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

describe('choosing a role (hanzo-inc/app issue 323)', () => {
  test('offers every role, Something else and Skip', async () => {
    await mount(h(RolePicker, {}))
    for (const id of ['director', 'marketing', 'education', 'creative', 'founder', 'developer', 'sales', 'research', 'else']) expect(pick(id), id).toBeTruthy()
    expect(host.textContent).toContain('Something else')
    expect(host.querySelector('[data-slot="role-skip"]')).toBeTruthy()
  })

  test('Skip answers for the account and closes', async () => {
    const onClose = vi.fn()
    await mount(h(RolePicker, { onClose }))
    await press('role-skip')
    expect(state.prefs.get(ROLE_KEY)).toBe(SKIP)
    expect(onClose).toHaveBeenCalledOnce()
    expect(install).not.toHaveBeenCalled()
  })

  test('a role is kept on the account and shows its recommended skills, all ticked', async () => {
    await mount(h(RolePicker, {}))
    await act(async () => pick('marketing')!.click())
    expect(state.prefs.get(ROLE_KEY)).toBe('marketing')
    expect(skills()).toEqual([...role('marketing')!.skills])
    const boxes = [...host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')]
    expect(boxes.every((b) => b.checked)).toBe(true)
    expect(host.querySelector('[data-slot="roles-add"]')?.textContent).toBe(`Add ${role('marketing')!.skills.length} skills`)
  })

  test('Something else offers the starting set', async () => {
    await mount(h(RolePicker, {}))
    await act(async () => pick('else')!.click())
    expect(skills()).toEqual([...role('else')!.skills])
  })
})

describe('adding the set in one click', () => {
  test('adds every ticked skill in one write, less the one unticked', async () => {
    await mount(h(RolePicker, {}))
    await act(async () => pick('education')!.click())
    const box = host.querySelector<HTMLInputElement>('input[aria-label="Video rooms"]')!
    await act(async () => box.click())
    expect(box.checked).toBe(false)
    const want = role('education')!.skills.filter((n) => n !== 'meet_session')
    expect(host.querySelector('[data-slot="roles-add"]')?.textContent).toBe(`Add ${want.length} skills`)
    await press('roles-add')
    expect(install).toHaveBeenCalledOnce()
    expect(install).toHaveBeenCalledWith(want)
    expect(host.querySelector('[data-slot="roles-done"]')?.textContent).toContain(`Added ${want.length} skills`)
  })

  test('leaves out what the org has on already, and what the catalogue no longer lists', async () => {
    const director = role('director')!
    state.rows = director.skills
      .filter((n) => n !== 'books_pnl')
      .map((n) => ({ name: `skill_${n}`, description: `Read ${n}: Returns it, newest first. More.`, activated: n === 'task_projects' }))
    await mount(h(RolePicker, {}))
    await act(async () => pick('director')!.click())
    expect(skills()).toEqual(director.skills.filter((n) => n !== 'books_pnl'))
    expect(host.querySelector('[data-skill="task_projects"]')?.textContent).toContain('Added')
    expect(host.querySelector('[data-skill="team_docs"]')?.textContent).toContain('Returns it, newest first')
    await press('roles-add')
    expect(install).toHaveBeenCalledWith(director.skills.filter((n) => n !== 'books_pnl' && n !== 'task_projects'))
  })

  test('a tool plane that lists none of the catalogue (its skills app away) still offers the whole set', async () => {
    state.rows = [{ name: 'skill_our-own', description: 'Ours: a skill the org wrote.', activated: true }]
    await mount(h(RolePicker, {}))
    await act(async () => pick('marketing')!.click())
    expect(skills()).toEqual([...role('marketing')!.skills])
  })

  test('a member is told only an admin can add them, and cannot press Add', async () => {
    state.role = 'member'
    await mount(h(RolePicker, {}))
    await act(async () => pick('marketing')!.click())
    expect(host.querySelector('[data-slot="roles-admin"]')).toBeTruthy()
    expect(host.querySelector<HTMLButtonElement>('[data-slot="roles-add"]')!.disabled).toBe(true)
  })

  test('a refusal is said, and nothing reads as added', async () => {
    install.mockRejectedValueOnce(Object.assign(new Error('403'), { status: 403 }))
    await mount(h(RolePicker, {}))
    await act(async () => pick('creative')!.click())
    await press('roles-add')
    expect(host.querySelector('[data-slot="roles-wrong"]')?.textContent).toContain('Only an organization admin can add skills')
    expect(host.querySelector('[data-slot="roles-done"]')).toBeNull()
  })

  test('the catalogue’s words lose their API title and keep one sentence', () => {
    expect(detail('Read marketing campaigns: Returns the org’s campaigns, newest first. Paged.')).toBe('Returns the org’s campaigns, newest first')
    expect(detail('Read graph graphql: Read the graph’s GraphQL schema..')).toBe('Read the graph’s GraphQL schema')
    expect(detail('No title here')).toBe('No title here')
  })
})

describe('the new customer’s card', () => {
  test('asks an account made in the last two weeks that has not answered', async () => {
    await mount(h(RoleCard, {}))
    expect(host.querySelector('[data-slot="role-card"]')).toBeTruthy()
    await press('role-card-choose')
    expect(host.querySelector('[data-slot="dialog"] [data-slot="roles-pick"]')).toBeTruthy()
  })

  test('Skip puts it away for good', async () => {
    await mount(h(RoleCard, {}))
    await press('role-card-skip')
    expect(state.prefs.get(ROLE_KEY)).toBe(SKIP)
    await mount(h(RoleCard, { key: 'again' }))
    expect(host.querySelector('[data-slot="role-card"]')).toBeNull()
  })

  test('asks nobody who answered, or an account older than two weeks, or one whose age is unknown', async () => {
    state.prefs.set(ROLE_KEY, 'director')
    await mount(h(RoleCard, {}))
    expect(host.querySelector('[data-slot="role-card"]')).toBeNull()

    state.prefs.clear()
    state.joined = '2025-01-01T00:00:00Z'
    await mount(h(RoleCard, { key: 'old' }))
    expect(host.querySelector('[data-slot="role-card"]')).toBeNull()

    state.joined = undefined
    await mount(h(RoleCard, { key: 'unknown' }))
    expect(host.querySelector('[data-slot="role-card"]')).toBeNull()
  })
})
