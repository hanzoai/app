/**
 * THE LIBRARY — everything a person made, in one place (`/v1/library`).
 *
 * Chat keeps what its answers make there: a page or a picture an answer wrote
 * out, a file it wrote out whole, and a file the reader chose to keep. Each is
 * one POST of its bytes; the item is the reader's alone until they share it.
 *
 * A save names itself with a key — `<thread>/<message>/<index>` for what an
 * answer made — and the Library answers the item already kept for a key it has
 * seen, so a turn drawn again, a retry, or a second tab files one item, not two.
 */

import type { HttpClient } from '@hanzo/ai'
import type { Artifact } from '@hanzo/build'

/** The HTTP half of an `@hanzo/ai` client: all this module needs. */
export interface Api {
  http: Pick<HttpClient, 'json'>
}

/** One thing in the Library, as it answers. */
export interface Item {
  id: string
  kind: string
  source: string
  name: string
  mime: string
  bytes: number
  /** A signed address that opens it in place, for an hour. */
  url: string
  /** A signed address that downloads it. */
  download: string
  /** A signed address of its still, or '' for none. */
  preview: string
  /** The path back to what made it. */
  origin: string
  mine: boolean
  shared: boolean
}

/** What a save sends. */
export interface Keep {
  name: string
  mime: string
  /** The bytes: base64, or a Blob read here. */
  data: string | Blob
  /** What made it: the conversation. */
  ref: string
  /** The path back to it. */
  origin: string
  /** Names the save, so the same one twice is one item. */
  key: string
  /** A still that shows it, base64 PNG. */
  preview?: string
  width?: number
  height?: number
}

/** The most one save sends; the Library answers 413 past it. */
export const MAX = 10 * 1024 * 1024

/** The key of the `index`th thing message `message` of `thread` made. */
export const keyOf = (thread: string, message: string, index: number): string => `${thread}/${message}/${index}`

/** A Blob's bytes, base64. */
export async function base64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/** Reads an item off the wire, or null for something that is not one. */
export function read(raw: unknown): Item | null {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const str = (k: string): string => (typeof o[k] === 'string' ? (o[k] as string) : '')
  if (!str('id')) return null
  return {
    id: str('id'),
    kind: str('kind'),
    source: str('source'),
    name: str('name') || str('id'),
    mime: str('mime'),
    bytes: typeof o.bytes === 'number' ? o.bytes : 0,
    url: str('url'),
    download: str('download'),
    preview: str('preview'),
    origin: str('origin'),
    mine: o.mine === true,
    shared: o.shared === true,
  }
}

/** Keeps one thing from Chat in the reader's Library. */
export async function save(api: Api, k: Keep): Promise<Item> {
  const data = typeof k.data === 'string' ? k.data : await base64(k.data)
  if ((data.length * 3) / 4 > MAX) throw new Error(`${k.name} is larger than 10 MB, the most the Library takes from Chat.`)
  const body: Record<string, unknown> = { name: k.name, mime: k.mime, data, source: 'chat', ref: k.ref, origin: k.origin, key: k.key }
  if (k.preview) body.preview = k.preview
  if (k.width) body.width = Math.round(k.width)
  if (k.height) body.height = Math.round(k.height)
  const got = read(await api.http.json<unknown>({ method: 'POST', path: '/v1/library', body }))
  if (!got) throw new Error('The Library answered with no item.')
  return got
}

/** One item the reader may see — theirs, or shared in their organization. */
export async function get(api: Api, id: string): Promise<Item> {
  const got = read(await api.http.json<unknown>({ path: `/v1/library/${encodeURIComponent(id)}` }))
  if (!got) throw new Error('That item is not in your Library.')
  return got
}

const EXT: Record<string, string> = { 'text/html': 'html', 'image/svg+xml': 'svg' }

const FILE = /\.[a-z0-9]{1,8}$/i

/** Whether a browser draws it as a page or a picture (@hanzo/build `renders`). */
const drawn = (a: Artifact): boolean => a.mime === 'text/html' || a.mime === 'image/svg+xml'

/**
 * What an answer made, worth keeping, of the fenced blocks it wrote
 * (@hanzo/build `artifacts`): a page or a picture, and a file written out under
 * a file's name. A snippet in a language (`ts block`) is part of the answer,
 * not a thing it made, so it is not kept.
 */
export function made(blocks: readonly Artifact[]): Artifact[] {
  return blocks
    .filter((a) => drawn(a) || FILE.test(a.name))
    .map((a, i) => (FILE.test(a.name) ? a : { ...a, name: `${a.mime === 'image/svg+xml' ? 'Picture' : 'Page'} ${i + 1}.${EXT[a.mime] ?? 'txt'}` }))
}
