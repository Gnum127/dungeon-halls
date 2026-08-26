import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OBJECT_KIND_ENTRIES } from '../model/objects'
import { ObjectPalette } from './ObjectPalette'

describe('ObjectPalette', () => {
  it('renders category headers and swatches for every object kind', () => {
    render(
      <ObjectPalette
        activeKindId={null}
        selectActive
        onSelectKind={vi.fn()}
        onSelectSelectTool={vi.fn()}
      />,
    )

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
    render(
      <ObjectPalette
        activeKindId={null}
        selectActive={false}
        onSelectKind={vi.fn()}
        onSelectSelectTool={vi.fn()}
      />,
    )

    expect(screen.getByText('2×1')).toBeInTheDocument() // table
    expect(screen.getByText('2×2')).toBeInTheDocument() // rock
  })

  it('filters objects by search', () => {
    render(
      <ObjectPalette
        activeKindId={null}
        selectActive={false}
        onSelectKind={vi.fn()}
        onSelectSelectTool={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'door' } })
    expect(screen.getByTitle('Door')).toBeInTheDocument()
    expect(screen.queryByTitle('Table')).not.toBeInTheDocument()
  })

  it('marks the active kind and the select tool with aria-pressed', () => {
    render(
      <ObjectPalette
        activeKindId="chest"
        selectActive={false}
        onSelectKind={vi.fn()}
        onSelectSelectTool={vi.fn()}
      />,
    )

    expect(screen.getByTitle('Chest')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTitle('Door')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Select (Del to remove)')).toHaveAttribute('aria-pressed', 'false')
  })

  it('reports the clicked kind id and select tool activation', () => {
    const onSelectKind = vi.fn()
    const onSelectSelectTool = vi.fn()
    render(
      <ObjectPalette
        activeKindId={null}
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
