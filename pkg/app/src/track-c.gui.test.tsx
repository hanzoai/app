// @vitest-environment happy-dom
import { act, useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { mount, tap, type Mounted } from '../vitest.real'
import { ResearchActivity } from './Chat'
import { useSpan } from './span'
import { Side, Split } from './Shell'
import { useOpen } from './open'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

let mounted: Mounted | null = null

afterEach(async () => {
  if (mounted) {
    await mounted.done()
    mounted = null
  }
})

describe('Track C — Research Activity, Shell Resize, Artifact Preservation & Visual Restraint', () => {
  it('ResearchActivity expands to distinguish web vs connected sources and opens citations in new tab', async () => {
    mounted = await mount()
    await mounted.draw(
      <ResearchActivity
        worked={4200}
        reasoning="Checked live documentation and repository pull requests."
        toolCalls={[
          { id: 'c1', type: 'function', function: { name: 'web_search', arguments: '{"q":"hanzo"}' } },
          { id: 'c2', type: 'function', function: { name: 'github_list_prs', arguments: '{}' } },
        ]}
        citations={[
          { id: 'cite:0:0', title: 'Hanzo Docs', url: 'https://docs.hanzo.ai', host: 'docs.hanzo.ai' },
        ]}
      />,
    )

    const container = mounted.box
    const toggle = container.querySelector<HTMLButtonElement>('[data-slot="research-activity-toggle"]')
    expect(toggle).not.toBeNull()
    expect(toggle?.getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('[data-slot="worked-for"]')?.textContent).toContain('Worked for 4s')
    expect(container.querySelector('[data-slot="research-activity-panel"]')).toBeNull()

    await tap(toggle!)
    expect(toggle?.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('[data-slot="research-web-sources"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="research-connected-sources"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="research-reasoning"]')?.textContent).toContain('Checked live documentation')

    const citeLink = container.querySelector('[data-slot="research-web-sources"] a')
    expect(citeLink?.getAttribute('target')).toBe('_blank')
    expect(citeLink?.getAttribute('rel')).toContain('noopener')
  })

  it('useSpan clamps sidebar/panel width strictly within [floor, ceil]', async () => {
    let latest: ReturnType<typeof useSpan> | null = null
    function Probe() {
      latest = useSpan('track-c-test-span', 260, 200, 420)
      return <div ref={latest.ref} data-testid="span-box">{latest.span}</div>
    }

    mounted = await mount()
    await mounted.draw(<Probe />)
    const box = mounted.box.querySelector<HTMLElement>('[data-testid="span-box"]')!
    expect(latest!.span).toBe(260)

    act(() => latest!.move(90))
    expect(box.style.getPropertyValue('--span')).toBe('200px')

    act(() => latest!.move(999))
    expect(box.style.getPropertyValue('--span')).toBe('420px')

    act(() => latest!.keep(312.6))
    expect(latest!.span).toBe(313)
    expect(box.style.getPropertyValue('--span')).toBe('313px')
    expect(localStorage.getItem('track-c-test-span')).toBe('313')
  })

  it('Split keeps conversation children mounted and preserves state when artifact aside opens and closes', async () => {
    function ConversationChild() {
      const { aside, showAside } = useOpen()
      const [streamCount, setStreamCount] = useState(1)
      return (
        <div>
          {aside ? (
            <Side>
              <div data-testid="artifact-aside">Preview Artifact</div>
            </Side>
          ) : null}
          <span data-testid="stream-counter">{streamCount}</span>
          <button type="button" data-testid="tick" onClick={() => setStreamCount((n) => n + 1)}>
            tick
          </button>
          <button type="button" data-testid="toggle-aside" onClick={() => showAside(aside ? null : 'tasks')}>
            toggle-aside
          </button>
        </div>
      )
    }

    mounted = await mount()
    await mounted.draw(
      <Split>
        <ConversationChild />
      </Split>,
    )

    const container = mounted.box
    const tick = container.querySelector<HTMLButtonElement>('[data-testid="tick"]')!
    const toggle = container.querySelector<HTMLButtonElement>('[data-testid="toggle-aside"]')!
    const counter = () => container.querySelector('[data-testid="stream-counter"]')?.textContent

    await tap(tick)
    expect(counter()).toBe('2')

    // Open artifact split pane
    await tap(toggle)
    expect(container.querySelector('[data-testid="artifact-aside"]')).not.toBeNull()
    expect(counter()).toBe('2')

    // Close artifact split pane
    await tap(toggle)
    expect(container.querySelector('[data-testid="artifact-aside"]')).toBeNull()
    expect(counter()).toBe('2')
  })

  it('visual restraint: segmented tabs and secondary toolbar controls avoid solid white variant="primary"', () => {
    const auditedFiles = [
      'science/SchedulesTab.tsx',
      'science/AutonomyTab.tsx',
      'science/MachinesTab.tsx',
      'learn/KaiLabPlayground.tsx',
      'learn/CourseWorkspace.tsx',
      'learn/LabPanels.tsx',
      'learn/LearnLaunchpad.tsx',
      'learn/LearnPane.tsx',
      'flow/FlowKnowledgePanel.tsx',
      'Shared.tsx',
    ]
    for (const rel of auditedFiles) {
      const src = readFileSync(resolve(__dirname, rel), 'utf8')
      expect(src, `${rel} should not use competing primary toggles/toolbar buttons`).not.toMatch(
        /variant=\{[^}]*\?\s*['"]primary['"]/,
      )
    }
  })
})
