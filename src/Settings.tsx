'use client'

// Settings: the sidebar's second level, and the pane it opens in the room.
//
// TWO PARTS, ONE TAXONOMY. `SettingsList` is the rail's list — the shell swaps
// its own rows for these and back. `SettingsPane` (SettingsPane.tsx) is what
// fills the room while a row is chosen, loaded only then: it carries the plan,
// the usage panel, the model picker and the catalog, none of which a room's
// first screen draws. Both read `GROUPS`, so the list can only offer a row the
// pane can draw.
//
// Which row is open is the shell's `showSettings` value and nothing here: a
// pane deep in the tree asks for Channels through the same store, and the rail
// and the room read that one answer.
//
// Every section that has a screen RENDERS IT HERE. Account, billing and usage
// are not links out to hanzo.id, billing.hanzo.ai and platform.hanzo.ai, because
// the surface is already packaged — @hanzo/usage carries the one usage panel
// every Hanzo product renders, @hanzo/iam carries the identity, and lib/plans
// carries the ladder. A row leaves this surface only when what it opens
// genuinely is not here: a legal document, another product's page, or a card
// form, which belongs to the payment host and nowhere else.
//
// The panes that are not yet built say so in one sentence rather than pretending
// to a screen. An honest empty pane is a smaller lie than an invented one.

import { useI18n } from '@hanzo/i18n/react'
import { app, dev } from './lib/host'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { Text } from '@hanzo/ui'
import { SidebarItem, SidebarSection } from '@hanzo/ui/chat'
import { site } from './where'


export type Row = {
  id: string
  label: string
  /**
   * Where the row GOES, for one that leaves this list for the page that owns it.
   *
   * The row is still a button and not an anchor: the rail's contract is one verb
   * per row, and the shell is the only thing that knows how this host moves. So
   * this states the destination and `onPick` performs it.
   */
  href?: string
  /** One sentence, for a pane we have not built a screen for yet. */
  note?: string
}

type Group = { label: string; rows: Row[] }

const GROUPS: Group[] = [
  {
    label: 'Settings',
    rows: [
      { id: 'general', label: 'General' },
      { id: 'account', label: 'Account' },
      { id: 'billing', label: 'Billing' },
      { id: 'usage', label: 'Usage' },
      { id: 'capabilities', label: 'Capabilities', note: 'What a model may reach for on your behalf.' },
      { id: 'privacy', label: 'Privacy', href: site('/legal/privacy') },
      { id: 'dev', label: 'Hanzo Dev', href: dev() },
      { id: 'browser', label: 'Hanzo Browser', href: site('/extension') },
    ],
  },
  {
    label: 'Preferences',
    rows: [
      // DEFAULT MODEL, and the word matters beside Platform's Models: this row
      // chooses which one answers, that one says which ones are served.
      { id: 'model', label: 'Default model' },
      {
        id: 'agent',
        label: 'Personal agent',
        note:
          'The agent that answers as you — its capabilities, its modes, and what it is allowed ' +
          'to do on your behalf. Nothing is bound to this surface yet, so there is nothing here ' +
          'to change; it is listed because this is where it will live.',
      },
    ],
  },
  // Plugins and skills are what an agent brings to a run, and Customize is
  // their one home: these rows lead there rather than drawing a second list.
  {
    label: 'Customize',
    rows: [
      { id: 'apps', label: 'Apps' },
      { id: 'channels', label: 'Channels' },
      { id: 'plugins', label: 'Plugins', href: site(app('-/customize/plugins')) },
      { id: 'skills', label: 'Skills', href: site(app('-/customize')) },
      { id: 'memory', label: 'Memory', note: 'Nothing is remembered between conversations yet.' },
    ],
  },
  /**
   * THE PLATFORM, from the workspace.
   *
   * Models draws here because `/v1/models` is a call this app already makes, so
   * the pane can state what is actually served rather than describe it. Base,
   * Functions and Realtime have no read this app makes, so each row goes to the
   * page that already documents the product — a row that led to an invented
   * screen would be worse than one that leaves.
   */
  {
    label: 'Platform',
    rows: [
      { id: 'models', label: 'Models' },
      { id: 'base', label: 'Base', href: site('/base') },
      { id: 'functions', label: 'Functions', href: site('/functions') },
      { id: 'realtime', label: 'Realtime', href: site('/realtime') },
      { id: 'keys', label: 'API keys', href: 'https://platform.hanzo.ai/api-keys' },
    ],
  },
]

/** Every row, flat — what the pane looks a chosen id up in. */
export const ROWS: Row[] = GROUPS.flatMap((g) => g.rows)

/** The row Settings opens on when nothing has asked for another. */
export const FIRST = ROWS[0].id

/**
 * The rail's second level: every settings row, grouped.
 *
 * It renders `SidebarItem` rather than a shape of its own so a settings row and
 * a room row are the same row — the list under it changes, the column does not.
 *
 * `aria-current="true"` is stated rather than left to `active`, which publishes
 * `page`. A settings row is the current item in a set, not the current page;
 * the address never moves.
 */
export function SettingsList({
  active,
  filter,
  onPick,
  onBack,
}: {
  /** The open row's id. */
  active: string
  /** The rail's own filter, narrowing these rows the way it narrows the rooms. */
  filter: string
  /** Chosen. The shell decides what a row with an `href` does. */
  onPick: (row: Row) => void
  /** Back to the rooms. */
  onBack: () => void
}) {
  const { t } = useI18n();
  const q = filter.trim().toLowerCase()
  const groups = q
    ? GROUPS.map((g) => ({ ...g, rows: g.rows.filter((r) => r.label.toLowerCase().includes(q)) })).filter(
        (g) => g.rows.length > 0,
      )
    : GROUPS

  return (
    <>
      <SidebarItem icon={<ArrowLeft size={15} aria-hidden />} onPress={onBack}>{t("Workspace")}</SidebarItem>
      {q && groups.length === 0 ? (
        <Text px="$3" py="$2" fontSize="$2" color="$quiet">{t("No matches for “")}{filter.trim()}”.
        </Text>
      ) : null}
      {groups.map((g) => (
        <SidebarSection key={g.label} label={g.label}>
          {g.rows.map((r) => (
            <SidebarItem
              key={r.id}
              // The arrow says this row LEAVES. Without it a row that navigates
              // away and one that draws a pane in place look identical until
              // pressed.
              icon={r.href ? <ArrowUpRight size={13} aria-hidden /> : undefined}
              active={r.id === active}
              aria-current={r.id === active ? 'true' : undefined}
              onPress={() => onPick(r)}
            >
              {r.label}
            </SidebarItem>
          ))}
        </SidebarSection>
      ))}
    </>
  )
}
