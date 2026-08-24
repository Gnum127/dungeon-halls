import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { GenerationParams } from '@/generator'
import { GeneratorPanel, parseForm } from './GeneratorPanel'

function typeInto(label: string, value: string) {
  // Язык зафиксирован в setup.ts как en.
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function clickGenerate() {
  fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
}

describe('parseForm', () => {
  it('returns dungeon params for valid defaults', () => {
    const params = parseForm({
      genType: 'dungeon',
      seed: '42',
      width: '40',
      height: '30',
      roomAttempts: '150',
      fillProbability: '0.45',
      smoothingIterations: '4',
    })

    expect(params).toEqual({
      type: 'dungeon',
      seed: 42,
      width: 40,
      height: 30,
      roomAttempts: 150,
    })
  })

  it('returns null on non-numeric seed or out-of-range size', () => {
    const base = {
      genType: 'dungeon' as const,
      seed: '42',
      width: '40',
      height: '30',
      roomAttempts: '150',
      fillProbability: '0.45',
      smoothingIterations: '4',
    }

    expect(parseForm({ ...base, seed: 'abc' })).toBeNull()
    expect(parseForm({ ...base, width: '5' })).toBeNull()
    expect(parseForm({ ...base, width: '301' })).toBeNull()
    expect(parseForm({ ...base, roomAttempts: '0' })).toBeNull()
  })

  it('validates cave-specific fields only in caves mode', () => {
    const base = {
      genType: 'caves' as const,
      seed: '42',
      width: '40',
      height: '30',
      roomAttempts: 'garbage', // в режиме пещер не читается
      fillProbability: '0.6',
      smoothingIterations: '3',
    }

    const params = parseForm(base)
    expect(params).toEqual({
      type: 'caves',
      seed: 42,
      width: 40,
      height: 30,
      fillProbability: 0.6,
      smoothingIterations: 3,
    })

    expect(parseForm({ ...base, fillProbability: '1.2' })).toBeNull()
    expect(parseForm({ ...base, smoothingIterations: '-1' })).toBeNull()
  })
})

describe('GeneratorPanel', () => {
  it('emits dungeon params on generate with default form', () => {
    const onGenerate = vi.fn()
    render(<GeneratorPanel onGenerate={onGenerate} />)

    clickGenerate()

    expect(onGenerate).toHaveBeenCalledTimes(1)
    expect(onGenerate.mock.calls[0]![0] as GenerationParams).toMatchObject({
      type: 'dungeon',
      seed: 42,
      width: 40,
      height: 30,
      roomAttempts: 150,
    })
  })

  it('switches to caves and emits cave params', () => {
    const onGenerate = vi.fn()
    render(<GeneratorPanel onGenerate={onGenerate} />)

    fireEvent.click(screen.getByRole('button', { name: 'Caves' }))
    typeInto('Cave density', '0.55')
    typeInto('Smoothing iterations', '3')
    clickGenerate()

    expect(onGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'caves',
        fillProbability: 0.55,
        smoothingIterations: 3,
      }),
    )
  })

  it('disables generate while any field is invalid', () => {
    const onGenerate = vi.fn()
    render(<GeneratorPanel onGenerate={onGenerate} />)

    typeInto('Seed', '')
    expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled()

    clickGenerate()
    expect(onGenerate).not.toHaveBeenCalled()
  })

  it('keeps keyboard access: all numeric fields are reachable inputs', () => {
    render(<GeneratorPanel onGenerate={vi.fn()} />)

    for (const label of ['Seed', 'Width', 'Height']) {
      const field = screen.getByLabelText(label)
      expect(field.tagName).toBe('INPUT')
    }
  })
})
