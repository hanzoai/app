'use client'

// The "More" pop-open menu, shared by the desktop sidebar, the folded rail and the phone's menu so they cannot drift:
// compact, filterable, and scrollable like the agent picker, with every place under its Hanzo group heading and a small
// pin button per row. The menu never lets Tab reach that button, so the footer row, "Pin to sidebar…", opens a page of
// the same places as ordinary rows, which the arrow keys reach.
import { Fragment, useState, type ReactElement, type ReactNode } from 'react'
import { Building2, Check, Pin } from 'lucide-react'
import { phrase } from '@hanzo/i18n'
import { Text, XStack, YStack } from '@hanzo/gui'
import {
  DropdownMenu,
  DropdownMenuBack,
  DropdownMenuContent,
  DropdownMenuEmpty,
  DropdownMenuItem,
  DropdownMenuPage,
  DropdownMenuSearch,
  DropdownMenuSection,
  DropdownMenuSeparator,
  toast,
  type DropdownMenuProps,
} from '@hanzo/ui'
import { GROUPS, HEADING, BETAS, type Group } from './lib/betas'
import type { NavEntry } from './Rail'

type T = (key: string, params?: Record<string, string | number>) => string
type Heading = 'Workspace' | Group

const WORKSPACE = phrase('Workspace')

/** Compact list viewport height inside the dropdown so the full apps list stays scrollable rather than towering. */
const LIST_MAX_H = 220

/** The built-in places first, then Hanzo's groups in the order betas.ts holds them. */
const ORDER: readonly Heading[] = ['Workspace', ...GROUPS]

/** Built-ins are the Workspace; a hosted or beta app files under its own betas.ts group. Team and Marketplace have none (Business: the company and what it sells), Bot is Agents. */
const EXTERNAL: Record<string, Heading> = { 'ext-team': 'Business', 'ext-market': 'Business', 'ext-bots': 'Agents' }
const headingOf = (id: string): Heading => EXTERNAL[id] ?? BETAS.find((b) => id === `app-${b.id}` || id === `beta-${b.id}`)?.group ?? 'Workspace'

/** The entries under their headings, in ORDER, optionally filtered by name, id, or group label. */
export function moreGroups(entries: NavEntry[], t: T, query = ''): { key: Heading; label: string; items: NavEntry[] }[] {
  const needle = query.trim().toLowerCase()
  return ORDER.map((key) => {
    const label = t(key === 'Workspace' ? WORKSPACE : HEADING[key])
    const groupHit = needle !== '' && label.toLowerCase().includes(needle)
    const items = entries.filter((e) => {
      if (headingOf(e.id) !== key) return false
      if (!needle || groupHit) return true
      return e.label.toLowerCase().includes(needle) || e.id.toLowerCase().includes(needle)
    })
    return { key, label, items }
  }).filter((g) => g.items.length > 0)
}

