import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RoomTools } from './RoomTools'

describe('RoomTools', () => {
  it('renders two tool buttons with pressed state', () => {
    render(
      <RoomTools
        activeMode="room-rect"
        disabled={false}
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

  it('disables all tools with a hint on non-square grids', () => {
    render(
      <RoomTools
        activeMode={null}
        disabled
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
        onSelectRect={vi.fn()}
        onSelectPolygon={vi.fn()}
      />,
    )
    expect(screen.getByRole('note')).toBeInTheDocument()

    rerender(
      <RoomTools
        activeMode="room-rect"
        disabled={false}
        onSelectRect={vi.fn()}
        onSelectPolygon={vi.fn()}
      />,
    )
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })
})