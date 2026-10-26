'use client'

import { useEffect, useState } from 'react'
import { api } from './lib/api'
import { scope } from './lib/session'

/**
 * A value kept on the signed-in person's account, so it follows them to every
 * machine and every Hanzo surface: GET /v1/pref reads their preference document,
 * PATCH /v1/pref merges one key into it (shallow: a key sent is replaced whole,
 * the rest are left as they are).
 *
 * Signed in, the account is the truth: a key the document holds wins, and a key
 * it does not hold is `initial`, never what this browser kept for whoever used
 * it before. This browser's copy only paints the first frame and stands in while
 * signed out. `ready` is false until the document has answered, so a surface that
 * would flash (a card the person already dismissed) can wait for it.
 */
export function usePref<T>(key: string, initial: T): [T, (v: T) => void, boolean] {
  const signed = Boolean(scope().Authorization)
  const [value, setValue] = useState<T>(() => local(key, initial))
  const [ready, setReady] = useState(!signed)

  useEffect(() => {
    if (!signed) return
    let live = true
    void held().then((doc) => {
      if (!live) return
      if (doc) {
        const next = key in doc ? (doc[key] as T) : initial
        setValue(next)
        keep(key, next)
      }
      setReady(true)
    })
    return () => {
      live = false
    }
    // `initial` is a literal at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, signed])

  const set = (v: T) => {
    setValue(v)
    keep(key, v)
    send({ [key]: v })
  }
  return [value, set, ready]
}

/** The document, read once per page and per credential, and shared by every key. */
let read: { auth: string; doc: Promise<Record<string, unknown> | null> } | null = null

function held(): Promise<Record<string, unknown> | null> {
  const auth = scope()
  if (!auth.Authorization) return Promise.resolve(null)
  if (read?.auth !== auth.Authorization) {
    read = {
      auth: auth.Authorization,
      doc: fetch(`${api()}/v1/pref`, { headers: auth })
        .then((r) => (r.ok ? (r.json() as Promise<{ prefs?: unknown }>) : null))
        .then((body) => (body && body.prefs && typeof body.prefs === 'object' ? (body.prefs as Record<string, unknown>) : body ? {} : null))
        .catch(() => null),
    }
  }
  return read.doc
}

/** One key written to the account; a signed-out page keeps it in this browser only. */
export function send(patch: Record<string, unknown>): void {
  const auth = scope()
  if (!auth.Authorization) return
  if (read?.auth === auth.Authorization) {
    const was = read.doc
    read = { auth: auth.Authorization, doc: was.then((doc) => ({ ...(doc ?? {}), ...patch })) }
  }
  void fetch(`${api()}/v1/pref`, {
    method: 'PATCH',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }).catch(() => {})
}

function local<T>(key: string, initial: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? initial : (JSON.parse(raw) as T)
  } catch {
    return initial
  }
}

function keep(key: string, v: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* the account still holds it */
  }
}
