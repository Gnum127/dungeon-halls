import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { RefObject } from 'react'
import type { Command } from '../model/commands'
import type { MapModel, TileValue } from '../model/types'
import type { Viewport } from '../render/viewport'
import { commitStroke, isInsideMap } from '../tools/brush'
import type { Cell } from '../tools/brush'
import { useCellFromEvent } from './useCellFromEvent'

interface BrushOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>
  /** false — кисть неактивна, события игнорируются. */
  active: boolean
  model: MapModel
  tile: TileValue
  viewportRef: RefObject<Viewport>
  onCommit: (command: Command | null) => void
}

const LEFT_BUTTON = 0

/**
 * Кисть террейна: зажатая ЛКМ собирает клетки штриха, отпускание коммитит
 * ровно одну команду setTiles (coalescing до dispatch). pointercancel
 * отбрасывает незавершённый штрих.
 */
export function useTerrainBrush(options: BrushOptions): {
  pendingCells: readonly Cell[]
  handlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerUp: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerCancel: (event: ReactPointerEvent<HTMLCanvasElement>) => void
  }
} {
  const { canvasRef, active, model, tile, viewportRef, onCommit } = options
  const strokeCellsRef = useRef<Cell[]>([])
  const strokeKeysRef = useRef<Set<number>>(new Set())
  const pointerIdRef = useRef<number | null>(null)
  const [pendingCells, setPendingCells] = useState<readonly Cell[]>([])

  const cellFromEvent = useCellFromEvent(canvasRef, viewportRef)

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!active || event.button !== LEFT_BUTTON) return
    // Второй указатель во время штриха не перехватывает жест.
    if (pointerIdRef.current !== null) return
    event.preventDefault()
    try {
      canvasRef.current?.setPointerCapture(event.pointerId)
    } catch {
      // Pointer уже неактивен; штрих завершится по pointerup/cancel.
    }
    pointerIdRef.current = event.pointerId
    strokeKeysRef.current = new Set()
    const cell = cellFromEvent(event)
    strokeCellsRef.current = []
    setPendingCells([])
    addCell(cell)
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (pointerIdRef.current !== event.pointerId) return
    if ((event.buttons & 1) === 0) {
      // Кнопку отпустили вне окна — считаем штрих завершённым.
      finishStroke()
      return
    }
    addCell(cellFromEvent(event))
  }

  /** Дедуп и фильтрация при записи: превью честное и не разбухает. */
  function addCell(cell: Cell) {
    if (!isInsideMap(model, cell.x, cell.y)) return
    const key = cell.y * model.width + cell.x
    if (strokeKeysRef.current.has(key)) return
    strokeKeysRef.current.add(key)
    strokeCellsRef.current.push(cell)
    setPendingCells([...strokeCellsRef.current])
  }

  function onPointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (pointerIdRef.current !== event.pointerId) return
    finishStroke()
  }

  function onPointerCancel(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (pointerIdRef.current !== event.pointerId) return
    discardStroke()
  }

  function finishStroke() {
    pointerIdRef.current = null
    const cells = strokeCellsRef.current
    strokeCellsRef.current = []
    strokeKeysRef.current = new Set()
    setPendingCells([])
    onCommit(commitStroke(model, cells, tile))
  }

  function discardStroke() {
    pointerIdRef.current = null
    strokeCellsRef.current = []
    strokeKeysRef.current = new Set()
    setPendingCells([])
  }

  return {
    pendingCells,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
  }
}
