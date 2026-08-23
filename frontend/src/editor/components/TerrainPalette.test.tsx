import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TILE_TYPES } from '../model/types'
import { TerrainPalette } from './TerrainPalette'

const EMPTY = TILE_TYPES.indexOf('empty')
const FLOOR = TILE_TYPES.indexOf('floor')
const WALL = TILE_TYPES.indexOf('wall')

describe('TerrainPalette', () => {
  it('renders a swatch for every tile type with localized names', () => {
    render(<TerrainPalette selected={FLOOR} onSelect={vi.fn()} />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(TILE_TYPES.length)

    // Язык зафиксирован в setup.ts как en.
    expect(screen.getByTitle('Floor')).toBeInTheDocument()
    expect(screen.getByTitle('Grass')).toBeInTheDocument()
    expect(screen.getByTitle('Wall')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Terrain types' })).toBeInTheDocument()
  })

  it('marks the selected tile with aria-pressed', () => {
    render(<TerrainPalette selected={WALL} onSelect={vi.fn()} />)

    const wallButton = screen.getByTitle('Wall')
    const floorButton = screen.getByTitle('Floor')

    expect(wallButton).toHaveAttribute('aria-pressed', 'true')
    expect(floorButton).toHaveAttribute('aria-pressed', 'false')
  })

  it('reports the clicked tile value', async () => {
    const onSelect = vi.fn()
    render(<TerrainPalette selected={EMPTY} onSelect={onSelect} />)

    fireEvent.click(screen.getByTitle('Water'))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(TILE_TYPES.indexOf('water'))
  })
})
