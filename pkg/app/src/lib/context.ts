/** How full the model's own context window is, 0-100, from the characters so far (about four to a token). A model that names no window has no meter: null. */
export function contextPercent(chars: number, window: number | undefined): number | null {
  if (!window || window <= 0) return null
  return Math.min(100, Math.round(chars / 4 / window * 100))
}
