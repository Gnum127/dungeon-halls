import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DOOR_CATALOG } from '../model/doorCatalog'
import type { TileTypeName } from '../model/types'
import type { EditorTool } from '../tools/editorTool'
import { NO_IMAGE_SELECT_VALUE } from './imageSelect'
import { ToolParams } from './ToolParams'
import type { ToolParamsProps } from './ToolParams'

function renderParams(overrides: Partial<ToolParamsProps> = {}) {
  const props: ToolParamsProps = {
    tool: { type: 'region-rect', tileType: 'floor' },
    tileType: 'floor' as TileTypeName,
    vertexCount: 6,
    autoWalls: true,
    doorImageId: null,
    onSelectTile: vi.fn(),
    onToggleEraser: vi.fn(),
    onVertexCountChange: vi.fn(),
    onAutoWallsChange: vi.fn(),
    onDoorImageChange: vi.fn(),
    onObjectImageChange: vi.fn(),
    onObjectScaleChange: vi.fn(),
    onObjectRotationChange: vi.fn(),
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
  const doorTool: EditorTool = { type: 'door', imageId: null }

  it('maps the texture choice (default → null)', () => {
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
  })

  it('binds the texture dropdown to the persisted door image', () => {
    const imageId = DOOR_CATALOG[1].defaultImageId
    renderParams({ tool: doorTool, doorImageId: imageId })

    expect(screen.getByRole('combobox', { name: 'Door texture' })).toHaveValue(imageId)
  })

  it('shows no leaf-angle field anymore', () => {
    renderParams({ tool: doorTool })
    expect(screen.queryByRole('spinbutton')).toBeNull()
  })
})

describe('ToolParams — выделение (этап 28)', () => {
  it('shows object texture, size and rotation controls for the selected object', () => {
    const props = renderParams({
      tool: { type: 'cursor' },
      selectedObject: { id: 5, kindId: 'table', x: 1, y: 1, scale: { w: 2, h: 1 } },
    })

    expect(screen.getByText('Object selected')).toBeInTheDocument()
    const texture = screen.getByRole('combobox', { name: 'Texture' })
    fireEvent.change(texture, { target: { value: 'table-round' } })
    expect(props.onObjectImageChange).toHaveBeenCalledWith('table-round')

    // «По умолчанию» → undefined, «без текстуры» → null (этап 28).
    fireEvent.change(texture, { target: { value: '' } })
    expect(props.onObjectImageChange).toHaveBeenLastCalledWith(undefined)
    fireEvent.change(texture, { target: { value: NO_IMAGE_SELECT_VALUE } })
    expect(props.onObjectImageChange).toHaveBeenLastCalledWith(null)

    const size = screen.getByRole('combobox', { name: 'Size' })
    expect(size).toHaveValue('2x1')
    fireEvent.change(size, { target: { value: '1x2' } })
    expect(props.onObjectScaleChange).toHaveBeenCalledWith({ w: 1, h: 2 })

    const rotation = screen.getByRole('combobox', { name: 'Rotation' })
    fireEvent.change(rotation, { target: { value: '90' } })
    expect(props.onObjectRotationChange).toHaveBeenCalledWith(90)
  })

  it('shows a size field for a resized kind without a fixed scale list', () => {
    renderParams({
      tool: { type: 'cursor' },
      selectedObject: { id: 7, kindId: 'chair', x: 1, y: 1, scale: { w: 2, h: 3 } },
    })

    // У chair нет списка scales, но размер ≠ 1×1 — поле показываем.
    expect(screen.getByRole('combobox', { name: 'Size' })).toHaveValue('2x3')
  })

  it('hides the size field for an unscaled default kind', () => {
    renderParams({
      tool: { type: 'cursor' },
      selectedObject: { id: 8, kindId: 'chair', x: 1, y: 1 },
    })

    expect(screen.queryByRole('combobox', { name: 'Size' })).toBeNull()
  })

  it('shows only the door texture picker for the selected door', () => {
    const props = renderParams({
      tool: { type: 'cursor' },
      selectedDoor: { id: 'd1', a: { x: 1, y: 1 }, b: { x: 2, y: 1 }, imageId: null },
    })

    expect(screen.getByText('Door selected')).toBeInTheDocument()
    const select = screen.getByRole('combobox', { name: 'Door texture' })
    fireEvent.change(select, { target: { value: 'door-stone' } })
    expect(props.onDoorImageChange).toHaveBeenCalledWith('door-stone')
    expect(screen.queryByRole('combobox', { name: 'Size' })).toBeNull()
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