export function MoreMenu({
  entries,
  onPin,
  orgName,
  onSaveOrgDefault,
  t,
  trigger,
  ...rest
}: {
  entries: NavEntry[]
  onPin: (id: string) => void
  orgName?: string | null
  /** Org admins/owners can save the current sidebar app list & order as the default for new org members. */
  onSaveOrgDefault?: () => Promise<boolean>
  t: T
  trigger: ReactElement
} & Pick<DropdownMenuProps, 'placement' | 'minWidth' | 'maxHeight'>): ReactNode {
  const [query, setQuery] = useState('')
  const [pinQuery, setPinQuery] = useState('')
  const groups = moreGroups(entries, t, query)
  const pinnable = entries.filter((e) => e.pinnable !== false)
  const pinNeedle = pinQuery.trim().toLowerCase()
  const filteredPinnable = pinNeedle
    ? pinnable.filter((item) => item.label.toLowerCase().includes(pinNeedle) || item.id.toLowerCase().includes(pinNeedle))
    : pinnable
  const pin = (item: NavEntry) => {
    onPin(item.id)
    toast.success(t('Pinned {name} to the sidebar', { name: item.label }))
  }
  return (
    <DropdownMenu
      trigger={trigger}
      defaultPage="main"
      onOpenChange={(open) => {
        if (!open) {
          setQuery('')
          setPinQuery('')
        }
      }}
      {...rest}
    >
      <DropdownMenuContent minW={rest.minWidth ?? 240} maxH={rest.maxHeight ?? 320}>
        <DropdownMenuPage id="main">
          <DropdownMenuSearch
            value={query}
            onValueChange={setQuery}
            placeholder={t('Filter apps…')}
            aria-label={t('Filter apps')}
          />
          <DropdownMenuSeparator />
          <YStack data-slot="more-scroll" maxH={LIST_MAX_H} overflowY="auto" overflowX="hidden">
            {groups.length === 0 ? (
              <DropdownMenuEmpty>{t('No matching apps')}</DropdownMenuEmpty>
            ) : (
              groups.map((g, i) => (
                <Fragment key={g.key}>
                  {i === 0 ? null : <DropdownMenuSeparator />}
                  <DropdownMenuSection label={g.label}>
                    {g.items.map((item) => (
                      <DropdownMenuItem
                        key={item.id}
                        data-item={item.id}
                        aria-current={item.on ? 'page' : undefined}
                        onSelect={item.onPress}
                        actions={
                          item.pinnable === false ? undefined : (
                            // For a mouse or finger only: the keyboard has the page below, so a screen reader is not told of a row it cannot reach.
                            <XStack
                              render="button"
                              aria-hidden
                              tabIndex={-1}
                              data-item={`pin-${item.id}`}
                              width={24}
                              height={24}
                              items="center"
                              justify="center"
                              rounded={6}
                              cursor="pointer"
                              hoverStyle={{ bg: '$hover' }}
                              onClick={(e: { stopPropagation: () => void }) => {
                                e.stopPropagation()
                                pin(item)
                              }}
                            >
                              <Pin size={14} aria-hidden />
                            </XStack>
                          )
                        }
                      >
                        <XStack items="center" gap={10} flex={1}>
                          <XStack width={20} height={20} items="center" justify="center" shrink={0}>
                            {item.icon}
                          </XStack>
                          <Text fontSize="$2" flex={1}>
                            {item.label}
                          </Text>
                          {item.on ? <Check size={14} aria-hidden /> : null}
                        </XStack>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSection>
                </Fragment>
              ))
            )}
          </YStack>
          {pinnable.length || onSaveOrgDefault ? (
            <>
              <DropdownMenuSeparator />
              {pinnable.length ? (
                <DropdownMenuItem data-item="pin-page" page="pin">
                  <XStack items="center" gap={10} flex={1}>
                    <XStack width={20} height={20} items="center" justify="center" shrink={0}>
                      <Pin size={15} aria-hidden />
                    </XStack>
                    <Text fontSize="$2" flex={1}>
                      {t('Pin to sidebar…')}
                    </Text>
                  </XStack>
                </DropdownMenuItem>
              ) : null}
              {onSaveOrgDefault ? (
                <DropdownMenuItem
                  data-item="save-org-nav-default"
                  onSelect={() => {
                    void onSaveOrgDefault().then((ok) => {
                      if (ok) {
                        toast.success(
                          orgName
                            ? t('Saved sidebar apps as default for {org}', { org: orgName })
                            : t('Saved sidebar apps as organization default'),
                        )
                      } else {
                        toast.error(t('Could not save organization default sidebar'))
                      }
                    })
                  }}
                >
                  <XStack items="center" gap={10} flex={1}>
                    <XStack width={20} height={20} items="center" justify="center" shrink={0}>
                      <Building2 size={15} aria-hidden />
                    </XStack>
                    <Text fontSize="$2" flex={1}>
                      {orgName ? t('Save as {org} default', { org: orgName }) : t('Save as org default')}
                    </Text>
                  </XStack>
                </DropdownMenuItem>
              ) : null}
            </>
          ) : null}
        </DropdownMenuPage>
        <DropdownMenuPage id="pin">
          <DropdownMenuBack>{t('Pin to sidebar')}</DropdownMenuBack>
          <DropdownMenuSearch
            value={pinQuery}
            onValueChange={setPinQuery}
            placeholder={t('Filter apps…')}
            aria-label={t('Filter apps to pin')}
          />
          <DropdownMenuSeparator />
          <YStack data-slot="more-pin-scroll" maxH={LIST_MAX_H} overflowY="auto" overflowX="hidden">
            {filteredPinnable.length === 0 ? (
              <DropdownMenuEmpty>{t('No matching apps')}</DropdownMenuEmpty>
            ) : (
              filteredPinnable.map((item) => (
                <DropdownMenuItem key={item.id} data-item={`pin-to-${item.id}`} onSelect={() => pin(item)}>
                  <XStack items="center" gap={10} flex={1}>
                    <XStack width={20} height={20} items="center" justify="center" shrink={0}>
                      {item.icon}
                    </XStack>
                    <Text fontSize="$2" flex={1}>
                      {item.label}
                    </Text>
                  </XStack>
                </DropdownMenuItem>
              ))
            )}
          </YStack>
        </DropdownMenuPage>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
