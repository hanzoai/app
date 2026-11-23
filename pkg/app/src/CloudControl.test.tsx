// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@hanzo/i18n/react', () => ({ useI18n: () => ({ t: (s: string) => s }) }))
vi.mock('@hanzo/ui', () => ({
  Button: ({ children, onClick, disabled }: any) => {
    const el = document.createElement('button')
    el.setAttribute('data-slot', 'cloud-button')
    if (disabled) el.setAttribute('disabled', 'true')
    el.textContent = String(children)
    if (onClick) el.addEventListener('click', onClick)
    return el
  },
  Switch: ({ checked, onCheckedChange, 'aria-label': label }: any) => {
    const el = document.createElement('input')
    el.type = 'checkbox'
    el.checked = checked === true
    el.setAttribute('aria-label', label || '')
    el.addEventListener('change', () => onCheckedChange(!checked))
    return el
  },
  Text: ({ children }: any) => {
    const el = document.createElement('p')
    el.textContent = String(children ?? '')
    return el
  },
  Box: ({ children, render }: any) => {
    const Tag = render || 'div'
    const el = document.createElement(Tag)
    el.textContent = String(children ?? '')
    return el
  },
  XStack: ({ children }: any) => {
    const el = document.createElement('div')
    el.textContent = String(children ?? '')
    return el
  },
  YStack: ({ children }: any) => {
    const el = document.createElement('div')
    el.textContent = String(children ?? '')
    return el
  },
  Separator: () => document.createElement('hr'),
  Input: () => document.createElement('input'),
}))
vi.mock('@hanzo/iam/react', () => ({ useIam: () => ({ isAuthenticated: true }) }))
vi.mock('./lib/session', () => ({
  api: () => 'https://api.test',
  bearer: () => 'token',
  org: () => 'acme',
  scope: () => ({ Authorization: 'Bearer token', 'X-Org-Id': 'acme' }),
}))
vi.mock('./pref', () => ({
  usePref: (key: string, initial: any) => {
    const store: Record<string, any> = {}
    const [value, setValue] = [store[key] ?? initial, (v: any) => { store[key] = v }]
    return [value, setValue, true]
  },
}))

import { CloudControlPane, emergencyStopOn, refuseOutbound, saveEmergencyStop } from './CloudControl'

describe('cloud control pane (Settings → Cloud control)', () => {
  test('renders without crashing — ShieldAlert, PhoneCall and UserCheck resolve', () => {
    const html = renderToStaticMarkup(CloudControlPane())
    expect(html).toContain('Cloud control')
    expect(html).toContain('Emergency stop')
    expect(html).toContain('Outbound calls')
    expect(html).toContain('Outbound texts')
    expect(html).toContain('Outbound AI')
  })

  test('saving emergency stop persists and the guard reads it', async () => {
    expect(emergencyStopOn()).toBe(false)
    await saveEmergencyStop(true)
    expect(emergencyStopOn()).toBe(true)
    await saveEmergencyStop(false)
    expect(emergencyStopOn()).toBe(false)
  })

  test('with emergency stop on, outbound calls, texts and AI are refused', () => {
    saveEmergencyStop(true)
    expect(refuseOutbound('call')).toBe(true)
    expect(refuseOutbound('text')).toBe(true)
    expect(refuseOutbound('ai')).toBe(true)
    saveEmergencyStop(false)
    expect(refuseOutbound('call')).toBe(false)
    expect(refuseOutbound('text')).toBe(false)
    expect(refuseOutbound('ai')).toBe(false)
  })
})
