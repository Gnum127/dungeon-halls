import { useTranslation } from 'react-i18next'
import type { MapObject, ObjectRotation, ObjectScale, TileTypeName } from '../model/types'
import type { Door } from '../model/doors'
import { DOOR_CATALOG } from '../model/doorCatalog'
import { OBJECT_KIND_ENTRIES } from '../model/objects'
import { TILE_COLORS } from '../render/colors'
import type { EditorTool } from '../tools/editorTool'
import { NO_IMAGE_SELECT_VALUE, imageIdToSelectValue, selectValueToImageId } from './imageSelect'
import { TerrainPalette } from './TerrainPalette'
import styles from './ToolParams.module.css'

export const MAX_POLYGON_VERTICES = 12
export const MIN_POLYGON_VERTICES = 3

const ROTATIONS: readonly ObjectRotation[] = [0, 90, 180, 270]

export interface ToolParamsProps {
  tool: EditorTool
  tileType: TileTypeName
  vertexCount: number
  autoWalls: boolean
  doorImageId: string | null
  /** Выделенный объект (режим «Курсор»), если есть. */
  selectedObject?: MapObject
  /** Выделенная дверь (режим «Курсор»), если есть. */
  selectedDoor?: Door
  onSelectTile: (tileType: TileTypeName) => void
  onToggleEraser: () => void
  onVertexCountChange: (count: number) => void
  onAutoWallsChange: (value: boolean) => void
  onDoorImageChange: (imageId: string | null) => void
  onObjectImageChange: (imageId: string | null | undefined) => void
  onObjectScaleChange: (scale: ObjectScale) => void
  onObjectRotationChange: (rotation: ObjectRotation) => void
}

function kindImagePool(kindId: string): readonly string[] {
  return OBJECT_KIND_ENTRIES.find((entry) => entry.id === kindId)?.imagePool ?? []
}

function kindScales(kindId: string): readonly ObjectScale[] {
  return OBJECT_KIND_ENTRIES.find((entry) => entry.id === kindId)?.scales ?? []
}

/**
 * Боковая панель параметров активного инструмента (нижняя плашка выбирает
 * сам инструмент). Для фигур — покрытие, ластик, вершины, авто-стены; для
 * двери — текстура; для «Курсора» с выделением — параметры выделенной
 * сущности (этап 28): текстура/размер/поворот объекта либо текстура двери.
 */
