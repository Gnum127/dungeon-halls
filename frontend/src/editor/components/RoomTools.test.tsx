import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TILE_TYPES } from '../model/types'
import { EMPTY_TILE } from '../model/types'
import { RoomTools } from './RoomTools'

const STONE = TILE_TYPES.indexOf('stone')

describe('RoomTools', () => {
  it('renders two tool buttons with pressed state', () => {
    render(
      <RoomTools
        activeMode="room-rect"
        disabled={false}
        tile={1}
        onSelectRect={vi.fn()}
        onSelectPolygon={vi.fn()}
      />,
    )

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
    render(
      <RoomTools
        activeMode={null}
        disabled={false}
        tile={1}
        onSelectRect={onSelectRect}
        onSelectPolygon={onSelectPolygon}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Room: polygon' }))
    expect(onSelectPolygon).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Room: rectangle' }))
    expect(onSelectRect).toHaveBeenCalledTimes(1)
    expect(onSelectPolygon).toHaveBeenCalledTimes(1)
  })

  it('shows what tile will fill the room', () => {
    render(
      <RoomTools
        activeMode={null}
        disabled={false}
        tile={STONE}
        onSelectRect={vi.fn()}
        onSelectPolygon={vi.fn()}
      />,
    )

    expect(screen.getByRole('group', { name: 'Room fill' })).toHaveTextContent('Stone')
  })

  it('shows the eraser label for the empty fill', () => {
    render(
      <RoomTools
        activeMode={null}
        disabled={false}
        tile={EMPTY_TILE}
        onSelectRect={vi.fn()}
        onSelectPolygon={vi.fn()}
      />,
    )

    expect(screen.getByRole('group', { name: 'Room fill' })).toHaveTextContent('clears the area')
  })

  it('disables all tools with a hint on non-square grids', () => {
    render(
      <RoomTools
        activeMode={null}
        disabled
        tile={1}
        onSelectRect={vi.fn()}
        onSelectPolygon={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Room: rectangle' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Room: polygon' })).toBeDisabled()
    expect(screen.getByRole('note')).toBeInTheDocument()
  })

  it('shows the polygon hint only when the polygon tool is active', () => {
    const { rerender } = render(
      <RoomTools
        activeMode="room-polygon"
        disabled={false}
        tile={1}
        onSelectRect={vi.fn()}
        onSelectPolygon={vi.fn()}
      />,
    )
    expect(screen.getByRole('note')).toBeInTheDocument()

    rerender(
      <RoomTools
        activeMode="room-rect"
        disabled={false}
        tile={1}
        onSelectRect={vi.fn()}
        onSelectPolygon={vi.fn()}
      />,
    )
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })
})