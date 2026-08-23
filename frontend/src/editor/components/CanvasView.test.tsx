import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../model/createEmptyMap'
import type { EditorTool } from '../tools/editorTool'
import { EditorStore } from '../store/EditorStore'
import { CanvasView } from './CanvasView'

const TERRAIN_TOOL: EditorTool = { type: 'terrain', tile: 1 }

describe('CanvasView hover statusbar', () => {
  it('shows hovered cell coordinates while the pointer is over the map', () => {
    const store = new EditorStore(createEmptyMap(8, 8))
    const { getByTestId } = render(
      <CanvasView
        store={store}
        tool={TERRAIN_TOOL}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
      />,
    )

    // jsdom-rect нулевой, offset нулевой → любая точка даёт клетку (0,0).
    fireEvent.pointerMove(getByTestId('editor-canvas'), { clientX: 10, clientY: 20 })

    expect(getByTestId('editor-coords')).toHaveTextContent('x: 0 · y: 0')
  })

  it('clears the readout when the cursor leaves the canvas', () => {
    const store = new EditorStore(createEmptyMap(8, 8))
    const { getByTestId } = render(
      <CanvasView
        store={store}
        tool={TERRAIN_TOOL}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
      />,
    )
    const canvas = getByTestId('editor-canvas')

    fireEvent.pointerMove(canvas, { clientX: 10, clientY: 20 })
    fireEvent.pointerLeave(canvas)

    expect(getByTestId('editor-coords')).toHaveTextContent('—')
  })

  it('hides coordinates when the pointer is outside the map bounds', () => {
    const store = new EditorStore(createEmptyMap(8, 8))
    const { getByTestId } = render(
      <CanvasView
        store={store}
        tool={TERRAIN_TOOL}
        selectedObjectId={null}
        onSelectObject={vi.fn()}
      />,
    )

    // Клетка далеко за пределами карты 8×8.
    fireEvent.pointerMove(getByTestId('editor-canvas'), { clientX: 5000, clientY: 5000 })

    expect(getByTestId('editor-coords')).toHaveTextContent('—')
  })
})
