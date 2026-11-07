import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomBar } from './components/BottomBar'
import { CanvasView } from './components/CanvasView'
import { MapFileActions } from './components/MapFileActions'
import type { FileActionStatus } from './components/MapFileActions'
import { ObjectPalette } from './components/ObjectPalette'
import { SectionPanel } from './components/SectionPanel'
import { ToolParams } from './components/ToolParams'
import { ToolRail } from './components/ToolRail'
import type { EditorSectionId } from './components/ToolRail'
import { usePersistentBoolean } from './hooks/usePersistentBoolean'
import { createEmptyMap } from './model/createEmptyMap'
import { OBJECT_KIND_ENTRIES, cycleScale } from './model/objects'
import type { ObjectKindId } from './model/objects'
import type { ObjectRotation, ObjectScale, TileTypeName } from './model/types'
import { loadElementImage, saveElementImage } from './render/elementImage'
import { loadDoorImageId, saveDoorImageId } from './render/doorTexture'
import { DEFAULT_DOOR_OPEN_ANGLE, MAX_DOOR_OPEN_ANGLE } from './model/doors'
import { EditorStore } from './store/EditorStore'
import type { EditorTool } from './tools/editorTool'
import { useEditorHotkeys } from './hooks/useEditorHotkeys'
import styles from './EditorPage.module.css'

const AUTO_WALLS_STORAGE_KEY = 'dungeon-halls.editor.autoWalls'

function defaultScaleForKind(kindId: ObjectKindId): ObjectScale {
  const entry = OBJECT_KIND_ENTRIES.find((e) => e.id === kindId)
  return entry?.defaultScale ?? { w: 1, h: 1 }
}

/** Применяет выбранное покрытие к активному инструменту-фигуре. */
function withTileType(tool: EditorTool, tileType: TileTypeName): EditorTool {
  if (tool.type === 'region-polygon') {
    return { type: 'region-polygon', tileType, vertices: tool.vertices }
  }
  return { type: 'region-rect', tileType }
}

