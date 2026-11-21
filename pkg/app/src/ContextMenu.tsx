'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { SizableText, Text, View, XStack, YStack } from '@hanzo/gui'
import { toast } from '@hanzo/ui'
import {
  Archive,
  ArchiveRestore,
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
  PinOff,
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
import { app, design, flow, settings, talk, TERMINALS, type Place } from './lib/host'
import { rememberSettingsReturn } from './lib/dev-mode'
import { useOpen } from './open'
import { usePinnedNav, type Pins } from './Rail'
import { site } from './where'
import { useWindowed } from './windowed'

type MenuEntry =
  | {
      key: string
      label: string
      icon: ReactNode
      shortcut?: string
      destructive?: boolean
      run: () => void
    }
  | { key: string; line: true }

interface MenuState {
  x: number
  y: number
  title?: string
  entries: MenuEntry[]
}

const SAFE_BOTTOM = 'calc(12px + env(safe-area-inset-bottom, 0px))' as `var(--${string})`
const FOCUS_RING = { outlineWidth: 2, outlineStyle: 'solid', outlineColor: '$outlineColor' } as const

const isMac = (): boolean =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)

const fullUrl = (path: string): string => {
  if (/^https?:\/\//.test(path)) return path
  return new URL(site(path), window.location.href).href
}

const placePath = (id: string, mode: Place['mode']): string | null => {
  switch (id) {
    case 'new':
      return mode === 'dev' ? app('') : mode === 'design' ? design('') : talk()
    case 'projects':
      return app('-/projects')
    case 'issues':
      return app('-/issues')
    case 'templates':
      return app('-/templates')
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
    case 'rail-flow':
    case 'place-flow':
      return flow('')
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
  pins: held,
}: {
  host: Host
  mode: Place['mode']
  closed: boolean
  onToggleSidebar: () => void
  onSeek: () => void
  onNewChat: () => void
  go: (address: string) => void
  /** The surface's pins (App.tsx), so a pin made here shows in the Sidebar and the Rail at once. */
  pins?: Pins
}) {
  const { t } = useI18n()
  const windowed = useWindowed()
  const { thread: activeThread } = useOpen()
  const [state, setState] = useState<MenuState | null>(null)
  const [compact, setCompact] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false,
  )
  const panelRef = useRef<HTMLElement | null>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const apple = isMac()
  const own = usePinnedNav()
  const [pins, togglePin] = held ?? own

  const closeMenu = useCallback((restoreFocus = false) => {
    setState(null)
    if (restoreFocus) {
      queueMicrotask(() => openerRef.current?.focus?.())
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(max-width: 639px)')
    const sync = () => setCompact(mq.matches)
    sync()
    mq.addEventListener?.('change', sync)
    return () => mq.removeEventListener?.('change', sync)
  }, [])

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
      // Select multiple acts on a Recents list; offer it only while one is drawn (Tabs, Studio, Flow and Betas draw none).
      const listed = Boolean(document.querySelector('[data-slot="recents"]'))
      const windowRoot = target.closest('[data-slot="window"]')
      if (!windowRoot) return

      // Let ConversationMenu handle [data-thread] rows, and never override native menu in inputs, standalone SVGs, or active text selections
      if (target.closest('[data-thread], [role="menu"], [role="dialog"]')) return
      if (target.closest('svg') && !target.closest('button, a, [role="button"], [data-slot^="rail-"], [data-place-id], [data-project]')) return
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
          const pinTargetId = placeId && placeId !== 'new' ? placeId : slot.startsWith('place-') && slot !== 'place-more' && slot !== 'place-back' && slot !== 'place-name' ? slot.slice('place-'.length) : ''
          const label = placeEl.textContent?.trim() || placeEl.getAttribute('aria-label') || t('Open')
          const routeTo = placeId ? placePath(placeId, mode) : railPath(slot)
          title = label
          entries.push({
            key: 'place-open',
            label: t('Open {name}', { name: label }),
            icon: <FolderGit2 size={15} aria-hidden />,
            run: () => placeEl.click(),
          })
          if (pinTargetId) {
            const pinned = pins.includes(pinTargetId)
            entries.push({
              key: 'place-pin',
              label: pinned ? t('Unpin') : t('Pin to top'),
              icon: pinned ? <PinOff size={15} aria-hidden /> : <Pin size={15} aria-hidden />,
              run: () => {
                togglePin(pinTargetId)
              },
            })
          }
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
            ...(listed
              ? [{
                  key: 'place-select',
                  label: t('Select multiple…'),
                  icon: <CheckSquare size={15} aria-hidden />,
                  run: () => window.dispatchEvent(new CustomEvent('hanzo:recents-select')),
                }]
              : []),
            {
              key: 'place-search',
              label: t('Search & commands…'),
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
        const ignoredSlots = new Set(['rail', 'rail-marks', 'rail-more', 'rail-pinned', 'rail-unpinned', 'rail-fold-toggle', 'rail-item-options', 'rail-expand', 'rail-new'])
        if (railEl && slot && !ignoredSlots.has(slot)) {
          const navId = railEl.getAttribute('data-nav-id') ?? slot.replace(/^rail-/, '')
          const label = railEl.getAttribute('aria-label') || t('Open')
          const routeTo = railPath(slot)
          title = label
          entries.push({
            key: 'rail-open',
            label: t('Open {name}', { name: label }),
            icon: <ExternalLink size={15} aria-hidden />,
            run: () => railEl.click(),
          })
          if (navId && !navId.startsWith('anon-')) {
            const pinned = pins.includes(navId)
            entries.push({
              key: 'rail-pin',
              label: pinned ? t('Unpin') : t('Pin to top'),
              icon: pinned ? <PinOff size={15} aria-hidden /> : <Pin size={15} aria-hidden />,
              run: () => {
                togglePin(navId)
              },
            })
          }
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
                run: () => go(app('-/projects')),
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
              ...(listed
                ? [{
                    key: 'rail-chat-select',
                    label: t('Select multiple…'),
                    icon: <CheckSquare size={15} aria-hidden />,
                    run: () => window.dispatchEvent(new CustomEvent('hanzo:recents-select')),
                  }]
                : []),
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
          ...(listed
            ? [
                {
                  key: 'sidebar-select',
                  label: t('Select multiple…'),
                  icon: <CheckSquare size={15} aria-hidden />,
                  run: () => window.dispatchEvent(new CustomEvent('hanzo:recents-select')),
                },
                {
                  key: 'sidebar-select-all',
                  label: t('Select all'),
                  icon: <CheckSquare size={15} aria-hidden />,
                  shortcut: apple ? '⌘A' : 'Ctrl+A',
                  run: () => window.dispatchEvent(new CustomEvent('hanzo:recents-select', { detail: { mode: 'all' } })),
                },
              ]
            : []),
          {
            key: 'sidebar-search',
            label: t('Search & commands…'),
            icon: <Search size={15} aria-hidden />,
            shortcut: apple ? '⌘K' : 'Ctrl+K',
            run: onSeek,
          },
          { key: 'sep-sidebar-places', line: true },
          {
            key: 'sidebar-projects',
            label: t('Projects'),
            icon: <FolderGit2 size={15} aria-hidden />,
            run: () => go(app('-/projects')),
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
          const activeId =
            activeThread ||
            (window.location.pathname.startsWith('/chat/')
              ? decodeURIComponent(window.location.pathname.slice('/chat/'.length))
              : '')
          const activeRow =
            activeId && typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
              ? document.querySelector(`[data-thread="${CSS.escape(activeId)}"]`)
              : activeId
                ? Array.from(document.querySelectorAll('[data-thread]')).find((el) => el.getAttribute('data-thread') === activeId) ?? null
                : null
          const isPinned = Boolean(activeRow?.hasAttribute('data-pinned'))
          const isArchived = Boolean(activeRow?.hasAttribute('data-archived'))
          const convPath = activeId ? talk(activeId) : window.location.pathname + window.location.search
          entries.push(
            {
              key: 'conv-rename',
              label: t('Rename'),
              icon: <Pencil size={15} aria-hidden />,
              run: () => dispatchChat('rename'),
            },
            {
              key: 'conv-pin',
              label: isPinned ? t('Unpin') : t('Pin'),
              icon: isPinned ? <PinOff size={15} aria-hidden /> : <Pin size={15} aria-hidden />,
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
              run: () => void copyLink(convPath),
            },
            {
              key: 'conv-open-tab',
              label: t('Open in new tab'),
              icon: <ExternalLink size={15} aria-hidden />,
              run: () => openNewTab(convPath),
            },
            {
              key: 'conv-archive',
              label: isArchived ? t('Unarchive') : t('Archive'),
              icon: isArchived ? <ArchiveRestore size={15} aria-hidden /> : <Archive size={15} aria-hidden />,
              run: () => dispatchChat('archive'),
            },
            { key: 'sep-conv-del', line: true },
            {
              key: 'conv-delete',
              label: t('Delete'),
              icon: <Trash2 size={15} color="var(--state-error)" aria-hidden />,
              destructive: true,
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
            label: t('Search & commands…'),
            icon: <Search size={15} aria-hidden />,
            shortcut: apple ? '⌘K' : 'Ctrl+K',
            run: onSeek,
          },
          { key: 'sep-stage-nav', line: true },
          {
            key: 'stage-projects',
            label: t('Projects'),
            icon: <FolderGit2 size={15} aria-hidden />,
            run: () => go(app('-/projects')),
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
                    label: isLight ? t('Switch to dark theme') : t('Switch to light theme'),
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
              rememberSettingsReturn()
              go(settings('account'))
            },
          },
        )
      }

      if (!entries.length) return
      e.preventDefault()
      openerRef.current =
        document.activeElement instanceof HTMLElement && document.activeElement !== document.body
          ? document.activeElement
          : (target.closest('button, a, [role="button"], [tabindex]') as HTMLElement | null)
      const vw = window.innerWidth
      const vh = window.innerHeight
      const menuW = 240
      const menuH = entries.length * 32 + 24
      const x = Math.max(8, Math.min(e.clientX, vw - menuW - 8))
      const y = Math.max(8, Math.min(e.clientY, vh - menuH - 8))
      setCompact(vw < 640)
      // A window of its own has no browser tabs: its menus offer no Open in new tab.
      setState({ x, y, title, entries: windowed ? entries.filter((e) => !e.key.endsWith('-tab')) : entries })
    }

    window.addEventListener('contextmenu', onContextMenu)
    return () => window.removeEventListener('contextmenu', onContextMenu)
  }, [activeThread, apple, closed, go, host, mode, onNewChat, onSeek, onToggleSidebar, pins, togglePin, t, windowed])

  useEffect(() => {
    if (!state) return
    const onPointerDown = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return
      closeMenu(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeMenu(true)
      }
    }
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return
      closeMenu(false)
    }
    const onBlur = () => closeMenu(false)
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('blur', onBlur)
    }
  }, [state, closeMenu])

  if (!state) return null

  const items = state.entries.map((entry) =>
    'line' in entry ? (
      <XStack key={entry.key} height={1} bg="$borderColor" my="$1" mx="$1" role="separator" />
    ) : (
      <XStack
        key={entry.key}
        render={<button type="button" />}
        role="menuitem"
        width="100%"
        px="$2.5"
        py={compact ? '$2' : '$1.5'}
        minH={compact ? 44 : 30}
        $max-sm={{ minH: 44 }}
        rounded="$3"
        borderWidth={0}
        items="center"
        gap="$2.5"
        cursor="pointer"
        bg="transparent"
        hoverStyle={{ bg: '$hover' }}
        focusStyle={{ bg: '$hover' }}
        focusVisibleStyle={FOCUS_RING}
        onClick={() => {
          closeMenu(false)
          entry.run()
        }}
      >
        <XStack width={16} height={16} items="center" justify="center" shrink={0} opacity={entry.destructive ? 1 : 0.85}>
          {entry.icon}
        </XStack>
        <Text flex={1} minW={0} fontSize={compact ? '$3' : '$2'} color={entry.destructive ? 'var(--state-error)' : '$ink'} numberOfLines={1} text="start">
          {entry.label}
        </Text>
        {entry.shortcut && !compact ? (
          <SizableText size="$1" color="$soft" aria-hidden data-i18n-ltr>
            {entry.shortcut}
          </SizableText>
        ) : null}
      </XStack>
    ),
  )

  if (compact) {
    return (
      <>
        <View
          data-slot="app-context-menu-scrim"
          position="fixed"
          inset={0}
          bg="var(--surface-scrim)"
          z="var(--z-overlay)"
          onClick={() => closeMenu(true)}
        />
        <YStack
          ref={(node: unknown) => {
            panelRef.current = (node as HTMLElement | null) ?? null
          }}
          role="menu"
          aria-label={state.title ?? t('Application menu')}
          data-slot="app-context-menu"
          data-presentation="sheet"
          position="fixed"
          b={0}
          l={8}
          r={8}
          width="calc(100vw - 16px)"
          maxW="100vw"
          maxH="75dvh"
          overflowY="auto"
          pt="$2"
          px="$2"
          pb={SAFE_BOTTOM}
          borderTopLeftRadius="$5"
          borderTopRightRadius="$5"
          borderBottomLeftRadius={0}
          borderBottomRightRadius={0}
          bg="var(--popover)"
          borderWidth={1}
          borderColor="var(--border-strong)"
          boxShadow="var(--shadow-floating)"
          z="var(--z-modal)"
        >
          <XStack justify="center" pt="$1" pb="$2" shrink={0} aria-hidden data-slot="sheet-handle">
            <View width={36} height={4} rounded="$10" bg="$edge" />
          </XStack>
          {state.title ? (
            <Text fontSize="$2" fontWeight="600" color="$aside" px="$2.5" pb="$1.5" numberOfLines={1}>
              {state.title}
            </Text>
          ) : null}
          <YStack gap="$0.5" minW={0}>
            {items}
          </YStack>
        </YStack>
      </>
    )
  }

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
      maxH="75dvh"
      overflowY="auto"
      p="$1.5"
      rounded="$4"
      bg="var(--popover)"
      borderWidth={1}
      borderColor="var(--border-strong)"
      boxShadow="var(--shadow-floating)"
      z="var(--z-popover)"
      position="fixed"
      l={state.x}
      t={state.y}
      $platform-web={{
        backdropFilter: 'blur(20px)',
        boxShadow: 'var(--shadow-floating)',
      }}
    >
      {items}
    </YStack>
  )
}
