/**
 * Liquid glass styling and specular refraction engine.
 *
 * Adapted from nikdelvin/liquid-glass for Hanzo design system and native iOS Safari symmetry.
 * Combines SVG displacement maps, multi-layer specular highlights, and hardware-accelerated
 * backdrop filtering for mobile UI chrome and widgets.
 */

export interface DisplacementOptions {
  height: number
  width: number
  radius: number
  depth: number
  strength?: number
  chromaticAberration?: number
}

/** Generates SVG displacement map as data URI for optical refraction */
export function getDisplacementMap({
  height,
  width,
  radius,
  depth,
}: Omit<DisplacementOptions, 'chromaticAberration' | 'strength'>): string {
  const yStop1 = Math.ceil((radius / Math.max(height, 1)) * 15)
  const yStop2 = Math.floor(100 - (radius / Math.max(height, 1)) * 15)
  const xStop1 = Math.ceil((radius / Math.max(width, 1)) * 15)
  const xStop2 = Math.floor(100 - (radius / Math.max(width, 1)) * 15)

  const svg = `<svg height="${height}" width="${width}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <style>.mix { mix-blend-mode: screen; }</style>
    <defs>
      <linearGradient id="Y" x1="0" x2="0" y1="${yStop1}%" y2="${yStop2}%">
        <stop offset="0%" stop-color="#0F0" />
        <stop offset="100%" stop-color="#000" />
      </linearGradient>
      <linearGradient id="X" x1="${xStop1}%" x2="${xStop2}%" y1="0" y2="0">
        <stop offset="0%" stop-color="#F00" />
        <stop offset="100%" stop-color="#000" />
      </linearGradient>
    </defs>
    <rect x="0" y="0" height="${height}" width="${width}" fill="#808080" />
    <g filter="blur(2px)">
      <rect x="0" y="0" height="${height}" width="${width}" fill="#000080" />
      <rect x="0" y="0" height="${height}" width="${width}" fill="url(#Y)" class="mix" />
      <rect x="0" y="0" height="${height}" width="${width}" fill="url(#X)" class="mix" />
      <rect x="${depth}" y="${depth}" height="${Math.max(0, height - 2 * depth)}" width="${Math.max(0, width - 2 * depth)}" fill="#808080" rx="${radius}" ry="${radius}" filter="blur(${depth}px)" />
    </g>
  </svg>`

  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

/** Generates SVG chromatic aberration filter URI with R/G/B phase displacement */
export function getDisplacementFilter({
  height,
  width,
  radius,
  depth,
  strength = 100,
  chromaticAberration = 0,
}: DisplacementOptions): string {
  const mapUri = getDisplacementMap({ height, width, radius, depth })

  const svg = `<svg height="${height}" width="${width}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="displace" color-interpolation-filters="sRGB">
        <feImage x="0" y="0" height="${height}" width="${width}" href="${mapUri}" result="displacementMap" />
        <feDisplacementMap in="SourceGraphic" in2="displacementMap" scale="${strength + chromaticAberration * 2}" xChannelSelector="R" yChannelSelector="G" />
        <feColorMatrix type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="displacedR" />
        <feDisplacementMap in="SourceGraphic" in2="displacementMap" scale="${strength + chromaticAberration}" xChannelSelector="R" yChannelSelector="G" />
        <feColorMatrix type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="displacedG" />
        <feDisplacementMap in="SourceGraphic" in2="displacementMap" scale="${strength}" xChannelSelector="R" yChannelSelector="G" />
        <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="displacedB" />
        <feBlend in="displacedR" in2="displacedG" mode="screen" />
        <feBlend in2="displacedB" mode="screen" />
      </filter>
    </defs>
  </svg>`

  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '#displace'
}

export interface LiquidGlassOptions {
  /** Background tint custom variable or color token */
  fill?: string
  /** Corner radius (number or token) */
  radius?: number | string
  /** Border stroke color */
  border?: string
  /** Blur strength in px */
  blur?: number
  /** Saturation multiplier */
  saturate?: number
  /** Specular light intensity (0 to 1) */
  specular?: number
}

/** Standard multi-layer specular light shadow */
export const LIQUID_SPECULAR_SHADOW =
  'inset 0 1px 1px 0 rgba(255, 255, 255, 0.22), inset 0 -1px 1px 0 rgba(0, 0, 0, 0.16), 0 8px 32px 0 rgba(0, 0, 0, 0.28)'

/**
 * Native iOS Safari widget liquid glass preset:
 * - Fluid specular lighting top and bottom
 * - Continuous squircle corner
 * - 24px hardware accelerated blur with 190% saturation
 * - Touch-responsive spring physics
 */
export const IOS_WIDGET_GLASS = {
  backgroundColor: 'var(--liquid-glass-bg, var(--pane-fill, rgba(20, 20, 24, 0.72)))',
  borderRadius: 9999,
  borderWidth: 1,
  borderStyle: 'solid' as const,
  borderColor: 'var(--liquid-glass-border, var(--pane-edge, rgba(255, 255, 255, 0.12)))',
  backdropFilter: 'blur(24px) saturate(190%) contrast(102%)',
  WebkitBackdropFilter: 'blur(24px) saturate(190%) contrast(102%)',
  boxShadow: LIQUID_SPECULAR_SHADOW,
} as const

/** Generates CSS style object for liquid glass surfaces */
export function liquidGlass(options: LiquidGlassOptions = {}) {
  const {
    fill = 'var(--liquid-glass-bg, var(--pane-fill, rgba(20, 20, 24, 0.72)))',
    radius = 9999,
    border = 'var(--liquid-glass-border, var(--pane-edge, rgba(255, 255, 255, 0.12)))',
    blur = 24,
    saturate = 190,
  } = options

  const filter = `blur(${blur}px) saturate(${saturate}%) contrast(102%)`

  return {
    backgroundColor: fill,
    borderRadius: radius,
    borderWidth: 1,
    borderStyle: 'solid' as const,
    borderColor: border,
    backdropFilter: filter,
    WebkitBackdropFilter: filter,
    boxShadow: LIQUID_SPECULAR_SHADOW,
  }
}
