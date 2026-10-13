import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { RefObject } from 'react'
import type { MapModel } from '../model/types'
import { isInsideMap } from '../tools/isInsideMap'
import type { Viewport } from '../render/viewport'
import { useCellFromEvent } from './useCellFromEvent'

interface HoverCellOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>
  viewportRef: RefObject<Viewport>
  /** Включён в зависимости пересчёта: пан/зум меняют клетку под курсором. */
  viewport: Viewport
  model: MapModel
}

/**
 * Клетка под курсором для подсветки и статусбара. Пересчитывается и при
 * движении мыши, и при смене вьюпорта/модели под неподвижным курсором.
 */
export function useHoverCell(options: HoverCellOptions): {
  hoverCell: { x: number; y: number } | null
  recompute: () => void
  handlers: {
    onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void
    onPointerLeave: () => void
  }
} {
  const { canvasRef, viewportRef, viewport, model } = options
  const clientPointRef = useRef<{ clientX: number; clientY: number } | null>(null)
  const [cell, setCell] = useState<{ x: number; y: number } | null>(null)

  const cellFromEvent = useCellFromEvent(canvasRef, viewportRef)

  const recompute = useCallback(() => {
    const point = clientPointRef.current
    if (!point) return
    const next = cellFromEvent(point)
    if (!isInsideMap(model, next.x, next.y)) {
      setCell(null)
      return
    }
    setCell((previous) =>
      previous && previous.x === next.x && previous.y === next.y ? previous : next,
    )
  }, [cellFromEvent, model])

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      clientPointRef.current = { clientX: event.clientX, clientY: event.clientY }
      recompute()
    },
    [recompute],
  )

  const onPointerLeave = useCallback(() => {
    clientPointRef.current = null
    setCell(null)
  }, [])

  // Пан/зум под неподвижным курсором меняют клетку — пересчитываем.
  useEffect(() => {
    recompute()
  }, [viewport, recompute])

  return {
    hoverCell: cell,
    recompute,
    handlers: { onPointerMove, onPointerLeave },
  }
}
