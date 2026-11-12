import { describe, expect, test } from 'vitest'
import { resultOf } from './result'

const t = ((s: string, v?: Record<string, unknown>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v?.[k]))) as never

describe('a finished run', () => {
  test('shows its answer text, with model and time as meta, never the log JSON', () => {
    const r = resultOf(
      [
        { seq: 2, kind: 'log', payload: JSON.stringify({ runId: 'r', model: 'enso', durationMs: 1234, error: '' }) },
        { seq: 1, kind: 'message', payload: JSON.stringify({ text: 'Four.' }) },
      ],
      t,
    )
    expect(r).toEqual({ text: 'Four.', error: '', meta: 'enso · 1.2s' })
  })
  test('a run that failed says so', () => {
    expect(resultOf([{ seq: 1, kind: 'log', payload: { model: 'enso', error: 'no funds' } }], t)?.error).toBe('no funds')
  })
})
