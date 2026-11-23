// @vitest-environment happy-dom
import { createElement } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@hanzo/i18n/react', () => ({ useI18n: () => ({ t: (s: string) => s }) }))
vi.mock('@hanzo/ui', () => ({
  Button: ({ children, onClick, disabled }: any) => createElement('button', { 'data-slot': 'cloud-button', disabled, onClick }, children),
  Switch: ({ checked, onCheckedChange, 'aria-label': label }: any) => createElement('input', { type: 'checkbox', checked: checked === true, 'aria-label': label || '', onChange: () => onCheckedChange && onCheckedChange(!checked) }),
  Text: ({ children }: any) => createElement('p', null, children),
  Box: ({ children, render }: any) => createElement(render || 'div', null, children),
  XStack: ({ children }: any) => createElement('div', null, children),
  YStack: ({ children }: any) => createElement('div', null, children),
  Separator: () => createElement('hr'),
  Input: () => createElement('input'),
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
    return [store[key] ?? initial, (v: any) => { store[key] = v }, true]
  },
}))

import { CloudControlPane, emergencyStopOn, refuseOutbound, saveEmergencyStop } from './CloudControl'

describe('cloud control pane (Settings → Cloud control)', () => {
  test('renders without crashing — ShieldAlert, PhoneCall and UserCheck resolve', () => {
    const html = renderToStaticMarkup(createElement(CloudControlPane))
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
    void saveEmergencyStop(true)
    expect(refuseOutbound('call')).toBe(true)
    expect(refuseOutbound('text')).toBe(true)
    expect(refuseOutbound('ai')).toBe(true)
    void saveEmergencyStop(false)
    expect(refuseOutbound('call')).toBe(false)
    expect(refuseOutbound('text')).toBe(false)
    expect(refuseOutbound('ai')).toBe(false)
  })
})
