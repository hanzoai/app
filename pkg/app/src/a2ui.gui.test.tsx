// @vitest-environment happy-dom
import { act } from 'react'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { formatA2UIActionMessage, HANZO_A2UI_CATALOG_ID, type A2UIActionEvent } from '@hanzo/ui/a2ui'
import { mount, tap, type Mounted } from '../vitest.real'
import { ask, drawChat, platform, settle, signIn } from '../vitest.chat'
import { Prose } from './Prose'

let mounted: Mounted | null = null

afterEach(async () => {
  if (mounted) {
    await mounted.done()
    mounted = null
  }
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// @hanzogui/toast keeps a 200ms removal timer after unmount during Chat tests.
afterAll(() => new Promise((done) => setTimeout(done, 400)))

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

const BOOKING_CREATE_SURFACE = JSON.stringify({
  version: 'v1.0',
  createSurface: {
    surfaceId: 'booking-card',
    catalogId: HANZO_A2UI_CATALOG_ID,
    root: 'card',
    dataModel: {
      date: '2026-12-01',
      guest: 'Grace Hopper',
      windowSeat: false,
      internalSecret: 'do-not-leak-this-token',
    },
    components: [
      {
        id: 'card',
        component: 'Card',
        title: 'Reserve Flight',
        subtitle: 'Confirm your itinerary details',
        children: ['intro', 'date-field', 'guest-field', 'window-check', 'submit-btn'],
      },
      {
        id: 'intro',
        component: 'Text',
        text: 'Select your travel date and passenger name.',
      },
      {
        id: 'date-field',
        component: 'DateTimeInput',
        label: 'Departure date',
        enableDate: true,
        enableTime: false,
        value: { '@path': '/date' },
      },
      {
        id: 'guest-field',
        component: 'TextField',
        label: 'Passenger name',
        value: { '@path': '/guest' },
      },
      {
        id: 'window-check',
        component: 'CheckBox',
        label: 'Window seat preference',
        value: { '@path': '/windowSeat' },
      },
      {
        id: 'submit-btn',
        component: 'Button',
        label: 'Confirm booking',
        primary: true,
        action: {
          event: {
            name: 'confirm_booking',
            context: {
              date: { '@path': '/date' },
              guest: { '@path': '/guest' },
              windowSeat: { '@path': '/windowSeat' },
            },
          },
        },
      },
    ],
  },
})

const BOOKING_MARKDOWN = [
  'Here is your interactive booking form:',
  '',
  '```a2ui',
  BOOKING_CREATE_SURFACE,
  '```',
  '',
  'Let me know if you need another leg.',
].join('\n')

describe('Prose Google A2UI 1.0 integration', () => {
  it('renders a fenced ```a2ui v1.0 booking surface inline and dispatches zero-trust context on submit', async () => {
    const onAction = vi.fn<(event: A2UIActionEvent) => void>()
    mounted = await mount()
    await mounted.draw(<Prose text={BOOKING_MARKDOWN} onA2UIAction={onAction} />)

    const box = mounted.box
    expect(box.textContent).toContain('Here is your interactive booking form:')
    expect(box.textContent).toContain('Let me know if you need another leg.')
    expect(box.querySelector('[data-slot="prose-code-scroll"]')).toBeNull()
    expect(box.querySelector('[data-slot="prose-a2ui"]')).not.toBeNull()
    expect(box.querySelector('[data-slot="a2ui-surface"]')?.getAttribute('data-surface-id')).toBe('booking-card')

    const dateInput = box.querySelector<HTMLInputElement>('[data-slot="a2ui-datetime"]')
    const textInput = box.querySelector<HTMLInputElement>('[data-slot="a2ui-textfield"]')
    const checkbox = box.querySelector<HTMLInputElement>('[data-slot="a2ui-checkbox"] input[type="checkbox"]')
    const submitBtn = box.querySelector<HTMLButtonElement>('[data-slot="a2ui-button"]')

    expect(dateInput).not.toBeNull()
    expect(textInput).not.toBeNull()
    expect(checkbox).not.toBeNull()
    expect(submitBtn).not.toBeNull()

    await act(async () => {
      setInputValue(dateInput!, '2026-12-15')
      setInputValue(textInput!, 'Ada Lovelace')
      checkbox!.click()
    })

    await tap(submitBtn!)

    expect(onAction).toHaveBeenCalledTimes(1)
    const event = onAction.mock.calls[0]![0]!
    expect(event.surfaceId).toBe('booking-card')
    expect(event.name).toBe('confirm_booking')
    expect(event.context).toEqual({
      date: '2026-12-15',
      guest: 'Ada Lovelace',
      windowSeat: true,
    })
    // Zero-trust: undeclared dataModel keys are never leaked in context or payload
    expect('internalSecret' in event.context).toBe(false)
    expect(event.dataModel).toBeUndefined()

    const formatted = formatA2UIActionMessage(event)
    expect(formatted).toBe(
      '[A2UI Action "confirm_booking" on surface "booking-card"] date: 2026-12-15, guest: Ada Lovelace, windowSeat: true',
    )
  })

  it('supports json+a2ui and application/json+a2ui fences while keeping plain json fences as Code', async () => {
    mounted = await mount()
    const md = [
      '```json+a2ui',
      BOOKING_CREATE_SURFACE,
      '```',
      '',
      '```json',
      BOOKING_CREATE_SURFACE,
      '```',
    ].join('\n')

    await mounted.draw(<Prose text={md} />)
    expect(mounted.box.querySelectorAll('[data-slot="prose-a2ui"]').length).toBe(1)
    expect(mounted.box.querySelectorAll('[data-slot="prose-code-scroll"]').length).toBe(1)
  })

  it('handles progressive streaming without throwing (loading placeholder then live surface with partial trailing JSONL)', async () => {
    mounted = await mount()

    // Stage 1: opening tokens of an unclosed ```a2ui fence before any complete surface arrives
    const earlyStream = 'Building your card…\n\n```a2ui\n{"version":"v1.0","createSurface":{"surfaceId":"booking-card"'
    await mounted.draw(<Prose text={earlyStream} />)
    expect(mounted.box.querySelector('[data-slot="prose-a2ui-loading"]')).not.toBeNull()
    expect(mounted.box.querySelector('[data-slot="a2ui-surface"]')).toBeNull()

    // Stage 2: complete first JSONL line + partial trailing updateDataModel line (still unclosed fence)
    const midStream = [
      'Building your card…',
      '',
      '```a2ui',
      BOOKING_CREATE_SURFACE,
      '{"version":"v1.0","updateDataModel":{"surfaceId":"booking-card","path":"/da',
    ].join('\n')
    await mounted.draw(<Prose text={midStream} />)
    expect(mounted.box.querySelector('[data-slot="prose-a2ui-loading"]')).toBeNull()
    expect(mounted.box.querySelector('[data-slot="a2ui-surface"]')).not.toBeNull()
    expect(mounted.box.textContent).toContain('Reserve Flight')
  })

  it('disables interactive controls and blocks action dispatch when a2uiReadOnly is true', async () => {
    const onAction = vi.fn<(event: A2UIActionEvent) => void>()
    mounted = await mount()
    await mounted.draw(<Prose text={BOOKING_MARKDOWN} onA2UIAction={onAction} a2uiReadOnly />)

    const submitBtn = mounted.box.querySelector<HTMLButtonElement>('[data-slot="a2ui-button"]')
    const dateInput = mounted.box.querySelector<HTMLInputElement>('[data-slot="a2ui-datetime"]')
    expect(submitBtn?.disabled).toBe(true)
    expect(dateInput?.disabled).toBe(true)

    await tap(submitBtn!)
    expect(onAction).not.toHaveBeenCalled()
  })
})

describe('Chat A2UI action round-trip', () => {
  it('submits formatA2UIActionMessage as the user next turn when clicking an A2UI action button in Chat', async () => {
    localStorage.clear()
    sessionStorage.clear()
    signIn()
    const api = platform()
    mounted = await drawChat()

    await ask('Book my flight')
    const firstTurn = await api.turn()
    await firstTurn.say(BOOKING_MARKDOWN)
    await firstTurn.end()
    await settle(60)

    const dateInput = document.querySelector<HTMLInputElement>('[data-slot="a2ui-datetime"]')
    const textInput = document.querySelector<HTMLInputElement>('[data-slot="a2ui-textfield"]')
    const checkbox = document.querySelector<HTMLInputElement>('[data-slot="a2ui-checkbox"] input[type="checkbox"]')
    const submitBtn = document.querySelector<HTMLButtonElement>('[data-slot="a2ui-button"]')

    expect(dateInput).not.toBeNull()
    expect(textInput).not.toBeNull()
    expect(checkbox).not.toBeNull()
    expect(submitBtn).not.toBeNull()

    await act(async () => {
      setInputValue(dateInput!, '2026-12-20')
      setInputValue(textInput!, 'Alan Turing')
      checkbox!.click()
    })
    await tap(submitBtn!)

    const secondTurn = await api.turn()
    const lastUserMessage = secondTurn.asked.messages?.at(-1)
    expect(lastUserMessage).toMatchObject({
      role: 'user',
      content: '[A2UI Action "confirm_booking" on surface "booking-card"] date: 2026-12-20, guest: Alan Turing, windowSeat: true',
    })
    await secondTurn.say('Booked for Alan Turing on 2026-12-20.')
    await secondTurn.end()
    await settle(60)
  }, 30_000)
})
