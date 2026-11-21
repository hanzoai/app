// The page as a picture, from the platform alone: the document is cloned, its
// stylesheets travel with it as one <style>, and the browser draws the result
// from an SVG <foreignObject>. No dependency, nothing leaves the page.
//
// What it leaves out is on purpose. Images, video, canvas and frames are blanked
// (they are other origins' pixels and would taint the canvas), and every input
// and textarea is emptied, so a typed password or message is never in the
// picture. The person sees the result before it is sent and can remove it.
// Hanzo Dev's desktop app captures its own window natively instead
// (`desktopBridge.captureWindow`, or `configure({ report: { capture } })`).

import { where } from './where'

const css = (): string => {
  let out = ''
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) out += `${rule.cssText}\n`
    } catch {
      /* a stylesheet from another origin is not readable, and is left out */
    }
  }
  return out
}

/** A PNG data URL of what the window shows, or null where the browser cannot draw one. */
export async function shoot(): Promise<string | null> {
  const native = where().report?.capture ?? (window as { desktopBridge?: { captureWindow?: () => Promise<string | null> } }).desktopBridge?.captureWindow
  if (native) return native().catch(() => null)
  if (typeof document === 'undefined') return null
  try {
    const w = window.innerWidth
    const h = window.innerHeight
    const clone = document.documentElement.cloneNode(true) as HTMLElement
    clone.querySelectorAll('script, noscript, iframe, video, audio, canvas, img, picture, source, link[rel="stylesheet"]').forEach((n) => n.remove())
    clone.querySelectorAll('input, textarea').forEach((n) => {
      n.removeAttribute('value')
      if (n instanceof HTMLTextAreaElement) n.textContent = ''
    })
    const style = document.createElement('style')
    style.textContent = css()
    clone.querySelector('head')?.append(style)
    clone.style.width = `${w}px`
    clone.style.height = `${h}px`
    const xhtml = new XMLSerializer().serializeToString(clone)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject width="100%" height="100%">${xhtml}</foreignObject></svg>`
    const img = new Image()
    const loaded = new Promise<void>((ok, no) => {
      img.onload = () => ok()
      img.onerror = () => no(new Error('draw'))
    })
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    await Promise.race([loaded, new Promise<never>((_, no) => setTimeout(() => no(new Error('timeout')), 5000))])
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')?.drawImage(img, 0, 0)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}
