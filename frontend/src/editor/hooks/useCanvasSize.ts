import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

export interface CanvasSize {
  width: number
  height: number
}

/** Размер элемента в CSS-пикселях через ResizeObserver. */
export function useCanvasSize(target: RefObject<HTMLElement | null>): CanvasSize {
  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0 })

  useEffect(() => {
    const element = target.current
    if (!element) return

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      const width = rect.width
      const height = rect.height
      setSize((previous) =>
        previous.width === width && previous.height === height ? previous : { width, height },
      )
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [target])

  return size
}
