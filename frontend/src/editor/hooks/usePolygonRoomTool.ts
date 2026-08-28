import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { RefObject } from 'react'
import { isEditableTarget } from '../dom/isEditableTarget'
import type { Command } from '../model/commands'
import { polygonRoom, regularPolygonVertices } from '../model/rooms'
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
  /** Количество вершин правильного многоугольника (3..12). */
  vertexCount: number
  viewportRef: RefObject<Viewport>
  onCommit: (command: Command | null) => void
}

export interface PolygonRoomPreview {
  readonly center: Cell
  /** Радиусная точка; null, пока курсор ещё не задал радиус (или ушёл за карту). */
  readonly radial: Cell | null
  /** Вершины готового многоугольника; пусто при нулевом радиусе. */
  readonly vertices: readonly Cell[]
}

/** Размещение в процессе: центр поставлен, радиус тянется курсором. */
interface Placement {
  readonly center: Cell
  readonly radial: Cell | null
}

const LEFT_BUTTON = 0

/**
 * Инструмент «Комната-полигон» (старый покликовый ввод удалён): первый клик
 * ставит центр, курсор тянет вторую (радиальную) точку с живым превью
 * правильного N-угольника, клик №2 фиксирует радиус и коммитит. Esc отменяет.
 * Клик в ту же клетку, что и центр (радиус 0), не коммитит — размещение
 * остаётся активным, можно ткнуть в другую клетку.
 */
export function usePolygonRoomTool(options: PolygonRoomToolOptions): {
  preview: PolygonRoomPreview | null
  handlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void
  }
} {
  const { canvasRef, active, model, tile, vertexCount, viewportRef, onCommit } = options
  const [placement, setPlacement] = useState<Placement | null>(null)
  const placementRef = useRef<Placement | null>(null)

  const cellFromEvent = useCellFromEvent(canvasRef, viewportRef, model.gridType)

  function applyPlacement(next: Placement | null) {
    placementRef.current = next
    setPlacement(next)
  }

  function tryCommit(center: Cell, radial: Cell): boolean {
    const vertices = regularPolygonVertices(center, radial, vertexCount, model.width, model.height)
    if (vertices.length === 0) return false
    onCommit(commitRoom(polygonRoom(vertices, model.width, model.height, tile)))
    return true
  }

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.button !== LEFT_BUTTON) return
    if (!active) {
      // Смена инструмента оставила незавершённое размещение — сбрасываем.
      applyPlacement(null)
      return
    }
    const cell = cellFromEvent(event)
    if (!isInsideMap(model, cell.x, cell.y)) return
    event.preventDefault()
    const current = placementRef.current
    if (!current) {
      applyPlacement({ center: cell, radial: null })
      return
    }
    // Клик №2: радиус. Нулевой радиус не коммитит — остаёмся в размещении.
    const next = { center: current.center, radial: cell }
    applyPlacement(next)
    if (tryCommit(current.center, cell)) applyPlacement(null)
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!active) return
    const current = placementRef.current
    if (!current) return
    const cell = cellFromEvent(event)
    if (!isInsideMap(model, cell.x, cell.y)) {
      applyPlacement({ center: current.center, radial: null })
      return
    }
    applyPlacement({ center: current.center, radial: cell })
  }

  const preview = useMemo<PolygonRoomPreview | null>(() => {
    if (!active) return null
    if (!placement) return null
    const vertices = placement.radial
      ? regularPolygonVertices(placement.center, placement.radial, vertexCount, model.width, model.height)
      : []
    return { center: placement.center, radial: placement.radial, vertices }
  }, [placement, active, vertexCount, model.width, model.height])

  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent) => {
      // Не перехватываем клавиши у полей ввода (единый guard с хоткеями).
      if (isEditableTarget(event.target)) return
      if (placementRef.current === null) return
      if (event.code === 'Escape') {
        event.preventDefault()
        applyPlacement(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active])

  return {
    preview,
    handlers: { onPointerDown, onPointerMove },
  }
}