export function ToolParams(props: ToolParamsProps) {
  const { t } = useTranslation()
  const { tool } = props

  if (tool.type === 'cursor' && (props.selectedObject || props.selectedDoor)) {
    const object = props.selectedObject
    const pool = object ? kindImagePool(object.kindId) : []
    const scales = object ? kindScales(object.kindId) : []
    const currentScale = object ? (object.scale ?? { w: 1, h: 1 }) : null
    return (
      <div className={styles.params} role="group" aria-label={t('editor.toolParams.label')}>
        <span className={styles.fillName}>
          {t(object ? 'editor.toolParams.selectedObject' : 'editor.toolParams.selectedDoor')}
        </span>
        {object && (
          <>
            {pool.length > 0 && (
              <label className={styles.field}>
                <span>{t('editor.toolParams.texture')}</span>
                <select
                  value={imageIdToSelectValue(object.imageId)}
                  onChange={(event) =>
                    props.onObjectImageChange(selectValueToImageId(event.target.value))
                  }
                >
                  <option value="">{t('editor.objects.imageDefault')}</option>
                  <option value={NO_IMAGE_SELECT_VALUE}>{t('editor.objects.imageNone')}</option>
                  {pool.map((imageId) => (
                    <option key={imageId} value={imageId}>
                      {imageId}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {currentScale &&
              (scales.length > 0 || currentScale.w !== 1 || currentScale.h !== 1) && (
                <label className={styles.field}>
                  <span>{t('editor.toolParams.objectSize')}</span>
                  <select
                    value={`${currentScale.w}x${currentScale.h}`}
                    onChange={(event) => {
                      const [w, h] = event.target.value.split('x').map(Number)
                      props.onObjectScaleChange({ w, h })
                    }}
                  >
                    {scales.map((scale) => (
                      <option key={`${scale.w}x${scale.h}`} value={`${scale.w}x${scale.h}`}>
                        {scale.w}×{scale.h}
                      </option>
                    ))}
                    {/* Ресайз допускает размер вне списка вида — показываем и его. */}
                    {!scales.some(
                      (scale) => scale.w === currentScale.w && scale.h === currentScale.h,
                    ) && (
                      <option
                        key={`${currentScale.w}x${currentScale.h}`}
                        value={`${currentScale.w}x${currentScale.h}`}
                      >
                        {currentScale.w}×{currentScale.h}
                      </option>
                    )}
                  </select>
                </label>
              )}
            <label className={styles.field}>
              <span>{t('editor.toolParams.objectRotation')}</span>
              <select
                value={String(object.rotation ?? 0)}
                onChange={(event) =>
                  props.onObjectRotationChange(Number(event.target.value) as ObjectRotation)
                }
              >
                {ROTATIONS.map((rotation) => (
                  <option key={rotation} value={rotation}>
                    {rotation}°
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {props.selectedDoor && (
          <label className={styles.field}>
            <span>{t('editor.toolParams.doorTexture')}</span>
            <select
              value={props.selectedDoor.imageId ?? ''}
              onChange={(event) =>
                props.onDoorImageChange(event.target.value === '' ? null : event.target.value)
              }
            >
              <option value="">{t('editor.doors.none')}</option>
              {DOOR_CATALOG.map((entry) => (
                <option key={entry.doorKindId} value={entry.defaultImageId}>
                  {t(`editor.doors.${entry.labelKey}`)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    )
  }

  if (tool.type === 'region-rect' || tool.type === 'region-polygon') {
    const erasing = tool.tileType === 'empty'
    return (
      <div className={styles.params} role="group" aria-label={t('editor.toolParams.label')}>
        <TerrainPalette selected={props.tileType} onSelect={props.onSelectTile} />
        <div className={styles.fillRow}>
          {/* Цвет свотча — data-driven значение палитры рендера, не оформительский стиль. */}
          <span
            className={styles.fillSwatch}
            style={{ backgroundColor: TILE_COLORS[props.tileType] }}
            aria-hidden="true"
          />
          <span className={styles.fillName}>
            {erasing ? t('editor.toolParams.erases') : t(`editor.tiles.${props.tileType}`)}
          </span>
        </div>
        <button
          type="button"
          className={[styles.button, erasing ? styles.selected : ''].filter(Boolean).join(' ')}
          aria-pressed={erasing}
          onClick={props.onToggleEraser}
        >
          {t('editor.toolParams.eraser')}
        </button>
        {tool.type === 'region-polygon' && (
          <label className={styles.field}>
            <span>{t('editor.toolParams.vertices')}</span>
            <input
              type="number"
              min={MIN_POLYGON_VERTICES}
              max={MAX_POLYGON_VERTICES}
              step={1}
              value={props.vertexCount}
              onChange={(event) => {
                const next = Number(event.target.value)
                if (
                  Number.isInteger(next) &&
                  next >= MIN_POLYGON_VERTICES &&
                  next <= MAX_POLYGON_VERTICES
                ) {
                  props.onVertexCountChange(next)
                }
              }}
            />
          </label>
        )}
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={props.autoWalls}
            onChange={(event) => props.onAutoWallsChange(event.target.checked)}
          />
          {t('editor.toolParams.autoWalls')}
        </label>
      </div>
    )
  }

  if (tool.type === 'door') {
    return (
      <div className={styles.params} role="group" aria-label={t('editor.toolParams.label')}>
        <label className={styles.field}>
          <span>{t('editor.toolParams.doorTexture')}</span>
          <select
            value={props.doorImageId ?? ''}
            onChange={(event) =>
              props.onDoorImageChange(event.target.value === '' ? null : event.target.value)
            }
          >
            <option value="">{t('editor.doors.none')}</option>
            {DOOR_CATALOG.map((entry) => (
              <option key={entry.doorKindId} value={entry.defaultImageId}>
                {t(`editor.doors.${entry.labelKey}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
    )
  }

  if (tool.type === 'stairs') {
    return <p className={styles.hint}>{t('editor.toolParams.stairsHint')}</p>
  }

  if (tool.type === 'cursor' || tool.type === 'pan') {
    return (
      <p className={styles.hint}>
        {tool.type === 'pan' ? t('editor.toolParams.panHint') : t('editor.toolParams.cursorHint')}
      </p>
    )
  }

  // object / wall / light: у инструментов нет параметров в этой панели.
  return null
}
