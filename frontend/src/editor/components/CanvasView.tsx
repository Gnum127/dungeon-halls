import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useEditor } from '../hooks/useEditor'
import type { EditorStore } from '../store/EditorStore'
import { renderMap } from '../render/renderMap'
import { BASE_CELL_SIZE, zoomAt } from '../render/viewport'
import type { Viewport } from '../render/viewport'
import styles from './CanvasView.module.css'

const ZOOM_STEP = 1.15

interface Props {
  store: EditorStore
}

export function CanvasView({ store }: Props) {
  const model = useEditor(store)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [viewport, setViewport] = useState<Viewport>({
    width: 0,
    height: 0,
    cellSize: BASE_CELL_SIZE,
    offsetX: 0,
    offsetY: 0,
  })
  const panStateRef = useRef<{ pointerId: number; lastX: number; lastY: number } | null>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) setSize({ width: rect.width, height: rect.height })
    })
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [])

  // Колесо вешаем нативно: React-обработчик onWheel пассивен,
  // preventDefault в нём не работает.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = canvas.getBoundingClientRect()
      setViewport((current) =>
        zoomAt(
          current,
          event.clientX - rect.left,
          event.clientY - rect.top,
          current.cellSize * (event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP),
        ),
      )
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.button !== 1) return
    event.preventDefault()
    canvasRef.current?.setPointerCapture(event.pointerId)
    panStateRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const pan = panStateRef.current
    if (!pan || pan.pointerId !== event.pointerId) return
    setViewport((current) => ({
      ...current,
      offsetX: current.offsetX - (event.clientX - pan.lastX),
      offsetY: current.offsetY - (event.clientY - pan.lastY),
    }))
    pan.lastX = event.clientX
    pan.lastY = event.clientY
  }

  function onPointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (panStateRef.current?.pointerId === event.pointerId) {
      panStateRef.current = null
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.width < 1 || size.height < 1) return

    const dpr = window.devicePixelRatio || 1
    const cssWidth = Math.floor(size.width)
    const cssHeight = Math.floor(size.height)
    const pixelWidth = Math.floor(cssWidth * dpr)
    const pixelHeight = Math.floor(cssHeight * dpr)
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth
      canvas.height = pixelHeight
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    renderMap(ctx, model, { ...viewport, width: cssWidth, height: cssHeight })
  }, [model, viewport, size])

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        data-testid="editor-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
    </div>
  )
}
