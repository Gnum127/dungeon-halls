import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { MAX_POLYGON_VERTICES } from '../model/rooms'
import { EMPTY_TILE, TILE_TYPES } from '../model/types'
import type { TileValue } from '../model/types'
import { TILE_COLORS } from '../render/colors'
import styles from './RoomTools.module.css'

export type RoomToolMode = 'room-rect' | 'room-polygon'

export interface RoomToolsProps {
  /** Активный режим инструмента комнат, иначе null. */
  activeMode: RoomToolMode | null
  /** Комнаты заливают пол и строят периметровые стены — только для квадратной сетки. */
  disabled: boolean
  /** Текущая кисть: чем зальётся комната; EMPTY_TILE = ластик области. */
  tile: TileValue
  /** Количество вершин правильного полигона (3..12). */
  vertexCount: number
  onVertexCountChange: (count: number) => void
  onSelectRect: () => void
  onSelectPolygon: () => void
}

/** Кнопки «Комната-прямоугольник» / «Комната-полигон» + свотч заливки; на гексах задизейблены. */
export function RoomTools({
  activeMode,
  disabled,
  tile,
  vertexCount,
  onVertexCountChange,
  onSelectRect,
  onSelectPolygon,
}: RoomToolsProps) {
  const { t } = useTranslation()
  const verticesId = useId()

  const buttons = [
    { mode: 'room-rect' as const, label: t('editor.tools.roomRect') },
    { mode: 'room-polygon' as const, label: t('editor.tools.roomPolygon') },
  ]

  const isEraser = tile === EMPTY_TILE

  return (
    <div className={styles.field}>
      <div
        role="group"
        aria-label={t('editor.rooms.fill')}
        className={[styles.fill, disabled ? styles.fillDisabled : ''].filter(Boolean).join(' ')}
      >
        {/* Цвет свотча — data-driven значение, а не оформительский inline-стиль. */}
        <span
          className={[styles.swatch, isEraser ? styles.swatchEraser : ''].filter(Boolean).join(' ')}
          style={{ backgroundColor: TILE_COLORS[TILE_TYPES[tile]] }}
          aria-hidden="true"
        />
        <span className={styles.fillName}>
          {isEraser ? t('editor.rooms.clearsArea') : t(`editor.tiles.${TILE_TYPES[tile]}`)}
        </span>
      </div>
      <div role="group" aria-label={t('editor.tools.rooms')} className={styles.group}>
        {buttons.map(({ mode, label }) => (
          <button
            key={mode}
            type="button"
            className={[styles.button, activeMode === mode ? styles.selected : '']
              .filter(Boolean)
              .join(' ')}
            aria-pressed={activeMode === mode}
            disabled={disabled}
            onClick={mode === 'room-rect' ? onSelectRect : onSelectPolygon}
          >
            {label}
          </button>
        ))}
        {!disabled && activeMode === 'room-polygon' && (
          <label className={styles.vertices} htmlFor={verticesId}>
            <span>{t('editor.rooms.verticesCount')}</span>
            <input
              id={verticesId}
              type="number"
              min={3}
              max={MAX_POLYGON_VERTICES}
              value={vertexCount}
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10)
                if (parsed >= 3 && parsed <= MAX_POLYGON_VERTICES) onVertexCountChange(parsed)
              }}
            />
          </label>
        )}
      </div>
      {disabled ? (
        <p className={styles.hint} role="note">
          {t('editor.tools.roomSquareOnly')}
        </p>
      ) : (
        activeMode === 'room-polygon' && (
          <p className={styles.hint} role="note">
            {t('editor.tools.roomHint')}
          </p>
        )
      )}
    </div>
  )
}