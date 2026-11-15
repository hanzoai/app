'use client'

// Unified Secrets & Credential Autofill Vault shared across:
//   - platform.hanzo.ai (Secrets & KMS)
//   - hanzo.app / hanzo.ai Settings (Computer & Browser / Security)
//   - hanzo.bot (Bot inspector + Desktop Sandbox Computer 1-click & agent autofill)
//
// Non-secret metadata lives in `config` under `/v1/settings/vault`; every secret
// value (passwords, API keys, TOTP seeds, 1Password / LastPass tokens) is sealed
// directly into Hanzo KMS at `orgs/{org}/settings/vault/{key}` and never returned
// on read.

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { Input, Text, XStack, YStack } from '@hanzo/gui'
import { Button, Dialog, DialogContent, DialogTitle } from '@hanzo/ui'
import { Check, Globe, KeyRound, Lock, Plus, RefreshCw, Shield, Trash2, Upload, X } from 'lucide-react'
import { api } from './lib/api'
import { scope } from './lib/session'
import { say } from './failure'
import { CARD, CLIP, LABEL, PILL, ROUND, WORD } from './bots/kit'
import { DIM, FLOOR, GROUND, INK, LINE, PICKED, RAISED } from './bots/ink'

export type VaultSource = 'hanzo' | '1password' | 'lastpass'
export type VaultKind = 'login' | 'api_key' | 'secret'

export interface VaultItem {
  id: string
  kind: VaultKind
  name: string
  envVar?: string
  domain?: string
  url?: string
  username?: string
  secretKey: string
  totpSecretKey?: string
  source: VaultSource
  vaultRef?: string
  updatedAt: string
}

export interface VaultProviders {
  onepassword?: {
    connected: boolean
    vaultName?: string
    accountHint?: string
    secretKey?: string
    syncedCount?: number
    updatedAt?: string
  }
  lastpass?: {
    connected: boolean
    email?: string
    secretKey?: string
    syncedCount?: number
    updatedAt?: string
  }
}

export interface VaultDoc {
  items: VaultItem[]
  providers: VaultProviders
  secretKeys: string[]
}

interface SettingsWire {
  product?: string
  config?: {
    items?: VaultItem[]
    providers?: VaultProviders
  }
  secretKeys?: string[]
}

function slugKey(prefix: string, id: string): string {
  const clean = id
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 44)
  return `${prefix}_${clean || 'item'}`.slice(0, 62)
}

function mintId(): string {
  const rand = Math.random().toString(36).slice(2, 8)
  return `v_${Date.now().toString(36)}${rand}`
}

function normalizeHost(raw: string): string {
  const s = raw.trim().toLowerCase()
  if (!s) return ''
  try {
    if (s.includes('://')) return new URL(s).hostname.replace(/^www\./, '')
  } catch {
    // ignore malformed URL
  }
  return (s.split('/')[0] ?? '').replace(/^www\./, '')
}

export async function readVault(signal?: AbortSignal): Promise<VaultDoc> {
  try {
    const r = await fetch(`${api()}/v1/settings/vault`, { headers: scope(), signal })
    if (!r.ok) return { items: [], providers: {}, secretKeys: [] }
    const j = (await r.json()) as SettingsWire
    return {
      items: Array.isArray(j.config?.items) ? j.config.items : [],
      providers: j.config?.providers ?? {},
      secretKeys: Array.isArray(j.secretKeys) ? j.secretKeys : [],
    }
  } catch {
    return { items: [], providers: {}, secretKeys: [] }
  }
}

export async function writeVault(
  config: { items: VaultItem[]; providers: VaultProviders },
  secrets: Record<string, string> = {},
): Promise<VaultDoc> {
  const r = await fetch(`${api()}/v1/settings/vault`, {
    method: 'PUT',
    headers: { ...scope(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ config, secrets }),
  })
  if (!r.ok) {
    const msg = await r.text().catch(() => '')
    throw new Error(msg || `Vault write failed (${r.status})`)
  }
  const j = (await r.json()) as SettingsWire
  return {
    items: Array.isArray(j.config?.items) ? j.config.items : config.items,
    providers: j.config?.providers ?? config.providers,
    secretKeys: Array.isArray(j.secretKeys) ? j.secretKeys : [],
  }
}

