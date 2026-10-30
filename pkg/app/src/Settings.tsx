'use client'

// Settings: the sidebar's second level, and the pane it opens in the shell.
//
// TWO PARTS, ONE TAXONOMY. `SettingsList` is the rail's list — the shell swaps
// its own rows for these and back. `SettingsPane` (SettingsPane.tsx) is what
// fills the pane while a row is chosen, loaded only then: it carries the plan,
// the usage panel, the model picker and the catalog, none of which an app's
// first screen draws. Both read `GROUPS`, so the list can only offer a row the
// pane can draw.
//
// Which row is open is the shell's `showSettings` value and nothing here: a
// pane deep in the tree asks for Channels through the same store, and the rail
// and the pane read that one answer.
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

import { phrase, type Say } from '@hanzo/i18n'
import { useI18n } from '@hanzo/i18n/react'
import { app, dev } from './lib/host'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { Text } from '@hanzo/ui'
import { SidebarItem, SidebarSection } from '@hanzo/ui/chat'
import { site } from './where'


export type Row = {
  id: string
  /** Authored English, drawn through `t` (`named`), unless `product` says it is a name. */
  label: string
  /** The label is a product's name (Hanzo Dev, Base), drawn as it is in every language. */
  product?: true
  /**
   * Where the row GOES, for one that leaves this list for the page that owns it.
   *
   * The row is still a button and not an anchor: the rail's contract is one verb
   * per row, and the shell is the only thing that knows how this host moves. So
   * this states the destination and `onPick` performs it.
   */
  href?: string
  /** One sentence, for a pane we have not built a screen for yet: authored English, drawn through `t`. */
  note?: string
}

/** A row's name as the reader sees it. */
export const named = (r: Row, t: Say): string => (r.product ? r.label : t(r.label))

type Group = { label: string; rows: Row[] }

const GROUPS: Group[] = [
  {
    label: phrase('Settings'),
    rows: [
      { id: 'general', label: phrase('General') },
      { id: 'account', label: phrase('Account') },
      { id: 'billing', label: phrase('Billing') },
      { id: 'referrals', label: phrase('Referrals & Rewards') },
      { id: 'usage', label: phrase('Usage') },
      { id: 'capabilities', label: phrase('Capabilities'), note: phrase('What a model may reach for on your behalf.') },
      { id: 'privacy', label: phrase('Privacy'), href: site('/legal/privacy') },
      { id: 'dev', label: 'Hanzo Dev', product: true, href: dev() },
      { id: 'browser', label: 'Hanzo Browser', product: true, href: site('/extension') },
    ],
  },
  {
    label: phrase('Preferences'),
    rows: [
      // DEFAULT MODEL, and the word matters beside Platform's Models: this row
      // chooses which one answers, that one says which ones are served.
      { id: 'model', label: phrase('Default model') },
      {
        id: 'agent',
        label: phrase('Personal agent'),
        // One literal, so the catalog extractor reads it whole.
        note: phrase(
          'The agent that answers as you — its capabilities, its modes, and what it is allowed to do on your behalf. Nothing is bound to this surface yet, so there is nothing here to change; it is listed because this is where it will live.',
        ),
      },
    ],
  },
  // Plugins and skills are what an agent brings to a run, and Customize is
  // their one home: these rows lead there rather than drawing a second list.
  {
    label: phrase('Customize'),
    rows: [
      { id: 'apps', label: phrase('Apps') },
      { id: 'channels', label: phrase('Channels') },
      { id: 'plugins', label: phrase('Plugins'), href: site(app('-/customize/plugins')) },
      { id: 'skills', label: phrase('Skills'), href: site(app('-/customize')) },
      { id: 'memory', label: phrase('Memory'), note: phrase('Nothing is remembered between conversations yet.') },
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
    label: phrase('Platform'),
    rows: [
      { id: 'models', label: phrase('Models') },
      { id: 'base', label: 'Base', product: true, href: site('/base') },
      { id: 'functions', label: 'Functions', product: true, href: site('/functions') },
      { id: 'realtime', label: 'Realtime', product: true, href: site('/realtime') },
      { id: 'keys', label: phrase('API keys'), href: 'https://platform.hanzo.ai/api-keys' },
    ],
  },
  {
    label: phrase('Help & Support'),
    rows: [
      { id: 'docs', label: phrase('Documentation'), href: 'https://docs.hanzo.ai' },
      { id: 'support', label: phrase('Help center'), href: site('/support') },
      { id: 'contact', label: phrase('Contact us'), href: site('/contact') },
      { id: 'status', label: phrase('Status'), href: 'https://status.hanzo.ai' },
      { id: 'releases', label: phrase('Release notes'), href: 'https://github.com/hanzoai/cli/releases' },
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
 * an app's row are the same row — the list under it changes, the column does not.
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
  /** The rail's own filter, narrowing these rows the way it narrows an app's list. */
  filter: string
  /** Chosen. The shell decides what a row with an `href` does. */
  onPick: (row: Row) => void
  /** Back to the shell's own rows. */
  onBack: () => void
}) {
  const { t } = useI18n();
  const q = filter.trim().toLowerCase()
  // A row is found by the name the reader sees, or by its English one.
  const groups = q
    ? GROUPS.map((g) => ({ ...g, rows: g.rows.filter((r) => [named(r, t), r.label].some((l) => l.toLowerCase().includes(q))) })).filter(
        (g) => g.rows.length > 0,
      )
    : GROUPS

  return (
    <>
      <SidebarItem icon={<ArrowLeft size={15} aria-hidden data-i18n-mirror />} onPress={onBack}>{t("Workspace")}</SidebarItem>
      {q && groups.length === 0 ? (
        <Text px="$3" py="$2" fontSize="$2" color="$quiet">
          {t('No matches for “{query}”.', { query: filter.trim() })}
        </Text>
      ) : null}
      {groups.map((g) => (
        <SidebarSection key={g.label} label={t(g.label)}>
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
              {named(r, t)}
            </SidebarItem>
          ))}
        </SidebarSection>
      ))}
    </>
  )
}
