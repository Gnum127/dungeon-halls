import { useTranslation } from 'react-i18next'
import type { ObjectKindId } from '../model/objects'
import { OBJECT_COLORS, OBJECT_KINDS } from '../model/objects'
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
        {OBJECT_KINDS.map((kindId) => (
          <button
            key={kindId}
            type="button"
            className={[styles.swatch, kindId === activeKindId ? styles.selected : '']
              .filter(Boolean)
              .join(' ')}
            aria-pressed={kindId === activeKindId}
            title={t(`editor.objects.${kindId}`)}
            onClick={() => onSelectKind(kindId)}
          >
            <span
              // Цвет вида объекта — data-driven значение из константы каталога.
              style={{ backgroundColor: OBJECT_COLORS[kindId] }}
              className={styles.dot}
            />
            <span className={styles.name}>{t(`editor.objects.${kindId}`)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