function parseCsvRows(raw: string): string[][] {
  const rows: string[][] = []
  let cur: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    const next = raw[i + 1]
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      cur.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && next === '\n') i++
      cur.push(field)
      field = ''
      if (cur.some((c) => c.trim().length > 0)) rows.push(cur)
      cur = []
    } else {
      field += ch
    }
  }
  cur.push(field)
  if (cur.some((c) => c.trim().length > 0)) rows.push(cur)
  return rows
}

export function parsePasswordImport(
  raw: string,
  source: '1password' | 'lastpass',
): { items: VaultItem[]; secrets: Record<string, string> } {
  const now = new Date().toISOString()
  const items: VaultItem[] = []
  const secrets: Record<string, string> = {}

  const trimmed = raw.trim()
  if (!trimmed) return { items, secrets }

  // JSON export (1Password CLI `op item list --format=json` or structured export)
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as { items?: unknown[] }).items)
          ? (parsed as { items: unknown[] }).items
          : []
      for (const entry of list) {
        if (!entry || typeof entry !== 'object') continue
        const rec = entry as Record<string, unknown>
        const title = String(rec.title ?? rec.name ?? '').trim()
        const urls = Array.isArray(rec.urls) ? (rec.urls as Array<{ href?: string }>) : []
        const rawUrl = String(rec.url ?? urls[0]?.href ?? rec.domain ?? '').trim()
        const fields = Array.isArray(rec.fields) ? (rec.fields as Array<Record<string, unknown>>) : []
        const findField = (pred: (f: Record<string, unknown>) => boolean) =>
          String(fields.find(pred)?.value ?? '').trim()
        const username =
          String(rec.username ?? '').trim() ||
          findField((f) => String(f.purpose ?? f.id ?? f.label ?? '').toLowerCase().includes('user'))
        const secretVal =
          String(rec.secret ?? rec.value ?? '').trim() ||
          findField((f) => {
            const k = String(f.purpose ?? f.id ?? f.label ?? '').toLowerCase()
            return k.includes('pass') || k.includes('credential') || k.includes('token')
          })
        const totpVal =
          String(rec.totp ?? '').trim() ||
          findField((f) => String(f.type ?? f.id ?? f.label ?? '').toLowerCase().includes('otp'))
        if (!secretVal) continue
        const id = mintId()
        const secretKey = slugKey('item', `${id}_s`)
        secrets[secretKey] = secretVal
        let totpSecretKey: string | undefined
        if (totpVal) {
          totpSecretKey = slugKey('item', `${id}_t`)
          secrets[totpSecretKey] = totpVal
        }
        items.push({
          id,
          kind: 'login',
          name: title || normalizeHost(rawUrl) || 'Imported Login',
          domain: normalizeHost(rawUrl) || undefined,
          url: rawUrl || undefined,
          username: username || undefined,
          secretKey,
          totpSecretKey,
          source,
          updatedAt: now,
        })
      }
      return { items, secrets }
    } catch {
      // fall through to CSV parser
    }
  }

  // CSV export (LastPass: url,username,password,totp,extra,name,grouping,fav
  //             1Password: Title,Url,Username,Password,OTPAuth)
  const rows = parseCsvRows(trimmed)
  if (rows.length < 2) return { items, secrets }
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const col = (...names: string[]) => header.findIndex((h) => names.some((n) => h === n || h.includes(n)))
  const idxName = col('title', 'name')
  const idxUrl = col('url', 'website', 'domain')
  const idxUser = col('username', 'login', 'email')
  const idxSecret = col('password', 'secret')
  const idxTotp = col('otpauth', 'totp', 'one-time')

  for (const row of rows.slice(1)) {
    const secretVal = idxSecret >= 0 ? (row[idxSecret] ?? '').trim() : ''
    if (!secretVal) continue
    const rawUrl = idxUrl >= 0 ? (row[idxUrl] ?? '').trim() : ''
    const name = idxName >= 0 ? (row[idxName] ?? '').trim() : ''
    const username = idxUser >= 0 ? (row[idxUser] ?? '').trim() : ''
    const totpVal = idxTotp >= 0 ? (row[idxTotp] ?? '').trim() : ''
    const id = mintId()
    const secretKey = slugKey('item', `${id}_s`)
    secrets[secretKey] = secretVal
    let totpSecretKey: string | undefined
    if (totpVal) {
      totpSecretKey = slugKey('item', `${id}_t`)
      secrets[totpSecretKey] = totpVal
    }
    items.push({
      id,
      kind: 'login',
      name: name || normalizeHost(rawUrl) || username || 'Imported Login',
      domain: normalizeHost(rawUrl) || undefined,
      url: rawUrl || undefined,
      username: username || undefined,
      secretKey,
      totpSecretKey,
      source,
      updatedAt: now,
    })
    if (Object.keys(secrets).length >= 56) break
  }
  return { items, secrets }
}

