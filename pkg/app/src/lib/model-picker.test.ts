// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { openModelPicker } from './model-picker'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('openModelPicker', () => {
  it('presses Enter on the composer\'s model chip', () => {
    document.body.innerHTML = '<div data-slot="mind"><button data-slot="model-picker"></button></div>'
    const chip = document.querySelector('[data-slot="model-picker"]')!
    let key = ''
    chip.addEventListener('keydown', (e) => (key = (e as KeyboardEvent).key))
    expect(openModelPicker()).toBe(true)
    expect(key).toBe('Enter')
    expect(document.activeElement).toBe(chip)
  })

  it('says so when the page has no composer', () => {
    expect(openModelPicker()).toBe(false)
  })
})
