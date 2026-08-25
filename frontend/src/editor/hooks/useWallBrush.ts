import { useRef } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { Command } from '../model/commands'
import type { MapModel } from '../model/types'
import type { WallEdge } from '../model/walls'
import type { Viewport } from '../render/viewport'
import { commitWallStroke, nearestEdgeAt } from '../tools/walls'

interface WallBrushOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>
  /** false — инструмент неактивен, события игнорируются. */
  active: boolean
  model: MapModel
  /** true — рисуем стены, false — ластик. */
  present: boolean
  viewportRef: RefObject<Viewport>
  onCommit: (command: Command | null) => void
}

const LEFT_BUTTON = 0

/**
 * Инструмент стен: зажатая ЛКМ собирает рёбра штриха, отпускание коммитит
 * ровно одну команду setWalls. pointercancel отбрасывает незавершённый штрих.
 */
export function useWallBrush(options: WallBrushOptions): {
  handlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerUp: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerCancel: (event: ReactPointerEvent<HTMLCanvasElement>) => void
  }
} {
  const { canvasRef, active, model, present, viewportRef, onCommit } = options
  const strokeEdgesRef = useRef<WallEdge[]>([])
  const strokeKeysRef = useRef<Set<string>>(new Set())
  const pointerIdRef = useRef<number | null>(null)

  function edgeFromEvent(event: ReactPointerEvent<HTMLCanvasElement>): WallEdge | null {
    const canvas = canvasRef.current
    const viewport = viewportRef.current
    if (!canvas || !viewport) return null
    const rect = canvas.getBoundingClientRect()
    return nearestEdgeAt(
      viewport,
      event.clientX - rect.left,
      event.clientY - rect.top,
      model.width,
      model.height,
    )
  }

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
    strokeEdgesRef.current = []
    strokeKeysRef.current = new Set()
    addEdge(edgeFromEvent(event))
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (pointerIdRef.current !== event.pointerId) return
    if ((event.buttons & 1) === 0) {
      finishStroke()
      return
    }
    addEdge(edgeFromEvent(event))
  }

  function addEdge(edge: WallEdge | null) {
    if (!edge) return
    const key = `${edge.x},${edge.y},${edge.side}`
    if (strokeKeysRef.current.has(key)) return
    strokeKeysRef.current.add(key)
    strokeEdgesRef.current.push(edge)
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
    const edges = strokeEdgesRef.current
    strokeEdgesRef.current = []
    strokeKeysRef.current = new Set()
    onCommit(commitWallStroke(model, edges, present))
  }

  function discardStroke() {
    pointerIdRef.current = null
    strokeEdgesRef.current = []
    strokeKeysRef.current = new Set()
  }

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
  }
}
