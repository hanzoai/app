'use client'

/**
 * EMERGENCY STOP.
 *
 * One flag on the signed-in person's account (PATCH /v1/pref), so it follows
 * them to every machine and every Hanzo surface. While it is on, outbound
 * calls, texts and AI are refused on this client — nothing leaves.
 *
 * Signed out there is no account, so the flag lives in this browser only and
 * still refuses everything here.
 */

import { api } from './api'
import { scope } from './session'

const KEY = 'hanzo.cloud.emergencyStop'

/** Whether emergency stop is on right now, read from this browser's store. */
export function emergencyStopOn(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** Save the emergency stop flag to the account (signed in) or this browser (signed out). */
export async function saveEmergencyStop(on: boolean): Promise<void> {
  const auth = scope()
  if (auth.Authorization) {
    await fetch(`${api()}/v1/pref`, {
      method: 'PATCH',
      keepalive: true,
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ [KEY]: on }),
    }).catch(() => {
      /* the store below is the fallback; a signed-in reader whose network is
         down still gets stopped here */
    })
  }
  try {
    if (on) window.localStorage.setItem(KEY, '1')
    else window.localStorage.removeItem(KEY)
  } catch {
    /* no store: the guard reads nothing and refuses nothing */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('hanzo:cloud:emergency-stop', { detail: { on } }))
  }
}

/** Whether one kind of outbound is refused while emergency stop is on. */
export function refuseOutbound(kind: 'call' | 'text' | 'ai'): boolean {
  return emergencyStopOn()
}
