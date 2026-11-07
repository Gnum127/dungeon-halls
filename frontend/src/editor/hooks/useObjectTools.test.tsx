import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../model/createEmptyMap'
import type { MapModel } from '../model/types'
import type { EditorTool } from '../tools/editorTool'
import type { Viewport } from '../render/viewport'
import { useObjectTools } from './useObjectTools'

const CELL = 32
const COLS = 8
const ROWS = 8

const TOOL: Extract<EditorTool, { type: 'object' }> = {
  type: 'object',
  kindId: 'torch',
  rotation: 0,
  scale: { w: 1, h: 1 },
}

interface HarnessProps {
  model: MapModel
  tool?: EditorTool
  dispatch: (command: unknown) => void
}

function Harness({ model, tool = TOOL, dispatch }: HarnessProps) {
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
  const { handlers } = useObjectTools({
    canvasRef,
    viewportRef,
    store: { dispatch: dispatch as never },
    model,
    tool,
  })
  return <canvas ref={canvasRef} data-testid="canvas" {...handlers} />
}

/** Пиксель клиента для мировой float-координаты (левый-верхний угол канвы в 0,0). */
function worldPx(value: number) {
  return value * CELL
}

function setup(model: MapModel, tool?: EditorTool) {
  const dispatch = vi.fn()
  render(<Harness model={model} tool={tool} dispatch={dispatch} />)
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
  return { canvas, dispatch }
}

describe('useObjectTools', () => {
  it('places the object at the exact float world point (not snapped to a cell)', () => {
    const { canvas, dispatch } = setup(createEmptyMap(COLS, ROWS))

    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: worldPx(1.3),
      clientY: worldPx(2.7),
    })

    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({
      kind: 'addObject',
      x: 1.3,
      y: 2.7,
      kindId: 'torch',
      rotation: 0,
      scale: { w: 1, h: 1 },
    })
  })

  it('allows placement whose footprint overhangs the right/bottom edge', () => {
    const { canvas, dispatch } = setup(createEmptyMap(COLS, ROWS))

    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: worldPx(7.5),
      clientY: worldPx(7.5),
    })

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'addObject', x: 7.5, y: 7.5 }),
    )
  })

  it('ignores clicks outside the map (negative or beyond the grid)', () => {
    const { canvas, dispatch } = setup(createEmptyMap(COLS, ROWS))

    fireEvent.pointerDown(canvas, { button: 0, clientX: worldPx(-0.5), clientY: worldPx(2) })
    fireEvent.pointerDown(canvas, { button: 0, clientX: worldPx(8.5), clientY: worldPx(2) })

    expect(dispatch).not.toHaveBeenCalled()
  })

  it('snaps the placement point to the half-cell step with Shift', () => {
    const { canvas, dispatch } = setup(createEmptyMap(COLS, ROWS))

    fireEvent.pointerDown(canvas, {
      button: 0,
      shiftKey: true,
      clientX: worldPx(1.3),
      clientY: worldPx(2.7),
    })

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'addObject', x: 1.5, y: 2.5 }),
    )
  })

  it('allows a multi-cell footprint to overhang the edge', () => {
    const tool: EditorTool = { ...TOOL, scale: { w: 2, h: 1 } }
    const { canvas, dispatch } = setup(createEmptyMap(COLS, ROWS), tool)

    fireEvent.pointerDown(canvas, { button: 0, clientX: worldPx(7.5), clientY: worldPx(2) })

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'addObject', x: 7.5, y: 2, scale: { w: 2, h: 1 } }),
    )
  })

  it('does not place onto an occupied footprint', () => {
    const model: MapModel = {
      ...createEmptyMap(COLS, ROWS),
      objects: [{ id: 1, kindId: 'torch', x: 1, y: 1 }],
    }
    const { canvas, dispatch } = setup(model)

    fireEvent.pointerDown(canvas, { button: 0, clientX: worldPx(1.2), clientY: worldPx(1) })

    expect(dispatch).not.toHaveBeenCalled()
  })

  it('is inert for a non-object tool', () => {
    const { canvas, dispatch } = setup(createEmptyMap(COLS, ROWS), { type: 'cursor' })

    fireEvent.pointerDown(canvas, { button: 0, clientX: worldPx(1), clientY: worldPx(1) })

    expect(dispatch).not.toHaveBeenCalled()
  })

  it('rejects a multi-cell footprint that overlaps another object', () => {
    const model: MapModel = {
      ...createEmptyMap(COLS, ROWS),
      objects: [{ id: 1, kindId: 'torch', x: 2, y: 2 }],
    }
    const tool: EditorTool = { ...TOOL, scale: { w: 2, h: 1 } }
    const { canvas, dispatch } = setup(model, tool)

    // Footprint [1.5..3.5)×[2..3) накрывает объект в (2,2).
    fireEvent.pointerDown(canvas, { button: 0, clientX: worldPx(1.5), clientY: worldPx(2) })

    expect(dispatch).not.toHaveBeenCalled()
  })
})
