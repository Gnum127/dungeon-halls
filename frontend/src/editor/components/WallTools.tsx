import { useTranslation } from 'react-i18next'
import styles from './WallTools.module.css'

export type WallToolMode = 'wall' | 'wall-eraser' | 'door'

export interface WallToolsProps {
  /** Активный режим инструмента стен/дверей, иначе null. */
  activeMode: WallToolMode | null
  /** Стены-рёбра и двери определены только для квадратной сетки. */
  disabled: boolean
  onSelectWall: () => void
  onSelectEraser: () => void
  onSelectDoor: () => void
}

/** Кнопки «Стена» / «Ластик стен» / «Дверь»; на гексах задизейблены. */
export function WallTools({
  activeMode,
  disabled,
  onSelectWall,
  onSelectEraser,
  onSelectDoor,
}: WallToolsProps) {
  const { t } = useTranslation()

  const buttons = [
    { mode: 'wall' as const, label: t('editor.tools.wall') },
    { mode: 'wall-eraser' as const, label: t('editor.tools.wallEraser') },
    { mode: 'door' as const, label: t('editor.tools.door') },
  ]

  return (
    <div className={styles.field}>
      <div role="group" aria-label={t('editor.tools.walls')} className={styles.group}>
        {buttons.map(({ mode, label }) => (
          <button
            key={mode}
            type="button"
            className={[styles.button, activeMode === mode ? styles.selected : '']
              .filter(Boolean)
              .join(' ')}
            aria-pressed={activeMode === mode}
            disabled={disabled}
            onClick={
              mode === 'wall'
                ? onSelectWall
                : mode === 'wall-eraser'
                  ? onSelectEraser
                  : onSelectDoor
            }
          >
            {label}
          </button>
        ))}
      </div>
      {disabled && (
        <p className={styles.hint} role="note">
          {t('editor.tools.squareOnly')}
        </p>
      )}
    </div>
  )
}
