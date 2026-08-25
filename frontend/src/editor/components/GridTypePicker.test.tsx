import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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

  it('offers every supported grid type', () => {
    render(<GridTypePicker gridType="square" onChange={vi.fn()} />)

    const options = (screen.getByLabelText('Grid type') as HTMLSelectElement).options
    expect(options).toHaveLength(3)
  })
})
