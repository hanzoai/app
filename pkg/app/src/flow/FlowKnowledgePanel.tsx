'use client'

import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { XStack, YStack } from '@hanzo/gui'
import { Button, Input, Text, Textarea } from '@hanzo/ui'
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Database,
  FileText,
  Globe,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react'
import {
  createEmbeddings,
  deleteKnowledgeFile,
  getKnowledgeGraph,
  importKnowledgeDocument,
  listKnowledgeFiles,
  retrieveKnowledgeFiles,
  searchKnowledge,
  type KnowledgeCitedPassage,
  type KnowledgeFile,
  type KnowledgeGraph,
  type KnowledgeHit,
} from './api'
import { EMBEDDING_MODELS, type EmbeddingModelId } from './types'

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FlowKnowledgePanel({ orgId }: { orgId?: string | null }) {
  const { t } = useI18n()

  const [embeddingModel, setEmbeddingModel] = useState<EmbeddingModelId>('zen-embedding-3')
  const [files, setFiles] = useState<KnowledgeFile[]>([])
  const [graph, setGraph] = useState<KnowledgeGraph>({ nodes: [], edges: [] })
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Live embedding verification probe
  const [embedProbing, setEmbedProbing] = useState(false)
  const [embedStatus, setEmbedStatus] = useState<string | null>(null)
  const [embedError, setEmbedError] = useState<string | null>(null)

  // Live semantic search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchProject, setSearchProject] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchHits, setSearchHits] = useState<KnowledgeHit[]>([])
  const [searchPassages, setSearchPassages] = useState<KnowledgeCitedPassage[]>([])
  const [searchedOnce, setSearchedOnce] = useState(false)

  // Live import state (Text/Markdown or URL)
  const [importMode, setImportMode] = useState<'text' | 'url'>('text')
  const [importTitle, setImportTitle] = useState('')
  const [importProject, setImportProject] = useState('')
  const [importText, setImportText] = useState('')
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importReceipt, setImportReceipt] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const refreshKnowledge = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setLoadError(null)
    try {
      const [filesResult, graphResult] = await Promise.allSettled([
        listKnowledgeFiles({ limit: 100, signal }),
        getKnowledgeGraph({ signal }),
      ])
      if (signal?.aborted) return
      if (filesResult.status === 'fulfilled') {
        setFiles(filesResult.value)
      }
      if (graphResult.status === 'fulfilled') {
        setGraph(graphResult.value)
      }
      if (filesResult.status === 'rejected' && graphResult.status === 'rejected') {
        const err = filesResult.reason
        setLoadError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    void refreshKnowledge(ctrl.signal)
    return () => ctrl.abort()
  }, [orgId, refreshKnowledge])

  const handleTestEmbedding = useCallback(async () => {
    setEmbedProbing(true)
    setEmbedError(null)
    setEmbedStatus(null)
    const t0 = Date.now()
    try {
      const res = await createEmbeddings(
        'Hanzo Cloud native semantic embeddings via Hanzo IAM',
        embeddingModel,
      )
      const ms = Math.max(1, Date.now() - t0)
      setEmbedStatus(`${res.model} · ${res.dimensions}d vector · ${res.totalTokens} tokens · ${ms}ms`)
    } catch (err) {
      setEmbedError(err instanceof Error ? err.message : String(err))
    } finally {
      setEmbedProbing(false)
    }
  }, [embeddingModel])

  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim()
    if (!q || searching) return
    setSearching(true)
    setSearchError(null)
    setSearchedOnce(true)
    try {
      const project = searchProject.trim() || undefined
      const [kbRes, filesRes] = await Promise.allSettled([
        searchKnowledge({ query: q, limit: 10, project }),
        retrieveKnowledgeFiles({ query: q, limit: 8, project }),
      ])
      if (kbRes.status === 'rejected' && filesRes.status === 'rejected') {
        const err = kbRes.reason
        setSearchError(err instanceof Error ? err.message : String(err))
        setSearchHits([])
        setSearchPassages([])
        return
      }
      setSearchHits(kbRes.status === 'fulfilled' ? kbRes.value.hits : [])
      setSearchPassages(filesRes.status === 'fulfilled' ? filesRes.value.passages : [])
    } finally {
      setSearching(false)
    }
  }, [searchQuery, searchProject, searching])

  const handleImport = useCallback(async () => {
    if (importing) return
    setImporting(true)
    setImportError(null)
    setImportReceipt(null)
    try {
      const result = await importKnowledgeDocument({
        title: importTitle.trim() || undefined,
        content: importMode === 'text' ? importText.trim() : undefined,
        url: importMode === 'url' ? importUrl.trim() : undefined,
        project: importProject.trim() || undefined,
      })
      setImportReceipt(
        `Indexed "${result.title}" (${result.imported} page, ${result.chars} chars) into Hanzo Cloud Knowledge via ${embeddingModel}`,
      )
      setImportTitle('')
      setImportText('')
      setImportUrl('')
      void refreshKnowledge()
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err))
    } finally {
      setImporting(false)
    }
  }, [importing, importMode, importTitle, importText, importUrl, importProject, embeddingModel, refreshKnowledge])

  const handleDeleteFile = useCallback(
    async (fileId: string) => {
      try {
        await deleteKnowledgeFile(fileId)
        setFiles((prev) => prev.filter((f) => f.id !== fileId))
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : String(err))
      }
    },
    [],
  )

  const pageNodes = graph.nodes.filter((n) => n.type !== 'unresolved' && n.type !== 'kb.connector')

  return (
    <YStack
      data-slot="flow-knowledge-view"
      flex={1}
      minH={0}
      overflowY="auto"
      p="$5"
      gap="$4"
      bg="$background"
    >
      {/* Header + Native Hanzo Enso Embedding Status Pill */}
      <XStack items="flex-start" justify="space-between" flexWrap="wrap" gap="$3">
        <YStack gap="$1" flex={1} minW={260}>
          <XStack items="center" gap="$2">
            <BookOpen size={18} color="var(--foreground)" aria-hidden />
            <Text fontSize="$5" fontWeight="600" color="$ink">
              {t('Hanzo Cloud Knowledge')}
            </Text>
          </XStack>
          <Text fontSize="$2" color="$quiet">
            {t('Workspace documents, vector embeddings, and hybrid semantic search natively powered by Hanzo Cloud and Hanzo IAM.')}
          </Text>
        </YStack>

        <XStack items="center" gap="$2" flexWrap="wrap">
          <XStack
            data-slot="knowledge-provider-pill"
            items="center"
            gap="$2"
            px="$3"
            py="$1.5"
            rounded="$10"
            bg="var(--surface-card)"
            borderWidth={1}
            borderColor="var(--border-strong)"
          >
            <YStack width={8} height={8} rounded={999} bg="var(--state-online)" />
            <Text fontSize="$1" fontWeight="500" color="$ink" fontFamily="$mono">
              Hanzo Enso — {embeddingModel}
            </Text>
            <Text fontSize="$1" color="$quiet">
              {t('Active via Hanzo IAM')}
            </Text>
          </XStack>

          <Button
            size="sm"
            variant="outline"
            data-slot="knowledge-refresh"
            disabled={loading}
            onPress={() => void refreshKnowledge()}
          >
            {loading ? <Loader2 size={13} aria-hidden /> : <RefreshCw size={13} aria-hidden />}
            {t('Refresh')}
          </Button>
        </XStack>
      </XStack>

      {/* Embedding Provider Configuration Card (pre-enabled out of the box) */}
      <YStack
        data-slot="knowledge-embedding-card"
        p="$4"
        rounded="$4"
        borderWidth={1}
        borderColor="$edge"
        bg="var(--surface-card)"
        gap="$3"
      >
        <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
          <XStack items="center" gap="$2">
            <Layers size={15} color="var(--foreground)" aria-hidden />
            <YStack>
              <Text fontSize="$3" fontWeight="600" color="$ink">
                {t('Native Embeddings Provider')}
              </Text>
              <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                POST /v1/embeddings · api.hanzo.ai/v1 · Hanzo IAM Bearer (no API keys required)
              </Text>
            </YStack>
          </XStack>

          <XStack items="center" gap="$1.5" flexWrap="wrap">
            {EMBEDDING_MODELS.map((m) => {
              const selected = embeddingModel === m.id
              return (
                <XStack
                  key={m.id}
                  render="button"
                  data-slot={`knowledge-embed-model-${m.id}`}
                  onClick={() => setEmbeddingModel(m.id)}
                  px="$2.5"
                  py="$1.5"
                  rounded="$3"
                  borderWidth={1}
                  borderColor={selected ? 'var(--border-selected)' : '$edge'}
                  bg={selected ? '$raised' : 'transparent'}
                  cursor="pointer"
                  hoverStyle={{ borderColor: 'var(--border-strong)' }}
                >
                  <Text fontSize="$1" fontFamily="$mono" fontWeight={selected ? '600' : '400'} color="$ink">
                    {m.id}
                  </Text>
                </XStack>
              )
            })}

            <Button
              size="sm"
              variant="outline"
              data-slot="knowledge-test-embedding"
              disabled={embedProbing}
              onPress={() => void handleTestEmbedding()}
            >
              {embedProbing ? <Loader2 size={13} aria-hidden /> : <Sparkles size={13} aria-hidden />}
              {t('Verify live')}
            </Button>
          </XStack>
        </XStack>

        {embedStatus ? (
          <XStack items="center" gap="$2" px="$3" py="$2" rounded="$3" bg="$background" borderWidth={1} borderColor="$edge">
            <CheckCircle2 size={14} color="var(--state-online)" aria-hidden />
            <Text fontSize="$1" fontFamily="$mono" color="$ink" data-slot="knowledge-embed-receipt">
              {embedStatus}
            </Text>
          </XStack>
        ) : null}

        {embedError ? (
          <XStack items="center" gap="$2" px="$3" py="$2" rounded="$3" bg="var(--state-error-bg)" borderWidth={1} borderColor="var(--state-error)">
            <AlertCircle size={14} color="var(--state-error)" aria-hidden />
            <Text fontSize="$1" color="var(--state-error-text)">
              {embedError}
            </Text>
          </XStack>
        ) : null}
      </YStack>

      {/* Two-column workspace: Semantic Search + Import Document/URL */}
      <XStack gap="$4" flexWrap="wrap" items="stretch">
        {/* Live Semantic Search Card */}
        <YStack
          data-slot="knowledge-search-card"
          flex={1}
          flexBasis={380}
          minW={300}
          p="$4"
          rounded="$4"
          borderWidth={1}
          borderColor="$edge"
          bg="var(--surface-card)"
          gap="$3"
        >
          <XStack items="center" gap="$2">
            <Search size={15} color="var(--foreground)" aria-hidden />
            <YStack>
              <Text fontSize="$3" fontWeight="600" color="$ink">
                {t('Live Semantic Search')}
              </Text>
              <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                POST /v1/knowledge/search + /v1/knowledge/files/retrieve
              </Text>
            </YStack>
          </XStack>

          <XStack gap="$2" flexWrap="wrap">
            <Input
              data-slot="knowledge-search-input"
              flex={1}
              minW={180}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('Ask your org knowledge base…')}
            />
            <Input
              data-slot="knowledge-search-project"
              width={148}
              value={searchProject}
              onChangeText={setSearchProject}
              placeholder={t('Project (optional)')}
            />
            <Button
              size="sm"
              variant="primary"
              data-slot="knowledge-search-submit"
              disabled={searching || !searchQuery.trim()}
              onPress={() => void handleSearch()}
            >
              {searching ? <Loader2 size={13} aria-hidden /> : <Search size={13} aria-hidden />}
              {t('Search')}
            </Button>
          </XStack>

          {searchError ? (
            <XStack items="center" gap="$2" p="$2.5" rounded="$3" bg="var(--state-error-bg)" borderWidth={1} borderColor="var(--state-error)">
              <AlertCircle size={14} color="var(--state-error)" aria-hidden />
              <Text fontSize="$1" color="var(--state-error-text)">
                {searchError}
              </Text>
            </XStack>
          ) : null}

          {searchedOnce && !searching && !searchError && searchHits.length === 0 && searchPassages.length === 0 ? (
            <Text fontSize="$2" color="$quiet">
              {t('No matching passages found yet. Import text or a URL on the right to index your first knowledge document.')}
            </Text>
          ) : null}

          {searchPassages.length > 0 ? (
            <YStack gap="$2" data-slot="knowledge-search-passages">
              <Text fontSize="$1" fontWeight="600" color="$soft">
                {t('Cited file passages')} ({searchPassages.length})
              </Text>
              {searchPassages.map((p, idx) => (
                <YStack
                  key={`${p.cite}-${idx}`}
                  p="$2.5"
                  rounded="$3"
                  borderWidth={1}
                  borderColor="$edge"
                  bg="$background"
                  gap="$1"
                >
                  <XStack items="center" justify="space-between" gap="$2">
                    <Text fontSize="$1" fontWeight="600" color="$ink" numberOfLines={1} flex={1}>
                      {p.cite}
                    </Text>
                    <Text fontSize="$1" fontFamily="$mono" color="$quiet">
                      score {p.score.toFixed(3)}
                    </Text>
                  </XStack>
                  <Text fontSize="$1" color="$soft" numberOfLines={4}>
                    {p.text}
                  </Text>
                </YStack>
              ))}
            </YStack>
          ) : null}

          {searchHits.length > 0 ? (
            <YStack gap="$2" data-slot="knowledge-search-hits">
              <Text fontSize="$1" fontWeight="600" color="$soft">
                {t('Knowledge base matches')} ({searchHits.length})
              </Text>
              {searchHits.map((hit) => (
                <YStack
                  key={`${hit.doctype}:${hit.name}`}
                  p="$2.5"
                  rounded="$3"
                  borderWidth={1}
                  borderColor="$edge"
                  bg="$background"
                  gap="$1"
                >
                  <XStack items="center" justify="space-between" gap="$2">
                    <Text fontSize="$2" fontWeight="500" color="$ink" numberOfLines={1} flex={1}>
                      {hit.title || hit.name}
                    </Text>
                    <Text fontSize="$1" fontFamily="$mono" color="$quiet">
                      {hit.doctype} · {hit.score.toFixed(3)}
                    </Text>
                  </XStack>
                  {hit.project || hit.provider ? (
                    <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                      {[hit.project, hit.provider].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                </YStack>
              ))}
            </YStack>
          ) : null}
        </YStack>

        {/* Create / Import Knowledge Card */}
        <YStack
          data-slot="knowledge-import-card"
          flex={1}
          flexBasis={380}
          minW={300}
          p="$4"
          rounded="$4"
          borderWidth={1}
          borderColor="$edge"
          bg="var(--surface-card)"
          gap="$3"
        >
          <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
            <XStack items="center" gap="$2">
              <Plus size={15} color="var(--foreground)" aria-hidden />
              <YStack>
                <Text fontSize="$3" fontWeight="600" color="$ink">
                  {t('Import into Knowledge Base')}
                </Text>
                <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                  POST /v1/knowledge/import · {embeddingModel}
                </Text>
              </YStack>
            </XStack>

            <XStack gap="$1">
              <XStack
                render="button"
                data-slot="knowledge-import-mode-text"
                onClick={() => setImportMode('text')}
                px="$2.5"
                py="$1"
                rounded="$2"
                borderWidth={1}
                borderColor={importMode === 'text' ? 'var(--border-selected)' : '$edge'}
                bg={importMode === 'text' ? '$raised' : 'transparent'}
                items="center"
                gap="$1"
                cursor="pointer"
              >
                <FileText size={12} aria-hidden />
                <Text fontSize="$1" color="$ink">
                  {t('Text')}
                </Text>
              </XStack>
              <XStack
                render="button"
                data-slot="knowledge-import-mode-url"
                onClick={() => setImportMode('url')}
                px="$2.5"
                py="$1"
                rounded="$2"
                borderWidth={1}
                borderColor={importMode === 'url' ? 'var(--border-selected)' : '$edge'}
                bg={importMode === 'url' ? '$raised' : 'transparent'}
                items="center"
                gap="$1"
                cursor="pointer"
              >
                <Globe size={12} aria-hidden />
                <Text fontSize="$1" color="$ink">
                  {t('URL')}
                </Text>
              </XStack>
            </XStack>
          </XStack>

          <XStack gap="$2" flexWrap="wrap">
            <Input
              data-slot="knowledge-import-title"
              flex={1}
              minW={160}
              value={importTitle}
              onChangeText={setImportTitle}
              placeholder={t('Document title')}
            />
            <Input
              data-slot="knowledge-import-project"
              width={156}
              value={importProject}
              onChangeText={setImportProject}
              placeholder={t('Project / KB name')}
            />
          </XStack>

          {importMode === 'text' ? (
            <Textarea
              data-slot="knowledge-import-text"
              value={importText}
              onChangeText={setImportText}
              placeholder={t('Paste documentation, runbooks, notes, or markdown to embed and index…')}
              rows={5}
            />
          ) : (
            <Input
              data-slot="knowledge-import-url"
              value={importUrl}
              onChangeText={setImportUrl}
              placeholder="https://docs.hanzo.ai/flow"
            />
          )}

          <XStack items="center" justify="space-between" gap="$2">
            <Text fontSize="$1" color="$quiet">
              {t('Embedded automatically with Hanzo Enso — zen-embedding-3')}
            </Text>
            <Button
              size="sm"
              variant="primary"
              data-slot="knowledge-import-submit"
              disabled={importing || (importMode === 'text' ? !importText.trim() : !importUrl.trim())}
              onPress={() => void handleImport()}
            >
              {importing ? <Loader2 size={13} aria-hidden /> : <Plus size={13} aria-hidden />}
              {importing ? t('Indexing…') : t('Import & Index')}
            </Button>
          </XStack>

          {importReceipt ? (
            <XStack items="center" gap="$2" p="$2.5" rounded="$3" bg="$background" borderWidth={1} borderColor="$edge">
              <CheckCircle2 size={14} color="var(--state-online)" aria-hidden />
              <Text fontSize="$1" color="$ink" data-slot="knowledge-import-receipt">
                {importReceipt}
              </Text>
            </XStack>
          ) : null}

          {importError ? (
            <XStack items="center" gap="$2" p="$2.5" rounded="$3" bg="var(--state-error-bg)" borderWidth={1} borderColor="var(--state-error)">
              <AlertCircle size={14} color="var(--state-error)" aria-hidden />
              <Text fontSize="$1" color="var(--state-error-text)">
                {importError}
              </Text>
            </XStack>
          ) : null}
        </YStack>
      </XStack>

      {/* Indexed Workspace Files & Knowledge Graph Documents */}
      {loadError ? (
        <XStack items="center" gap="$2" p="$3" rounded="$4" bg="var(--state-error-bg)" borderWidth={1} borderColor="var(--state-error)">
          <AlertCircle size={15} color="var(--state-error)" aria-hidden />
          <Text fontSize="$2" color="var(--state-error-text)">
            {loadError}
          </Text>
        </XStack>
      ) : null}

      <XStack gap="$4" flexWrap="wrap" items="stretch">
        {/* Workspace Files (`GET /v1/knowledge/files`) */}
        <YStack
          data-slot="knowledge-files-list"
          flex={1}
          flexBasis={380}
          minW={300}
          p="$4"
          rounded="$4"
          borderWidth={1}
          borderColor="$edge"
          bg="var(--surface-card)"
          gap="$3"
        >
          <XStack items="center" justify="space-between" gap="$2">
            <XStack items="center" gap="$2">
              <Database size={15} color="var(--foreground)" aria-hidden />
              <Text fontSize="$3" fontWeight="600" color="$ink">
                {t('Workspace Files')} ({files.length})
              </Text>
            </XStack>
            <Text fontSize="$1" fontFamily="$mono" color="$quiet">
              GET /v1/knowledge/files
            </Text>
          </XStack>

          {files.length === 0 ? (
            <Text fontSize="$2" color="$quiet">
              {loading
                ? t('Loading indexed workspace files…')
                : t('No workspace files indexed yet. Files uploaded in Drive or Chat appear here automatically with vector embeddings.')}
            </Text>
          ) : (
            <YStack gap="$2">
              {files.map((file) => (
                <XStack
                  key={file.id}
                  data-slot={`knowledge-file-${file.id}`}
                  items="center"
                  justify="space-between"
                  gap="$2"
                  p="$2.5"
                  rounded="$3"
                  borderWidth={1}
                  borderColor="$edge"
                  bg="$background"
                >
                  <YStack flex={1} minW={0} gap="$0.5">
                    <XStack items="center" gap="$2">
                      <Text fontSize="$2" fontWeight="500" color="$ink" numberOfLines={1}>
                        {file.name}
                      </Text>
                      <Text fontSize="$1" fontFamily="$mono" color="$quiet" px="$1.5" py={1} rounded="$2" bg="$hover">
                        {file.status}
                        {file.stage ? ` · ${file.stage}` : ''}
                      </Text>
                    </XStack>
                    <Text fontSize="$1" color="$quiet" fontFamily="$mono" numberOfLines={1}>
                      {file.bucket} · {formatBytes(file.size)}
                      {typeof file.passages === 'number' ? ` · ${file.passages} passages` : ''}
                      {typeof file.embedded === 'number' ? ` · ${file.embedded} vectors` : ''}
                    </Text>
                  </YStack>
                  <XStack
                    render="button"
                    aria-label={t('Remove from knowledge index')}
                    onClick={() => void handleDeleteFile(file.id)}
                    width={26}
                    height={26}
                    rounded="$2"
                    items="center"
                    justify="center"
                    cursor="pointer"
                    hoverStyle={{ bg: '$hover' }}
                  >
                    <Trash2 size={13} color="var(--muted-foreground)" aria-hidden />
                  </XStack>
                </XStack>
              ))}
            </YStack>
          )}
        </YStack>

        {/* Knowledge Base Pages & Graph Nodes (`GET /v1/knowledge/graph`) */}
        <YStack
          data-slot="knowledge-graph-list"
          flex={1}
          flexBasis={380}
          minW={300}
          p="$4"
          rounded="$4"
          borderWidth={1}
          borderColor="$edge"
          bg="var(--surface-card)"
          gap="$3"
        >
          <XStack items="center" justify="space-between" gap="$2">
            <XStack items="center" gap="$2">
              <BookOpen size={15} color="var(--foreground)" aria-hidden />
              <Text fontSize="$3" fontWeight="600" color="$ink">
                {t('Knowledge Pages & Graph')} ({pageNodes.length})
              </Text>
            </XStack>
            <Text fontSize="$1" fontFamily="$mono" color="$quiet">
              GET /v1/knowledge/graph · {graph.edges.length} links
            </Text>
          </XStack>

          {pageNodes.length === 0 ? (
            <Text fontSize="$2" color="$quiet">
              {loading
                ? t('Loading knowledge graph…')
                : t('No knowledge pages indexed yet. Use Import into Knowledge Base above to add text or URLs.')}
            </Text>
          ) : (
            <YStack gap="$1.5">
              {pageNodes.slice(0, 30).map((node) => (
                <XStack
                  key={node.id}
                  items="center"
                  justify="space-between"
                  gap="$2"
                  p="$2.5"
                  rounded="$3"
                  borderWidth={1}
                  borderColor="$edge"
                  bg="$background"
                >
                  <YStack flex={1} minW={0}>
                    <Text fontSize="$2" fontWeight="500" color="$ink" numberOfLines={1}>
                      {node.title || node.name}
                    </Text>
                    <Text fontSize="$1" fontFamily="$mono" color="$quiet" numberOfLines={1}>
                      {node.type}
                      {node.project ? ` · ${node.project}` : ''}
                    </Text>
                  </YStack>
                </XStack>
              ))}
            </YStack>
          )}
        </YStack>
      </XStack>
    </YStack>
  )
}
