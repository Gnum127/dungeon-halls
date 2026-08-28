import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EMPTY_TILE, TILE_TYPES } from '../model/types'
import { RoomTools } from './RoomTools'

const STONE = TILE_TYPES.indexOf('stone')

function renderTools(props: Partial<Parameters<typeof RoomTools>[0]> = {}) {
  return render(
    <RoomTools
      activeMode={null}
      disabled={false}
      tile={1}
      vertexCount={6}
      onVertexCountChange={vi.fn()}
      onSelectRect={vi.fn()}
      onSelectPolygon={vi.fn()}
      {...props}
    />,
  )
}

describe('RoomTools', () => {
  it('renders two tool buttons with pressed state', () => {
    renderTools({ activeMode: 'room-rect' })

    expect(screen.getByRole('group', { name: 'Rooms' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Room: rectangle' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Room: polygon' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('reports the clicked tool', () => {
    const onSelectRect = vi.fn()
    const onSelectPolygon = vi.fn()
    renderTools({ onSelectRect, onSelectPolygon })

    fireEvent.click(screen.getByRole('button', { name: 'Room: polygon' }))
    expect(onSelectPolygon).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Room: rectangle' }))
    expect(onSelectRect).toHaveBeenCalledTimes(1)
    expect(onSelectPolygon).toHaveBeenCalledTimes(1)
  })

  it('shows what tile will fill the room', () => {
    renderTools({ tile: STONE })

    expect(screen.getByRole('group', { name: 'Room fill' })).toHaveTextContent('Stone')
  })

  it('shows the eraser label for the empty fill', () => {
    renderTools({ tile: EMPTY_TILE })

    expect(screen.getByRole('group', { name: 'Room fill' })).toHaveTextContent('clears the area')
  })

  it('disables all tools with a hint on non-square grids', () => {
    renderTools({ disabled: true })

    expect(screen.getByRole('button', { name: 'Room: rectangle' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Room: polygon' })).toBeDisabled()
    expect(screen.getByRole('note')).toBeInTheDocument()
  })

  it('shows the polygon hint only when the polygon tool is active', () => {
    const { rerender } = renderTools({ activeMode: 'room-polygon' })
    expect(screen.getByRole('note')).toBeInTheDocument()

    rerender(
      <RoomTools
        activeMode="room-rect"
        disabled={false}
        tile={1}
        vertexCount={6}
        onVertexCountChange={vi.fn()}
        onSelectRect={vi.fn()}
        onSelectPolygon={vi.fn()}
      />,
    )
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('lets the polygon vertex count be edited within 3..12', () => {
    const onVertexCountChange = vi.fn()
    renderTools({ activeMode: 'room-polygon', onVertexCountChange })

    const input = screen.getByRole('spinbutton', { name: 'Vertices' })
    expect(input).toHaveValue(6)

    fireEvent.change(input, { target: { value: '8' } })
    expect(onVertexCountChange).toHaveBeenCalledWith(8)

    // Вне диапазона — игнорируется.
    fireEvent.change(input, { target: { value: '20' } })
    expect(onVertexCountChange).toHaveBeenCalledTimes(1)
  })

  it('hides the vertex count input for the rectangle tool', () => {
    renderTools({ activeMode: 'room-rect' })

    expect(screen.queryByRole('spinbutton', { name: 'Vertices' })).not.toBeInTheDocument()
  })
})