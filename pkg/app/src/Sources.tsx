'use client'

// Settings → Linked sources: @hanzo/sources' view, given this host's gateway, IAM
// bearer and organization. The view, its cloud client and its rules are that
// package's alone (HIP-1350, "One view, one picker, four surfaces"); nothing of
// them is kept here.

import { useMemo } from 'react'
import { administers } from '@hanzo/build'
import { createClient } from '@hanzo/sources'
import { SourcesView } from '@hanzo/sources/view'
import { api } from './lib/api'
import { bearer, org } from './lib/session'

export function Sources() {
  const client = useMemo(() => createClient({ apiBase: api(), token: bearer, org }), [])
  return <SourcesView client={client} surface="web" admin={administers(bearer(), org())} />
}
