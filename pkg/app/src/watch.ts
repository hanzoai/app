// One run on the Work board, as an address: where a line about a run sends the
// reader. No React, so a spec reads it as it is.
//
// Home's Next card says "{n} failed in the past 7 days". Linked to /work alone,
// it left the reader on a board of up to a hundred runs, old failures among
// them, to find the ones it meant (hanzo-inc/app issue 202). The address names
// the newest failure instead, and Work opens it on arrival, where its steps say
// what went wrong and Steer acts on it. What writes the address and what reads
// it live here together, so the two cannot drift apart.

/** The query key Work reads a run from. */
export const KEY = 'session'

/** An id-shaped token ("sess_" + 32 hex today), and nothing that could be a path. */
const ID = /^[A-Za-z0-9_-]{1,128}$/

/** The Work board, opened on one run; the board alone for anything that is not an id. */
export const watch = (id: string): string => (ID.test(id) ? `/work?${new URLSearchParams({ [KEY]: id })}` : '/work')

/** The run an address asks Work to open, or null when it names none. */
export function asked(search: string): string | null {
  const id = new URLSearchParams(search).get(KEY)?.trim()
  return id && ID.test(id) ? id : null
}
