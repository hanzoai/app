// @vitest-environment happy-dom
import { act, createElement, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, test, vi } from 'vitest'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const { makeSpy, updateGroupSpy, mockClient, part, inputPart } = vi.hoisted(() => {
  const part = ({
    children,
    render,
    onSubmit,
    onClick,
    onChange,
    value,
    placeholder,
    disabled,
    type,
    rows,
    'data-slot': slot,
    'data-parity-key': parity,
    'aria-label': ariaLabel,
  }: {
    children?: ReactNode
    render?: string
    onSubmit?: (e: FormEvent) => void
    onClick?: () => void
    onChange?: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
    value?: string
    placeholder?: string
    disabled?: boolean
    type?: string
    rows?: number
    'data-slot'?: string
    'data-parity-key'?: string
    'aria-label'?: string
  }) => {
    const tag = render === 'form' ? 'form' : render === 'button' ? 'button' : 'div'
    const attrs: Record<string, unknown> = {}
    if (onSubmit !== undefined) attrs.onSubmit = onSubmit
    if (onClick !== undefined) attrs.onClick = onClick
    if (disabled !== undefined) attrs.disabled = disabled
    if (type !== undefined) attrs.type = type
    if (slot !== undefined) attrs['data-slot'] = slot
    if (parity !== undefined) attrs['data-parity-key'] = parity
    if (ariaLabel !== undefined) attrs['aria-label'] = ariaLabel
    void onChange
    void value
    void placeholder
    void rows
    return createElement(tag, attrs, children)
  }

  const inputPart = ({
    render,
    value,
    onChange,
    placeholder,
    'aria-label': ariaLabel,
    rows,
  }: {
    render?: string
    value?: string
    onChange?: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
    placeholder?: string
    'aria-label'?: string
    rows?: number
  }) => {
    const tag = render === 'textarea' ? 'textarea' : 'input'
    return createElement(tag, { value, onChange, placeholder, 'aria-label': ariaLabel, rows })
  }

  return {
    makeSpy: vi.fn(),
    updateGroupSpy: vi.fn(async () => null),
    mockClient: { fake: true },
    part,
    inputPart,
  }
})

vi.mock('@hanzo/i18n/react', () => ({
  useI18n: () => ({
    t: (s: string, v?: Record<string, unknown>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v?.[k] ?? '')),
  }),
}))
vi.mock('@hanzo/gui', () => ({ Input: inputPart, Text: part, XStack: part, YStack: part }))
vi.mock('@hanzo/ui', () => ({
  Dialog: ({ children }: { children?: ReactNode }) => createElement('div', { 'data-slot': 'dialog' }, children),
  DialogContent: part,
  DialogTitle: part,
  DropdownMenu: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  DropdownMenuContent: part,
  DropdownMenuItem: part,
  DropdownMenuTrigger: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
}))
vi.mock('lucide-react', () => ({ ChevronDown: () => createElement('svg') }))
vi.mock('../lib/ai', () => ({ ENSO: 'enso', useAi: () => ({ client: mockClient }) }))
vi.mock('../failure', () => ({ plainly: (e: unknown) => String(e) }))
vi.mock('./api', async (actual) => {
  const real = await actual<typeof import('./api')>()
  return {
    ...real,
    make: makeSpy,
    updateGroup: updateGroupSpy,
  }
})

import { NAME } from './api'
import { Make, deriveBotName, resolveBotName } from './Make'

function setFieldValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

async function mountMake() {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const onDone = vi.fn()
  const onCancel = vi.fn()
  await act(async () => {
    root.render(createElement(Make, { onDone, onCancel }))
  })
  return {
    host,
    onDone,
    onCancel,
    unmount: async () => {
      await act(async () => root.unmount())
      host.remove()
    },
  }
}

