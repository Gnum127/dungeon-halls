import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { GenerationParams } from '@/generator'
import { DEFAULT_GENERATOR_FORM, parseGeneratorForm } from './generatorForm'
import type { GeneratorFormState } from './generatorForm'
import { GeneratorPanel } from './GeneratorPanel'

function typeInto(label: string, value: string) {
  // Язык зафиксирован в setup.ts как en.
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function clickGenerate() {
  fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
}

describe('parseGeneratorForm', () => {
  it('returns dungeon params for valid defaults', () => {
    const params = parseGeneratorForm(DEFAULT_GENERATOR_FORM)

    expect(params).toEqual({
      type: 'dungeon',
      seed: 42,
      width: 40,
      height: 30,
      roomAttempts: 150,
    })
  })

  it('returns null on non-numeric seed or out-of-range size', () => {
    const base = { ...DEFAULT_GENERATOR_FORM }

    expect(parseGeneratorForm({ ...base, seed: 'abc' })).toBeNull()
    expect(parseGeneratorForm({ ...base, width: '5' })).toBeNull()
    expect(parseGeneratorForm({ ...base, width: '301' })).toBeNull()
    expect(parseGeneratorForm({ ...base, roomAttempts: '0' })).toBeNull()
  })

  it('validates cave-specific fields only in caves mode', () => {
    const caves: GeneratorFormState = {
      ...DEFAULT_GENERATOR_FORM,
      genType: 'caves',
      roomAttempts: 'garbage', // в режиме пещер не читается
      fillProbability: '0.6',
      smoothingIterations: '3',
    }

    const params = parseGeneratorForm(caves)
    expect(params).toEqual({
      type: 'caves',
      seed: 42,
      width: 40,
      height: 30,
      fillProbability: 0.6,
      smoothingIterations: 3,
    })

    expect(parseGeneratorForm({ ...caves, fillProbability: '1.2' })).toBeNull()
    expect(parseGeneratorForm({ ...caves, smoothingIterations: '-1' })).toBeNull()

    // Регрессия: пустое поле и hex/exponent-формы раньше превращались в 0.
    // '1e-1' и '0x1' попадают в [0..1] — отсекаются самим парсером, а не
    // проверкой диапазона.
    expect(parseGeneratorForm({ ...caves, fillProbability: '' })).toBeNull()
    expect(parseGeneratorForm({ ...caves, fillProbability: '0x10' })).toBeNull()
    expect(parseGeneratorForm({ ...caves, fillProbability: '0x1' })).toBeNull()
    expect(parseGeneratorForm({ ...caves, fillProbability: '1e2' })).toBeNull()
    expect(parseGeneratorForm({ ...caves, fillProbability: '1e-1' })).toBeNull()
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

  // Пункт 2.9: «Ещё раз» повторяет прошлый успешный вызов даже когда
  // текущая форма уже невалидна.
  it('regenerate repeats the last successful params regardless of current form', () => {
    const onGenerate = vi.fn()
    render(<GeneratorPanel onGenerate={onGenerate} />)

    expect(screen.queryByRole('button', { name: 'Regenerate same seed' })).toBeNull()

    clickGenerate()
    const firstCall = onGenerate.mock.calls[0]![0]

    // Портим форму: сид невалиден, обычная Generate заблокирована.
    typeInto('Seed', 'abc')
    expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled()

    const again = screen.getByRole('button', { name: 'Regenerate same seed' })
    fireEvent.click(again)

    expect(onGenerate).toHaveBeenCalledTimes(2)
    expect(onGenerate.mock.calls[1]![0]).toEqual(firstCall)
  })
})
