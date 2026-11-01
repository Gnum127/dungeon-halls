import { useEffect, useRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../model/createEmptyMap'
import type { MapModel } from '../model/types'
import type { Point } from '@/shared/point'
import type { Viewport } from '../render/viewport'
import { useHoverCell } from './useHoverCell'

const CELL = 32

interface Hover {
  readonly cell: { x: number; y: number } | null
  readonly world: Point | null
}

function Harness({
  model,
  viewport,
  capture,
}: {
  model: MapModel
  viewport: Viewport
  capture: (hover: Hover) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const viewportRef = { current: viewport } as unknown as React.RefObject<Viewport>
  const { hoverCell, hoverWorld, handlers } = useHoverCell({
    canvasRef,
    viewportRef,
    viewport,
    model,
  })
  useEffect(() => {
    capture({ cell: hoverCell, world: hoverWorld })
  })
  return <canvas ref={canvasRef} data-testid="canvas" {...handlers} />
}

function makeViewport(overrides: Partial<Viewport> = {}): Viewport {
  return { width: 4 * CELL, height: 4 * CELL, cellSize: CELL, offsetX: 0, offsetY: 0, ...overrides }
}

function setup(model: MapModel = createEmptyMap(4, 4), viewport: Viewport = makeViewport()) {
  const latest = { current: { cell: null, world: null } as Hover }
  const view = render(
    <Harness model={model} viewport={viewport} capture={(hover) => (latest.current = hover)} />,
  )
  const canvas = screen.getByTestId('canvas')
  canvas.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 4 * CELL,
      right: 4 * CELL,
      width: 4 * CELL,
      height: 4 * CELL,
      toJSON: () => ({}),
    }) as DOMRect
  return { canvas, latest, view }
}

describe('useHoverCell', () => {
  it('reports the cell and the raw world point under the cursor', () => {
    const { canvas, latest } = setup()
    fireEvent.pointerMove(canvas, { clientX: 48, clientY: 80 })

    expect(latest.current.cell).toEqual({ x: 1, y: 2 })
    expect(latest.current.world).toEqual({ x: 1.5, y: 2.5 })
  })

  it('clears the hover outside the map', () => {
    const { canvas, latest } = setup()
    // World x = 4 → cell 4 is outside a 4×4 map.
    fireEvent.pointerMove(canvas, { clientX: 4 * CELL, clientY: 16 })

    expect(latest.current.cell).toBeNull()
    expect(latest.current.world).toBeNull()
  })

  it('clears the hover on pointer leave', () => {
    const { canvas, latest } = setup()
    fireEvent.pointerMove(canvas, { clientX: 48, clientY: 48 })
    expect(latest.current.cell).toEqual({ x: 1, y: 1 })

    fireEvent.pointerLeave(canvas)
    expect(latest.current.cell).toBeNull()
  })

  it('recomputes the hover when the viewport changes under a still cursor', () => {
    const model = createEmptyMap(4, 4)
    const { canvas, latest, view } = setup(model)
    fireEvent.pointerMove(canvas, { clientX: 48, clientY: 80 })
    expect(latest.current.cell).toEqual({ x: 1, y: 2 })

    view.rerender(
      <Harness
        model={model}
        viewport={makeViewport({ offsetX: 32, offsetY: 32 })}
        capture={(hover) => (latest.current = hover)}
      />,
    )
    expect(latest.current.cell).toEqual({ x: 2, y: 3 })
    expect(latest.current.world).toEqual({ x: 2.5, y: 3.5 })
  })

  it('keeps the same state object when cell and world are unchanged', () => {
    const model = createEmptyMap(4, 4)
    const { canvas, latest, view } = setup(model)
    fireEvent.pointerMove(canvas, { clientX: 48, clientY: 80 })
    const firstWorld = latest.current.world

    // A new (equal) model re-runs recompute under the still cursor; the state
    // object must not be recreated, so downstream renders are skipped.
    view.rerender(
      <Harness
        model={{ ...model }}
        viewport={makeViewport()}
        capture={(hover) => (latest.current = hover)}
      />,
    )
    expect(latest.current.world).toBe(firstWorld)
  })
})
