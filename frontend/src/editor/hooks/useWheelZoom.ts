import { useEffect } from 'react'
import type { RefObject } from 'react'

const ZOOM_STEP = 1.15

/**
 * Зум колесом мыши. Слушатель вешается нативно, потому что React-обработчик
 * onWheel пассивен и preventDefault в нём не работает.
 */
export function useWheelZoom(
  target: RefObject<HTMLCanvasElement | null>,
  onZoom: (screenX: number, screenY: number, factor: number) => void,
): void {
  useEffect(() => {
    const canvas = target.current
    if (!canvas) return

    const handler = (event: WheelEvent) => {
      event.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
      onZoom(event.clientX - rect.left, event.clientY - rect.top, factor)
    }

    canvas.addEventListener('wheel', handler, { passive: false })
    return () => canvas.removeEventListener('wheel', handler)
  }, [target, onZoom])
}
