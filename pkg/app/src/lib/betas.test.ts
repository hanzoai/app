import { describe, expect, it } from 'vitest'
import { BETAS, GROUPS, key, opens } from './betas'

describe('the apps in beta', () => {
  it('names each app once, by a lowercase one-word id', () => {
    const ids = BETAS.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9]*$/)
  })

  it('puts every app in a group, and every group has one', () => {
    for (const b of BETAS) expect(GROUPS).toContain(b.group)
    for (const g of GROUPS) expect(BETAS.some((b) => b.group === g)).toBe(true)
  })

  it('lists the six creative models, and the next Zen as a preview with no href', () => {
    const creative = BETAS.filter((b) => b.group === 'Creative').map((b) => b.id)
    expect(creative).toEqual(['koma', 'iro', 'mori', 'oto', 'koe', 'uta'])
    const zen = BETAS.find((b) => b.id === 'zen7')
    expect(zen).toMatchObject({ name: 'Zen 7', group: 'Models' })
    expect(zen?.href).toBeUndefined()
  })

  it('opens an app for its switch alone, and every app for a SuperAdmin', () => {
    expect(key('crm')).toBe('beta.crm')
    expect(opens('crm', {}, false)).toBe(false)
    expect(opens('crm', { 'beta.crm': true }, false)).toBe(true)
    expect(opens('erp', { 'beta.crm': true }, false)).toBe(false)
    expect(opens('crm', { beta: true }, false)).toBe(false)
    expect(opens('crm', { 'beta.crm': 'true' as unknown as boolean }, false)).toBe(false)
    expect(opens('crm', {}, true)).toBe(true)
  })

  it('opens a granted app where it lives, over https', () => {
    for (const b of BETAS) if (b.href) expect(b.href).toMatch(/^https:\/\//)
  })
})
