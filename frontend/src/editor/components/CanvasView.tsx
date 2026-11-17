import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditor } from '../hooks/useEditor'
import { useCanvasSize } from '../hooks/useCanvasSize'
import { useDevicePixelRatio } from '../hooks/useDevicePixelRatio'
import { useMiddleButtonPan } from '../hooks/useMiddleButtonPan'
import { useWheelZoom } from '../hooks/useWheelZoom'
import { useObjectTools } from '../hooks/useObjectTools'
import { useCursorTool } from '../hooks/useCursorTool'
import { useHoverCell } from '../hooks/useHoverCell'
import { useLightTool } from '../hooks/useLightTool'
import { useDoorTool } from '../hooks/useDoorTool'
import { useStairsTool } from '../hooks/useStairsTool'
import { DOOR_FILL_COLOR, DOOR_THICKNESS_FRACTION, STAIRS_OUTLINE_COLOR } from '../render/colors'
import { drawStairsSelection } from '../render/stairsHighlight'
import { drawDoorSelection, drawObjectSelection } from '../render/selectionHighlight'
import type { SelectedEntity } from '../model/selection'
import { useRectRegionTool } from '../hooks/useRectRegionTool'
import { usePolygonRegionTool } from '../hooks/usePolygonRegionTool'
import { useWallTool } from '../hooks/useWallTool'
import type { EditorStore } from '../store/EditorStore'
import type { Command } from '../model/commands'
import { renderMap } from '../render/renderMap'
import type { TextureRenderContext } from '../render/sprites/loader'
import { drawHoverOverlay } from '../render/hoverHighlight'
import { drawGhostPreview } from '../render/ghostPreview'
import { isCommittablePolygon, rectPreviewPolygon, regularPolygonPoints } from '../tools/regions'
import { drawRegionWithWalls } from '../tools/regionPreview'
import { snapToHalfGrid } from '../model/snap'
import { BASE_CELL_SIZE, zoomAt } from '../render/viewport'
import type { PanZoomState, Viewport } from '../render/viewport'
import type { TileTypeName } from '../model/types'
import type { EditorTool } from '../tools/editorTool'
import { mergePointerHandlers } from './pointerHandlers'
import { formatCoords } from './formatCoords'
import styles from './CanvasView.module.css'

interface CanvasViewProps {
  store: EditorStore
  tool: EditorTool
  /** Единое выделение (объект/дверь/лестница), этап 28. */
  selected: SelectedEntity
  onSelect: (entity: SelectedEntity) => void
  /** Текущее покрытие для инструментов регионов (кисть заливки). */
  tileType: TileTypeName
  /** Авто-стены: пересчитывать контур при построении регионов. */
  autoWalls: boolean
  /** Атлас текстур ландшафта и объектов (необязателен — иначе цветной fallback). */
  textures?: TextureRenderContext
}

/** Параметры инструмента света по умолчанию; панель скрыта (этапы 21/24). */
const DEFAULT_LIGHT_RADIUS = 3
const DEFAULT_LIGHT_COLOR = '#ffd682'

