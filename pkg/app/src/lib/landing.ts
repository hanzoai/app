/** Landing in the Drive happens once: the first bucket opens on arrival, and never again after the reader has gone back to the root list. */
export function landing(done: boolean, bucket: string | null, first: string | null): { done: boolean; open: string | null } {
  if (done) return { done, open: null }
  if (bucket) return { done: true, open: null }
  if (first) return { done: true, open: first }
  return { done: false, open: null }
}
