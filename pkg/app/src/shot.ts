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
    const rootStyle = getComputedStyle(document.documentElement)
    const bodyStyle = getComputedStyle(document.body)
    const rootBg = rootStyle.backgroundColor
    const bodyBg = bodyStyle.backgroundColor
    const isDark =
      document.documentElement.classList.contains('dark') ||
      document.documentElement.classList.contains('t_dark') ||
      document.documentElement.dataset.themeProfile === 'zen' ||
      document.documentElement.dataset.themeProfile === 'lelouch'
    const fill =
      (bodyBg && bodyBg !== 'rgba(0, 0, 0, 0)' && bodyBg !== 'transparent' ? bodyBg : '') ||
      (rootBg && rootBg !== 'rgba(0, 0, 0, 0)' && rootBg !== 'transparent' ? rootBg : '') ||
      rootStyle.getPropertyValue('--surface-page').trim() ||
      (isDark ? 'black' : 'white')
    clone.style.width = `${w}px`
    clone.style.height = `${h}px`
    clone.style.backgroundColor = fill
    const cloneBody = clone.querySelector('body')
    if (cloneBody) {
      cloneBody.style.backgroundColor = fill
      cloneBody.style.color = bodyStyle.color || rootStyle.getPropertyValue('--foreground').trim() || (isDark ? 'white' : 'black')
    }
    const xhtml = new XMLSerializer().serializeToString(clone)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${fill}"/><foreignObject width="100%" height="100%">${xhtml}</foreignObject></svg>`
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
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = fill
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0)
    }
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}
