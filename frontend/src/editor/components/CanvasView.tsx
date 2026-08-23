import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useEditor } from '../hooks/useEditor'
import { useCanvasSize } from '../hooks/useCanvasSize'
import { useDevicePixelRatio } from '../hooks/useDevicePixelRatio'
import { useMiddleButtonPan } from '../hooks/useMiddleButtonPan'
import { useWheelZoom } from '../hooks/useWheelZoom'
import { useTerrainBrush } from '../hooks/useTerrainBrush'
import { useObjectTools } from '../hooks/useObjectTools'
import { useCellFromEvent } from '../hooks/useCellFromEvent'
import type { EditorStore } from '../store/EditorStore'
import type { Command } from '../model/commands'
import { isInsideMap } from '../tools/brush'
import { renderMap } from '../render/renderMap'
import { drawStrokePreview } from '../render/strokePreview'
import { drawCellHighlight } from '../render/cellHighlight'
import { BASE_CELL_SIZE, zoomAt } from '../render/viewport'
import type { PanZoomState, Viewport } from '../render/viewport'
import type { EditorTool } from '../tools/editorTool'
import { mergePointerHandlers } from './pointerHandlers'
import styles from './CanvasView.module.css'

interface CanvasViewProps {
  store: EditorStore
  tool: EditorTool
  selectedObjectId: number | null
  onSelectObject: (id: number | null) => void
}

export function CanvasView({ store, tool, selectedObjectId, onSelectObject }: CanvasViewProps) {
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
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null)

  const viewport = useMemo(
    () => ({
      ...panZoom,
      width: Math.floor(size.width),
      height: Math.floor(size.height),
    }),
    [panZoom, size],
  )

  // Зеркало для хуков, читающих вьюпорт внутри событий.
  const viewportRef = useRef<Viewport>(viewport)
  useEffect(() => {
    viewportRef.current = viewport
  }, [viewport])

  const cellFromEvent = useCellFromEvent(canvasRef, viewportRef)

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

  const handleBrushCommit = useCallback(
    (command: Command | null) => {
      if (!command) return
      store.dispatch(command)
    },
    [store],
  )
  const brushTile = tool.type === 'terrain' ? tool.tile : -1
  const { pendingCells, handlers: brushHandlers } = useTerrainBrush({
    canvasRef,
    active: tool.type === 'terrain',
    model,
    tile: brushTile,
    viewportRef,
    onCommit: handleBrushCommit,
  })

  const handleSelect = useCallback((id: number | null) => onSelectObject(id), [onSelectObject])
  const { handlers: objectHandlers } = useObjectTools({
    canvasRef,
    viewportRef,
    store,
    model,
    tool,
    selectedId: selectedObjectId,
    onSelect: handleSelect,
  })

  function trackHover(event: ReactPointerEvent<HTMLCanvasElement>) {
    const cell = cellFromEvent(event)
    if (!isInsideMap(model, cell.x, cell.y)) {
      setHoverCell(null)
      return
    }
    setHoverCell((previous) =>
      previous && previous.x === cell.x && previous.y === cell.y ? previous : cell,
    )
  }

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
    drawStrokePreview(ctx, pendingCells, viewport, brushTile)
    if (hoverCell) drawCellHighlight(ctx, hoverCell, viewport)
  }, [model, viewport, dpr, pendingCells, brushTile, hoverCell])

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        data-testid="editor-canvas"
        onContextMenu={(event) => event.preventDefault()}
        {...mergePointerHandlers(panHandlers, brushHandlers, objectHandlers, {
          onPointerMove: trackHover,
          onPointerLeave: () => setHoverCell(null),
        })}
      />
      <div className={styles.status} role="status" data-testid="editor-coords">
        {hoverCell ? `x: ${hoverCell.x} · y: ${hoverCell.y}` : '—'}
      </div>
    </div>
  )
}
