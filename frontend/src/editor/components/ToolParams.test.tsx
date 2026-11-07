import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DOOR_CATALOG } from '../model/doorCatalog'
import type { TileTypeName } from '../model/types'
import type { EditorTool } from '../tools/editorTool'
import { ToolParams } from './ToolParams'
import type { ToolParamsProps } from './ToolParams'

function renderParams(overrides: Partial<ToolParamsProps> = {}) {
  const props: ToolParamsProps = {
    tool: { type: 'region-rect', tileType: 'floor' },
    tileType: 'floor' as TileTypeName,
    vertexCount: 6,
    autoWalls: true,
    doorImageId: null,
    doorOpenAngle: 30,
    onSelectTile: vi.fn(),
    onToggleEraser: vi.fn(),
    onVertexCountChange: vi.fn(),
    onAutoWallsChange: vi.fn(),
    onDoorImageChange: vi.fn(),
    onDoorAngleChange: vi.fn(),
    ...overrides,
  }
  render(<ToolParams {...props} />)
  return props
}

describe('ToolParams — фигуры', () => {
  it('shows the terrain palette, eraser toggle and auto-walls for a rectangle', () => {
    const props = renderParams({ tool: { type: 'region-rect', tileType: 'floor' } })

    expect(screen.getByRole('group', { name: 'Terrain types' })).toBeInTheDocument()
    // Rectangles have no vertex count field, and door controls stay hidden.
    expect(screen.queryByRole('spinbutton')).toBeNull()
    expect(screen.queryByRole('combobox', { name: 'Door texture' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Erase area' }))
    expect(props.onToggleEraser).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Auto walls' }))
    expect(props.onAutoWallsChange).toHaveBeenCalledWith(false)
  })

  it('marks the eraser toggle when the tool erases', () => {
    renderParams({ tool: { type: 'region-rect', tileType: 'empty' }, tileType: 'empty' })

    expect(screen.getByRole('button', { name: 'Erase area' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('clears the area')).toBeInTheDocument()
  })

  it('accepts only integer vertex counts in 3..12 for the polygon', () => {
    const props = renderParams({
      tool: { type: 'region-polygon', tileType: 'floor', vertices: 6 },
    })
    const vertices = screen.getByRole('spinbutton', { name: 'Vertices' })

    fireEvent.change(vertices, { target: { value: '8' } })
    expect(props.onVertexCountChange).toHaveBeenCalledWith(8)

    for (const invalid of ['2', '13', '3.5']) {
      fireEvent.change(vertices, { target: { value: invalid } })
    }
    expect(props.onVertexCountChange).toHaveBeenCalledTimes(1)
  })
})

describe('ToolParams — дверь', () => {
  const doorTool: EditorTool = { type: 'door', imageId: null, openAngle: 30 }

  it('maps the texture choice (default → null) and reports the angle', () => {
    const props = renderParams({ tool: doorTool })

    const select = screen.getByRole('combobox', { name: 'Door texture' })
    // Bound to the persisted choice and built from the catalog.
    expect(select).toHaveValue('')
    expect(screen.getByRole('option', { name: 'Wooden' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Stone' })).toBeInTheDocument()

    fireEvent.change(select, { target: { value: '' } })
    expect(props.onDoorImageChange).toHaveBeenCalledWith(null)

    const imageId = DOOR_CATALOG[0].defaultImageId
    fireEvent.change(select, { target: { value: imageId } })
    expect(props.onDoorImageChange).toHaveBeenLastCalledWith(imageId)

    const angle = screen.getByRole('spinbutton', { name: 'Leaf angle' })
    fireEvent.change(angle, { target: { value: '45' } })
    expect(props.onDoorAngleChange).toHaveBeenCalledWith(45)
  })

  it('binds the texture dropdown to the persisted door image', () => {
    const imageId = DOOR_CATALOG[1].defaultImageId
    renderParams({ tool: doorTool, doorImageId: imageId })

    expect(screen.getByRole('combobox', { name: 'Door texture' })).toHaveValue(imageId)
  })

  it('accepts the 0..150 bounds, a cleared field as 0, and rejects the rest', () => {
    const props = renderParams({ tool: doorTool })
    const angle = screen.getByRole('spinbutton', { name: 'Leaf angle' })

    fireEvent.change(angle, { target: { value: '0' } })
    fireEvent.change(angle, { target: { value: '150' } })
    expect(props.onDoorAngleChange).toHaveBeenNthCalledWith(1, 0)
    expect(props.onDoorAngleChange).toHaveBeenNthCalledWith(2, 150)

    // A cleared field is parsed as 0 (regression from the removed RegionTools test).
    fireEvent.change(angle, { target: { value: '' } })
    expect(props.onDoorAngleChange).toHaveBeenNthCalledWith(3, 0)

    for (const invalid of ['999', '-5', '45.5']) {
      fireEvent.change(angle, { target: { value: invalid } })
    }
    expect(props.onDoorAngleChange).toHaveBeenCalledTimes(3)
  })
})

describe('ToolParams — подсказки', () => {
  it('shows the cursor hint for the cursor tool', () => {
    renderParams({ tool: { type: 'cursor' } })
    expect(screen.getByText('Click — select, drag — move, Delete — remove')).toBeInTheDocument()
  })

  it('shows the pan hint for the pan tool', () => {
    renderParams({ tool: { type: 'pan' } })
    expect(screen.getByText('Hold and drag to pan the map')).toBeInTheDocument()
  })

  it('shows the stairs hint for the stairs tool', () => {
    renderParams({ tool: { type: 'stairs' } })
    expect(screen.getByText('Three clicks: start → base → far edge')).toBeInTheDocument()
  })
})
