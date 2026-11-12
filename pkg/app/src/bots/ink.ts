// The ramp the Bots app is drawn in.
//
// Greyscale, because nothing on this screen is a category: a bot is not red and
// a run is not green. Status is said in words.
//
// ROLES, NOT VALUES. Each name is a @hanzo/design token, which tunes both
// grounds; a literal here would read right in one theme by coincidence.
//
// Two grounds, as the window is drawn: the roster stands on the floor and the
// thread and the panel on the ground one step above it.

/** The roster's ground: the window itself. */
export const FLOOR = 'var(--background)'
/** The thread's and the panel's ground. */
export const GROUND = 'var(--card)'
/** What stands on the ground: the pills, the cards, the composer, a bot's message. */
export const RAISED = 'var(--surface-card-emphasis)'
/** The bot that is open, in the roster. */
export const PICKED = 'var(--secondary)'
/** Your own message: lighter than a bot's, in either theme. */
export const MINE = 'color-mix(in oklab, var(--foreground) 22%, var(--card))'
export const INK = 'var(--foreground)'
export const DIM = 'var(--muted-foreground)'
// The dimmest ink is gui's `$faint` rung: design's --text-tertiary is 4.32:1 on
// the light ground, under text's 4.5.
export const FAINT = '$faint'
export const LINE = 'var(--border)'
/** The composer's edge, the one control drawn a step louder. */
export const EDGE = 'var(--border-strong)'
