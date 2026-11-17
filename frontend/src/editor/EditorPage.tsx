import { useMemo, useRef, useState } from 'react'
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
import { useEditor } from './hooks/useEditor'
import { createEmptyMap } from './model/createEmptyMap'
import { OBJECT_KIND_ENTRIES, cycleScale, imageIdForKind } from './model/objects'
import type { ObjectKindId } from './model/objects'
import type { ObjectRotation, ObjectScale, TileTypeName } from './model/types'
import { loadDoorImageId, saveDoorImageId } from './render/doorTexture'
import { useTextureAtlas } from './hooks/useTextureAtlas'
import type { TextureRenderContext } from './render/sprites/loader'
import type { SelectedEntity } from './model/selection'
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
  const [objectImageId, setObjectImageId] = useState<string | null | undefined>(undefined)
  const [selected, setSelected] = useState<SelectedEntity>(null)
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

  const model = useEditor(store)
  const selectedObject =
    selected?.type === 'object'
      ? model.objects.find((object) => object.id === selected.id)
      : undefined
  const selectedDoor =
    selected?.type === 'door' ? model.doors.find((door) => door.id === selected.id) : undefined

  // Последнее непустое покрытие: к нему возвращает переключатель ластика.
  const lastFillTileRef = useRef<TileTypeName>('floor')

  const atlas = useTextureAtlas()
  const textures = useMemo<TextureRenderContext | undefined>(() => atlas ?? undefined, [atlas])

  function selectTile(next: TileTypeName) {
    setSelected(null)
    if (next !== 'empty') lastFillTileRef.current = next
    setTileType(next)
    setTool((current) => withTileType(current, next))
  }

  function toggleEraser() {
    const next: TileTypeName = tileType === 'empty' ? lastFillTileRef.current : 'empty'
    setSelected(null)
    setTileType(next)
    setTool((current) => withTileType(current, next))
  }

  function selectCursor() {
    setSelected(null)
    setTool({ type: 'cursor' })
  }

  function selectPan() {
    setSelected(null)
    setTool({ type: 'pan' })
  }

  function selectRect() {
    setSelected(null)
    setTool({ type: 'region-rect', tileType })
  }

  function selectPolygon() {
    setSelected(null)
    setTool({ type: 'region-polygon', tileType, vertices: polygonVertexCount })
  }

  function selectEraser() {
    setSelected(null)
    setTileType('empty')
    setTool((current) => withTileType(current, 'empty'))
  }

  function selectDoor() {
    setSelected(null)
    setTool({ type: 'door', imageId: doorImageId })
  }

  function selectStairs() {
    setSelected(null)
    setTool({ type: 'stairs' })
  }

  function changeDoorImage(imageId: string | null) {
    // Правка выделенной двери не трогает дефолт будущих размещений.
    if (tool.type === 'cursor' && selectedDoor) {
      store.dispatch({ kind: 'setDoorImage', id: selectedDoor.id, imageId })
      return
    }
    saveDoorImageId(imageId)
    setDoorImageId(imageId)
    if (tool.type === 'door') setTool({ ...tool, imageId })
  }

  function changeVertexCount(count: number) {
    setPolygonVertexCount(count)
    if (tool.type === 'region-polygon') setTool({ ...tool, vertices: count })
  }

  function selectObjectKind(kindId: ObjectKindId) {
    setSelected(null)
    const scale = defaultScaleForKind(kindId)
    setObjectScale(scale)
    setTool({
      type: 'object',
      kindId,
      rotation: objectRotation,
      scale,
      // Текстуру чужого вида не переносим (пулы у видов разные).
      imageId: imageIdForKind(objectImageId, kindId),
    })
  }

  /** Поворот: выделенный объект в режиме «Курсор» либо настройка будущих размещений. */
  function rotateObject() {
    if (tool.type === 'cursor' && selectedObject) {
      const current = selectedObject.rotation ?? 0
      const next = ((current + 90) % 360) as ObjectRotation
      store.dispatch({ kind: 'setObjectRotation', id: selectedObject.id, rotation: next })
      return
    }
    const next: ObjectRotation = ((objectRotation + 90) % 360) as ObjectRotation
    setObjectRotation(next)
    if (tool.type === 'object') {
      setTool({ ...tool, rotation: next })
    }
  }

  /** Размер: выделенный объект в режиме «Курсор» либо цикл размеров инструмента. */
  function resizeObject() {
    if (tool.type !== 'object') return
    const next = cycleScale(tool.kindId, objectScale)
    setObjectScale(next)
    setTool({ ...tool, scale: next })
  }

  /**
   * Смена изображения: выделенный объект (режим «Курсор») либо настройка
   * будущих размещений (`tool.imageId`). Глобального override видов больше нет.
   */
  function changeObjectImage(imageId: string | null | undefined) {
    // Правка выделенного объекта не трогает дефолт будущих размещений.
    if (tool.type === 'cursor' && selectedObject) {
      store.dispatch({ kind: 'setObjectImage', id: selectedObject.id, imageId })
      return
    }
    setObjectImageId(imageId)
    if (tool.type === 'object') setTool({ ...tool, imageId })
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
              selectedObject={selectedObject}
              selectedDoor={selectedDoor}
              onSelectTile={selectTile}
              onToggleEraser={toggleEraser}
              onVertexCountChange={changeVertexCount}
              onAutoWallsChange={toggleAutoWalls}
              onDoorImageChange={changeDoorImage}
              onObjectImageChange={changeObjectImage}
              onObjectScaleChange={(scale) => {
                if (selectedObject) {
                  store.dispatch({ kind: 'setObjectScale', id: selectedObject.id, scale })
                }
              }}
              onObjectRotationChange={(rotation) => {
                if (selectedObject) {
                  store.dispatch({ kind: 'setObjectRotation', id: selectedObject.id, rotation })
                }
              }}
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
              onSelectKind={selectObjectKind}
              objectRotation={selectedObject?.rotation ?? objectRotation}
              objectScale={selectedObject?.scale ?? objectScale}
              onRotate={rotateObject}
              onResize={resizeObject}
              imageId={tool.type === 'object' ? tool.imageId : undefined}
              onSelectImage={changeObjectImage}
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
              textures={textures}
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
          selected={selected}
          onSelect={setSelected}
          tileType={tileType}
          autoWalls={autoWalls}
          textures={textures}
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
