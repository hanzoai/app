'use client'

// A workspace file's table of contents, opened beside Drive.
//
// The index reads every file into sections — a page's headings, a PDF's outline,
// a document's heading styles, a sheet's rows, a long text cut into parts — each
// with a one-line summary. This pane draws that tree, opens a section's own
// text, and follows the graph from it: the sections it links to, the files that
// cite it, the entities it shares with the rest of the workspace. It is the same
// tree `retrieve` reads before it picks where to look, so what a person browses
// here is what an answer cites.

import { useEffect, useState } from 'react'
import { phrase, english, type Say } from '@hanzo/i18n'
import { useI18n } from '@hanzo/i18n/react'
import { ArrowLeft, MessageSquare, X } from 'lucide-react'
import { Box, Button, Text, XStack, YStack } from '@hanzo/ui'
import { pct, section as openSection, toc, type Api, type Opened, type Passage, type TocEntry, type WorkFile } from './lib/files'
import { BAD } from './lib/mix'

/** What each stage of a file's ingest is doing, as a person reads it: authored English, drawn through `t`. */
const STAGE: Record<NonNullable<WorkFile['stage']>, string> = {
  extract: phrase('reading'),
  toc: phrase('contents'),
  passages: phrase('passages'),
  graph: phrase('linking'),
  embed: phrase('vectors'),
}

/** How far a file's ingest has got, as Drive's badge and this pane's head say it, in the reader's words given their `t`. */
export function standing(f: WorkFile, t: Say = english): string {
  const at = pct(f)
  switch (f.status) {
    case 'ready': {
      // Ready means read; while its vectors fill in, search by meaning grows.
      const count = f.sections ?? 0
      const head = f.clipped ? t('Indexed in part · {count} sections', { count }) : t('Indexed · {count} sections', { count })
      return f.stage === 'embed' && at !== undefined ? t('{head} · vectors {percent}%', { head, percent: at }) : head
    }
    case 'stored':
      return t('Kept, not indexed')
    case 'failed':
      return t('Indexing failed')
    case 'queued':
      return t('Queued')
    default: {
      const stage = f.stage ? t(STAGE[f.stage]) : t('starting')
      return at === undefined ? t('Indexing · {stage}', { stage }) : t('Indexing · {stage} {percent}%', { stage, percent: at })
    }
  }
}

/** The badge a Drive row wears for its index state. */
export function Badge({ f }: { f: WorkFile }) {
  const { t } = useI18n()
  const bad = f.status === 'failed'
  return (
    <Text
      fontSize="$1"
      color={bad ? BAD : f.status === 'ready' ? '$soft' : '$faint'}
      numberOfLines={1}
      data-slot="drive-index"
      data-state={f.status}
      data-stage={f.stage ?? ''}
      {...(f.error || f.note ? ({ title: f.error || f.note } as object) : null)}
    >
      {standing(f, t)}
    </Text>
  )
}

/** Passages of the workspace that match a search, each naming where it is. */
export function Hits({ hits, onOpen }: { hits: Passage[]; onOpen: (p: Passage) => void }) {
  const { t } = useI18n()
  return (
    <YStack gap="$2" data-slot="drive-passages">
      <Text fontSize={12} fontWeight="600" color="$soft">
        {t('Passages')}
      </Text>
      <YStack borderWidth={1} borderColor="$borderColor" rounded={8} overflow="hidden">
        {hits.map((p, i) => (
          <YStack
            key={`${p.file.id}#${p.section.id}.${p.part}.${i}`}
            px={16}
            py={10}
            gap="$1"
            cursor="pointer"
            borderBottomWidth={i === hits.length - 1 ? 0 : 1}
            borderColor="$borderColor"
            hoverStyle={{ bg: '$hover' }}
            onPress={() => onOpen(p)}
            data-slot="drive-passage"
          >
            <Text fontSize="$2" fontWeight="600" color="$ink" numberOfLines={1}>
              {p.cite}
            </Text>
            <Text fontSize="$2" color="$soft" numberOfLines={3}>
              {p.text}
            </Text>
          </YStack>
        ))}
      </YStack>
    </YStack>
  )
}

