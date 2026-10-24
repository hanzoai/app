/**
 * Dynamic custom font loader and manager for organizations and designers.
 */

export interface CustomFontOptions {
  family: string
  url: string
  format?: 'woff2' | 'woff' | 'truetype' | 'opentype'
  weights?: (number | string)[]
  isStylesheet?: boolean
}

const INJECTED_FONT_PREFIX = 'hanzo-font-'

/**
 * Injects a designer/organization custom font into document head dynamically.
 * Supports direct webfont stylesheets (Google Fonts, Adobe Fonts, Typekit) or @font-face binaries.
 */
export function injectCustomFont(options: CustomFontOptions): void {
  if (typeof document === 'undefined') return

  const elementId = `${INJECTED_FONT_PREFIX}${options.family.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
  const existing = document.getElementById(elementId)
  if (existing) existing.remove()

  if (options.isStylesheet || options.url.endsWith('.css') || options.url.includes('fonts.googleapis.com')) {
    const link = document.createElement('link')
    link.id = elementId
    link.rel = 'stylesheet'
    link.href = options.url
    document.head.appendChild(link)
  } else {
    const format = options.format || (options.url.endsWith('.woff2') ? 'woff2' : options.url.endsWith('.woff') ? 'woff' : 'truetype')
    const weights = options.weights || [400, 500, 600, 700]

    let fontFaceRules = ''
    for (const w of weights) {
      fontFaceRules += `
        @font-face {
          font-family: "${options.family}";
          src: url("${options.url}") format("${format}");
          font-weight: ${w};
          font-style: normal;
          font-display: swap;
        }
      `
    }

    const style = document.createElement('style')
    style.id = elementId
    style.textContent = fontFaceRules
    document.head.appendChild(style)
  }
}

/** Removes an injected custom font stylesheet or style tag */
export function removeCustomFont(family: string): void {
  if (typeof document === 'undefined') return
  const elementId = `${INJECTED_FONT_PREFIX}${family.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
  const el = document.getElementById(elementId)
  if (el) el.remove()
}

/** Statically applies a font-family to CSS variables */
export function applyFontFamily(target: 'heading' | 'sans' | 'mono', fontFamily: string): void {
  if (typeof document === 'undefined') return
  const cssVar = target === 'heading' ? '--font-heading' : target === 'mono' ? '--font-mono' : '--font-sans'
  document.documentElement.style.setProperty(cssVar, fontFamily)
}
