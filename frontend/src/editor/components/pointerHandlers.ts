import type { PointerEvent as ReactPointerEvent } from 'react'

export interface PointerHandlers {
  onPointerDown?: (event: ReactPointerEvent<HTMLCanvasElement>) => void
  onPointerMove?: (event: ReactPointerEvent<HTMLCanvasElement>) => void
  onPointerUp?: (event: ReactPointerEvent<HTMLCanvasElement>) => void
  onPointerCancel?: (event: ReactPointerEvent<HTMLCanvasElement>) => void
}

/**
 * Объединяет наборы pointer-обработчиков (пан, кисть, …): событие получают
 * все наборы, каждый сам фильтрует по кнопке/pointerId.
 */
export function mergePointerHandlers(...sets: PointerHandlers[]): Required<PointerHandlers> {
  return {
    onPointerDown: (event) => sets.forEach((set) => set.onPointerDown?.(event)),
    onPointerMove: (event) => sets.forEach((set) => set.onPointerMove?.(event)),
    onPointerUp: (event) => sets.forEach((set) => set.onPointerUp?.(event)),
    onPointerCancel: (event) => sets.forEach((set) => set.onPointerCancel?.(event)),
  }
}
