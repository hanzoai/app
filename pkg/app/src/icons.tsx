import {
  AppWindow,
  CalendarClock,
  Library,
  MessageSquare,
  Palette,
  Plus,
  SlidersHorizontal,
  SquarePen,
  SquareTerminal,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react'

// The one icon set of the shell's navigation: Hanzo Dev's glyphs (lucide), at Dev's
// stroke (2) and size (16 by default). A mode's `icon` marks its place; its `make`
// is the mark of its New row. Nothing else in the shell draws a place's icon.
const STROKE = 2
const SIZE = 16

const mark = (Glyph: LucideIcon) => (props: LucideProps) => <Glyph size={SIZE} strokeWidth={STROKE} {...props} />

const pair = (icon: LucideIcon, make: LucideIcon) => ({ icon: mark(icon), make: mark(make) })

export const MARKS = {
  chat: pair(MessageSquare, SquarePen),
  dev: pair(SquareTerminal, SquarePen),
  design: pair(Palette, Palette),
  library: pair(Library, Plus),
  tabs: pair(AppWindow, Plus),
  scheduled: pair(CalendarClock, CalendarClock),
  customize: pair(SlidersHorizontal, SlidersHorizontal),
}

/** Back and Forward: Dev's chevrons, heavier than its glyphs. */
export const CHEVRON = 2.25
