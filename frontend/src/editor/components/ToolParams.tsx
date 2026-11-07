import { useTranslation } from 'react-i18next'
import type { TileTypeName } from '../model/types'
import { DOOR_CATALOG } from '../model/doorCatalog'
import { MAX_DOOR_OPEN_ANGLE } from '../model/doors'
import { TILE_COLORS } from '../render/colors'
import type { EditorTool } from '../tools/editorTool'
import { TerrainPalette } from './TerrainPalette'
import styles from './ToolParams.module.css'

export const MAX_POLYGON_VERTICES = 12
export const MIN_POLYGON_VERTICES = 3

export interface ToolParamsProps {
  tool: EditorTool
  tileType: TileTypeName
  vertexCount: number
  autoWalls: boolean
  doorImageId: string | null
  doorOpenAngle: number
  onSelectTile: (tileType: TileTypeName) => void
  onToggleEraser: () => void
  onVertexCountChange: (count: number) => void
  onAutoWallsChange: (value: boolean) => void
  onDoorImageChange: (imageId: string | null) => void
  onDoorAngleChange: (angle: number) => void
}

/**
 * Боковая панель параметров активного инструмента (нижняя плашка выбирает
 * сам инструмент). Для фигур — покрытие, ластик, вершины, авто-стены; для
 * двери — текстура и угол; для курсора/пана/лестницы — подсказка.
 */
export function ToolParams(props: ToolParamsProps) {
  const { t } = useTranslation()
  const { tool } = props

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
            {erasing
              ? t('editor.toolParams.erases')
              : t(`editor.tiles.${props.tileType}`)}
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
        <label className={styles.field}>
          <span>{t('editor.toolParams.doorAngle')}</span>
          <input
            type="number"
            min={0}
            max={MAX_DOOR_OPEN_ANGLE}
            step={1}
            value={props.doorOpenAngle}
            onChange={(event) => {
              const next = Number(event.target.value)
              if (Number.isInteger(next) && next >= 0 && next <= MAX_DOOR_OPEN_ANGLE) {
                props.onDoorAngleChange(next)
              }
            }}
          />
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
        {tool.type === 'pan'
          ? t('editor.toolParams.panHint')
          : t('editor.toolParams.cursorHint')}
      </p>
    )
  }

  // object / wall / light: у инструментов нет параметров в этой панели.
  return null
}
