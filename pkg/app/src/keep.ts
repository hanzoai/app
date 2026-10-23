'use client'

// What Chat keeps in the Library, and what it takes back out.
//
// KEPT AS IT IS MADE. When an answer finishes, every page, picture and file it
// wrote out (lib/library `made`) is saved to the reader's Library under the
// conversation, keyed `<thread>/<message>/<index>`, so it is kept once whatever
// redraws it. A picture is kept with a still drawn here, so the Library shows it
// whatever type its bytes are served as. Nothing is kept for a reader with no
// account, or before the conversation has an id: the item names where it came
// from.
//
// TAKEN BACK IN by `/chat?attach=<item>` (the Library's "Use in Chat"): the
// item's bytes are held for the next message by the one road a picked file
// takes (pane.ts `hold`).

import { useEffect, useRef, useState } from 'react'
import type { Artifact } from '@hanzo/build'
import { base64, get, keyOf, made, save, type Api, type Item } from './lib/library'
import { talk } from './lib/host'
import { hold, type Via } from './pane'

/** The longest side of a picture's still, px. */
const STILL = 512

/** A picture's still: its SVG drawn onto a canvas, as base64 PNG, with its size. Null where the browser cannot draw it. */
export async function still(svg: string): Promise<{ png: string; width: number; height: number } | null> {
  if (typeof document === 'undefined') return null
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    await new Promise<void>((done, fail) => {
      img.onload = () => done()
      img.onerror = () => fail(new Error('undrawable'))
      img.src = url
    })
    const w = img.naturalWidth || STILL
    const h = img.naturalHeight || STILL
    const scale = Math.min(1, STILL / Math.max(w, h))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(w * scale))
    canvas.height = Math.max(1, Math.round(h * scale))
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/png'))
    return blob ? { png: await base64(blob), width: w, height: h } : null
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Keeps what one finished answer made. Each save stands alone: one that fails leaves the rest kept. */
export async function keepAnswer(api: Api, thread: string, message: string, blocks: readonly Artifact[]): Promise<Item[]> {
  const out: Item[] = []
  for (const [i, a] of made(blocks).entries()) {
    try {
      const pic = a.mime === 'image/svg+xml' ? await still(a.body) : null
      out.push(
        await save(api, {
          name: a.name,
          mime: a.mime,
          data: new Blob([a.body], { type: a.mime }),
          ref: thread,
          origin: talk(thread),
          key: keyOf(thread, message, i),
          ...(pic ? { preview: pic.png, width: pic.width, height: pic.height } : {}),
        }),
      )
    } catch {
      // Kept on the next answer that makes it; the conversation holds it meanwhile.
    }
  }
  return out
}

/**
 * Keeps each answer's makings once it finishes. `finished` is the answer that
 * just stopped streaming (its id and its words), `thread` the conversation's
 * id, which can land a moment after the answer does: the answer waits for it.
 */
export function useKeep(api: Api, signedIn: boolean, thread: string | null, finished: { id: string; text: string } | null, blocks: (text: string) => Artifact[]): void {
  const waiting = useRef<{ id: string; text: string }[]>([])
  const kept = useRef(new Set<string>())
  useEffect(() => {
    if (!signedIn || !finished || kept.current.has(finished.id)) return
    waiting.current.push(finished)
    kept.current.add(finished.id)
  }, [signedIn, finished])
  useEffect(() => {
    if (!thread || !signedIn || !waiting.current.length) return
    const now = waiting.current.splice(0)
    for (const one of now) {
      const list = blocks(one.text)
      if (list.length) void keepAnswer(api, thread, one.id, list)
    }
  }, [thread, signedIn, finished, api, blocks])
}

/** A Library item's bytes as a File, read through its signed address. */
export async function fileOf(item: Item): Promise<File> {
  const res = await fetch(item.url)
  if (!res.ok) throw new Error(`${item.name} could not be read from your Library.`)
  const blob = await res.blob()
  return new File([blob], item.name, { type: item.mime || blob.type })
}

/**
 * `/chat?attach=<item>`: the Library item, held for the next message in
 * conversation `at`. The parameter is struck from the address once read, so a
 * reload does not attach it twice. Answers why it could not be, or ''.
 */
export function useAttach(at: string, via: Via): string {
  const [why, setWhy] = useState('')
  const done = useRef(false)
  useEffect(() => {
    if (done.current || typeof window === 'undefined' || !via.org) return
    const url = new URL(window.location.href)
    const id = url.searchParams.get('attach')?.trim()
    if (!id) return
    done.current = true
    url.searchParams.delete('attach')
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    get(via.api, id)
      .then(fileOf)
      .then((f) => hold(at, [f], via))
      .catch((e: unknown) => setWhy((e as Error)?.message || 'That item could not be attached.'))
  }, [at, via])
  return why
}

/**
 * Keeps a file the reader put into the conversation, when they ask: its bytes
 * read from `url` (the object URL this document holds, or the workspace copy's
 * signed address), keyed by the workspace file it is, so asking twice keeps one.
 */
export async function keepFile(api: Api, f: { id: string; name: string; type: string; url: string; thread: string | null }): Promise<Item> {
  const res = await fetch(f.url)
  if (!res.ok) throw new Error(`${f.name} could not be read.`)
  const blob = await res.blob()
  return save(api, {
    name: f.name,
    mime: f.type || blob.type || 'application/octet-stream',
    data: blob,
    ref: f.thread ?? '',
    origin: f.thread ? talk(f.thread) : talk(),
    key: `file/${f.id}`,
  })
}
