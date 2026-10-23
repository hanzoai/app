import { describe, expect, test } from 'vitest'
import { axis, FLICK, OPEN, pull, REACH, settle, sign, SLOP, STRIP } from './slide'

describe('the slide', () => {
  test('goes toward the end side: right where the line runs left to right, left under rtl', () => {
    expect(sign('ltr')).toBe(1)
    expect(sign('rtl')).toBe(-1)
    // Anything that is not rtl is a left-to-right line.
    expect(sign('')).toBe(1)
  })

  test('leaves a thumb of the pane in sight, and the menu stays a menu on a wide window', () => {
    expect(STRIP).toBeGreaterThanOrEqual(44)
    expect(OPEN).toBe(`min(100% - ${STRIP}px, ${REACH}px)`)
  })
})

describe('a finger', () => {
  test('is nothing until it moves past the slop', () => {
    expect(axis(SLOP - 1, SLOP - 1)).toBeNull()
  })

  test('along the line is a pull; down the menu, or on a slant, is a scroll', () => {
    expect(axis(-20, 4)).toBe('x')
    expect(axis(20, -4)).toBe('x')
    expect(axis(4, 20)).toBe('y')
    expect(axis(20, 18)).toBe('y')
  })

  test('pulls the pane home the same way in both directions: toward the start', () => {
    // Open at 300px from home. Left in LTR is toward the start; right is, under rtl.
    expect(pull(300, -100, 1, 300)).toBe(200)
    expect(pull(300, 100, -1, 300)).toBe(200)
    // Toward the end it is already as open as it goes; past home it stops at home.
    expect(pull(300, 80, 1, 300)).toBe(300)
    expect(pull(300, -80, -1, 300)).toBe(300)
    expect(pull(300, -900, 1, 300)).toBe(0)
    expect(pull(300, 900, -1, 300)).toBe(0)
  })

  test('let go, it stays open past half way, unless a flick says otherwise', () => {
    expect(settle(200, 300, 0)).toBe(true)
    expect(settle(100, 300, 0)).toBe(false)
    expect(settle(250, 300, -FLICK)).toBe(false)
    expect(settle(50, 300, FLICK)).toBe(true)
  })
})
