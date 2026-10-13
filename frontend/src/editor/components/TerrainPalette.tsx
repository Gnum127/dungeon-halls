import { useTranslation } from 'react-i18next'
import { TILE_TYPES } from '../model/types'
import type { TileTypeName } from '../model/types'
import { TILE_COLORS } from '../render/colors'
import styles from './TerrainPalette.module.css'

interface TerrainPaletteProps {
  /** Выбранный тип покрытия ('' = ни один, активен другой инструмент). */
  selected: TileTypeName | null
  onSelect: (tileType: TileTypeName) => void
}

export function TerrainPalette({ selected, onSelect }: TerrainPaletteProps) {
  const { t } = useTranslation()

  return (
    <div className={styles.palette} role="group" aria-label={t('editor.palette.label')}>
      {TILE_TYPES.map((typeName) => (
        <button
          key={typeName}
          type="button"
          className={[styles.swatch, typeName === selected ? styles.selected : '']
            .filter(Boolean)
            .join(' ')}
          // Цвет свотча приходит из константы палитры рендера — это
          // data-driven значение, а не оформительский inline-стиль.
          style={{ backgroundColor: TILE_COLORS[typeName] }}
          aria-pressed={typeName === selected}
          title={t(`editor.tiles.${typeName}`)}
          onClick={() => onSelect(typeName)}
        >
          <span className={styles.name}>{t(`editor.tiles.${typeName}`)}</span>
        </button>
      ))}
    </div>
  )
}
