import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OBJECT_KIND_ENTRIES } from '../model/objects'
import { ObjectPalette } from './ObjectPalette'

describe('ObjectPalette', () => {
  it('renders a swatch for every object kind with localized names', () => {
    render(
      <ObjectPalette
        activeKindId={null}
        selectActive
        onSelectKind={vi.fn()}
        onSelectSelectTool={vi.fn()}
      />,
    )

    // +1 кнопка «выбрать объект» перед списком видов.
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(OBJECT_KIND_ENTRIES.length + 1)

    // Язык зафиксирован в setup.ts как en.
    expect(screen.getByTitle('Door')).toBeInTheDocument()
    expect(screen.getByTitle('Stairs')).toBeInTheDocument()
    expect(screen.getByTitle('Torch')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Objects' })).toBeInTheDocument()
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