export function CanvasView({
  store,
  tool,
  selected,
  onSelect,
  tileType,
  autoWalls,
  textures,
}: CanvasViewProps) {
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

  const viewportRef = useRef<Viewport>(viewport)
  useEffect(() => {
    viewportRef.current = viewport
  }, [viewport])

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
  const { handlers: panHandlers } = useMiddleButtonPan(canvasRef, handlePan, {
    leftButton: tool.type === 'pan',
  })

  const onCommit = useCallback(
    (command: Command | null) => {
      if (!command) return
      store.dispatch(command)
    },
    [store],
  )

  const { handlers: rectRegionHandlers, preview: rectPreview } = useRectRegionTool({
    canvasRef,
    active: tool.type === 'region-rect',
    model,
    tileType,
    autoWalls,
    viewportRef,
    onCommit,
  })

  const { handlers: polygonRegionHandlers, preview: polygonPreview } = usePolygonRegionTool({
    canvasRef,
    active: tool.type === 'region-polygon',
    model,
    tileType,
    vertices: tool.type === 'region-polygon' ? tool.vertices : 6,
    autoWalls,
    viewportRef,
    onCommit,
  })

  const { handlers: wallHandlers, preview: wallPreview } = useWallTool({
    canvasRef,
    active: tool.type === 'wall',
    model,
    viewportRef,
    onCommit,
  })

  const { handlers: doorHandlers, preview: doorPreview } = useDoorTool({
    canvasRef,
    active: tool.type === 'door',
    model,
    imageId: tool.type === 'door' ? tool.imageId : null,
    viewportRef,
    onCommit,
  })

  const { handlers: lightHandlers } = useLightTool({
    canvasRef,
    active: tool.type === 'light',
    model,
    radius: DEFAULT_LIGHT_RADIUS,
    color: DEFAULT_LIGHT_COLOR,
    viewportRef,
    onCommit,
  })

  const handleSelect = useCallback((entity: SelectedEntity) => onSelect(entity), [onSelect])

  const { handlers: stairsHandlers, preview: stairsPreview } = useStairsTool({
    canvasRef,
    active: tool.type === 'stairs',
    model,
    viewportRef,
    selected,
    onSelect: handleSelect,
    onCommit,
  })

  const { handlers: objectHandlers } = useObjectTools({
    canvasRef,
    viewportRef,
    store,
    model,
    tool,
  })

  const { handlers: cursorHandlers, resizePreview } = useCursorTool({
    canvasRef,
    viewportRef,
    store,
    model,
    active: tool.type === 'cursor',
    selected,
    onSelect: handleSelect,
  })

  const {
    hoverCell,
    hoverWorld,
    hoverShift,
    handlers: hoverHandlers,
  } = useHoverCell({
    canvasRef,
    viewportRef,
    viewport,
    model,
  })

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
    renderMap(ctx, model, viewport, textures)

    if (selected) {
      const selectedStairs =
        selected.type === 'stairs'
          ? model.stairs.find((entry) => entry.id === selected.id)
          : undefined
      const selectedObject =
        selected.type === 'object'
          ? model.objects.find((entry) => entry.id === selected.id)
          : undefined
      const selectedDoor =
        selected.type === 'door' ? model.doors.find((entry) => entry.id === selected.id) : undefined
      if (selectedStairs) drawStairsSelection(ctx, selectedStairs.polygon, viewport)
      if (selectedObject) {
        // Во время ресайза рамка/хендлы идут по превью, а не по модели.
        const frame =
          resizePreview !== null
            ? { ...selectedObject, x: resizePreview.x, y: resizePreview.y, scale: resizePreview.scale }
            : selectedObject
        drawObjectSelection(ctx, frame, viewport)
      }
      if (selectedDoor) drawDoorSelection(ctx, selectedDoor, viewport)
    }

    if (hoverCell && hoverWorld) {
      drawHoverOverlay(ctx, model, tool, hoverCell, hoverWorld, viewport)
    }
    if (hoverWorld && tool.type === 'object') {
      // Ghost повторяет ту же точку, что уйдёт в команду размещения (Shift — снап).
      const anchor = hoverShift ? snapToHalfGrid(hoverWorld) : hoverWorld
      drawGhostPreview(ctx, anchor, viewport, tool)
    }

    if (tool.type === 'region-rect' && rectPreview) {
      const polygon = rectPreviewPolygon(rectPreview, model.grid.width, model.grid.height)
      // Нулевая площадь (клик без протяжки) — превью не рисуем.
      if (polygon) {
        drawRegionWithWalls(ctx, model, viewport, tileType, polygon, autoWalls)
      }
    }

    if (tool.type === 'region-polygon' && polygonPreview) {
      const points = regularPolygonPoints(
        polygonPreview.center,
        polygonPreview.current,
        tool.vertices,
        {
          cols: model.grid.width,
          rows: model.grid.height,
        },
      )
      if (isCommittablePolygon(points)) {
        drawRegionWithWalls(ctx, model, viewport, tileType, points, autoWalls)
      }
    }

    if (tool.type === 'wall' && wallPreview) {
      ctx.strokeStyle = '#e0b050'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(
        wallPreview.a.x * viewport.cellSize - viewport.offsetX,
        wallPreview.a.y * viewport.cellSize - viewport.offsetY,
      )
      ctx.lineTo(
        wallPreview.b.x * viewport.cellSize - viewport.offsetX,
        wallPreview.b.y * viewport.cellSize - viewport.offsetY,
      )
      ctx.stroke()
    }

    if (tool.type === 'door' && doorPreview) {
      ctx.strokeStyle = DOOR_FILL_COLOR
      ctx.lineWidth = Math.max(4, viewport.cellSize * DOOR_THICKNESS_FRACTION)
      ctx.lineCap = 'butt'
      // Линия проёма — подсказка о месте двери; на финальном рендере створка
      // закрыта и лежит на этом же отрезке, а стена разрывается по пересечению.
      ctx.beginPath()
      ctx.moveTo(
        doorPreview.a.x * viewport.cellSize - viewport.offsetX,
        doorPreview.a.y * viewport.cellSize - viewport.offsetY,
      )
      ctx.lineTo(
        doorPreview.b.x * viewport.cellSize - viewport.offsetX,
        doorPreview.b.y * viewport.cellSize - viewport.offsetY,
      )
      ctx.stroke()
    }

    if (tool.type === 'stairs' && stairsPreview) {
      const previewPoints = stairsPreview.points
      ctx.strokeStyle = STAIRS_OUTLINE_COLOR
      ctx.lineWidth = Math.max(2, viewport.cellSize * 0.06)
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(
        previewPoints[0].x * viewport.cellSize - viewport.offsetX,
        previewPoints[0].y * viewport.cellSize - viewport.offsetY,
      )
      for (let i = 1; i < previewPoints.length; i += 1) {
        ctx.lineTo(
          previewPoints[i].x * viewport.cellSize - viewport.offsetX,
          previewPoints[i].y * viewport.cellSize - viewport.offsetY,
        )
      }
      if (previewPoints.length === 4) ctx.closePath()
      ctx.stroke()
    }
  }, [
    model,
    viewport,
    dpr,
    hoverCell,
    hoverWorld,
    hoverShift,
    tool,
    rectPreview,
    polygonPreview,
    wallPreview,
    doorPreview,
    stairsPreview,
    selected,
    resizePreview,
    tileType,
    autoWalls,
    textures,
  ])

  const pointerHandlers = useMemo(
    () =>
      mergePointerHandlers(
        panHandlers,
        objectHandlers,
        cursorHandlers,
        hoverHandlers,
        lightHandlers,
        doorHandlers,
        stairsHandlers,
        rectRegionHandlers,
        polygonRegionHandlers,
        wallHandlers,
      ),
    [
      panHandlers,
      objectHandlers,
      cursorHandlers,
      hoverHandlers,
      lightHandlers,
      doorHandlers,
      stairsHandlers,
      rectRegionHandlers,
      polygonRegionHandlers,
      wallHandlers,
    ],
  )

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        data-testid="editor-canvas"
        onContextMenu={(event) => event.preventDefault()}
        {...pointerHandlers}
      />
      <div className={styles.status} data-testid="editor-coords">
        {hoverCell ? formatCoords(hoverCell) : '—'}
      </div>
    </div>
  )
}
