// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { mount, type Mounted } from '../vitest.real'
import { Prose } from './Prose'

let mounted: Mounted | null = null

afterEach(async () => {
  if (mounted) {
    await mounted.done()
    mounted = null
  }
})

async function renderProse(text: string): Promise<HTMLElement> {
  mounted = await mount()
  await mounted.draw(<Prose text={text} />)
  return mounted.box
}

describe('Prose responsive overflow & citation preservation', () => {
  it('wraps markdown tables in a dedicated horizontal scroll container', async () => {
    const md = [
      '| Column A | Column B | Column C | Column D |',
      '| --- | --- | --- | --- |',
      '| alpha_very_long_identifier_value | beta_very_long_identifier_value | gamma_value | delta_value |',
    ].join('\n')
    const container = await renderProse(md)
    const tableScroll = container.querySelector('[data-slot="prose-table-scroll"]')
    expect(tableScroll).not.toBeNull()
    expect(tableScroll?.textContent).toContain('Column A')
    expect(tableScroll?.textContent).toContain('alpha_very_long_identifier_value')
  })

  it('wraps fenced code blocks in a contained scroll wrapper', async () => {
    const md = '```ts\nconst veryLongLine = "' + 'x'.repeat(180) + '"\n```'
    const container = await renderProse(md)
    const codeWrap = container.querySelector('[data-slot="prose-code-scroll"]')
    expect(codeWrap).not.toBeNull()
    expect(codeWrap?.textContent).toContain('veryLongLine')
  })

  it('renders display math blocks inside a dedicated horizontal scroll container', async () => {
    const md = 'Here is the integral:\n\n$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$\n\nDone.'
    const container = await renderProse(md)
    const mathBlock = container.querySelector('[data-slot="prose-math"]')
    expect(mathBlock).not.toBeNull()
    expect(mathBlock?.textContent).toContain('\\int_{-\\infty}^{\\infty}')
  })

  it('opens external citations in a new tab to preserve reading position', async () => {
    const md = 'See [Hanzo Docs](https://docs.hanzo.ai/reference/very-long-url-segment-without-spaces-for-320px-viewport).'
    const container = await renderProse(md)
    const anchor = container.querySelector('a')
    expect(anchor).not.toBeNull()
    expect(anchor?.getAttribute('href')).toBe('https://docs.hanzo.ai/reference/very-long-url-segment-without-spaces-for-320px-viewport')
    expect(anchor?.getAttribute('target')).toBe('_blank')
    expect(anchor?.getAttribute('rel')).toContain('noopener')
    expect(anchor?.getAttribute('rel')).toContain('noreferrer')
  })
})
