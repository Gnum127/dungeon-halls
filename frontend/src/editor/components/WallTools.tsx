import { useTranslation } from 'react-i18next'
import styles from './WallTools.module.css'

export interface WallToolsProps {
  /** Активный режим инструмента стен, иначе null. */
  activeMode: 'wall' | 'wall-eraser' | null
  /** Стены-рёбра определены только для квадратной сетки. */
  disabled: boolean
  onSelectWall: () => void
  onSelectEraser: () => void
}

/** Кнопки «Стены» / «Ластик стен»; на гексах задизейблены с подсказкой. */
export function WallTools({
  activeMode,
  disabled,
  onSelectWall,
  onSelectEraser,
}: WallToolsProps) {
  const { t } = useTranslation()

  return (
    <div className={styles.field}>
      <div role="group" aria-label={t('editor.tools.walls')} className={styles.group}>
        <button
          type="button"
          className={[styles.button, activeMode === 'wall' ? styles.selected : '']
            .filter(Boolean)
            .join(' ')}
          aria-pressed={activeMode === 'wall'}
          disabled={disabled}
          onClick={onSelectWall}
        >
          {t('editor.tools.wall')}
        </button>
        <button
          type="button"
          className={[styles.button, activeMode === 'wall-eraser' ? styles.selected : '']
            .filter(Boolean)
            .join(' ')}
          aria-pressed={activeMode === 'wall-eraser'}
          disabled={disabled}
          onClick={onSelectEraser}
        >
          {t('editor.tools.wallEraser')}
        </button>
      </div>
      {disabled && (
        <p className={styles.hint} role="note">
          {t('editor.tools.squareOnly')}
        </p>
      )}
    </div>
  )
}
