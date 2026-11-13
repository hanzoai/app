// The ramp the Bots app is drawn in.
//
// Greyscale, aligned to the shared Hanzo deep-black product family (--side-fill
// on the roster column, --pane-fill on the thread and inspector surfaces).

/** The roster's ground: matches hanzo.app and hanzo.team sidebar surface. */
export const FLOOR = 'var(--side-fill, var(--background))'
/** The thread's and the panel's ground: matches hanzo.app and hanzo.team main canvas. */
export const GROUND = 'var(--pane-fill, var(--card))'
/** What stands on the ground: the pills, the cards, the composer, a bot's message. */
export const RAISED = 'var(--surface-card-emphasis)'
/** The bot that is open, in the roster. */
export const PICKED = 'var(--secondary)'
/** Your own message: lighter than a bot's, in either theme. */
export const MINE = 'color-mix(in oklab, var(--foreground) 17%, var(--pane-fill, var(--card)))'
export const INK = 'var(--foreground)'
export const DIM = 'var(--text-secondary, var(--muted-foreground))'
export const FAINT = '$faint'
export const LINE = 'var(--pane-edge, var(--border))'
/** The composer's edge, the one control drawn a step louder. */
export const EDGE = 'var(--border-strong)'
