// Devices and shells by the names a person reads, in Tabs and the sidebar (hanzo-inc/app issue 311).
import { describe, expect, test } from 'vitest'
import { showDevice, showShell } from './devices'

describe('a device by the name a person reads', () => {
  test('a Mac is its computer name, never its hostname with the chip and GPU', () => {
    const mac = showDevice({ machine: 'Alexs-MacBook-Pro.local', hardware: '12 vCPU / 32G / 1× Apple M2' }, {}, false)
    expect(mac.title).toBe("Alex's MacBook Pro")
    expect(mac.title).not.toMatch(/\.local|vCPU|M2/)
    // The details stay, beneath.
    expect(mac.detail).toContain('Alexs-MacBook-Pro.local')
    expect(mac.detail).toContain('Apple M2')
    expect(mac.key).toBe('alexs-macbook-pro')
  })

  test('a developer sees the hostname; a name the person gave wins for everyone', () => {
    expect(showDevice({ machine: 'Alexs-MacBook-Pro.local' }, {}, true).title).toBe('Alexs-MacBook-Pro.local')
    const names = { 'alexs-macbook-pro': 'Studio laptop' }
    expect(showDevice({ machine: 'Alexs-MacBook-Pro.local' }, names, false).title).toBe('Studio laptop')
    expect(showDevice({ machine: 'Alexs-MacBook-Pro.local' }, names, true).title).toBe('Studio laptop')
  })

  test('a cloud workspace is named plainly, its project beneath, and can be renamed', () => {
    const cloud = showDevice({ machine: 'my-site', sandbox: true }, {}, false)
    expect(cloud.title).toBe('Cloud workspace')
    expect(cloud.detail).toContain('my-site')
    expect(showDevice({ machine: 'my-site', sandbox: true }, { 'my-site': 'Site box' }, false).title).toBe('Site box')
  })

  test('a shell is its machine and its own name, or the name the person gave it', () => {
    const mac = showDevice({ machine: 'Alexs-MacBook-Pro.local' }, {}, false)
    expect(showShell(mac, 'Alexs-MacBook-Pro.local', 'main', {})).toMatchObject({ title: "Alex's MacBook Pro · main", key: 'alexs-macbook-pro/main' })
    expect(showShell(mac, 'Alexs-MacBook-Pro.local', 'main', { 'alexs-macbook-pro/main': 'Deploys' }).title).toBe('Deploys')
    expect(showShell(mac, 'Alexs-MacBook-Pro.local', undefined, {})).toBe(mac)
  })
})
