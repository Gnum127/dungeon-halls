import { createRef, useEffect, useRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../model/createEmptyMap'
import type { Command } from '../model/commands'
import type { MapModel } from '../model/types'
import type { Point } from '@/shared/point'
import type { Viewport } from '../render/viewport'
import { usePolygonRegionTool } from './usePolygonRegionTool'
import type { PolygonPreview } from './usePolygonRegionTool'

const CELL = 32
const COLS = 4
const ROWS = 4

interface HarnessProps {
  model: MapModel
  active: boolean
  vertices?: number
  onCommit: (command: Command | null) => void
  onPreview: (preview: PolygonPreview | null) => void
}

function Harness({ model, active, vertices = 4, onCommit, onPreview }: HarnessProps) {
  const canvasRef = createRef<HTMLCanvasElement>()
  const viewportRef = useRef<Viewport>({
    width: COLS * CELL,
    height: ROWS * CELL,
    cellSize: CELL,
    offsetX: 0,
    offsetY: 0,
  })
  const { handlers, preview } = usePolygonRegionTool({
    canvasRef,
    active,
    model,
    tileType: 'floor',
    vertices,
    autoWalls: false,
    viewportRef,
    onCommit,
  })
  useEffect(() => {
    onPreview(preview)
  }, [preview, onPreview])
  return <canvas ref={canvasRef} data-testid="canvas" {...handlers} />
}

function setup(model: MapModel, vertices?: number) {
  const onCommit = vi.fn<(command: Command | null) => void>()
  const onPreview = vi.fn<(preview: PolygonPreview | null) => void>()
  const renderTree = (active: boolean) => (
    <Harness
      model={model}
      active={active}
      vertices={vertices}
      onCommit={onCommit}
      onPreview={onPreview}
    />
  )
  const view = render(renderTree(true))
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
  const deactivate = () => view.rerender(renderTree(false))
  const activate = () => view.rerender(renderTree(true))
  return { canvas, onCommit, onPreview, deactivate, activate }
}

function clickCell(canvas: HTMLElement, col: number, row: number) {
  fireEvent.pointerDown(canvas, {
    button: 0,
    pointerId: 1,
    clientX: col * CELL + CELL / 2,
    clientY: row * CELL + CELL / 2,
  })
}

function clickWorld(canvas: HTMLElement, x: number, y: number) {
  fireEvent.pointerDown(canvas, {
    button: 0,
    pointerId: 1,
    clientX: x * CELL,
    clientY: y * CELL,
  })
}

function committedPolygon(command: Command | null): readonly Point[] {
  if (command?.kind !== 'addRegion' && command?.kind !== 'addRegionWithWalls') {
    throw new Error('expected a region command')
  }
  return command.region.polygon
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

  it('takes the clicked world point as the center (no implicit cell-center offset)', () => {
    const { canvas, onCommit } = setup(createEmptyMap(COLS, ROWS), 4)
    // Exact integer clicks: the old cell-based code added +0.5 (2.5,2.5 / 3.5,2.5).
    clickWorld(canvas, 2, 2)
    clickWorld(canvas, 3, 2)

    expect(onCommit).toHaveBeenCalledTimes(1)
    const polygon = committedPolygon(onCommit.mock.calls[0][0])
    expect(polygon).toHaveLength(4)
    expect(polygon[0]).toEqual({ x: 3, y: 2 })
  })

  it('snaps fractional clicks to the half-cell grid', () => {
    const { canvas, onCommit } = setup(createEmptyMap(COLS, ROWS), 4)
    // 2.2 → 2, 3.2 → 3; without snapping the first vertex would be (3.2, 2.2).
    clickWorld(canvas, 2.2, 2.2)
    clickWorld(canvas, 3.2, 2.2)

    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(committedPolygon(onCommit.mock.calls[0][0])[0]).toEqual({ x: 3, y: 2 })
  })

  it('Escape clears the unfinished polygon instead of committing on the next click', () => {
    const { canvas, onPreview, onCommit } = setup(createEmptyMap(COLS, ROWS), 4)
    clickWorld(canvas, 1, 1)
    expect(onPreview).toHaveBeenLastCalledWith({
      center: { x: 1, y: 1 },
      current: { x: 1, y: 1 },
    })

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onPreview).toHaveBeenLastCalledWith(null)
    clickWorld(canvas, 2, 2)
    expect(onCommit).not.toHaveBeenCalled()
    expect(onPreview).toHaveBeenLastCalledWith({
      center: { x: 2, y: 2 },
      current: { x: 2, y: 2 },
    })
  })

  it('drops the unfinished polygon when the tool is deactivated', () => {
    const { canvas, onPreview, deactivate, activate, onCommit } = setup(
      createEmptyMap(COLS, ROWS),
      4,
    )
    clickWorld(canvas, 1, 1)

    deactivate()

    expect(onPreview).toHaveBeenLastCalledWith(null)
    activate()
    clickWorld(canvas, 2, 2)
    expect(onCommit).not.toHaveBeenCalled()
  })
})
