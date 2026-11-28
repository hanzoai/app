'use client'

// Settings → Linked machines: @hanzo/machines' view, given this host's gateway,
// IAM bearer and organization.

import { useMemo } from 'react'
import { administers } from '@hanzo/dev/builder'
import { createClient } from '@hanzo/machines'
import { MachinesView } from '@hanzo/machines/view'
import { api } from './lib/api'
import { bearer, org } from './lib/session'

export function Machines() {
  const client = useMemo(() => createClient({ apiBase: api(), token: bearer, org }), [])
  return <MachinesView client={client} surface="web" admin={administers(bearer(), org())} />
}
