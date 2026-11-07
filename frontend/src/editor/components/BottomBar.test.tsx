import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BottomBar } from './BottomBar'
import type { EditorTool } from '../tools/editorTool'

function renderBar(activeTool: EditorTool) {
  const handlers = {
    onSelectCursor: vi.fn(),
    onSelectPan: vi.fn(),
    onSelectRect: vi.fn(),
    onSelectPolygon: vi.fn(),
    onSelectStairs: vi.fn(),
    onSelectDoor: vi.fn(),
  }
  render(<BottomBar activeTool={activeTool} {...handlers} />)
  return { bar: screen.getByRole('toolbar', { name: 'Tools' }), handlers }
}

describe('BottomBar', () => {
  it('renders the six tools and marks the active one', () => {
    const { bar } = renderBar({ type: 'cursor' })

    for (const name of ['Cursor', 'Pan', 'Rectangle', 'Polygon', 'Stairs', 'Door']) {
      expect(within(bar).getByRole('button', { name })).toBeInTheDocument()
    }
    expect(within(bar).getByRole('button', { name: 'Cursor' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(bar).getByRole('button', { name: 'Door' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('reports the clicked tool', () => {
    const { bar, handlers } = renderBar({ type: 'cursor' })

    fireEvent.click(within(bar).getByRole('button', { name: 'Cursor' }))
    expect(handlers.onSelectCursor).toHaveBeenCalledTimes(1)

    fireEvent.click(within(bar).getByRole('button', { name: 'Polygon' }))
    expect(handlers.onSelectPolygon).toHaveBeenCalledTimes(1)

    fireEvent.click(within(bar).getByRole('button', { name: 'Pan' }))
    expect(handlers.onSelectPan).toHaveBeenCalledTimes(1)

    fireEvent.click(within(bar).getByRole('button', { name: 'Rectangle' }))
    expect(handlers.onSelectRect).toHaveBeenCalledTimes(1)

    fireEvent.click(within(bar).getByRole('button', { name: 'Stairs' }))
    expect(handlers.onSelectStairs).toHaveBeenCalledTimes(1)

    fireEvent.click(within(bar).getByRole('button', { name: 'Door' }))
    expect(handlers.onSelectDoor).toHaveBeenCalledTimes(1)
  })

  it('reflects region and door tools as active', () => {
    const { bar } = renderBar({ type: 'region-polygon', tileType: 'floor', vertices: 6 })
    expect(within(bar).getByRole('button', { name: 'Polygon' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})