describe('deriveBotName & resolveBotName', () => {
  test('derives lowercase hyphenated slugs matching NAME for descriptions with punctuation and uppercase', () => {
    const slug = deriveBotName('  Triage GitHub PRs, Issues & Slack @mentions! (v2)  ')
    expect(slug).toBe('triage-github-prs-issues-slack-mentions-v2')
    expect(NAME.test(slug)).toBe(true)
  })

  test('strips leading/trailing hyphens and normalizes accented Latin characters', () => {
    const slug = deriveBotName('---Café & Résumé Helper---')
    expect(slug).toBe('cafe-resume-helper')
    expect(NAME.test(slug)).toBe(true)
  })

  test('falls back to a valid NAME slug for empty, punctuation-only, or non-ASCII-only descriptions', () => {
    for (const raw of ['', '   ', '---...___', '🤖🔥🚀', '日本語のボット']) {
      const slug = deriveBotName(raw)
      expect(slug).toBe('bot')
      expect(NAME.test(slug)).toBe(true)
    }
  })

  test('enforces the 64-char max length without leaving a trailing hyphen', () => {
    const longSlug = deriveBotName(`${'alpha '.repeat(20)}omega`)
    expect(longSlug.length).toBeLessThanOrEqual(64)
    expect(longSlug.endsWith('-')).toBe(false)
    expect(NAME.test(longSlug)).toBe(true)

    const boundarySlug = deriveBotName(`${'a'.repeat(63)} bbb`)
    expect(boundarySlug).toBe('a'.repeat(63))
    expect(NAME.test(boundarySlug)).toBe(true)
  })

  test('respects manual name when provided and returns empty when both are blank', () => {
    expect(resolveBotName('  Custom_Bot.1  ', 'Triage PRs')).toBe('Custom_Bot.1')
    expect(resolveBotName('   ', 'Triage PRs')).toBe('triage-prs')
    expect(resolveBotName('   ', '   ')).toBe('')
  })
})

describe('Make bot dialog', () => {
  beforeEach(() => {
    makeSpy.mockReset()
    makeSpy.mockImplementation(async (_c: unknown, d: { name: string }) => ({ id: 'agt_1', name: d.name, model: 'enso' }))
    updateGroupSpy.mockClear()
  })

  test('disables submit when both name and description are blank', async () => {
    const { host, unmount } = await mountMake()
    const submitBtn = host.querySelector('button[type="submit"]') as HTMLButtonElement
    expect(submitBtn.disabled).toBe(true)
    await act(async () => {
      host.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(makeSpy).not.toHaveBeenCalled()
    await unmount()
  })

  test('creates a bot from job description alone using an auto-derived NAME-matching slug', async () => {
    const { host, onDone, unmount } = await mountMake()
    const doesEl = host.querySelector('textarea[aria-label="What it does"]') as HTMLTextAreaElement
    await act(async () => {
      setFieldValue(doesEl, 'Monitor Stripe invoices & notify Slack!')
    })

    const preview = host.querySelector('[data-slot="bots-make-derived-name"]')
    expect(preview?.textContent).toContain('monitor-stripe-invoices-notify-slack')

    const submitBtn = host.querySelector('button[type="submit"]') as HTMLButtonElement
    expect(submitBtn.disabled).toBe(false)

    await act(async () => {
      host.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })

    expect(makeSpy).toHaveBeenCalledTimes(1)
    expect(makeSpy.mock.calls[0]?.[1]).toMatchObject({
      name: 'monitor-stripe-invoices-notify-slack',
      instructions: 'Monitor Stripe invoices & notify Slack!',
    })
    expect(NAME.test(makeSpy.mock.calls[0]?.[1].name)).toBe(true)
    expect(onDone).toHaveBeenCalledTimes(1)
    await unmount()
  })

  test('allows non-ASCII-only description by falling back to a valid slug', async () => {
    const { host, unmount } = await mountMake()
    const doesEl = host.querySelector('textarea[aria-label="What it does"]') as HTMLTextAreaElement
    await act(async () => {
      setFieldValue(doesEl, '🤖🔥')
    })

    const submitBtn = host.querySelector('button[type="submit"]') as HTMLButtonElement
    expect(submitBtn.disabled).toBe(false)

    await act(async () => {
      host.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })

    expect(makeSpy).toHaveBeenCalledWith(mockClient, expect.objectContaining({ name: 'bot', instructions: '🤖🔥' }))
    await unmount()
  })

  test('respects manual name when provided and rejects invalid manual names', async () => {
    const { host, unmount } = await mountMake()
    const nameEl = host.querySelector('input[aria-label="Bot name"]') as HTMLInputElement
    const doesEl = host.querySelector('textarea[aria-label="What it does"]') as HTMLTextAreaElement

    await act(async () => {
      setFieldValue(nameEl, '-bad-slug')
      setFieldValue(doesEl, 'Valid description')
    })
    const submitBtn = host.querySelector('button[type="submit"]') as HTMLButtonElement
    expect(submitBtn.disabled).toBe(true)
    expect(host.textContent).toContain('Letters, digits, dot, dash and underscore')

    await act(async () => {
      setFieldValue(nameEl, 'ops-helper')
    })
    expect(submitBtn.disabled).toBe(false)

    await act(async () => {
      host.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(makeSpy).toHaveBeenCalledWith(mockClient, expect.objectContaining({ name: 'ops-helper', instructions: 'Valid description' }))
    await unmount()
  })
})
