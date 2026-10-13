import { useTranslation } from 'react-i18next'
import type { TileTypeName } from '../model/types'
import { DOOR_CATALOG } from '../model/doorCatalog'
import { TILE_COLORS } from '../render/colors'
import type { EditorTool } from '../tools/editorTool'
import styles from './RegionTools.module.css'

export const MAX_POLYGON_VERTICES = 12
export const MIN_POLYGON_VERTICES = 3

export interface RegionToolsProps {
  activeTool: EditorTool
  tileType: TileTypeName
  vertexCount: number
  autoWalls: boolean
  /** Выбранная текстура двери (null = жирная линия без текстуры). */
  doorImageId: string | null
  onSelectRect: () => void
  onSelectPolygon: () => void
  onSelectEraser: () => void
  onSelectWall: () => void
  onSelectDoor: () => void
  onVertexCountChange: (count: number) => void
  onAutoWallsChange: (value: boolean) => void
  onDoorImageChange: (imageId: string | null) => void
}

/** Панель «Ландшафт»: покрытие + инструменты построения фигур, стен и дверей. */
export function RegionTools(props: RegionToolsProps) {
  const {
    activeTool,
    tileType,
    vertexCount,
    autoWalls,
    doorImageId,
    onSelectRect,
    onSelectPolygon,
    onSelectEraser,
    onSelectWall,
    onSelectDoor,
    onVertexCountChange,
    onAutoWallsChange,
    onDoorImageChange,
  } = props
  const { t } = useTranslation()

  const isRect = activeTool.type === 'region-rect' && activeTool.tileType !== 'empty'
  const isPolygon = activeTool.type === 'region-polygon' && activeTool.tileType !== 'empty'
  const isEraser =
    (activeTool.type === 'region-rect' || activeTool.type === 'region-polygon') &&
    activeTool.tileType === 'empty'

  return (
    <div className={styles.tools} role="group" aria-label={t('editor.regionTools.label')}>
      <div className={styles.fillRow}>
        <span
          className={styles.fillSwatch}
          style={{ backgroundColor: TILE_COLORS[tileType] }}
          aria-hidden="true"
        />
        <span className={styles.fillName}>
          {tileType === 'empty'
            ? t('editor.regionTools.erases')
            : t(`editor.tiles.${tileType}`)}
        </span>
      </div>

      <div className={styles.row}>
        <button
          type="button"
          className={[styles.button, isRect ? styles.selected : ''].filter(Boolean).join(' ')}
          aria-pressed={isRect}
          onClick={onSelectRect}
        >
          {t('editor.regionTools.rect')}
        </button>
        <button
          type="button"
          className={[styles.button, isPolygon ? styles.selected : ''].filter(Boolean).join(' ')}
          aria-pressed={isPolygon}
          onClick={onSelectPolygon}
        >
          {t('editor.regionTools.polygon')}
        </button>
        <button
          type="button"
          className={[styles.button, isEraser ? styles.selected : ''].filter(Boolean).join(' ')}
          aria-pressed={isEraser}
          onClick={onSelectEraser}
        >
          {t('editor.regionTools.eraser')}
        </button>
      </div>

      <div className={styles.row}>
        <button
          type="button"
          className={[styles.button, activeTool.type === 'wall' ? styles.selected : '']
            .filter(Boolean)
            .join(' ')}
          aria-pressed={activeTool.type === 'wall'}
          onClick={onSelectWall}
        >
          {t('editor.regionTools.wall')}
        </button>
        <button
          type="button"
          className={[styles.button, activeTool.type === 'door' ? styles.selected : '']
            .filter(Boolean)
            .join(' ')}
          aria-pressed={activeTool.type === 'door'}
          onClick={onSelectDoor}
        >
          {t('editor.regionTools.door')}
        </button>
      </div>

      {(isPolygon || activeTool.type === 'region-polygon') && (
        <label className={styles.field}>
          <span>{t('editor.regionTools.vertices')}</span>
          <input
            type="number"
            min={MIN_POLYGON_VERTICES}
            max={MAX_POLYGON_VERTICES}
            step={1}
            value={vertexCount}
            onChange={(event) => {
              const next = Number(event.target.value)
              if (Number.isInteger(next) && next >= MIN_POLYGON_VERTICES && next <= MAX_POLYGON_VERTICES) {
                onVertexCountChange(next)
              }
            }}
          />
        </label>
      )}

      {activeTool.type === 'door' && (
        <label className={styles.field}>
          <span>{t('editor.regionTools.doorTexture')}</span>
          <select
            value={doorImageId ?? ''}
            onChange={(event) =>
              onDoorImageChange(event.target.value === '' ? null : event.target.value)
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

      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={autoWalls}
          onChange={(event) => onAutoWallsChange(event.target.checked)}
        />
        {t('editor.regionTools.autoWalls')}
      </label>
    </div>
  )
}
