import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../model/createEmptyMap'
import type { EditorTool } from '../tools/editorTool'
import { EditorStore } from '../store/EditorStore'
import { CanvasView } from './CanvasView'

const TERRAIN_TOOL: EditorTool = { type: 'terrain', tile: 1 }

function renderView(tool: EditorTool = TERRAIN_TOOL) {
  const store = new EditorStore(createEmptyMap(8, 8))
  return render(
    <CanvasView
      store={store}
      tool={tool}
      selectedObjectId={null}
      onSelectObject={vi.fn()}
      roomTile={1}
      polygonVertexCount={6}
      lightRadius={3}
      lightColor="#ffd682"
    />,
  )
}

describe('CanvasView hover statusbar', () => {
  it('shows hovered cell coordinates while the pointer is over the map', () => {
    const { getByTestId } = renderView()

    // jsdom-rect нулевой, offset нулевой → любая точка даёт клетку (0,0).
    fireEvent.pointerMove(getByTestId('editor-canvas'), { clientX: 10, clientY: 20 })

    expect(getByTestId('editor-coords')).toHaveTextContent('x: 0 · y: 0')
  })

  it('clears the readout when the cursor leaves the canvas', () => {
    const { getByTestId } = renderView()
    const canvas = getByTestId('editor-canvas')

    fireEvent.pointerMove(canvas, { clientX: 10, clientY: 20 })
    fireEvent.pointerLeave(canvas)

    expect(getByTestId('editor-coords')).toHaveTextContent('—')
  })

  it('hides coordinates when the pointer is outside the map bounds', () => {
    const { getByTestId } = renderView()

    // Клетка далеко за пределами карты 8×8.
    fireEvent.pointerMove(getByTestId('editor-canvas'), { clientX: 5000, clientY: 5000 })

    expect(getByTestId('editor-coords')).toHaveTextContent('—')
  })

  it('recomputes coordinates after panning under a still cursor', () => {
    const { getByTestId } = renderView()
    const canvas = getByTestId('editor-canvas')

    // Курсор в клетке (0,0).
    fireEvent.pointerMove(canvas, { clientX: 10, clientY: 20 })
    expect(getByTestId('editor-coords')).toHaveTextContent('x: 0 · y: 0')

    // Пан средней кнопкой: смещение +96px. Сам курсор уехал на clientX=4,
    // где при новом offset клетка — (3,0). Без пересчёта по [viewport]
    // статусбар остался бы на «x: 0».
    fireEvent.pointerDown(canvas, { button: 1, buttons: 4, pointerId: 9, clientX: 100 })
    fireEvent.pointerMove(canvas, { button: 1, buttons: 4, pointerId: 9, clientX: 4 })
    fireEvent.pointerUp(canvas, { button: 1, buttons: 0, pointerId: 9 })

    expect(getByTestId('editor-coords')).toHaveTextContent('x: 3 · y: 0')
  })
})
