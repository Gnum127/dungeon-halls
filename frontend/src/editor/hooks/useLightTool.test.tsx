import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { applyCommand } from '../model/commands'
import { createEmptyMap } from '../model/createEmptyMap'
import type { MapModel } from '../model/types'
import type { Viewport } from '../render/viewport'
import { useLightTool } from './useLightTool'

function Harness({
  model,
  radius = 3,
  color = '#ffd682',
  viewport: vp,
  onCommit,
}: {
  model: MapModel
  radius?: number
  color?: string
  viewport?: Partial<Viewport>
  onCommit: (command: unknown) => void
}) {
  const canvasRef = createRef<HTMLCanvasElement>()
  const fullViewport: Viewport = {
    width: 96,
    height: 96,
    cellSize: 32,
    offsetX: 0,
    offsetY: 0,
    ...vp,
  }
  const viewportRef = { current: fullViewport } as unknown as React.RefObject<Viewport>
  const { handlers } = useLightTool({
    canvasRef,
    active: true,
    model,
    radius,
    color,
    viewportRef,
    onCommit: onCommit as never,
  })

  return <canvas ref={canvasRef} data-testid="canvas" {...handlers} />
}

function setup(model: MapModel, viewport?: Partial<Viewport>, radius = 3) {
  const onCommit = vi.fn()
  render(<Harness model={model} viewport={viewport} radius={radius} onCommit={onCommit} />)
  const canvas = screen.getByTestId('canvas')
  canvas.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: 96,
    right: 96,
    width: 96,
    height: 96,
    toJSON: () => ({}),
  }) as DOMRect
  return { canvas, onCommit }
}

describe('useLightTool', () => {
  it('places a light with panel properties at the clicked cell', () => {
    const { canvas, onCommit } = setup(createEmptyMap(3, 3), undefined, 7)
    // Центр клетки (1,1).
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 48, clientY: 48 })

    expect(onCommit).toHaveBeenCalledWith({
      kind: 'addLight',
      x: 1,
      y: 1,
      radius: 7,
      color: '#ffd682',
    })
  })

  it('removes the existing light on a second click at the same cell', () => {
    let model = applyCommand(createEmptyMap(3, 3), {
      kind: 'addLight',
      x: 2,
      y: 0,
      radius: 3,
      color: '#88aaff',
    })
    const { canvas, onCommit } = setup(model)
    // Клетка (2,0): экран x∈[64..96].
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 80, clientY: 16 })

    expect(onCommit).toHaveBeenCalledWith({ kind: 'removeLight', id: 1 })
  })

  it('translates coordinates through zoom and scroll via screenToCell', () => {
    const vp = { cellSize: 64, offsetX: 50, offsetY: 30 }
    const { canvas, onCommit } = setup(createEmptyMap(6, 6), vp)
    // Мир: wx = 14+50 = 64 → клетка 1; wy = 40+30 = 70 → клетка 1.
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 14, clientY: 40 })

    expect(onCommit).toHaveBeenCalledWith({
      kind: 'addLight',
      x: 1,
      y: 1,
      radius: 3,
      color: '#ffd682',
    })
  })

  it('ignores clicks outside the map', () => {
    const { canvas, onCommit } = setup(createEmptyMap(3, 3))
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 200, clientY: 200 })
    expect(onCommit).not.toHaveBeenCalled()
  })
})
