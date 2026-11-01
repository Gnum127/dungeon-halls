import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RegionTools } from './RegionTools'
import type { RegionToolsProps } from './RegionTools'

function renderTools(overrides: Partial<RegionToolsProps> = {}) {
  const props: RegionToolsProps = {
    activeTool: { type: 'door', imageId: 'door-iron', openAngle: 30 },
    tileType: 'floor',
    vertexCount: 6,
    autoWalls: true,
    doorImageId: 'door-iron',
    onSelectRect: vi.fn(),
    onSelectPolygon: vi.fn(),
    onSelectEraser: vi.fn(),
    onSelectWall: vi.fn(),
    onSelectDoor: vi.fn(),
    onVertexCountChange: vi.fn(),
    onAutoWallsChange: vi.fn(),
    onDoorImageChange: vi.fn(),
    ...overrides,
  }
  render(<RegionTools {...props} />)
  return props
}

describe('RegionTools', () => {
  it('shows a door texture dropdown bound to the catalog when the door tool is active', () => {
    const props = renderTools()

    const select = screen.getByRole('combobox', { name: 'Door texture' })
    expect(select).toHaveValue('door-iron')
    expect(within(select).getByRole('option', { name: 'Wooden' })).toBeInTheDocument()
    expect(within(select).getByRole('option', { name: 'Stone' })).toBeInTheDocument()

    fireEvent.change(select, { target: { value: 'door-stone' } })
    expect(props.onDoorImageChange).toHaveBeenCalledWith('door-stone')
  })

  it('maps the "no texture" option to null', () => {
    const props = renderTools()
    fireEvent.change(screen.getByRole('combobox', { name: 'Door texture' }), {
      target: { value: '' },
    })
    expect(props.onDoorImageChange).toHaveBeenCalledWith(null)
  })

  it('hides the door texture dropdown for non-door tools', () => {
    renderTools({ activeTool: { type: 'region-rect', tileType: 'floor' } })
    expect(screen.queryByRole('combobox', { name: 'Door texture' })).toBeNull()
  })
})
