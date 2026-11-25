// @vitest-environment happy-dom
import { act, createElement, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const { draw } = vi.hoisted(() => {
  const draw = ({
    children,
    onClick,
    onPress,
    'data-slot': slot,
    'data-chip': chip,
    'aria-pressed': pressed,
    'aria-label': label,
  }: {
    children?: ReactNode
    onClick?: () => void
    onPress?: () => void
    'data-slot'?: string
    'data-chip'?: string
    'aria-pressed'?: boolean
    'aria-label'?: string
  }) =>
    createElement(
      onClick || onPress ? 'button' : 'div',
      { onClick: onClick ?? onPress, 'data-slot': slot, 'data-chip': chip, 'aria-pressed': pressed, 'aria-label': label },
      children,
    )
  return { draw }
})

vi.mock('@hanzo/i18n', () => ({ phrase: (s: string) => s }))
vi.mock('@hanzo/i18n/react', () => ({ useI18n: () => ({ t: (s: string) => s, locale: 'en' }) }))
vi.mock('@hanzo/iam/react', () => ({
  useIam: () => ({ user: null, isAuthenticated: false }),
  useOrganizations: () => ({ currentOrgId: 'hanzo' }),
}))
vi.mock('@hanzo/gui', () => ({ Anchor: draw, Text: draw, View: draw, XStack: draw, YStack: draw }))
vi.mock('@hanzo/ui', () => ({ Box: draw, Text: draw, View: draw, XStack: draw, YStack: draw }))
vi.mock('@hanzo/ui/agents', () => ({ ChannelHeader: draw }))
vi.mock('@hanzo/ui/chat', () => ({
  Composer: ({
    children,
    value,
    onChange,
    onSend,
    placeholder,
  }: {
    children?: ReactNode
    value?: string
    onChange?: (next: string) => void
    onSend?: () => void
    placeholder?: string
  }) =>
    createElement(
      'div',
      { 'data-slot': 'composer', 'data-placeholder': placeholder },
      createElement('input', {
        'data-slot': 'home-input',
        value: value ?? '',
        onChange: (e: { target: { value: string } }) => onChange?.(e.target.value),
      }),
      createElement('button', { 'data-slot': 'home-send', onClick: () => onSend?.() }, 'Send'),
      children,
    ),
}))
vi.mock('@hanzo/ai/react', () => ({
  useAgents: () => ({ agents: [] }),
  usePeople: () => ({ people: [] }),
  useSessions: () => ({ sessions: [], loading: false }),
  useThreads: () => ({ threads: [], loading: false }),
}))
vi.mock('./icons', () => ({ MARKS: new Proxy({}, { get: () => ({ icon: () => null }) }) }))
vi.mock('./card', () => ({ Go: draw, INK: '$ink', Quiet: draw, Row: draw, SOFT: '$soft', CHOSEN: '$edge' }))
vi.mock('./progress', () => ({ Bar: draw }))
vi.mock('./Talk', () => ({ Talk: () => null }))
vi.mock('./Directory', () => ({ Directory: () => null }))
vi.mock('./channels', () => ({ useChannels: () => ({ channels: [], spaces: [], loading: false }), fromKey: () => null, teamKey: () => 'team:1' }))
vi.mock('./open', () => ({ useOpen: () => ({ channel: null, openChannel: () => {} }) }))
vi.mock('./roster', () => ({ usePeople: () => ({ people: [] }), useAgents: () => ({ agents: [] }), useMe: () => null }))
vi.mock('./pref', () => ({ usePref: <T,>(_k: string, initial: T) => [initial, () => {}, true] as const }))
vi.mock('./lib/session', () => ({ bearer: () => null, hasSession: () => false }))
vi.mock('./lib/hydrated', () => ({ useHydrated: () => true }))
vi.mock('./lib/tap', () => ({ tap: () => {} }))
vi.mock('./lib/dev-mode', () => ({ useDevMode: () => [false, () => {}] }))
vi.mock('./lib/ai', () => ({ useAi: () => ({ client: null }) }))
vi.mock('./lib/home', () => ({ invite: async () => {}, apps: async () => [], projects: async () => [] }))
vi.mock('./failure', () => ({ plainly: () => '', say: () => '' }))
vi.mock('./failed', () => ({ failed: () => [] }))
vi.mock('./watch', () => ({ watch: () => () => {} }))
vi.mock('./where', () => ({
  brand: () => 'Hanzo',
  phrase: (s: string) => s,
  site: (p: string) => `https://hanzo.ai${p}`,
}))

const { Home } = await import('./Home')

describe('Home launcher modes', () => {
  let host: HTMLDivElement
  let assignCalls: string[]
  const originalLocation = window.location

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    assignCalls = []
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        get href() {
          return 'https://hanzo.app/'
        },
        set href(url: string) {
          assignCalls.push(url)
        },
      },
    })
  })

  afterEach(() => {
    host.remove()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
  })

  test('renders Design and Automate mode pills alongside Chat, Dev, News, and Research', () => {
    const html = renderToStaticMarkup(createElement(Home))
    for (const label of ['Chat', 'Dev', 'Design', 'Automate', 'News', 'Research']) {
      expect(html).toContain(label)
    }
  })

  test('routes Design and Automate prompts to /design?q=... and /flow?q=...', () => {
    const root = createRoot(host)
    act(() => {
      root.render(createElement(Home))
    })

    const clickMode = (label: string) => {
      const btn = Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === label)
      expect(btn).toBeTruthy()
      act(() => {
        btn!.click()
      })
    }

    act(() => {
      root.render(createElement(Home))
    })
    clickMode('Design')
    expect(host.querySelector('[data-slot="composer"]')?.getAttribute('data-placeholder')).toBe('Describe what to design')
    clickMode('Automate')
    expect(host.querySelector('[data-slot="composer"]')?.getAttribute('data-placeholder')).toBe(
      'Describe the workflow to automate',
    )
    clickMode('Design')
    const input = host.querySelector('[data-slot="home-input"]') as HTMLInputElement
    const setReactInput = (val: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(input, val)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
    act(() => {
      setReactInput('Landing page mockup')
    })
    act(() => {
      ;(host.querySelector('[data-slot="home-send"]') as HTMLButtonElement).click()
    })
    expect(assignCalls).toContain('/design?q=Landing%20page%20mockup')

    clickMode('Automate')
    act(() => {
      setReactInput('Triage PRs daily')
    })
    act(() => {
      ;(host.querySelector('[data-slot="home-send"]') as HTMLButtonElement).click()
    })
    expect(assignCalls).toContain('/flow?q=Triage%20PRs%20daily')

    act(() => root.unmount())
  })
})
