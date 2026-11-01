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
    doorOpenAngle: 30,
    onSelectRect: vi.fn(),
    onSelectPolygon: vi.fn(),
    onSelectEraser: vi.fn(),
    onSelectWall: vi.fn(),
    onSelectDoor: vi.fn(),
    onSelectStairs: vi.fn(),
    onVertexCountChange: vi.fn(),
    onAutoWallsChange: vi.fn(),
    onDoorImageChange: vi.fn(),
    onDoorAngleChange: vi.fn(),
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

  it('offers a stairs tool button that selects the stairs tool', () => {
    const props = renderTools({ activeTool: { type: 'region-rect', tileType: 'floor' } })
    fireEvent.click(screen.getByRole('button', { name: 'Stairs' }))
    expect(props.onSelectStairs).toHaveBeenCalled()
  })

  it('edits the door leaf angle within 0..150', () => {
    const props = renderTools()
    const angle = screen.getByRole('spinbutton', { name: 'Leaf angle' })
    expect(angle).toHaveValue(30)

    fireEvent.change(angle, { target: { value: '45' } })
    expect(props.onDoorAngleChange).toHaveBeenCalledWith(45)
  })

  it('ignores non-integer or out-of-range angles', () => {
    const props = renderTools()
    const field = screen.getByRole('spinbutton', { name: 'Leaf angle' })
    fireEvent.change(field, { target: { value: '999' } })
    fireEvent.change(field, { target: { value: '-5' } })
    fireEvent.change(field, { target: { value: '45.5' } })
    expect(props.onDoorAngleChange).not.toHaveBeenCalled()
  })

  it('accepts the 0 and 150 bounds', () => {
    const props = renderTools()
    const field = screen.getByRole('spinbutton', { name: 'Leaf angle' })
    fireEvent.change(field, { target: { value: '0' } })
    fireEvent.change(field, { target: { value: '150' } })
    expect(props.onDoorAngleChange).toHaveBeenNthCalledWith(1, 0)
    expect(props.onDoorAngleChange).toHaveBeenNthCalledWith(2, 150)
  })

  it('treats a cleared field as angle 0', () => {
    const props = renderTools()
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Leaf angle' }), {
      target: { value: '' },
    })
    expect(props.onDoorAngleChange).toHaveBeenCalledWith(0)
  })

  it('hides the door angle field for non-door tools', () => {
    renderTools({ activeTool: { type: 'region-rect', tileType: 'floor' } })
    expect(screen.queryByRole('spinbutton', { name: 'Leaf angle' })).toBeNull()
  })
})