const SOURCE_LABEL: Record<VaultSource, string> = {
  hanzo: 'Hanzo KMS',
  '1password': '1Password',
  lastpass: 'LastPass',
}

export function VaultManager({
  compact = false,
  onAutofill,
  onChanged,
}: {
  compact?: boolean
  onAutofill?: (item: VaultItem, field?: 'login' | 'totp') => void
  onChanged?: (doc: VaultDoc) => void
}) {
  const { t } = useI18n()
  const [doc, setDoc] = useState<VaultDoc>({ items: [], providers: {}, secretKeys: [] })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [tab, setTab] = useState<'all' | 'add' | '1password' | 'lastpass'>('all')
  const [kind, setKind] = useState<VaultKind>('login')
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [envVar, setEnvVar] = useState('')
  const [username, setUsername] = useState('')
  const [secretValue, setSecretValue] = useState('')
  const [totpValue, setTotpValue] = useState('')

  // 1Password & LastPass state
  const [opToken, setOpToken] = useState('')
  const [opVaultName, setOpVaultName] = useState('Private')
  const [lpEmail, setLpEmail] = useState('')
  const [lpToken, setLpToken] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [importSource, setImportSource] = useState<'1password' | 'lastpass'>('1password')

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true)
      const next = await readVault(signal)
      if (!signal?.aborted) {
        setDoc(next)
        if (next.providers.onepassword?.vaultName) setOpVaultName(next.providers.onepassword.vaultName)
        if (next.providers.lastpass?.email) setLpEmail(next.providers.lastpass.email)
        setLoading(false)
        onChanged?.(next)
      }
    },
    [onChanged],
  )

  useEffect(() => {
    const stop = new AbortController()
    void refresh(stop.signal)
    return () => stop.abort()
  }, [refresh])

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !secretValue.trim() || busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const id = mintId()
      const secretKey = slugKey('item', `${id}_s`)
      const secrets: Record<string, string> = { [secretKey]: secretValue }
      let totpSecretKey: string | undefined
      if (totpValue.trim()) {
        totpSecretKey = slugKey('item', `${id}_t`)
        secrets[totpSecretKey] = totpValue.trim()
      }
      const nextItem: VaultItem = {
        id,
        kind,
        name: name.trim(),
        domain: kind === 'login' ? normalizeHost(domain) || undefined : undefined,
        url: kind === 'login' && domain.trim() ? domain.trim() : undefined,
        envVar: kind !== 'login' && envVar.trim() ? envVar.trim().toUpperCase() : undefined,
        username: kind === 'login' && username.trim() ? username.trim() : undefined,
        secretKey,
        totpSecretKey,
        source: 'hanzo',
        updatedAt: new Date().toISOString(),
      }
      const saved = await writeVault({ items: [nextItem, ...doc.items], providers: doc.providers }, secrets)
      setDoc(saved)
      onChanged?.(saved)
      setName('')
      setDomain('')
      setEnvVar('')
      setUsername('')
      setSecretValue('')
      setTotpValue('')
      setTab('all')
      setNotice(t('Sealed "{name}" into Hanzo KMS — ready across platform.hanzo.ai, hanzo.app & hanzo.bot.', { name: nextItem.name }))
    } catch (err) {
      setError(say(err, t('Vault secret'), 'save', t))
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async (id: string) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const nextItems = doc.items.filter((i) => i.id !== id)
      const saved = await writeVault({ items: nextItems, providers: doc.providers })
      setDoc(saved)
      onChanged?.(saved)
    } catch (err) {
      setError(say(err, t('Vault item'), 'save', t))
    } finally {
      setBusy(false)
    }
  }

  const handleConnect1Password = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const secrets: Record<string, string> = {}
      if (opToken.trim()) secrets.op_service_account_token = opToken.trim()
      const saved = await writeVault(
        {
          items: doc.items,
          providers: {
            ...doc.providers,
            onepassword: {
              connected: Boolean(opToken.trim() || doc.providers.onepassword?.connected),
              vaultName: opVaultName.trim() || 'Private',
              secretKey: 'op_service_account_token',
              syncedCount: doc.items.filter((i) => i.source === '1password').length,
              updatedAt: new Date().toISOString(),
            },
          },
        },
        secrets,
      )
      setDoc(saved)
      onChanged?.(saved)
      setOpToken('')
      setNotice(t('1Password connected and Service Account token sealed in Hanzo KMS.'))
    } catch (err) {
      setError(say(err, '1Password', 'save', t))
    } finally {
      setBusy(false)
    }
  }

  const handleConnectLastPass = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const secrets: Record<string, string> = {}
      if (lpToken.trim()) secrets.lp_vault_token = lpToken.trim()
      const saved = await writeVault(
        {
          items: doc.items,
          providers: {
            ...doc.providers,
            lastpass: {
              connected: Boolean(lpEmail.trim() || lpToken.trim() || doc.providers.lastpass?.connected),
              email: lpEmail.trim() || doc.providers.lastpass?.email,
              secretKey: 'lp_vault_token',
              syncedCount: doc.items.filter((i) => i.source === 'lastpass').length,
              updatedAt: new Date().toISOString(),
            },
          },
        },
        secrets,
      )
      setDoc(saved)
      onChanged?.(saved)
      setLpToken('')
      setNotice(t('LastPass account linked and vault credential sealed in Hanzo KMS.'))
    } catch (err) {
      setError(say(err, 'LastPass', 'save', t))
    } finally {
      setBusy(false)
    }
  }

  const handleFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const raw = await file.text()
      const parsed = parsePasswordImport(raw, importSource)
      if (!parsed.items.length) {
        setError(t('No login rows found in file. Export as CSV or JSON from {src} and try again.', { src: SOURCE_LABEL[importSource] }))
        return
      }
      const nextItems = [...parsed.items, ...doc.items]
      const nextProviders: VaultProviders = {
        ...doc.providers,
        ...(importSource === '1password'
          ? {
              onepassword: {
                ...doc.providers.onepassword,
                connected: true,
                syncedCount: nextItems.filter((i) => i.source === '1password').length,
                updatedAt: new Date().toISOString(),
              },
            }
          : {
              lastpass: {
                ...doc.providers.lastpass,
                connected: true,
                syncedCount: nextItems.filter((i) => i.source === 'lastpass').length,
                updatedAt: new Date().toISOString(),
              },
            }),
      }
      const saved = await writeVault({ items: nextItems, providers: nextProviders }, parsed.secrets)
      setDoc(saved)
      onChanged?.(saved)
      setTab('all')
      setNotice(
        t('Imported and KMS-sealed {n} credentials from {src}.', {
          n: parsed.items.length,
          src: SOURCE_LABEL[importSource],
        }),
      )
    } catch (err) {
      setError(say(err, SOURCE_LABEL[importSource], 'save', t))
    } finally {
      setBusy(false)
    }
  }

  const triggerImport = (src: '1password' | 'lastpass') => {
    setImportSource(src)
    fileInputRef.current?.click()
  }

  const counts = useMemo(
    () => ({
      logins: doc.items.filter((i) => i.kind === 'login').length,
      keys: doc.items.filter((i) => i.kind !== 'login').length,
      op: Boolean(doc.providers.onepassword?.connected),
      lp: Boolean(doc.providers.lastpass?.connected),
    }),
    [doc],
  )

  return (
    <YStack gap={14} data-parity-key="vault.manager">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.json,.txt"
        onChange={(e: ChangeEvent<HTMLInputElement>) => void handleFileSelected(e)}
        hidden
      />

      <XStack items="center" justify="space-between" gap={8} flexWrap="wrap">
        <XStack p={3} rounded={999} bg={RAISED} borderWidth={1} borderColor={LINE} gap={2} flexWrap="wrap">
          {(
            [
              { id: 'all', label: t('Vault ({n})', { n: doc.items.length }) },
              { id: 'add', label: t('+ Add Secret / Login') },
              { id: '1password', label: counts.op ? '1Password ✓' : '1Password' },
              { id: 'lastpass', label: counts.lp ? 'LastPass ✓' : 'LastPass' },
            ] as const
          ).map((item) => {
            const active = tab === item.id
            return (
              <XStack
                key={item.id}
                render="button"
                {...{ type: 'button' }}
                onClick={() => setTab(item.id)}
                height={28}
                px={12}
                rounded={999}
                items="center"
                bg={active ? PICKED : 'transparent'}
                borderWidth={0}
                cursor="pointer"
              >
                <Text fontSize={12} lineHeight={16} fontWeight={active ? '500' : '400'} color={active ? INK : DIM}>
                  {item.label}
                </Text>
              </XStack>
            )
          })}
        </XStack>

        <XStack {...ROUND} width={30} height={30} aria-label={t('Refresh vault')} onClick={() => void refresh()}>
          <RefreshCw size={13} color={DIM} aria-hidden />
        </XStack>
      </XStack>

      {notice ? (
        <XStack px={12} py={8} rounded={10} bg={RAISED} borderWidth={1} borderColor={LINE} gap={8} items="center">
          <Check size={14} color={INK} aria-hidden />
          <Text fontSize={12} lineHeight={17} color={INK} flex={1}>
            {notice}
          </Text>
        </XStack>
      ) : null}

      {error ? (
        <Text role="alert" fontSize={12} lineHeight={17} color={DIM}>
          {error}
        </Text>
      ) : null}

      {tab === 'add' ? (
        <YStack render="form" {...{ onSubmit: (e: FormEvent) => void handleAdd(e) }} {...CARD} p={14} gap={12}>
          <XStack gap={6} flexWrap="wrap">
            {(
              [
                { id: 'login', label: t('Website Login (Autofill)') },
                { id: 'api_key', label: t('Shared API Key') },
                { id: 'secret', label: t('Environment Secret') },
              ] as const
            ).map((opt) => {
              const picked = kind === opt.id
              return (
                <XStack
                  key={opt.id}
                  render="button"
                  {...{ type: 'button' }}
                  onClick={() => setKind(opt.id)}
                  height={28}
                  px={11}
                  rounded={999}
                  items="center"
                  bg={picked ? INK : GROUND}
                  borderWidth={1}
                  borderColor={picked ? INK : LINE}
                  cursor="pointer"
                >
                  <Text fontSize={12} lineHeight={16} fontWeight="500" color={picked ? 'var(--background)' : INK}>
                    {opt.label}
                  </Text>
                </XStack>
              )
            })}
          </XStack>

          <XStack gap={10} flexWrap="wrap">
            <YStack flex={1} minW={180} gap={4}>
              <Text fontSize={12} color={DIM}>
                {t('Name')}
              </Text>
              <Input
                unstyled
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={kind === 'login' ? 'GitHub Production' : 'Stripe Live Key'}
                height={36}
                px={11}
                rounded={9}
                bg={GROUND}
                borderWidth={1}
                borderColor={LINE}
                color={INK}
                fontSize={13}
              />
            </YStack>

            {kind === 'login' ? (
              <YStack flex={1} minW={180} gap={4}>
                <Text fontSize={12} color={DIM}>
                  {t('Website Domain or URL')}
                </Text>
                <Input
                  unstyled
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="github.com"
                  height={36}
                  px={11}
                  rounded={9}
                  bg={GROUND}
                  borderWidth={1}
                  borderColor={LINE}
                  color={INK}
                  fontSize={13}
                />
              </YStack>
            ) : (
              <YStack flex={1} minW={180} gap={4}>
                <Text fontSize={12} color={DIM}>
                  {t('Environment Variable')}
                </Text>
                <Input
                  unstyled
                  value={envVar}
                  onChange={(e) => setEnvVar(e.target.value)}
                  placeholder="STRIPE_SECRET_KEY"
                  height={36}
                  px={11}
                  rounded={9}
                  bg={GROUND}
                  borderWidth={1}
                  borderColor={LINE}
                  color={INK}
                  fontSize={13}
                />
              </YStack>
            )}
          </XStack>

          {kind === 'login' ? (
            <YStack gap={4}>
              <Text fontSize={12} color={DIM}>
                {t('Username or Email')}
              </Text>
              <Input
                unstyled
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ops@hanzo.ai"
                height={36}
                px={11}
                rounded={9}
                bg={GROUND}
                borderWidth={1}
                borderColor={LINE}
                color={INK}
                fontSize={13}
              />
            </YStack>
          ) : null}

          <XStack gap={10} flexWrap="wrap">
            <YStack flex={1} minW={200} gap={4}>
              <Text fontSize={12} color={DIM}>
                {kind === 'login' ? t('Password (sealed in Hanzo KMS)') : t('Secret Value (sealed in Hanzo KMS)')}
              </Text>
              <Input
                unstyled
                secureTextEntry
                value={secretValue}
                onChange={(e) => setSecretValue(e.target.value)}
                placeholder="••••••••••••"
                height={36}
                px={11}
                rounded={9}
                bg={GROUND}
                borderWidth={1}
                borderColor={LINE}
                color={INK}
                fontSize={13}
              />
            </YStack>

            {kind === 'login' ? (
              <YStack flex={1} minW={200} gap={4}>
                <Text fontSize={12} color={DIM}>
                  {t('2FA TOTP Seed / otpauth:// (optional)')}
                </Text>
                <Input
                  unstyled
                  secureTextEntry
                  value={totpValue}
                  onChange={(e) => setTotpValue(e.target.value)}
                  placeholder="JBSWY3DPEHPK3PXP"
                  height={36}
                  px={11}
                  rounded={9}
                  bg={GROUND}
                  borderWidth={1}
                  borderColor={LINE}
                  color={INK}
                  fontSize={13}
                />
              </YStack>
            ) : null}
          </XStack>

          <XStack justify="space-between" items="center" gap={8} pt={2}>
            <Text fontSize={11} lineHeight={16} color={DIM} flex={1}>
              {t('Values are KMS-encrypted at rest and never exposed in browser storage or model transcripts.')}
            </Text>
            <XStack
              {...PILL}
              {...{ type: 'submit' }}
              height={34}
              px={15}
              bg={INK}
              borderColor={INK}
              disabled={!name.trim() || !secretValue.trim() || busy}
              opacity={!name.trim() || !secretValue.trim() || busy ? 0.45 : 1}
            >
              <Lock size={13} color="var(--background)" aria-hidden />
              <Text {...WORD} fontSize={13} color="var(--background)">
                {busy ? t('Sealing…') : t('Seal in KMS')}
              </Text>
            </XStack>
          </XStack>
        </YStack>
      ) : null}

      {tab === '1password' ? (
        <YStack render="form" {...{ onSubmit: (e: FormEvent) => void handleConnect1Password(e) }} {...CARD} p={14} gap={12}>
          <XStack items="center" justify="space-between" gap={10} flexWrap="wrap">
            <YStack flex={1} minW={200}>
              <Text fontSize={14} fontWeight="600" color={INK}>
                {t('1Password Autofill & Vault Sync')}
              </Text>
              <Text fontSize={12} lineHeight={17} color={DIM}>
                {t('Connect a 1Password Service Account token or import a 1Password CSV/JSON export into Hanzo KMS for instant zero-knowledge bot login autofill.')}
              </Text>
            </YStack>
            <XStack {...PILL} height={32} px={12} onClick={() => triggerImport('1password')}>
              <Upload size={13} color={INK} aria-hidden />
              <Text fontSize={12} fontWeight="500" color={INK}>
                {t('Import 1Password CSV / JSON')}
              </Text>
            </XStack>
          </XStack>

          <XStack gap={10} flexWrap="wrap">
            <YStack flex={1} minW={160} gap={4}>
              <Text fontSize={12} color={DIM}>
                {t('Default Vault Name')}
              </Text>
              <Input
                unstyled
                value={opVaultName}
                onChange={(e) => setOpVaultName(e.target.value)}
                placeholder="Employee / Shared"
                height={36}
                px={11}
                rounded={9}
                bg={GROUND}
                borderWidth={1}
                borderColor={LINE}
                color={INK}
                fontSize={13}
              />
            </YStack>
            <YStack flex={2} minW={220} gap={4}>
              <Text fontSize={12} color={DIM}>
                {t('Service Account Token (OP_SERVICE_ACCOUNT_TOKEN)')}
              </Text>
              <Input
                unstyled
                secureTextEntry
                value={opToken}
                onChange={(e) => setOpToken(e.target.value)}
                placeholder={counts.op ? '•••••••• (sealed in KMS)' : 'ops_eyJ...'}
                height={36}
                px={11}
                rounded={9}
                bg={GROUND}
                borderWidth={1}
                borderColor={LINE}
                color={INK}
                fontSize={13}
              />
            </YStack>
          </XStack>

          <XStack justify="flex-end">
            <XStack {...PILL} {...{ type: 'submit' }} height={34} px={14} bg={INK} borderColor={INK} disabled={busy}>
              <Text {...WORD} fontSize={13} color="var(--background)">
                {counts.op ? t('Update 1Password') : t('Connect 1Password')}
              </Text>
            </XStack>
          </XStack>
        </YStack>
      ) : null}

      {tab === 'lastpass' ? (
        <YStack render="form" {...{ onSubmit: (e: FormEvent) => void handleConnectLastPass(e) }} {...CARD} p={14} gap={12}>
          <XStack items="center" justify="space-between" gap={10} flexWrap="wrap">
            <YStack flex={1} minW={200}>
              <Text fontSize={14} fontWeight="600" color={INK}>
                {t('LastPass Autofill & Vault Sync')}
              </Text>
              <Text fontSize={12} lineHeight={17} color={DIM}>
                {t('Link LastPass or import a LastPass Vault CSV so bots and sandbox desktops can autofill logins and 2FA codes safely.')}
              </Text>
            </YStack>
            <XStack {...PILL} height={32} px={12} onClick={() => triggerImport('lastpass')}>
              <Upload size={13} color={INK} aria-hidden />
              <Text fontSize={12} fontWeight="500" color={INK}>
                {t('Import LastPass CSV')}
              </Text>
            </XStack>
          </XStack>

          <XStack gap={10} flexWrap="wrap">
            <YStack flex={1} minW={180} gap={4}>
              <Text fontSize={12} color={DIM}>
                {t('LastPass Account Email')}
              </Text>
              <Input
                unstyled
                value={lpEmail}
                onChange={(e) => setLpEmail(e.target.value)}
                placeholder="team@hanzo.ai"
                height={36}
                px={11}
                rounded={9}
                bg={GROUND}
                borderWidth={1}
                borderColor={LINE}
                color={INK}
                fontSize={13}
              />
            </YStack>
            <YStack flex={1} minW={180} gap={4}>
              <Text fontSize={12} color={DIM}>
                {t('API / CLI Token (optional)')}
              </Text>
              <Input
                unstyled
                secureTextEntry
                value={lpToken}
                onChange={(e) => setLpToken(e.target.value)}
                placeholder={counts.lp ? '•••••••• (sealed in KMS)' : '••••••••'}
                height={36}
                px={11}
                rounded={9}
                bg={GROUND}
                borderWidth={1}
                borderColor={LINE}
                color={INK}
                fontSize={13}
              />
            </YStack>
          </XStack>

          <XStack justify="flex-end">
            <XStack {...PILL} {...{ type: 'submit' }} height={34} px={14} bg={INK} borderColor={INK} disabled={busy}>
              <Text {...WORD} fontSize={13} color="var(--background)">
                {counts.lp ? t('Update LastPass') : t('Connect LastPass')}
              </Text>
            </XStack>
          </XStack>
        </YStack>
      ) : null}

      {tab === 'all' ? (
        doc.items.length === 0 ? (
          <YStack {...CARD} p={compact ? 14 : 20} items="center" gap={10}>
            <Shield size={22} color={DIM} aria-hidden />
            <Text fontSize={14} fontWeight="500" color={INK} text="center">
              {loading ? t('Loading Unified Vault…') : t('No shared secrets or autofill logins yet')}
            </Text>
            <Text fontSize={12} lineHeight={18} color={DIM} text="center" maxW={440}>
              {t('Secrets added here or on platform.hanzo.ai are KMS-sealed once and available across hanzo.app Settings and hanzo.bot desktop autofill.')}
            </Text>
            <XStack gap={8} flexWrap="wrap" justify="center">
              <XStack {...PILL} height={32} px={13} bg={INK} borderColor={INK} onClick={() => setTab('add')}>
                <Plus size={13} color="var(--background)" aria-hidden />
                <Text fontSize={12} fontWeight="500" color="var(--background)">
                  {t('Add Login or Secret')}
                </Text>
              </XStack>
              <XStack {...PILL} height={32} px={12} onClick={() => setTab('1password')}>
                <Text fontSize={12} fontWeight="500" color={INK}>
                  1Password
                </Text>
              </XStack>
              <XStack {...PILL} height={32} px={12} onClick={() => setTab('lastpass')}>
                <Text fontSize={12} fontWeight="500" color={INK}>
                  LastPass
                </Text>
              </XStack>
            </XStack>
          </YStack>
        ) : (
          <YStack {...CARD}>
            {doc.items.map((item, idx) => {
              const isLogin = item.kind === 'login'
              const subParts = [
                SOURCE_LABEL[item.source || 'hanzo'],
                item.domain,
                item.username,
                item.envVar,
                item.totpSecretKey ? '2FA TOTP' : undefined,
              ].filter(Boolean)
              return (
                <XStack
                  key={item.id}
                  px={13}
                  py={10}
                  gap={11}
                  items="center"
                  borderBottomWidth={idx === doc.items.length - 1 ? 0 : 1}
                  borderColor={LINE}
                >
                  {isLogin ? <Globe size={16} color={DIM} aria-hidden /> : <KeyRound size={16} color={DIM} aria-hidden />}
                  <YStack flex={1} minW={0}>
                    <Text {...CLIP} fontSize={14} lineHeight={19} fontWeight="500" color={INK}>
                      {item.name}
                    </Text>
                    <Text {...CLIP} fontSize={12} lineHeight={16} color={DIM}>
                      {subParts.join(' · ')}
                    </Text>
                  </YStack>

                  {onAutofill && isLogin ? (
                    <XStack gap={6} items="center">
                      <XStack
                        {...PILL}
                        height={28}
                        px={10}
                        bg={INK}
                        borderColor={INK}
                        onClick={() => onAutofill(item, 'login')}
                      >
                        <Text fontSize={11} fontWeight="500" color="var(--background)">
                          {t('Autofill')}
                        </Text>
                      </XStack>
                      {item.totpSecretKey ? (
                        <XStack {...PILL} height={28} px={9} onClick={() => onAutofill(item, 'totp')}>
                          <Text fontSize={11} fontWeight="500" color={INK}>
                            2FA
                          </Text>
                        </XStack>
                      ) : null}
                    </XStack>
                  ) : (
                    <Text fontSize={11} color={DIM}>
                      ••••••••
                    </Text>
                  )}

                  <XStack
                    render="button"
                    {...{ type: 'button' }}
                    aria-label={t('Remove {name}', { name: item.name })}
                    onClick={() => void handleRemove(item.id)}
                    width={28}
                    height={28}
                    rounded={999}
                    items="center"
                    justify="center"
                    bg="transparent"
                    borderWidth={0}
                    cursor="pointer"
                    hoverStyle={{ bg: PICKED }}
                  >
                    <Trash2 size={13} color={DIM} aria-hidden />
                  </XStack>
                </XStack>
              )
            })}
          </YStack>
        )
      ) : null}
    </YStack>
  )
}