export function EditorPage() {
  const { t } = useTranslation()
  const [store] = useState(() => new EditorStore(createEmptyMap()))
  const [tileType, setTileType] = useState<TileTypeName>('floor')
  const [tool, setTool] = useState<EditorTool>(() => ({ type: 'cursor' }))
  const [doorImageId, setDoorImageId] = useState<string | null>(() => loadDoorImageId())
  const [doorOpenAngle, setDoorOpenAngle] = useState(DEFAULT_DOOR_OPEN_ANGLE)
  const [selectedObjectId, setSelectedObjectId] = useState<number | null>(null)
  const [fileStatus, setFileStatus] = useState<FileActionStatus | null>(null)
  const [polygonVertexCount, setPolygonVertexCount] = useState(6)
  const [activeSection, setActiveSection] = useState<EditorSectionId | null>('landscape')
  const [landscapeCollapsed, toggleLandscapeCollapsed] = usePersistentBoolean(
    'dungeon-halls.editor.panels.collapsed.v1.landscape',
    false,
  )
  const [objectsCollapsed, toggleObjectsCollapsed] = usePersistentBoolean(
    'dungeon-halls.editor.panels.collapsed.v1.objects',
    false,
  )
  const [autoWalls, toggleAutoWalls] = usePersistentBoolean(AUTO_WALLS_STORAGE_KEY, true)

  const [objectRotation, setObjectRotation] = useState<ObjectRotation>(0)
  const [objectScale, setObjectScale] = useState<ObjectScale>({ w: 1, h: 1 })

  // Последнее непустое покрытие: к нему возвращает переключатель ластика.
  const lastFillTileRef = useRef<TileTypeName>('floor')

  const [elementImageOverrides, setElementImageOverrides] = useState<
    Partial<Record<ObjectKindId, string | null>>
  >(() => {
    const initial: Partial<Record<ObjectKindId, string | null>> = {}
    for (const entry of OBJECT_KIND_ENTRIES) initial[entry.id] = loadElementImage(entry.id)
    return initial
  })

  function selectTile(next: TileTypeName) {
    setSelectedObjectId(null)
    if (next !== 'empty') lastFillTileRef.current = next
    setTileType(next)
    setTool((current) => withTileType(current, next))
  }

  function toggleEraser() {
    const next: TileTypeName = tileType === 'empty' ? lastFillTileRef.current : 'empty'
    setSelectedObjectId(null)
    setTileType(next)
    setTool((current) => withTileType(current, next))
  }

  function selectCursor() {
    setSelectedObjectId(null)
    setTool({ type: 'cursor' })
  }

  function selectPan() {
    setSelectedObjectId(null)
    setTool({ type: 'pan' })
  }

  function selectRect() {
    setSelectedObjectId(null)
    setTool({ type: 'region-rect', tileType })
  }

  function selectPolygon() {
    setSelectedObjectId(null)
    setTool({ type: 'region-polygon', tileType, vertices: polygonVertexCount })
  }

  function selectEraser() {
    setSelectedObjectId(null)
    setTileType('empty')
    setTool((current) => withTileType(current, 'empty'))
  }

  function selectDoor() {
    setSelectedObjectId(null)
    setTool({ type: 'door', imageId: doorImageId, openAngle: doorOpenAngle })
  }

  function selectStairs() {
    setSelectedObjectId(null)
    setTool({ type: 'stairs' })
  }

  function changeDoorImage(imageId: string | null) {
    saveDoorImageId(imageId)
    setDoorImageId(imageId)
    if (tool.type === 'door') setTool({ ...tool, imageId })
  }

  function changeDoorOpenAngle(angle: number) {
    if (angle < 0 || angle > MAX_DOOR_OPEN_ANGLE) return
    setDoorOpenAngle(angle)
    if (tool.type === 'door') setTool({ ...tool, openAngle: angle })
  }

  function changeVertexCount(count: number) {
    setPolygonVertexCount(count)
    if (tool.type === 'region-polygon') setTool({ ...tool, vertices: count })
  }

  function selectObjectKind(kindId: ObjectKindId) {
    setSelectedObjectId(null)
    const scale = defaultScaleForKind(kindId)
    setObjectScale(scale)
    setTool({ type: 'object', kindId, rotation: objectRotation, scale })
  }

  function rotateObject() {
    const next: ObjectRotation = ((objectRotation + 90) % 360) as ObjectRotation
    setObjectRotation(next)
    if (tool.type === 'object') {
      setTool({ ...tool, rotation: next })
    }
  }

  function resizeObject() {
    if (tool.type !== 'object') return
    const next = cycleScale(tool.kindId, objectScale)
    setObjectScale(next)
    setTool({ ...tool, scale: next })
  }

  function selectElementImage(kindId: ObjectKindId, imageId: string | null) {
    saveElementImage(kindId, imageId)
    setElementImageOverrides((prev) => ({ ...prev, [kindId]: imageId }))
  }

  function toggleSection(id: EditorSectionId) {
    setActiveSection((current) => (current === id ? null : id))
  }

  function renderSection() {
    switch (activeSection) {
      case 'landscape':
        return (
          <SectionPanel
            title={t('editor.sections.landscape')}
            collapsible
            collapsed={landscapeCollapsed}
            onToggleCollapsed={toggleLandscapeCollapsed}
          >
            <ToolParams
              tool={tool}
              tileType={tileType}
              vertexCount={polygonVertexCount}
              autoWalls={autoWalls}
              doorImageId={doorImageId}
              doorOpenAngle={doorOpenAngle}
              onSelectTile={selectTile}
              onToggleEraser={toggleEraser}
              onVertexCountChange={changeVertexCount}
              onAutoWallsChange={toggleAutoWalls}
              onDoorImageChange={changeDoorImage}
              onDoorAngleChange={changeDoorOpenAngle}
            />
          </SectionPanel>
        )
      case 'objects':
        return (
          <SectionPanel
            title={t('editor.sections.objects')}
            collapsible
            collapsed={objectsCollapsed}
            onToggleCollapsed={toggleObjectsCollapsed}
          >
            <ObjectPalette
              activeKindId={tool.type === 'object' ? tool.kindId : null}
              selectActive={tool.type === 'cursor'}
              onSelectKind={selectObjectKind}
              onSelectSelectTool={selectCursor}
              objectRotation={objectRotation}
              objectScale={objectScale}
              onRotate={rotateObject}
              onResize={resizeObject}
              elementImageOverrides={elementImageOverrides}
              onSelectElementImage={selectElementImage}
            />
          </SectionPanel>
        )
      case 'file':
        return (
          <SectionPanel title={t('editor.sections.file')}>
            <MapFileActions
              getModel={() => store.getModel()}
              onLoaded={(loaded) => store.reset(loaded)}
              onResult={setFileStatus}
            />
            {fileStatus !== null && (
              <p className={styles.fileStatus} role="status">
                {t(`editor.files.${fileStatus}`)}
              </p>
            )}
          </SectionPanel>
        )
      default:
        return null
    }
  }

  useEditorHotkeys({
    onUndo: () => store.undo(),
    onRedo: () => store.redo(),
    onSelectCursor: selectCursor,
    onSelectRegionRect: selectRect,
    onSelectRegionPolygon: selectPolygon,
    onSelectEraser: selectEraser,
    onSelectDoors: selectDoor,
    onSelectObjectKind: (kindId) => selectObjectKind(kindId),
    onRotateObject: rotateObject,
  })

  return (
    <div className={styles.root}>
      <ToolRail active={activeSection} onSelect={toggleSection} />
      {activeSection !== null && <aside className={styles.sidebar}>{renderSection()}</aside>}
      <div className={styles.workspace}>
        <CanvasView
          store={store}
          tool={tool}
          selectedObjectId={selectedObjectId}
          onSelectObject={setSelectedObjectId}
          tileType={tileType}
          autoWalls={autoWalls}
        />
        <BottomBar
          activeTool={tool}
          onSelectCursor={selectCursor}
          onSelectPan={selectPan}
          onSelectRect={selectRect}
          onSelectPolygon={selectPolygon}
          onSelectStairs={selectStairs}
          onSelectDoor={selectDoor}
        />
      </div>
    </div>
  )
}
