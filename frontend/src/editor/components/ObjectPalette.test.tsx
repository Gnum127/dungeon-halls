import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NO_IMAGE_SELECT_VALUE } from './imageSelect'
import { ObjectPalette } from './ObjectPalette'

type ObjectPaletteProps = Parameters<typeof ObjectPalette>[0]

function renderPalette(overrides: Partial<ObjectPaletteProps> = {}) {
  const props: ObjectPaletteProps = {
    activeKindId: 'table',
    onSelectKind: vi.fn(),
    objectRotation: 0,
    objectScale: { w: 2, h: 1 },
    onRotate: vi.fn(),
    onResize: vi.fn(),
    imageId: undefined,
    onSelectImage: vi.fn(),
    ...overrides,
  }
  render(<ObjectPalette {...props} />)
  return props
}

describe('ObjectPalette — селект текстуры (этап 28)', () => {
  it('maps the three imageId states to option values', () => {
    renderPalette({ imageId: undefined })
    expect(screen.getByRole('combobox', { name: 'Image' })).toHaveValue('')
  })

  it('shows the explicit "no texture" state and maps it back to null', () => {
    const props = renderPalette({ imageId: null })
    const select = screen.getByRole('combobox', { name: 'Image' })
    expect(select).toHaveValue(NO_IMAGE_SELECT_VALUE)

    fireEvent.change(select, { target: { value: NO_IMAGE_SELECT_VALUE } })
    expect(props.onSelectImage).toHaveBeenCalledWith(null)
  })

  it('selects a concrete image and returns undefined for the default option', () => {
    const props = renderPalette({ imageId: 'table-wooden' })
    const select = screen.getByRole('combobox', { name: 'Image' })
    expect(select).toHaveValue('table-wooden')

    fireEvent.change(select, { target: { value: 'table-round' } })
    expect(props.onSelectImage).toHaveBeenCalledWith('table-round')
    fireEvent.change(select, { target: { value: '' } })
    expect(props.onSelectImage).toHaveBeenLastCalledWith(undefined)
  })

  it('hides the size button for a kind with a single size', () => {
    renderPalette({ activeKindId: 'ladder', objectScale: { w: 1, h: 1 } })
    expect(screen.queryByTitle('Size')).toBeNull()
  })

  it('shows the size button for a kind with multiple sizes', () => {
    renderPalette({ activeKindId: 'table' })
    expect(screen.getByTitle('Size')).toBeInTheDocument()
  })
})
