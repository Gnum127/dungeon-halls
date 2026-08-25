import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GRID_TYPES } from '../model/types'
import { GridTypePicker } from './GridTypePicker'

describe('GridTypePicker', () => {
  it('renders the current grid type as selected', () => {
    render(<GridTypePicker gridType="square" onChange={vi.fn()} />)

    const select = screen.getByLabelText('Grid type') as HTMLSelectElement
    expect(select.value).toBe('square')
  })

  it('reports the chosen grid type', () => {
    const onChange = vi.fn()
    render(<GridTypePicker gridType="square" onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Grid type'), { target: { value: 'hex-pointy' } })

    expect(onChange).toHaveBeenCalledWith('hex-pointy')
  })

  it('offers exactly the supported grid types as values', () => {
    render(<GridTypePicker gridType="square" onChange={vi.fn()} />)

    // Сравнение по values, а не по количеству: опечатка в value или потеря
    // ориентации обязаны падать.
    const values = [...(screen.getByLabelText('Grid type') as HTMLSelectElement).options].map(
      (option) => option.value,
    )
    expect(values).toEqual([...GRID_TYPES])
  })

  it('follows the prop on rerender (controlled select)', () => {
    const onChange = vi.fn()
    const { rerender } = render(<GridTypePicker gridType="square" onChange={onChange} />)

    // Регрессия «select не следует за стором» (например, после undo).
    rerender(<GridTypePicker gridType="hex-flat" onChange={onChange} />)
    expect((screen.getByLabelText('Grid type') as HTMLSelectElement).value).toBe('hex-flat')
  })

  // Пункт 5.4: при стенах/дверях смена сетки запрещена (рёбра square-сетки).
  it('disables the select with a hint while walls or doors exist', () => {
    const onChange = vi.fn()
    const { rerender } = render(<GridTypePicker gridType="square" disabled onChange={onChange} />)

    const select = screen.getByLabelText('Grid type') as HTMLSelectElement
    expect(select).toBeDisabled()
    expect(screen.getByRole('note')).toHaveTextContent(/Remove walls and doors/)

    fireEvent.change(select, { target: { value: 'hex-pointy' } })
    expect(onChange).not.toHaveBeenCalled()

    // Возврат в разрешённое состояние снимает дизейбл и подсказку.
    rerender(<GridTypePicker gridType="square" onChange={onChange} />)
    expect(screen.getByLabelText('Grid type')).toBeEnabled()
    expect(screen.queryByRole('note')).toBeNull()
  })
})
