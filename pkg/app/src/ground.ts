/**
 * The ground the workspace's cards stand on, and how each card is cut.
 *
 * A PANE is a card floating on the ground, cut by the `--pane-*` tokens
 * (@hanzo/design elevation.css): a corner, an edge, the lens behind it, and the
 * first paper rung's lit edge and drop — the second's 15px drop and the floor's
 * strong glass read as a gradient through a translucent pane, so both stay one
 * rung down. The fill is the caller's rung: `--pane-fill`
 * in the app's frame, `sheet(1)`/`sheet(2)` where a pane lies in the shell.
 *
 * The drop is a prop and not `sheet(2)`'s `elevation-2` class, whose shadow is
 * `!important`: a Dev run's pane steps aside for the two panes inside it by
 * slot (@hanzo/build's `run-split`), and an important shadow would stay behind.
 */
export const pane = (fill = 'var(--pane-fill)') =>
  ({
    backgroundColor: fill,
    borderRadius: 'var(--pane-round)',
    backdropFilter: 'var(--pane-blur)',
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

/**
 * A corner mark's centre from its edge, px: the rail's first mark from the
 * window's start edge (the rail is twice this wide), and the pane head's last
 * mark from the pane's end edge, so the two top corners mirror each other
 * (owner, 2026-10-30: "top left / top right").
 */
export const INSET = 28

/** The sidebar's width before the reader pulls its edge, px. */
export const SIDE = 280

/**
 * A row INSIDE a pane shares the height of the row it lines up with.
 */
export const inPane = (row: number): number => row

/**
 * THE FLOOR under the app's frame (app/_web.tsx, components/settings/Frame.tsx):
 * the ground colour with `--pane-ground`, the host's soft radial light, on it.
 */
export const floor = {
  backgroundColor: 'var(--pane-floor)',
  backgroundImage: 'var(--pane-ground)',
} as const
