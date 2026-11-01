import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TerrainPalette } from './TerrainPalette'

describe('TerrainPalette', () => {
  it('renders every tile type including the eraser (no stairs tile)', () => {
    render(<TerrainPalette selected={null} onSelect={vi.fn()} />)

    expect(screen.getByRole('group', { name: 'Terrain types' })).toBeInTheDocument()
    for (const name of ['Eraser', 'Floor', 'Grass', 'Water', 'Stone', 'Sand', 'Wall']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
    // Stairs is a separate entity now, not a coverage tile.
    expect(screen.queryByRole('button', { name: 'Stairs' })).toBeNull()
    expect(screen.queryByRole('button', { name: /hex/i })).toBeNull()
  })

  it('marks the selected swatch and reports clicks', () => {
    const onSelect = vi.fn()
    render(<TerrainPalette selected="water" onSelect={onSelect} />)

    expect(screen.getByRole('button', { name: 'Water' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Grass' }))
    expect(onSelect).toHaveBeenCalledWith('grass')
  })
})
