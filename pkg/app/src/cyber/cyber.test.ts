import { describe, expect, test } from 'vitest'
import { CYBER_TABS, cyberPath, parseCyberTab, severityOrder } from './types'

describe('cyber routes and helpers', () => {
  test('parses /cyber and every subtab cleanly', () => {
    expect(parseCyberTab('/cyber')).toBe('overview')
    expect(parseCyberTab('/cyber/')).toBe('overview')
    for (const tab of CYBER_TABS) {
      expect(parseCyberTab(cyberPath(tab))).toBe(tab)
    }
    expect(parseCyberTab('/cyber', '?tab=approvals')).toBe('approvals')
    expect(parseCyberTab('/cyber/unknown')).toBe('overview')
  })

  test('orders severities monotonically from critical to info', () => {
    expect(severityOrder('critical')).toBeGreaterThan(severityOrder('high'))
    expect(severityOrder('high')).toBeGreaterThan(severityOrder('medium'))
    expect(severityOrder('medium')).toBeGreaterThan(severityOrder('low'))
    expect(severityOrder('low')).toBeGreaterThan(severityOrder('info'))
  })
})
