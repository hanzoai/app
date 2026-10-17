'use client'

// The plan at the head of the account menu (Account.tsx): @hanzo/build's
// `Meter` over the organization's standing, read when the menu opens. Its own
// module so the menu's foot row costs a room's first screen nothing: it loads
// with the menu.

import { useMemo } from 'react'
import { Meter, useStanding } from '@hanzo/build'
import { api } from './lib/api'
import { bearer, org } from './lib/session'

export function Standing({ onPlans, onBilling }: { onPlans: () => void; onBilling: () => void }) {
  const scoped = org()
  const target = useMemo(() => ({ api: api(), token: bearer, org: scoped }), [scoped])
  const plan = useStanding(target, true)
  return <Meter read={plan} onPlans={onPlans} onBilling={onBilling} />
}
