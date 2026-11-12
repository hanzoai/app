'use client'

import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { SizableText, XStack, YStack } from '@hanzo/gui'
import { Folder, FolderOpen, Plus } from 'lucide-react'
import type { Thread } from '@hanzo/ai'
import { Button, Dialog, DialogContent, DialogTitle, Input } from '@hanzo/ui'
import { SidebarItem } from '@hanzo/ui/chat'
import { useKept } from './kept'
import { api } from './lib/api'
import { list } from './lib/list'
import { scope } from './lib/session'
import { UNTITLED, type Recent } from './recent'
import { ConversationMenu, ThreadRow } from './thread'

export interface ProjectFolder {
  id: string
  name: string
}

export interface StoredChatProjects {
  folders: ProjectFolder[]
  open: Record<string, boolean>
  assigned: Record<string, string>
}

export const EMPTY_CHAT_PROJECTS: StoredChatProjects = {
  folders: [],
  open: {},
  assigned: {},
}

export function normalizeProjectSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^[^/]+\//, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function readStoredChatProjects(raw: unknown): StoredChatProjects {
  if (!raw || typeof raw !== 'object') return EMPTY_CHAT_PROJECTS
  const obj = raw as Partial<StoredChatProjects>
  const folders = Array.isArray(obj.folders)
    ? obj.folders.filter(
        (f): f is ProjectFolder =>
          Boolean(f && typeof f === 'object' && typeof f.id === 'string' && f.id && typeof f.name === 'string' && f.name.trim()),
      )
    : []
  const open = obj.open && typeof obj.open === 'object' ? (obj.open as Record<string, boolean>) : {}
  const assigned = obj.assigned && typeof obj.assigned === 'object' ? (obj.assigned as Record<string, string>) : {}
  return { folders, open, assigned }
}

