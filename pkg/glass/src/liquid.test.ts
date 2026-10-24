import { describe, expect, it } from 'vitest'
import { getDisplacementMap, getDisplacementFilter, liquidGlass, IOS_WIDGET_GLASS } from './liquid'

describe('liquid glass engine', () => {
  it('generates valid svg displacement map data uri', () => {
    const uri = getDisplacementMap({ width: 200, height: 100, radius: 20, depth: 8 })
    expect(uri.startsWith('data:image/svg+xml;utf8,')).toBe(true)
    expect(decodeURIComponent(uri)).toContain('<svg height="100" width="200"')
    expect(decodeURIComponent(uri)).toContain('linearGradient id="Y"')
    expect(decodeURIComponent(uri)).toContain('linearGradient id="X"')
  })

  it('generates valid svg displacement filter data uri with chromatic aberration', () => {
    const filter = getDisplacementFilter({
      width: 240,
      height: 48,
      radius: 24,
      depth: 6,
      strength: 80,
      chromaticAberration: 5,
    })
    expect(filter.startsWith('data:image/svg+xml;utf8,')).toBe(true)
    expect(filter.endsWith('#displace')).toBe(true)
    const decoded = decodeURIComponent(filter)
    expect(decoded).toContain('<filter id="displace"')
    expect(decoded).toContain('scale="90"') // 80 + 5*2
    expect(decoded).toContain('result="displacedR"')
    expect(decoded).toContain('result="displacedG"')
    expect(decoded).toContain('result="displacedB"')
  })

  it('produces expected ios widget glass styles', () => {
    expect(IOS_WIDGET_GLASS.borderRadius).toBe(9999)
    expect(IOS_WIDGET_GLASS.backdropFilter).toContain('blur(24px)')
    expect(IOS_WIDGET_GLASS.backdropFilter).toContain('saturate(190%)')
    expect(IOS_WIDGET_GLASS.boxShadow).toContain('inset 0 1px 1px')
  })

  it('customizes liquidGlass properties cleanly', () => {
    const custom = liquidGlass({
      fill: 'rgba(0,0,0,0.5)',
      radius: 16,
      blur: 30,
      saturate: 200,
    })
    expect(custom.borderRadius).toBe(16)
    expect(custom.backgroundColor).toBe('rgba(0,0,0,0.5)')
    expect(custom.backdropFilter).toBe('blur(30px) saturate(200%) contrast(102%)')
  })
})
