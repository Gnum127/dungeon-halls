import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../model/createEmptyMap'
import type { MapModel } from '../model/types'
import type { Point } from '@/shared/point'
import type { Viewport } from '../render/viewport'
import { usePolygonRegionTool } from './usePolygonRegionTool'

const CELL = 32
const COLS = 4
const ROWS = 4

interface HarnessProps {
  model: MapModel
  vertices?: number
  onCommit: (command: unknown) => void
}

function Harness({ model, vertices = 4, onCommit }: HarnessProps) {
  const canvasRef = createRef<HTMLCanvasElement>()
  const viewportRef = {
    current: {
      width: COLS * CELL,
      height: ROWS * CELL,
      cellSize: CELL,
      offsetX: 0,
      offsetY: 0,
    },
  } as unknown as React.RefObject<Viewport>
  const { handlers } = usePolygonRegionTool({
    canvasRef,
    active: true,
    model,
    tileType: 'floor',
    vertices,
    autoWalls: false,
    viewportRef,
    onCommit: onCommit as never,
  })
  return <canvas ref={canvasRef} data-testid="canvas" {...handlers} />
}

function setup(model: MapModel, vertices?: number) {
  const onCommit = vi.fn()
  render(<Harness model={model} vertices={vertices} onCommit={onCommit} />)
  const canvas = screen.getByTestId('canvas')
  canvas.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: ROWS * CELL,
      right: COLS * CELL,
      width: COLS * CELL,
      height: ROWS * CELL,
      toJSON: () => ({}),
    }) as DOMRect
  return { canvas, onCommit }
}

function clickCell(canvas: HTMLElement, col: number, row: number) {
  fireEvent.pointerDown(canvas, {
    button: 0,
    pointerId: 1,
    clientX: col * CELL + CELL / 2,
    clientY: row * CELL + CELL / 2,
  })
}

function committedPolygon(command: unknown): Point[] {
  return (command as { region: { polygon: Point[] } }).region.polygon
}

describe('usePolygonRegionTool', () => {
  it('clamps every vertex of the committed polygon to the map bounds', () => {
    // Center on the top-left cell, radius point on the bottom-right corner:
    // half of the square would fall outside the 4×4 map.
    const { canvas, onCommit } = setup(createEmptyMap(COLS, ROWS), 4)
    clickCell(canvas, 0, 0)
    clickCell(canvas, 3, 3)

    expect(onCommit).toHaveBeenCalledTimes(1)
    const polygon = committedPolygon(onCommit.mock.calls[0][0])
    expect(polygon.length).toBeGreaterThanOrEqual(3)
    for (const point of polygon) {
      expect(point.x).toBeGreaterThanOrEqual(0)
      expect(point.x).toBeLessThanOrEqual(COLS)
      expect(point.y).toBeGreaterThanOrEqual(0)
      expect(point.y).toBeLessThanOrEqual(ROWS)
    }
  })

  it('does not commit when the radius point lands on the center cell', () => {
    const { canvas, onCommit } = setup(createEmptyMap(COLS, ROWS), 4)
    clickCell(canvas, 1, 1)
    clickCell(canvas, 1, 1)

    expect(onCommit).not.toHaveBeenCalled()
  })
})
