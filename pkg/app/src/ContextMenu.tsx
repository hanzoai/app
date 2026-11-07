'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { SizableText, Text, XStack, YStack } from '@hanzo/gui'
import { toast } from '@hanzo/ui'
import {
  Archive,
  CheckSquare,
  Clock,
  Code2,
  Copy,
  ExternalLink,
  FolderGit2,
  GitBranch,
  Globe,
  Link2,
  MessageSquare,
  Moon,
  PanelLeft,
  Pencil,
  Pin,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Share2,
  Sparkles,
  SquarePen,
  SquareTerminal,
  Sun,
  Trash2,
  Volume2,
  WandSparkles,
} from 'lucide-react'
import type { Host } from '@hanzo/build'
import { app, design, settings, studio, talk, TERMINALS, type Place } from './lib/host'
import { site } from './where'

type MenuEntry =
  | {
      key: string
      label: string
      icon: ReactNode
      shortcut?: string
      run: () => void
    }
  | { key: string; line: true }

interface MenuState {
  x: number
  y: number
  title?: string
  entries: MenuEntry[]
}

const isMac = (): boolean =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)

const fullUrl = (path: string): string => {
  if (/^https?:\/\//.test(path)) return path
  return new URL(site(path), window.location.href).href
}

const placePath = (id: string, mode: Place['mode']): string | null => {
  switch (id) {
    case 'new':
      return mode === 'dev' ? app('') : mode === 'design' ? design('') : mode === 'studio' ? studio('') : talk()
    case 'projects':
      return app('projects')
    case 'issues':
      return app('issues')
    case 'templates':
      return app('templates')
    case 'agents':
      return app('-/customize/agents')
    case 'bots':
      return app('-/customize/bots')
    case 'skills':
      return app('-/customize/skills')
    case 'connectors':
      return app('-/customize/connectors')
    case 'plugins':
      return app('-/customize/plugins')
    case 'upload':
    case 'all':
    case 'images':
    case 'documents':
      return app('-/artifacts')
    default:
      return null
  }
}

const railPath = (slot: string): string | null => {
  switch (slot) {
    case 'rail-chat':
      return talk()
    case 'rail-dev':
      return app('')
    case 'rail-design':
    case 'place-design':
      return design('')
    case 'rail-studio':
    case 'place-studio':
      return studio('')
    case 'rail-tabs':
    case 'place-tabs':
      return TERMINALS
    case 'rail-library':
      return app('-/artifacts')
    case 'rail-scheduled':
      return app('-/automations')
    case 'rail-customize':
      return app('-/customize')
    case 'rail-betas':
      return '/beta'
    default:
      if (slot.startsWith('rail-app-')) return `/apps/${slot.slice('rail-app-'.length)}`
      if (slot.startsWith('place-app-')) return `/apps/${slot.slice('place-app-'.length)}`
      return null
  }
}

export function AppContextMenu({
  host,
  mode,
  closed,
  onToggleSidebar,
  onSeek,
  onNewChat,
  go,
}: {
  host: Host
  mode: Place['mode']
  closed: boolean
  onToggleSidebar: () => void
  onSeek: () => void
  onNewChat: () => void
  go: (address: string) => void
}) {
  const { t } = useI18n()
  const [state, setState] = useState<MenuState | null>(null)
  const panelRef = useRef<HTMLElement | null>(null)
  const apple = isMac()

  const copyLink = async (path: string) => {
    try {
      await navigator.clipboard.writeText(fullUrl(path))
      toast.success(t('Link copied'))
    } catch {
      toast.error(t('The browser would not copy the link.'))
    }
  }

  const openNewTab = (path: string) => {
    window.open(fullUrl(path), '_blank', 'noopener,noreferrer')
  }

  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      if (e.defaultPrevented || e.shiftKey) return
      const target = e.target as Element | null
      if (!target || typeof target.closest !== 'function') return
      const windowRoot = target.closest('[data-slot="window"]')
      if (!windowRoot) return

      // Let ConversationMenu handle [data-thread] rows, and never override native menu in inputs, SVGs, or active text selections
      if (target.closest('[data-thread], [role="menu"], [role="dialog"], svg')) return
      const htmlEl = target as HTMLElement
      if (
        htmlEl.isContentEditable ||
        htmlEl.tagName === 'INPUT' ||
        htmlEl.tagName === 'TEXTAREA' ||
        htmlEl.tagName === 'SELECT' ||
        target.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        return
      }
      const selection = window.getSelection?.()?.toString().trim()
      if (selection) return

      const entries: MenuEntry[] = []
      let title: string | undefined

      // 1. Project row or repository card (`[data-project]` or `button[aria-label^="Open "]` in /dev/projects)
      const projectEl = target.closest('[data-project], button[aria-label^="Open "]') as HTMLElement | null
      const projectAttr =
        projectEl?.getAttribute('data-project') ??
        projectEl?.getAttribute('aria-label')?.replace(/^Open\s+/i, '').trim() ??
        null
      if (projectEl && projectAttr && (projectEl.hasAttribute('data-project') || projectAttr.includes('/'))) {
        const slug = projectAttr
        const projectRoute = app(`projects/${slug}`)
        title = slug
        entries.push(
          {
            key: 'project-open',
            label: t('Open {name}', { name: slug }),
            icon: <FolderGit2 size={15} aria-hidden />,
            run: () => go(projectRoute),
          },
          {
            key: 'project-run',
            label: t('New run in {name}', { name: slug }),
            icon: <Play size={15} aria-hidden />,
            run: () => go(app(`?repo=${encodeURIComponent(slug)}`)),
          },
          {
            key: 'project-tab',
            label: t('Open in new tab'),
            icon: <ExternalLink size={15} aria-hidden />,
            run: () => openNewTab(projectRoute),
          },
          {
            key: 'project-copy',
            label: t('Copy project link'),
            icon: <Link2 size={15} aria-hidden />,
            run: () => void copyLink(projectRoute),
          },
          { key: 'sep-forge', line: true },
          {
            key: 'project-forge',
            label: t('Open on Hanzo Forge'),
            icon: <GitBranch size={15} aria-hidden />,
            run: () => window.open(`https://git.hanzo.ai/${slug}`, '_blank', 'noopener,noreferrer'),
          },
        )
      }

      // 2. Sidebar place row (`[data-place-id]`, `[data-slot="app-new"]`, `[data-slot^="place-"]`)
      if (!entries.length) {
        const placeEl = target.closest(
          '[data-place-id], [data-slot="app-new"], [data-slot="app-images"], [data-slot="app-plugins"], [data-slot^="place-"]',
        ) as HTMLElement | null
        if (placeEl) {
          const slot = placeEl.getAttribute('data-slot') ?? ''
          const placeId = placeEl.getAttribute('data-place-id') ?? (slot === 'app-new' ? 'new' : '')
          const label = placeEl.textContent?.trim() || placeEl.getAttribute('aria-label') || t('Open')
          const routeTo = placeId ? placePath(placeId, mode) : railPath(slot)
          title = label
          entries.push({
            key: 'place-open',
            label: t('Open {name}', { name: label }),
            icon: <FolderGit2 size={15} aria-hidden />,
            run: () => placeEl.click(),
          })
          if (routeTo) {
            entries.push(
              {
                key: 'place-tab',
                label: t('Open in new tab'),
                icon: <ExternalLink size={15} aria-hidden />,
                run: () => openNewTab(routeTo),
              },
              {
                key: 'place-copy',
                label: t('Copy link'),
                icon: <Link2 size={15} aria-hidden />,
                run: () => void copyLink(routeTo),
              },
            )
          }
          entries.push(
            { key: 'sep-place', line: true },
            {
              key: 'place-select',
              label: t('Select multiple…'),
              icon: <CheckSquare size={15} aria-hidden />,
              run: () => window.dispatchEvent(new CustomEvent('hanzo:recents-select')),
            },
            {
              key: 'place-search',
              label: t('Search & Commands…'),
              icon: <Search size={15} aria-hidden />,
              shortcut: apple ? '⌘K' : 'Ctrl+K',
              run: onSeek,
            },
            {
              key: 'place-sidebar',
              label: t(closed ? 'Open sidebar' : 'Close sidebar'),
              icon: <PanelLeft size={15} aria-hidden />,
              run: onToggleSidebar,
            },
          )
        }
      }

      // 3. Rail product button (`[data-slot^="rail-"]`)
      if (!entries.length) {
        const railEl = target.closest('[data-slot^="rail-"]') as HTMLElement | null
        const slot = railEl?.getAttribute('data-slot') ?? ''
        if (railEl && slot && slot !== 'rail-marks' && slot !== 'rail-more') {
          const label = railEl.getAttribute('aria-label') || t('Open')
          const routeTo = railPath(slot)
          title = label
          entries.push({
            key: 'rail-open',
            label: t('Open {name}', { name: label }),
            icon: <ExternalLink size={15} aria-hidden />,
            run: () => railEl.click(),
          })
          if (routeTo) {
            entries.push(
              {
                key: 'rail-tab',
                label: t('Open in new tab'),
                icon: <ExternalLink size={15} aria-hidden />,
                run: () => openNewTab(routeTo),
              },
              {
                key: 'rail-copy',
                label: t('Copy link'),
                icon: <Link2 size={15} aria-hidden />,
                run: () => void copyLink(routeTo),
              },
            )
          }
          if (slot === 'rail-dev') {
            entries.push(
              { key: 'sep-dev', line: true },
              {
                key: 'rail-dev-new',
                label: t('New run'),
                icon: <Plus size={15} aria-hidden />,
                run: () => go(app('')),
              },
              {
                key: 'rail-dev-projects',
                label: t('Projects'),
                icon: <FolderGit2 size={15} aria-hidden />,
                run: () => go(app('projects')),
              },
            )
          } else if (slot === 'rail-chat') {
            entries.push(
              { key: 'sep-chat', line: true },
              {
                key: 'rail-chat-new',
                label: t('New chat'),
                icon: <SquarePen size={15} aria-hidden />,
                run: onNewChat,
              },
              {
                key: 'rail-chat-select',
                label: t('Select multiple…'),
                icon: <CheckSquare size={15} aria-hidden />,
                run: () => window.dispatchEvent(new CustomEvent('hanzo:recents-select')),
              },
            )
          }
          entries.push(
            { key: 'sep-rail-end', line: true },
            {
              key: 'rail-toggle',
              label: t(closed ? 'Open sidebar' : 'Close sidebar'),
              icon: <PanelLeft size={15} aria-hidden />,
              run: onToggleSidebar,
            },
          )
        }
      }

      // 4. Sidebar / Recents column (`[data-slot="app-column"]`, `[data-slot="recents"]`)
      if (!entries.length && target.closest('[data-slot="app-column"], [data-slot="recents"]')) {
        title = mode === 'dev' ? 'Hanzo Dev' : 'Hanzo AI'
        entries.push(
          {
            key: 'sidebar-new',
            label: mode === 'dev' ? t('New run') : t('New chat'),
            icon: <SquarePen size={15} aria-hidden />,
            run: () => (mode === 'dev' ? go(app('')) : onNewChat()),
          },
          {
            key: 'sidebar-select',
            label: t('Select multiple…'),
            icon: <CheckSquare size={15} aria-hidden />,
            run: () => window.dispatchEvent(new CustomEvent('hanzo:recents-select')),
          },
          {
            key: 'sidebar-select-all',
            label: t('Select All'),
            icon: <CheckSquare size={15} aria-hidden />,
            shortcut: apple ? '⌘A' : 'Ctrl+A',
            run: () => window.dispatchEvent(new CustomEvent('hanzo:recents-select', { detail: { mode: 'all' } })),
          },
          {
            key: 'sidebar-search',
            label: t('Search & Commands…'),
            icon: <Search size={15} aria-hidden />,
            shortcut: apple ? '⌘K' : 'Ctrl+K',
            run: onSeek,
          },
          { key: 'sep-sidebar-places', line: true },
          {
            key: 'sidebar-projects',
            label: t('Projects'),
            icon: <FolderGit2 size={15} aria-hidden />,
            run: () => go(app('projects')),
          },
          {
            key: 'sidebar-shut',
            label: t('Close sidebar'),
            icon: <PanelLeft size={15} aria-hidden />,
            run: onToggleSidebar,
          },
        )
      }

      // 5. Anchor link (`a[href]`)
      if (!entries.length) {
        const anchor = target.closest('a[href]') as HTMLAnchorElement | null
        const href = anchor?.getAttribute('href')
        if (anchor && href && !href.startsWith('javascript:')) {
          title = anchor.textContent?.trim().slice(0, 48) || href
          entries.push(
            {
              key: 'link-open',
              label: t('Open'),
              icon: <ExternalLink size={15} aria-hidden />,
              run: () => anchor.click(),
            },
            {
              key: 'link-tab',
              label: t('Open in new tab'),
              icon: <ExternalLink size={15} aria-hidden />,
              run: () => openNewTab(href),
            },
            {
              key: 'link-copy',
              label: t('Copy link'),
              icon: <Link2 size={15} aria-hidden />,
              run: () => void copyLink(href),
            },
          )
        }
      }

      // 5b. Chat turn / answer or active conversation surface (`[data-turn-id]`, `[data-slot="talk"]`, `[data-slot="conversation-head"]`)
      if (!entries.length && mode === 'chat') {
        const turnEl = target.closest('[data-turn-id]') as HTMLElement | null
        const turnId = turnEl?.getAttribute('data-turn-id') ?? undefined
        const turnRole = turnEl?.getAttribute('data-turn-role') ?? undefined
        const inTalk = Boolean(
          turnEl ||
            target.closest('[data-slot="talk"], [data-slot="conversation-head"]'),
        )
        const hasTurns = Boolean(document.querySelector('[data-slot="talk"] [data-turn-id]'))
        if (inTalk && (turnEl || hasTurns)) {
          const dispatchChat = (action: string) => {
            window.dispatchEvent(
              new CustomEvent('hanzo:chat-context-action', {
                detail: { action, turnId },
              }),
            )
          }
          if (turnId && turnRole === 'assistant') {
            entries.push(
              {
                key: 'turn-copy',
                label: t('Copy answer'),
                icon: <Copy size={15} aria-hidden />,
                run: () => dispatchChat('copy'),
              },
              {
                key: 'turn-redo',
                label: t('Regenerate'),
                icon: <RotateCcw size={15} aria-hidden />,
                run: () => dispatchChat('redo'),
              },
              {
                key: 'turn-think',
                label: t('Think harder'),
                icon: <Sparkles size={15} aria-hidden />,
                run: () => dispatchChat('think'),
              },
              {
                key: 'turn-web',
                label: t('Search web'),
                icon: <Globe size={15} aria-hidden />,
                run: () => dispatchChat('web'),
              },
              {
                key: 'turn-branch',
                label: t('Branch in new chat'),
                icon: <GitBranch size={15} aria-hidden />,
                run: () => dispatchChat('branch'),
              },
              {
                key: 'turn-listen',
                label: t('Read aloud'),
                icon: <Volume2 size={15} aria-hidden />,
                run: () => dispatchChat('listen'),
              },
              { key: 'sep-turn-conv', line: true },
            )
          } else if (turnId && turnRole === 'user') {
            entries.push(
              {
                key: 'turn-copy-q',
                label: t('Copy message'),
                icon: <Copy size={15} aria-hidden />,
                run: () => dispatchChat('copy'),
              },
              { key: 'sep-turn-q', line: true },
            )
          }
          entries.push(
            {
              key: 'conv-rename',
              label: t('Rename'),
              icon: <Pencil size={15} aria-hidden />,
              run: () => dispatchChat('rename'),
            },
            {
              key: 'conv-pin',
              label: t('Pin'),
              icon: <Pin size={15} aria-hidden />,
              run: () => dispatchChat('pin'),
            },
            {
              key: 'conv-share',
              label: t('Share…'),
              icon: <Share2 size={15} aria-hidden />,
              run: () => dispatchChat('share'),
            },
            {
              key: 'conv-schedule',
              label: t('Schedule…'),
              icon: <Clock size={15} aria-hidden />,
              run: () => dispatchChat('schedule'),
            },
            {
              key: 'conv-copy-link',
              label: t('Copy link'),
              icon: <Link2 size={15} aria-hidden />,
              run: () => void copyLink(window.location.pathname + window.location.search),
            },
            {
              key: 'conv-open-tab',
              label: t('Open in new tab'),
              icon: <ExternalLink size={15} aria-hidden />,
              run: () => openNewTab(window.location.pathname + window.location.search),
            },
            {
              key: 'conv-archive',
              label: t('Archive'),
              icon: <Archive size={15} aria-hidden />,
              run: () => dispatchChat('archive'),
            },
            { key: 'sep-conv-del', line: true },
            {
              key: 'conv-delete',
              label: t('Delete'),
              icon: <Trash2 size={15} aria-hidden />,
              run: () => dispatchChat('delete'),
            },
          )
        }
      }

      // 6. Workspace / Stage surface (`[data-slot="stage"]`, `[data-slot="pane"]`, `[data-slot="frame"]`)
      if (!entries.length && target.closest('[data-slot="stage"], [data-slot="pane"], [data-slot="frame"]')) {
        entries.push(
          {
            key: 'stage-new-chat',
            label: t('New chat'),
            icon: <MessageSquare size={15} aria-hidden />,
            run: onNewChat,
          },
          {
            key: 'stage-new-run',
            label: t('New run'),
            icon: <Code2 size={15} aria-hidden />,
            run: () => go(app('')),
          },
          {
            key: 'stage-search',
            label: t('Search & Commands…'),
            icon: <Search size={15} aria-hidden />,
            shortcut: apple ? '⌘K' : 'Ctrl+K',
            run: onSeek,
          },
          { key: 'sep-stage-nav', line: true },
          {
            key: 'stage-projects',
            label: t('Projects'),
            icon: <FolderGit2 size={15} aria-hidden />,
            run: () => go(app('projects')),
          },
          {
            key: 'stage-design',
            label: 'Design',
            icon: <WandSparkles size={15} aria-hidden />,
            run: () => go(design('')),
          },
          {
            key: 'stage-tabs',
            label: 'Tabs',
            icon: <SquareTerminal size={15} aria-hidden />,
            run: () => go(TERMINALS),
          },
          { key: 'sep-stage-view', line: true },
          {
            key: 'stage-sidebar',
            label: t(closed ? 'Open sidebar' : 'Close sidebar'),
            icon: <PanelLeft size={15} aria-hidden />,
            run: onToggleSidebar,
          },
          ...(host.chooseTheme
            ? [
                (() => {
                  const isLight =
                    typeof document !== 'undefined'
                      ? document.documentElement.classList.contains('light')
                      : host.theme === 'light'
                  return {
                    key: 'stage-theme',
                    label: t(isLight ? 'Switch to Dark theme' : 'Switch to Light theme'),
                    icon: isLight ? <Moon size={15} aria-hidden /> : <Sun size={15} aria-hidden />,
                    run: () => host.chooseTheme?.(isLight ? 'dark' : 'light'),
                  }
                })(),
              ]
            : []),
          {
            key: 'stage-settings',
            label: t('Settings…'),
            icon: <Settings size={15} aria-hidden />,
            shortcut: apple ? '⌘,' : 'Ctrl+,',
            run: () => {
              if (!host.token?.() && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('hanzo:anon-settings'))
                return
              }
              go(settings())
            },
          },
        )
      }

      if (!entries.length) return
      e.preventDefault()
      const vw = window.innerWidth
      const vh = window.innerHeight
      const menuW = 240
      const menuH = entries.length * 32 + 24
      const x = Math.max(8, Math.min(e.clientX, vw - menuW - 8))
      const y = Math.max(8, Math.min(e.clientY, vh - menuH - 8))
      setState({ x, y, title, entries })
    }

    window.addEventListener('contextmenu', onContextMenu)
    return () => window.removeEventListener('contextmenu', onContextMenu)
  }, [apple, closed, go, host, mode, onNewChat, onSeek, onToggleSidebar, t])

  useEffect(() => {
    if (!state) return
    const onPointerDown = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return
      setState(null)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setState(null)
      }
    }
    const onScroll = () => setState(null)
    window.addEventListener('mousedown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('blur', onScroll)
    return () => {
      window.removeEventListener('mousedown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('blur', onScroll)
    }
  }, [state])

  if (!state) return null

  return (
    <YStack
      ref={(node: unknown) => {
        panelRef.current = (node as HTMLElement | null) ?? null
      }}
      role="menu"
      aria-label={state.title ?? t('Application menu')}
      data-slot="app-context-menu"
      minW={228}
      maxW={280}
      p="$1.5"
      rounded="$4"
      bg="$raised"
      borderWidth={1}
      borderColor="$borderColor"
      z={100000}
      style={{
        position: 'fixed',
        left: state.x,
        top: state.y,
      }}
      $platform-web={{
        backdropFilter: 'blur(20px)',
        boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.36)',
      }}
    >
      {state.entries.map((entry) =>
        'line' in entry ? (
          <XStack key={entry.key} height={1} bg="$borderColor" my="$1" mx="$1" role="separator" />
        ) : (
          <XStack
            key={entry.key}
            render="button"
            role="menuitem"
            px="$2.5"
            py="$1.5"
            minH={30}
            rounded="$3"
            items="center"
            gap="$2.5"
            cursor="pointer"
            bg="transparent"
            hoverStyle={{ bg: '$hover' }}
            focusStyle={{ bg: '$hover' }}
            onPress={() => {
              setState(null)
              entry.run()
            }}
          >
            <XStack width={16} height={16} items="center" justify="center" shrink={0} opacity={0.85}>
              {entry.icon}
            </XStack>
            <Text flex={1} minW={0} fontSize="$2" color="$ink" numberOfLines={1} style={{ textAlign: 'start' }}>
              {entry.label}
            </Text>
            {entry.shortcut ? (
              <SizableText size="$1" color="$soft" aria-hidden data-i18n-ltr>
                {entry.shortcut}
              </SizableText>
            ) : null}
          </XStack>
        ),
      )}
    </YStack>
  )
}
