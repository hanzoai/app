import { describe, expect, test } from 'vitest'
import { planRequired } from './failure'

const refused = (status: number, code: string, upgrade_url = 'https://hanzo.ai/pay') =>
  Object.assign(new Error('refused'), { status, body: { error: { code, upgrade_url } } })

describe('planRequired', () => {
  test('a Free day spent is lifted by a plan, as the gateway answers it now (429) and before (402)', () => {
    expect(planRequired(refused(429, 'allowance_spent'))).toEqual({ href: 'https://hanzo.ai/pay' })
    expect(planRequired(refused(402, 'allowance_spent'))).toEqual({ href: 'https://hanzo.ai/pay' })
  })
  test('a model the plan lacks is lifted; an address off hanzo.ai is not kept', () => {
    expect(planRequired(refused(402, 'plan_required', 'https://evil.example/pay'))).toEqual({ href: undefined })
  })
  test('anything else is not a plan’s to lift', () => {
    expect(planRequired(refused(429, 'rate_limited'))).toBeNull()
    expect(planRequired(refused(429, 'plan_required'))).toBeNull()
  })
})
