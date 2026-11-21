'use client'

// A deep link's start of Dev work (hanzo.ai/dev/open): finds the person's runtime (devRuntime.ts:
// the host's own Dev or a linked machine; visiting a link never leases a cloud cell), mounts the Dev core on it, opens the repository there
// as a project with a new thread on it (@hanzo/dev-core `useDevOpen`), and says where that
// thread is. The host replaces its address with it; Dev's own surface then draws the thread.

import { useEffect, useState } from 'react'
import { DevProvider, useDevOpen, type DevRuntime } from '@hanzo/dev-core'
import { resolveRuntime } from './devRuntime'
import { app } from './lib/host'

/** The address of the thread `ref` (`<environment>/<thread>` or `draft/<id>`) names. */
export const threadAt = (ref: string): string => app(`thread/${ref}`)

function Start({ repo, branch, onDone, onFail }: { repo: string; branch: string; onDone: (to: string) => void; onFail: (e: Error) => void }) {
  const open = useDevOpen()
  useEffect(() => {
    open({ repo, ref: branch }).then((ref) => onDone(threadAt(ref)), (e: unknown) => onFail(e instanceof Error ? e : new Error(String(e))))
  }, [open, repo, branch, onDone, onFail])
  return null
}

export function DevOpen({
  repo,
  branch,
  onDone,
  onNone,
  onFail,
}: {
  /** Where the repository can be cloned from, e.g. `git.hanzo.ai/<org>/<name>`. */
  repo: string
  /** The branch, or '' for the default. */
  branch: string
  onDone: (to: string) => void
  /** The person has no runtime: the host says so in its own words. */
  onNone: () => void
  onFail: (e: Error) => void
}) {
  const [runtime, setRuntime] = useState<DevRuntime | null>(null)
  useEffect(() => {
    const ctl = new AbortController()
    void resolveRuntime(ctl.signal).then((r) => {
      if (ctl.signal.aborted) return
      if (r) setRuntime(r)
      else onNone()
    })
    return () => ctl.abort()
  }, [onNone])
  return runtime ? (
    <DevProvider runtime={runtime}>
      <Start repo={repo} branch={branch} onDone={onDone} onFail={onFail} />
    </DevProvider>
  ) : null
}
