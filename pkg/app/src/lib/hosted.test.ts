import { describe, expect, it } from 'vitest'
import { BETAS, opens } from './betas'
import { hosted, HOSTED, page, place } from './host'
import { frameUrl, HOSTED_APPS, hostedApp, origin, pathOn } from './hosted'

const crm = hostedApp('crm')!

describe('the apps that draw inside the app', () => {
  it('are the apps in beta that name an embed, once, in their own order', () => {
    expect(HOSTED_APPS.map((a) => a.id)).toEqual(['crm', 'commerce', 'cms', 'analytics', 'insights'])
    for (const a of HOSTED_APPS) {
      const beta = BETAS.find((b) => b.id === a.id)!
      expect(a).toMatchObject({ name: beta.name, href: beta.href, flag: `beta.${a.id}`, embed: 'frame' })
      expect(a.host).toBe(new URL(beta.href!).host)
      expect(typeof a.icon).toBe('object')
    }
  })

  it('live on the hosts they stand alone on', () => {
    expect(Object.fromEntries(HOSTED_APPS.map((a) => [a.id, a.host]))).toEqual({
      crm: 'crm.hanzo.ai',
      commerce: 'commerce-admin.hanzo.ai',
      cms: 'cms.hanzo.ai',
      analytics: 'analytics.hanzo.ai',
      insights: 'insights.hanzo.ai',
    })
  })

  it('open by the one predicate: the switch, or a SuperAdmin', () => {
    for (const a of HOSTED_APPS) {
      expect(opens(a.id, {}, false)).toBe(false)
      expect(opens(a.id, { [a.flag]: true }, false)).toBe(true)
      expect(opens(a.id, {}, true)).toBe(true)
    }
    expect(opens('commerce', { 'beta.crm': true }, false)).toBe(false)
  })
})

describe('the frame an app is drawn in', () => {
  it('is its own live host with embed=1, and no other host', () => {
    for (const a of HOSTED_APPS) {
      const u = new URL(frameUrl(a))
      expect(u.origin).toBe(origin(a))
      expect(u.searchParams.get('embed')).toBe('1')
    }
    expect(frameUrl(crm)).toBe('https://crm.hanzo.ai/?embed=1')
    expect(frameUrl(hostedApp('commerce')!)).toBe('https://commerce-admin.hanzo.ai/admin/?embed=1')
  })

  it('opens on the page the address names, when it is a path on the same host', () => {
    expect(frameUrl(crm, '/companies?x=1')).toBe('https://crm.hanzo.ai/companies?x=1&embed=1')
    expect(frameUrl(crm, '//evil.example/x')).toBe('https://crm.hanzo.ai/?embed=1')
    expect(frameUrl(crm, 'https://evil.example/')).toBe('https://crm.hanzo.ai/?embed=1')
    expect(frameUrl(crm, null)).toBe('https://crm.hanzo.ai/?embed=1')
  })

  it('reads where the frame says it is, on its own host only, without the embed flag', () => {
    expect(pathOn(crm, 'https://crm.hanzo.ai/people?embed=1&q=a')).toBe('/people?q=a')
    expect(pathOn(crm, '/deals')).toBe('/deals')
    expect(pathOn(crm, 'https://evil.example/people')).toBeNull()
    expect(pathOn(crm, 'https://crm.hanzo.ai.evil.example/')).toBeNull()
  })
})

describe('the address of a hosted app', () => {
  it('is /apps/<id>, with the page inside it after', () => {
    expect(HOSTED).toBe('/apps')
    expect(hosted('crm')).toBe('/apps/crm')
    expect(hosted('crm', '/companies?q=a b')).toBe('/apps/crm?at=%2Fcompanies%3Fq%3Da%20b')
  })

  it('is a place of the app for an app that draws inside it, and no other', () => {
    expect(place('/apps/crm')).toEqual({ mode: 'hosted', id: 'crm' })
    expect(place('/apps/crm/')).toEqual({ mode: 'hosted', id: 'crm' })
    expect(place('/apps/erp')).toBeNull()
    expect(place('/apps/nothing')).toBeNull()
    expect(place('/apps')).toBeNull()
    expect(place('/apps/crm/deep')).toBeNull()
  })

  it('counts as one page in analytics, whichever app', () => {
    expect(page('/apps/crm')).toBe('/apps/:id')
    expect(page('/apps/cms')).toBe('/apps/:id')
  })
})
