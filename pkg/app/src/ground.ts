/**
 * One theme, Dev's: a pure black ground and flat panes split by hairline dividers, no
 * floating card, no corner, no lens (@hanzo/design `--background` is the ground in both
 * schemes). A PANE is only a fill and a hairline on its start edge, where it meets the
 * sidebar or the pane beside it. The `--pane-*` tokens are @hanzo/design's (0.5.45), flat.
 */
export const pane = (fill = 'var(--background)') =>
  ({
    backgroundColor: fill,
    borderTopWidth: 0,
    borderBottomWidth: 0,
    borderInlineEndWidth: 0,
    borderInlineStartWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--pane-edge)',
  }) as const

/**
 * A phone's head row, px: its bar and the drawer's title row are this high and
 * stand on one line, so the marks in them share a centerline.
 */
export const BAND = 52

/**
 * The head row from a tablet up, px: one rail mark high (Rail `MARK`), so the
 * rail's first mark stands at the pane's top edge and the sidebar's title row
 * and the pane's head share its centre (owner, 2026-10-30: "align sidebar icons
 * top, left, right"). A thumb's mark is 44 on a touch screen, and the rows grow
 * with it (`TOUCH_HEAD`).
 */
export const HEAD = 40
export const TOUCH_HEAD = 44

/** A mark on the rail, px: a 40px rounded square leaving `--pane-gap` (4px) on each side of the 48px rail. */
export const MARK = 40

/**
 * A corner mark's centre from its edge, px: the rail's first mark from the
 * window's start edge (the rail is twice this wide), and the pane head's last
 * mark from the pane's end edge, so the two top corners mirror each other
 * (owner, 2026-10-30: "top left / top right").
 */
export const INSET = 24

/** The rail's width, px: two insets. */
export const RAIL = 2 * INSET

/** The top bar's height, px, on every shell. */
export const BAR = 38

/** The sidebar's width before the reader pulls its edge, px. */
export const SIDE = 256

/**
 * A row INSIDE a pane shares the height of the row it lines up with.
 */
export const inPane = (row: number): number => row

/** THE FLOOR under the app's frame: the ground colour, flat. */
export const floor = {
  backgroundColor: 'var(--background)',
} as const
