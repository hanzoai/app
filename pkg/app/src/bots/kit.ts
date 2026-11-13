// The controls the Bots app is drawn from, as gui props, stated once and spread
// where they are drawn.

import { DIM, INK, LINE, PICKED, RAISED } from './ink'

/** A round icon control, 34px: the roster's search and new, Share, Preferences, Close. */
export const ROUND = {
  render: 'button',
  type: 'button',
  width: 34,
  height: 34,
  shrink: 0,
  rounded: 999,
  bg: RAISED,
  borderWidth: 1,
  borderColor: LINE,
  items: 'center',
  justify: 'center',
  cursor: 'pointer',
  p: 0,
  hoverStyle: { bg: PICKED },
  focusVisibleStyle: { outlineWidth: 2, outlineStyle: 'solid', outlineColor: '$outlineColor' },
} as const

/** A pill: the open bot in the bar, a notice's ways past. */
export const PILL = {
  render: 'button',
  type: 'button',
  display: 'flex',
  items: 'center',
  gap: 8,
  height: 36,
  px: 13,
  rounded: 999,
  bg: RAISED,
  borderWidth: 1,
  borderColor: LINE,
  cursor: 'pointer',
  shrink: 0,
  hoverStyle: { bg: PICKED },
  focusVisibleStyle: { outlineWidth: 2, outlineStyle: 'solid', outlineColor: '$outlineColor' },
} as const

/** A pill's words. */
export const WORD = { fontSize: 14, lineHeight: 19, fontWeight: '500', color: INK, numberOfLines: 1 } as const

/** A section's heading in the panel. */
export const LABEL = { render: 'h3', fontSize: 13, lineHeight: 18, fontWeight: '400', color: DIM, m: 0 } as const

/** A card in the panel. */
export const CARD = { bg: RAISED, borderWidth: 1, borderColor: LINE, rounded: 14 } as const

/** One line, cut with an ellipsis where it runs out of space. */
export const CLIP = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as const