export function mergeProjectFolders(remote: ProjectFolder[], local: ProjectFolder[]): ProjectFolder[] {
  const seen = new Set<string>()
  const out: ProjectFolder[] = []
  for (const item of [...local, ...remote]) {
    const key = normalizeProjectSlug(item.id || item.name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push({ id: key, name: item.name.trim() })
  }
  return out
}

export function groupThreadsByProject(
  rows: Recent[],
  folders: ProjectFolder[],
  assigned: Record<string, string>,
): { byFolder: Map<string, Recent[]>; filedIds: Set<string> } {
  const byFolder = new Map<string, Recent[]>()
  const byKey = new Map<string, string>()
  for (const folder of folders) {
    byFolder.set(folder.id, [])
    byKey.set(normalizeProjectSlug(folder.id), folder.id)
    byKey.set(normalizeProjectSlug(folder.name), folder.id)
  }
  const filedIds = new Set<string>()
  for (const row of rows) {
    const explicit = assigned[row.id] ? normalizeProjectSlug(assigned[row.id]) : ''
    const implicit = row.project ? normalizeProjectSlug(row.project) : ''
    const target = (explicit && byKey.get(explicit)) || (implicit && byKey.get(implicit)) || null
    if (!target) continue
    byFolder.get(target)?.push(row)
    filedIds.add(row.id)
  }
  return { byFolder, filedIds }
}

export function hasUnreadUpdate(
  rowId: string,
  updatedAt: string | number | undefined,
  activeId: string | null,
  seenAt: Record<string, number>,
): boolean {
  if (!updatedAt || rowId === activeId) return false
  const stamp = typeof updatedAt === 'number' ? updatedAt : Date.parse(updatedAt)
  if (!Number.isFinite(stamp) || stamp <= 0) return false
  const seen = seenAt[rowId]
  return typeof seen === 'number' && stamp > seen
}

function useRemoteProjectFolders(): ProjectFolder[] {
  const [remote, setRemote] = useState<ProjectFolder[]>([])
  useEffect(() => {
    const stop = new AbortController()
    const headers = scope()
    Promise.all([
      fetch(`${api()}/v1/git/repos`, { headers, signal: stop.signal })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`${api()}/v1/project`, { headers, signal: stop.signal })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([reposBody, projectsBody]) => {
      if (stop.signal.aborted) return
      const repoRows = list<{ name?: string; slug?: string }>(
        Array.isArray(reposBody) ? reposBody : (reposBody as { data?: unknown; repos?: unknown } | null)?.data ?? (reposBody as { repos?: unknown } | null)?.repos,
      )
      const projRows = list<{ name?: string; slug?: string }>(
        Array.isArray(projectsBody) ? projectsBody : (projectsBody as { data?: unknown; projects?: unknown } | null)?.data ?? (projectsBody as { projects?: unknown } | null)?.projects,
      )
      const collected: ProjectFolder[] = []
      for (const r of [...repoRows, ...projRows]) {
        const name = (r?.name || r?.slug || '').trim()
        const id = normalizeProjectSlug(r?.slug || name)
        if (id && name) collected.push({ id, name })
      }
      setRemote(collected)
    })
    return () => stop.abort()
  }, [])
  return remote
}

export function useChatProjects(rows: Recent[]) {
  const [raw, save] = useKept<unknown>('hanzo.chat.projects.v1', EMPTY_CHAT_PROJECTS)
  const stored = useMemo(() => readStoredChatProjects(raw), [raw])
  const remote = useRemoteProjectFolders()
  const folders = useMemo(() => mergeProjectFolders(remote, stored.folders), [remote, stored.folders])
  const grouped = useMemo(() => groupThreadsByProject(rows, folders, stored.assigned), [rows, folders, stored.assigned])

  const toggleFolder = (id: string) => {
    save({
      ...stored,
      open: { ...stored.open, [id]: !stored.open[id] },
    })
  }

  const createFolder = (name: string) => {
    const trimmed = name.trim()
    const id = normalizeProjectSlug(trimmed)
    if (!id || !trimmed) return
    const exists = stored.folders.some((f) => normalizeProjectSlug(f.id) === id)
    save({
      ...stored,
      folders: exists ? stored.folders : [...stored.folders, { id, name: trimmed }],
      open: { ...stored.open, [id]: true },
    })
  }

  return {
    folders,
    openMap: stored.open,
    byFolder: grouped.byFolder,
    filedIds: grouped.filedIds,
    toggleFolder,
    createFolder,
  }
}

export function ProjectsTree({
  folders,
  openMap,
  byFolder,
  threads,
  activeId,
  onToggle,
  onCreate,
  onOpen,
  onNew,
}: {
  folders: ProjectFolder[]
  openMap: Record<string, boolean>
  byFolder: Map<string, Recent[]>
  threads: Map<string, Thread>
  activeId: string | null
  onToggle: (id: string) => void
  onCreate: (name: string) => void
  onOpen: (row: Recent) => void
  onNew: () => void
}) {
  const { t } = useI18n()
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState('')

  const submit = () => {
    const next = draft.trim()
    if (!next) return
    onCreate(next)
    setDraft('')
    setCreating(false)
  }

  return (
    <YStack data-slot="chat-projects" gap={1} pt="$2">
      <XStack
        group
        items="center"
        justify="space-between"
        height={26}
        paddingInlineStart="$2"
        paddingInlineEnd="$1"
        shrink={0}
      >
        <SizableText fontSize={11.5} lineHeight={16} fontWeight="500" color="var(--muted-foreground)">
          {t('Projects')}
        </SizableText>
        <XStack
          render="button"
          data-slot="chat-project-add"
          aria-label={t('New project')}
          {...({ title: t('New project') } as object)}
          width={22}
          height={22}
          rounded="$2"
          items="center"
          justify="center"
          cursor="pointer"
          opacity={folders.length === 0 ? 0.72 : 0}
          $group-hover={{ opacity: 1 }}
          focusStyle={{ opacity: 1 }}
          $touchable={{ opacity: 1 }}
          hoverStyle={{ bg: '$hover', opacity: 1 }}
          onPress={() => setCreating(true)}
        >
          <Plus size={13} color="var(--muted-foreground)" aria-hidden />
        </XStack>
      </XStack>

      {folders.length > 0 ? (
        <ConversationMenu threads={threads} active={activeId} onGone={onNew} primary={false}>
          <YStack role="list" aria-label={t('Projects')} gap={1}>
            {folders.map((folder) => {
              const expanded = Boolean(openMap[folder.id])
              const children = byFolder.get(folder.id) ?? []
              return (
                <YStack key={folder.id} role="listitem" gap={1}>
                  <SidebarItem
                    data-slot="project-folder"
                    data-project-id={folder.id}
                    aria-expanded={expanded}
                    rounded={8}
                    minH={28}
                    py={0}
                    px="$2"
                    $touchable={{ minH: 40 }}
                    icon={
                      <XStack width={18} height={18} items="center" justify="center" shrink={0}>
                        {expanded ? (
                          <FolderOpen size={15} strokeWidth={1.75} color="var(--muted-foreground)" aria-hidden />
                        ) : (
                          <Folder size={15} strokeWidth={1.75} color="var(--muted-foreground)" aria-hidden />
                        )}
                      </XStack>
                    }
                    onPress={() => onToggle(folder.id)}
                    onKeyDown={(e: { key?: string; preventDefault?: () => void }) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return
                      e.preventDefault?.()
                      onToggle(folder.id)
                    }}
                  >
                    <SizableText fontSize={13} lineHeight={18} color="var(--foreground)" numberOfLines={1} display="block">
                      {folder.name}
                    </SizableText>
                  </SidebarItem>

                  {expanded ? (
                    children.length > 0 ? (
                      <YStack role="list" aria-label={folder.name} gap={1}>
                        {children.map((child) => {
                          const threadObj = threads.get(child.id)
                          const isOpen = child.id === activeId
                          const labelText = child.title === UNTITLED ? t(UNTITLED) : child.title
                          const item = (
                            <SidebarItem
                              data-slot="project-thread"
                              active={isOpen}
                              rounded={8}
                              minH={27}
                              py={0}
                              paddingInlineStart={28}
                              paddingInlineEnd="$6"
                              $touchable={{ minH: 40, paddingInlineEnd: 48 }}
                              onPress={() => onOpen(child)}
                              onKeyDown={(e: { key?: string; preventDefault?: () => void }) => {
                                if (e.key !== 'Enter' && e.key !== ' ') return
                                e.preventDefault?.()
                                onOpen(child)
                              }}
                            >
                              <SizableText
                                fontSize={13}
                                lineHeight={18}
                                color={isOpen ? 'var(--text-primary)' : 'var(--text-secondary)'}
                                numberOfLines={1}
                                display="block"
                              >
                                {labelText}
                              </SizableText>
                            </SidebarItem>
                          )
                          return threadObj ? (
                            <ThreadRow key={child.id} t={threadObj} active={isOpen}>
                              {item}
                            </ThreadRow>
                          ) : (
                            <YStack key={child.id} role="listitem">
                              {item}
                            </YStack>
                          )
                        })}
                      </YStack>
                    ) : (
                      <XStack height={25} items="center" paddingInlineStart={28} paddingInlineEnd="$2" data-slot="project-empty">
                        <SizableText fontSize={12.5} lineHeight={17} color="var(--text-tertiary)" numberOfLines={1}>
                          {t('No chats')}
                        </SizableText>
                      </XStack>
                    )
                  ) : null}
                </YStack>
              )
            })}
          </YStack>
        </ConversationMenu>
      ) : null}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent maxW={400} rounded="$6" gap="$3">
          <DialogTitle>{t('New project')}</DialogTitle>
          <Input
            autoFocus
            value={draft}
            onChangeText={setDraft}
            placeholder={t('Project name')}
            aria-label={t('Project name')}
            maxLength={64}
            onKeyDown={(e: { key?: string; keyCode?: number; nativeEvent?: { isComposing?: boolean } }) => {
              if (e.key === 'Enter' && !e.nativeEvent?.isComposing && e.keyCode !== 229) submit()
            }}
          />
          <XStack gap="$2" justify="flex-end">
            <Button size="sm" variant="outline" rounded={999} onPress={() => setCreating(false)}>
              {t('Cancel')}
            </Button>
            <Button size="sm" rounded={999} disabled={!draft.trim()} onPress={submit}>
              {t('Create')}
            </Button>
          </XStack>
        </DialogContent>
      </Dialog>
    </YStack>
  )
}
