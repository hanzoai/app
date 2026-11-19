'use client'

// The "More" pop-open menu, shared by the desktop sidebar, the folded rail and the phone's menu so they cannot drift:
// every place under a short heading (Hanzo's own group names from lib/betas), each row with a small pin button for a
// mouse or finger. The menu never lets Tab reach that button, so the last row, "Pin to sidebar…", opens a page of the
// same places as ordinary rows, which the arrow keys reach.
import { Fragment, type ReactElement, type ReactNode } from 'react'
import { Check, Pin } from 'lucide-react'
import { phrase } from '@hanzo/i18n'
import { Text, XStack } from '@hanzo/gui'
import {
  DropdownMenu,
  DropdownMenuBack,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPage,
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

/** The built-in places first, then Hanzo's groups in the order betas.ts holds them. */
const ORDER: readonly Heading[] = ['Workspace', ...GROUPS]

/** Built-ins are the Workspace; a hosted or beta app files under its own betas.ts group. Team and Marketplace have none (Business: the company and what it sells), Bot is Agents. */
const EXTERNAL: Record<string, Heading> = { 'ext-team': 'Business', 'ext-market': 'Business', 'ext-bots': 'Agents' }
const headingOf = (id: string): Heading => EXTERNAL[id] ?? BETAS.find((b) => id === `app-${b.id}` || id === `beta-${b.id}`)?.group ?? 'Workspace'

/** The entries under their headings, in ORDER, each keeping the order it came in. */
export function moreGroups(entries: NavEntry[], t: T): { key: Heading; label: string; items: NavEntry[] }[] {
  return ORDER.map((key) => ({ key, label: t(key === 'Workspace' ? WORKSPACE : HEADING[key]), items: entries.filter((e) => headingOf(e.id) === key) })).filter((g) => g.items.length > 0)
}

export function MoreMenu({ entries, onPin, t, trigger, ...rest }: { entries: NavEntry[]; onPin: (id: string) => void; t: T; trigger: ReactElement } & Pick<DropdownMenuProps, 'placement' | 'minWidth' | 'maxHeight'>): ReactNode {
  const pinnable = entries.filter((e) => e.pinnable !== false)
  const pin = (item: NavEntry) => {
    onPin(item.id)
    toast.success(t('Pinned {name} to the sidebar', { name: item.label }))
  }
  return (
    <DropdownMenu trigger={trigger} defaultPage="main" {...rest}>
      <DropdownMenuContent minW={rest.minWidth ?? 220} maxH={rest.maxHeight}>
        <DropdownMenuPage id="main">
          {moreGroups(entries, t).map((g, i) => (
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
                          role="presentation"
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
                          onPress={() => pin(item)}
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
          ))}
          {pinnable.length ? (
            <>
              <DropdownMenuSeparator />
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
            </>
          ) : null}
        </DropdownMenuPage>
        <DropdownMenuPage id="pin">
          <DropdownMenuBack>{t('Pin to sidebar')}</DropdownMenuBack>
          {pinnable.map((item) => (
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
          ))}
        </DropdownMenuPage>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
