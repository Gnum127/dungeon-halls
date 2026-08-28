import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { RefObject } from 'react'
import { isEditableTarget } from '../dom/isEditableTarget'
import type { Command } from '../model/commands'
import { polygonRoom } from '../model/rooms'
import type { MapModel, TileValue } from '../model/types'
import type { Viewport } from '../render/viewport'
import { isInsideMap } from '../tools/brush'
import type { Cell } from '../tools/brush'
import { commitRoom } from '../tools/rooms'
import { useCellFromEvent } from './useCellFromEvent'

interface PolygonRoomToolOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>
  /** false — инструмент неактивен, события игнорируются. */
  active: boolean
  model: MapModel
  /** Чем заливается комната; `EMPTY_TILE` = ластик области без стен. */
  tile: TileValue
  viewportRef: RefObject<Viewport>
  onCommit: (command: Command | null) => void
}

const LEFT_BUTTON = 0

/**
 * Инструмент «Комната-полигон»: клики ставят вершины (snap к центрам клеток).
 * Enter или двойной клик завершают и коммитят комнату (нужно ≥3 вершин),
 * Esc отменяет незавершённый полигон. Живое превью рёбер и заливки.
 */
export function usePolygonRoomTool(options: PolygonRoomToolOptions): {
  vertices: readonly Cell[] | null
handlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerCancel: () => void
    onDoubleClick: (event: ReactMouseEvent<HTMLCanvasElement>) => void
  }
} {
  const { canvasRef, active, model, tile, viewportRef, onCommit } = options
  const [vertices, setVertices] = useState<readonly Cell[] | null>(null)
  const verticesRef = useRef<readonly Cell[] | null>(null)

  const cellFromEvent = useCellFromEvent(canvasRef, viewportRef, model.gridType)

  function applyVertices(next: readonly Cell[] | null) {
    verticesRef.current = next
    setVertices(next)
  }

  function addVertex(event: ReactPointerEvent<HTMLCanvasElement>) {
    const cell = cellFromEvent(event)
    if (!isInsideMap(model, cell.x, cell.y)) return
    const current = verticesRef.current
    if (current) {
      const last = current[current.length - 1]
      if (last.x === cell.x && last.y === cell.y) return
      applyVertices([...current, cell])
    } else {
      applyVertices([cell])
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!active || event.button !== LEFT_BUTTON) return
    event.preventDefault()
    addVertex(event)
  }

  function onPointerCancel() {
    if (!active) return
    applyVertices(null)
  }

  function onDoubleClick(event: ReactMouseEvent<HTMLCanvasElement>) {
    if (!active) return
    const current = verticesRef.current
    if (current && current.length >= 3) {
      event.preventDefault()
      commitPolygon(current)
    }
  }

  const commitPolygon = useCallback(
    (points: readonly Cell[]) => {
      onCommit(commitRoom(polygonRoom(points, model.width, model.height, tile)))
      applyVertices(null)
    },
    [model.width, model.height, onCommit, tile],
  )

  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent) => {
      // Не перехватываем клавиши у полей ввода (единый guard с хоткеями).
      if (isEditableTarget(event.target)) return
      if (verticesRef.current === null) return
      if (event.code === 'Enter' || event.code === 'NumpadEnter') {
        if (verticesRef.current.length >= 3) {
          event.preventDefault()
          commitPolygon(verticesRef.current)
        }
      } else if (event.code === 'Escape') {
        event.preventDefault()
        applyVertices(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, commitPolygon])

  return {
    vertices,
    handlers: { onPointerDown, onPointerCancel, onDoubleClick },
  }
}