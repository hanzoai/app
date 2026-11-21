import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const THREAD = readFileSync(new URL('./Thread.tsx', import.meta.url), 'utf8')

// A bot's refusal (an empty balance, a reached limit) is answered by its own notice. The
// composer also restores a message that was not delivered and offers "Try again" with
// "Could not reach this conversation", which was drawn beside the refusal and said the
// opposite of it: the bot was reached, and refused.
describe('a refused message', () => {
  it('shows its notice and not the could-not-reach line beside it', () => {
    expect(THREAD).toContain('{unsent && !notice ? (')
  })

  it('leaves no could-not-reach line behind when the notice is dismissed', () => {
    expect(THREAD).toMatch(/onClick=\{\(\) => \{ setUnsent\(null\); onDismiss\(\) \}\}/)
  })
})
