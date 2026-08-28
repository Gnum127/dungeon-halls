import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OBJECT_KIND_ENTRIES } from '../model/objects'
import { ObjectPalette } from './ObjectPalette'

const defaultProps = {
  activeKindId: null as null,
  selectActive: false,
  onSelectKind: vi.fn(),
  onSelectSelectTool: vi.fn(),
  objectRotation: 0 as const,
  objectScale: { w: 1, h: 1 },
  onRotate: vi.fn(),
  onResize: vi.fn(),
  elementImageOverrides: {},
  onSelectElementImage: vi.fn(),
}

describe('ObjectPalette', () => {
  it('renders category headers and swatches for every object kind', () => {
    render(<ObjectPalette {...defaultProps} selectActive />)

    // Category headers
    expect(screen.getByText('Structural')).toBeInTheDocument()
    expect(screen.getByText('Furniture')).toBeInTheDocument()
    expect(screen.getByText('Dungeon')).toBeInTheDocument()

    // All object kinds are present
    for (const kind of OBJECT_KIND_ENTRIES) {
      expect(screen.getByTitle(kind.id.charAt(0).toUpperCase() + kind.id.slice(1))).toBeInTheDocument()
    }
  })

  it('shows scale badge for multi-cell objects', () => {
    render(<ObjectPalette {...defaultProps} />)

    expect(screen.getByText('2×1')).toBeInTheDocument() // table
    expect(screen.getByText('2×2')).toBeInTheDocument() // rock
  })

  it('filters objects by search', () => {
    render(<ObjectPalette {...defaultProps} />)

    fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'door' } })
    expect(screen.getByTitle('Door')).toBeInTheDocument()
    expect(screen.queryByTitle('Table')).not.toBeInTheDocument()
  })

  it('marks the active kind and the select tool with aria-pressed', () => {
    render(<ObjectPalette {...defaultProps} activeKindId="chest" />)

    expect(screen.getByTitle('Chest')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTitle('Door')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Select (Del to remove)')).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows rotation bar when an object kind is active', () => {
    render(<ObjectPalette {...defaultProps} activeKindId="door" objectRotation={90} />)

    expect(screen.getByText('90°')).toBeInTheDocument()
    expect(screen.getByTitle('Rotate (R)')).toBeInTheDocument()
  })

  it('shows the size button and badge only for kinds with a scale list', () => {
    const { rerender } = render(<ObjectPalette {...defaultProps} activeKindId="table" />)
    expect(screen.getByTitle('Size')).toBeInTheDocument()
    expect(screen.getByText('1×1')).toBeInTheDocument()

    rerender(<ObjectPalette {...defaultProps} activeKindId="rock" objectScale={{ w: 1, h: 1 }} />)
    expect(screen.getByTitle('Size')).toBeInTheDocument()
    expect(screen.getByText('1×1')).toBeInTheDocument() // bar badge; rock swatch badge is 2×2

    rerender(<ObjectPalette {...defaultProps} activeKindId="stairs" />)
    expect(screen.getByTitle('Size')).toBeInTheDocument()
    expect(screen.getByText('1×1')).toBeInTheDocument() // stairs: без defaultScale, бейдж = текущий 1×1
  })

  it('hides the size button for kinds without a scale list', () => {
    render(<ObjectPalette {...defaultProps} activeKindId="chair" />)

    expect(screen.queryByTitle('Size')).not.toBeInTheDocument()
  })

  it('reports the resize button click', () => {
    const onResize = vi.fn()
    render(<ObjectPalette {...defaultProps} activeKindId="table" onResize={onResize} />)

    fireEvent.click(screen.getByTitle('Size'))
    expect(onResize).toHaveBeenCalledTimes(1)
  })

  it('offers the image pool dropdown with a default option for the active kind', () => {
    render(<ObjectPalette {...defaultProps} activeKindId="table" />)

    const picker = screen.getByLabelText('Image') as HTMLSelectElement
    expect(picker).toBeInTheDocument()
    expect(Array.from(picker.options).map((o) => o.value)).toEqual([
      '',
      'table-wooden',
      'table-round',
    ])
    expect(Array.from(picker.options).map((o) => o.textContent)).toEqual([
      'Default',
      'table-wooden',
      'table-round',
    ])
    expect(picker.value).toBe('')
  })

  it('reflects the persisted override in the picker value', () => {
    render(
      <ObjectPalette
        {...defaultProps}
        activeKindId="door"
        elementImageOverrides={{ door: 'door-iron' }}
      />,
    )

    expect((screen.getByLabelText('Image') as HTMLSelectElement).value).toBe('door-iron')
  })

  it('reports image selection and a reset to default', () => {
    const onSelectElementImage = vi.fn()
    render(
      <ObjectPalette
        {...defaultProps}
        activeKindId="rock"
        onSelectElementImage={onSelectElementImage}
      />,
    )
    const picker = screen.getByLabelText('Image')

    fireEvent.change(picker, { target: { value: 'rock-cave' } })
    expect(onSelectElementImage).toHaveBeenCalledWith('rock', 'rock-cave')

    fireEvent.change(picker, { target: { value: '' } })
    expect(onSelectElementImage).toHaveBeenCalledWith('rock', null)
  })

  it('hides the image picker when no active object kind is selected', () => {
    render(<ObjectPalette {...defaultProps} />)
    expect(screen.queryByLabelText('Image')).not.toBeInTheDocument()
  })

  it('reports the clicked kind id and select tool activation', () => {
    const onSelectKind = vi.fn()
    const onSelectSelectTool = vi.fn()
    render(
      <ObjectPalette
        {...defaultProps}
        selectActive
        onSelectKind={onSelectKind}
        onSelectSelectTool={onSelectSelectTool}
      />,
    )

    fireEvent.click(screen.getByTitle('Table'))
    expect(onSelectKind).toHaveBeenCalledTimes(1)
    expect(onSelectKind).toHaveBeenCalledWith('table')

    fireEvent.click(screen.getByText('Select (Del to remove)'))
    expect(onSelectSelectTool).toHaveBeenCalledTimes(1)
  })
})
