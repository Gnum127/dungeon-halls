import { useTranslation } from 'react-i18next'
import type { ObjectKindId } from '../model/objects'
import { OBJECT_KIND_ENTRIES } from '../model/objects'
import styles from './ObjectPalette.module.css'

interface ObjectPaletteProps {
  /** kindId активного инструмента-объекта, иначе null. */
  activeKindId: ObjectKindId | null
  selectActive: boolean
  onSelectKind: (kindId: ObjectKindId) => void
  onSelectSelectTool: () => void
}

export function ObjectPalette({
  activeKindId,
  selectActive,
  onSelectKind,
  onSelectSelectTool,
}: ObjectPaletteProps) {
  const { t } = useTranslation()

  return (
    <div className={styles.palette}>
      <button
        type="button"
        className={[styles.toolButton, selectActive ? styles.selected : '']
          .filter(Boolean)
          .join(' ')}
        aria-pressed={selectActive}
        onClick={onSelectSelectTool}
      >
        {t('editor.objects.select')}
      </button>
      <div role="group" aria-label={t('editor.objects.label')} className={styles.kindList}>
        {OBJECT_KIND_ENTRIES.map((kind) => (
          <button
            key={kind.id}
            type="button"
            className={[styles.swatch, kind.id === activeKindId ? styles.selected : '']
              .filter(Boolean)
              .join(' ')}
            aria-pressed={kind.id === activeKindId}
            title={t(kind.labelKey)}
            onClick={() => onSelectKind(kind.id)}
          >
            <span
              // Цвет вида объекта — data-driven значение из реестра каталога.
              style={{ backgroundColor: kind.color }}
              className={styles.dot}
            />
            <span className={styles.name}>{t(kind.labelKey)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