export function VaultDialog({
  open,
  onOpenChange,
  onAutofill,
  onChanged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAutofill?: (item: VaultItem, field?: 'login' | 'totp') => void
  onChanged?: (doc: VaultDoc) => void
}) {
  const { t } = useI18n()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-parity-key="bots.vault.dialog"
        width="94vw"
        maxW={680}
        height="78vh"
        maxH="86vh"
        p={0}
        showCloseButton={false}
        bg={GROUND}
        borderWidth={1}
        borderColor={LINE}
        rounded={18}
        overflow="hidden"
      >
        <YStack height="78vh" maxH="86vh" bg={GROUND}>
          <XStack px={18} py={13} items="center" justify="space-between" bg={FLOOR} borderBottomWidth={1} borderColor={LINE}>
            <YStack minW={0}>
              <DialogTitle>
                <Text fontSize={16} lineHeight={21} fontWeight="600" color={INK}>
                  {t('Unified Secrets & Login Autofill')}
                </Text>
              </DialogTitle>
              <Text fontSize={12} lineHeight={16} color={DIM}>
                {t('Shared across platform.hanzo.ai, hanzo.app Settings & hanzo.bot · KMS-sealed')}
              </Text>
            </YStack>
            <XStack {...ROUND} width={32} height={32} aria-label={t('Close')} onClick={() => onOpenChange(false)}>
              <X size={15} color={INK} aria-hidden />
            </XStack>
          </XStack>
          <YStack flex={1} minH={0} overflowY="auto" p={18}>
            <VaultManager
              onAutofill={
                onAutofill
                  ? (item, field) => {
                      onAutofill(item, field)
                      onOpenChange(false)
                    }
                  : undefined
              }
              onChanged={onChanged}
            />
          </YStack>
        </YStack>
      </DialogContent>
    </Dialog>
  )
}

export { LABEL as VAULT_LABEL }
