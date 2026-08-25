import { useId } from 'react'
import type { ChangeEvent as ReactChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { GRID_TYPES, isGridType } from '../model/types'
import type { GridType } from '../model/types'
import styles from './GridTypePicker.module.css'

export interface GridTypePickerProps {
  gridType: GridType
  /** Смена запрещена, пока на карте есть стены/двери (рёбра square-сетки). */
  disabled?: boolean
  onChange: (gridType: GridType) => void
}

const LABEL_KEYS: Record<GridType, string> = {
  square: 'editor.grid.square',
  'hex-flat': 'editor.grid.hexFlat',
  'hex-pointy': 'editor.grid.hexPointy',
}

/** Выбор типа сетки — свойство документа, а не инструмента. */
export function GridTypePicker({ gridType, disabled = false, onChange }: GridTypePickerProps) {
  const { t } = useTranslation()
  const id = useId()

  function handleChange(event: ReactChangeEvent<HTMLSelectElement>) {
    if (disabled) return
    const next = event.target.value
    if (isGridType(next)) onChange(next)
  }

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {t('editor.grid.label')}
      </label>
      <select
        id={id}
        className={styles.select}
        value={gridType}
        disabled={disabled}
        onChange={handleChange}
      >
        {GRID_TYPES.map((type) => (
          <option key={type} value={type}>
            {t(LABEL_KEYS[type])}
          </option>
        ))}
      </select>
      {disabled && (
        <p className={styles.hint} role="note">
          {t('editor.grid.changeLocked')}
        </p>
      )}
    </div>
  )
}
