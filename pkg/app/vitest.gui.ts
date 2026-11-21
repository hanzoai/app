// What the real kit reads that happy-dom does not have: gui builds its media registry from
// matchMedia at import, the tabs and slider watch their size and visibility.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
if (!window.matchMedia)
  (window as unknown as { matchMedia: unknown }).matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })
const g = globalThis as Record<string, unknown>
g.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
g.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} }
