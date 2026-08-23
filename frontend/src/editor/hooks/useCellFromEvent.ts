import { useCallback } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { RefObject } from 'react'
import type { Viewport } from '../render/viewport'
import { screenToCell } from '../render/viewport'

/**
 * Общий для инструментов перевод клиентских координат события в клетку.
 * Возвращает NaN-клетку, если canvas/viewport ещё не готовы.
 */
export function useCellFromEvent(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  viewportRef: RefObject<Viewport>,
): (event: ReactPointerEvent<HTMLCanvasElement>) => { x: number; y: number } {
  return useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      const viewport = viewportRef.current
      if (!canvas || !viewport) return { x: Number.NaN, y: Number.NaN }
      const rect = canvas.getBoundingClientRect()
      return screenToCell(viewport, event.clientX - rect.left, event.clientY - rect.top)
    },
    [canvasRef, viewportRef],
  )
}
