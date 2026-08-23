import { useTranslation } from 'react-i18next'
import { TILE_TYPES } from '../model/types'
import type { TileValue } from '../model/types'
import { TILE_COLORS } from '../render/colors'
import styles from './TerrainPalette.module.css'

interface TerrainPaletteProps {
  selected: TileValue
  onSelect: (tile: TileValue) => void
}

export function TerrainPalette({ selected, onSelect }: TerrainPaletteProps) {
  const { t } = useTranslation()

  return (
    <div className={styles.palette} role="group" aria-label={t('editor.palette.label')}>
      {TILE_TYPES.map((typeName, tile) => (
        <button
          key={typeName}
          type="button"
          className={`${styles.swatch} ${tile === selected ? styles.selected : ''}`}
          // Цвет свотча приходит из константы палитры рендера — это
          // data-driven значение, а не оформительский inline-стиль.
          style={{ backgroundColor: TILE_COLORS[typeName] }}
          aria-pressed={tile === selected}
          title={t(`editor.tiles.${typeName}`)}
          onClick={() => onSelect(tile)}
        >
          <span className={styles.name}>{t(`editor.tiles.${typeName}`)}</span>
        </button>
      ))}
    </div>
  )
}
