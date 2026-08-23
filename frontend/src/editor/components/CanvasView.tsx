import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditor } from '../hooks/useEditor'
import { useCanvasSize } from '../hooks/useCanvasSize'
import { useDevicePixelRatio } from '../hooks/useDevicePixelRatio'
import { useMiddleButtonPan } from '../hooks/useMiddleButtonPan'
import { useWheelZoom } from '../hooks/useWheelZoom'
import type { EditorStore } from '../store/EditorStore'
import { renderMap } from '../render/renderMap'
import { BASE_CELL_SIZE, zoomAt } from '../render/viewport'
import type { PanZoomState } from '../render/viewport'
import styles from './CanvasView.module.css'

interface CanvasViewProps {
  store: EditorStore
}

export function CanvasView({ store }: CanvasViewProps) {
  const model = useEditor(store)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const size = useCanvasSize(wrapRef)
  const dpr = useDevicePixelRatio()
  const [panZoom, setPanZoom] = useState<PanZoomState>({
    cellSize: BASE_CELL_SIZE,
    offsetX: 0,
    offsetY: 0,
  })

  const viewport = useMemo(
    () => ({
      ...panZoom,
      width: Math.floor(size.width),
      height: Math.floor(size.height),
    }),
    [panZoom, size],
  )

  const handleZoom = useCallback((screenX: number, screenY: number, factor: number) => {
    setPanZoom((current) => zoomAt(current, screenX, screenY, current.cellSize * factor))
  }, [])
  useWheelZoom(canvasRef, handleZoom)

  const handlePan = useCallback((deltaX: number, deltaY: number) => {
    setPanZoom((current) => ({
      ...current,
      offsetX: current.offsetX - deltaX,
      offsetY: current.offsetY - deltaY,
    }))
  }, [])
  const { handlers: panHandlers } = useMiddleButtonPan(canvasRef, handlePan)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || viewport.width < 1 || viewport.height < 1) return

    const pixelWidth = Math.floor(viewport.width * dpr)
    const pixelHeight = Math.floor(viewport.height * dpr)
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth
      canvas.height = pixelHeight
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    renderMap(ctx, model, viewport)
  }, [model, viewport, dpr])

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        data-testid="editor-canvas"
        {...panHandlers}
      />
    </div>
  )
}