/** The pane: a file's tree, and one section opened from it. */
export function Contents({
  api,
  file,
  at,
  onClose,
  onAsk,
  onFollow,
}: {
  api: Api
  file: WorkFile
  /** The section to open on arrival, when a search hit brought the reader here. */
  at?: number
  onClose: () => void
  onAsk: (f: WorkFile) => void
  /** Follows a link into another file. */
  onFollow: (file: string, section: number) => void
}) {
  const { t } = useI18n()
  const [tree, setTree] = useState<{ file: WorkFile; sections: TocEntry[] } | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [open, setOpen] = useState<Opened | null>(null)
  const [reading, setReading] = useState<number | null>(at ?? null)

  useEffect(() => {
    let live = true
    setTree(null)
    setFailed(null)
    toc(api, file.id)
      .then((got) => live && setTree(got))
      .catch((e) => live && setFailed((e as Error)?.message || t('The contents could not be read.')))
    return () => {
      live = false
    }
  }, [api, file.id])

  useEffect(() => {
    setReading(at ?? null)
  }, [at, file.id])

  useEffect(() => {
    if (reading === null) {
      setOpen(null)
      return
    }
    let live = true
    openSection(api, file.id, reading)
      .then((o) => live && setOpen(o))
      .catch((e) => live && setFailed((e as Error)?.message || t('The section could not be opened.')))
    return () => {
      live = false
    }
  }, [api, file.id, reading])

  const shown = tree?.file ?? file
  return (
    <YStack
      position="absolute"
      t={0}
      insetInlineEnd={0}
      b={0}
      width={440}
      maxW="100%"
      bg="$background"
      borderInlineStartWidth={1}
      borderColor="$borderColor"
      boxShadow="var(--shadow-lg)"
      z="var(--z-drawer)"
      data-slot="drive-contents"
    >
      <XStack items="center" justify="space-between" gap="$2" px="$4" py="$3" borderBottomWidth={1} borderColor="$borderColor">
        <YStack minW={0} flex={1}>
          <Text fontSize="$3" fontWeight="600" color="$ink" numberOfLines={1}>
            {shown.name}
          </Text>
          <Text fontSize="$1" color="$soft" numberOfLines={1}>
            {standing(shown, t)}
          </Text>
          {shown.note ? (
            <Text fontSize="$1" color="$faint" data-slot="drive-note">
              {shown.note.replace(/\n/g, ' ')}
            </Text>
          ) : null}
        </YStack>
        <Button size="sm" onClick={() => onAsk(shown)} aria-label={t('Ask in chat')}>
          <MessageSquare size={14} />
          {t('Ask in chat')}
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t('Close contents')} title={t('Close')}>
          <X size={15} />
        </Button>
      </XStack>
      <YStack flex={1} minH={0} overflowY="auto" px="$4" py="$3" gap="$2">
        {failed ? (
          <Text fontSize="$2" color={BAD}>
            {failed}
          </Text>
        ) : null}
        {open ? (
          <YStack gap="$3" data-slot="drive-section">
            <Button variant="ghost" size="sm" justify="flex-start" px={0} onClick={() => setReading(null)}>
              <ArrowLeft size={13} data-i18n-mirror />
              {t('Contents')}
            </Button>
            <Text fontSize="$1" color="$soft">
              {open.section.path}
            </Text>
            <Text fontSize="$4" fontWeight="600" color="$ink">
              {open.section.title}
            </Text>
            {open.summary ? (
              <Text fontSize="$2" color="$soft">
                {open.summary}
              </Text>
            ) : null}
            <Text fontSize="$2" color="$ink" whiteSpace="pre-wrap">
              {open.text}
            </Text>
            {open.children.length ? (
              <YStack gap="$1">
                <Text fontSize={11} fontWeight="600" color="$faint" letterSpacing={0.6}>
                  {t('Subsections')}
                </Text>
                {open.children.map((c) => (
                  <Entry key={c.id} e={c} onOpen={() => setReading(c.id)} />
                ))}
              </YStack>
            ) : null}
            {open.links.length ? (
              <YStack gap="$1" data-slot="drive-links">
                <Text fontSize={11} fontWeight="600" color="$faint" letterSpacing={0.6}>
                  {t('Linked')}
                </Text>
                {open.links.map((l, i) => (
                  <Box
                    key={`${l.file.id}#${l.section.id}.${i}`}
                    render="button"
                    items="flex-start"
                    py="$1"
                    onClick={() => (l.file.id === file.id ? setReading(l.section.id) : onFollow(l.file.id, l.section.id))}
                  >
                    <Text fontSize="$2" color="$ink" numberOfLines={1}>
                      {l.file.id === file.id ? l.section.path || l.section.title : `${l.file.name} › ${l.section.path || l.section.title}`}
                    </Text>
                    <Text fontSize="$1" color="$soft" numberOfLines={1}>
                      {l.kind}
                      {l.label ? ` · ${l.label}` : ''}
                    </Text>
                  </Box>
                ))}
              </YStack>
            ) : null}
            {open.entities.length ? (
              <Text fontSize="$1" color="$soft">
                {t('Names: {names}', { names: open.entities.map((e) => e.name).join(', ') })}
              </Text>
            ) : null}
          </YStack>
        ) : !tree ? (
          failed ? null : (
            <Text fontSize="$2" color="$soft">
              {t('Reading the contents…')}
            </Text>
          )
        ) : tree.sections.length <= 1 ? (
          <Text fontSize="$2" color="$soft">
            {t(shown.status === 'ready' ? 'This file has no sections.' : 'The contents appear once the file is indexed.')}
          </Text>
        ) : (
          tree.sections
            .filter((e) => e.level > 0)
            .map((e) => <Entry key={e.id} e={e} onOpen={() => setReading(e.id)} />)
        )}
      </YStack>
    </YStack>
  )
}

/** One line of the tree, indented by its depth. */
function Entry({ e, onOpen }: { e: TocEntry; onOpen: () => void }) {
  return (
    <Box render="button" items="flex-start" paddingInlineStart={(Math.max(1, e.level) - 1) * 14} py="$1" onClick={onOpen} data-slot="drive-toc-entry">
      <Text fontSize="$2" color="$ink" numberOfLines={1}>
        {e.title}
      </Text>
      {e.summary ? (
        <Text fontSize="$1" color="$soft" numberOfLines={2}>
          {e.summary}
        </Text>
      ) : null}
    </Box>
  )
}
