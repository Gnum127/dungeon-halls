import { useTranslation } from 'react-i18next'
import styles from './RoomTools.module.css'

export type RoomToolMode = 'room-rect' | 'room-polygon'

export interface RoomToolsProps {
  /** Активный режим инструмента комнат, иначе null. */
  activeMode: RoomToolMode | null
  /** Комнаты заливают пол и строят периметровые стены — только для квадратной сетки. */
  disabled: boolean
  onSelectRect: () => void
  onSelectPolygon: () => void
}

/** Кнопки «Комната-прямоугольник» / «Комната-полигон»; на гексах задизейблены. */
export function RoomTools({
  activeMode,
  disabled,
  onSelectRect,
  onSelectPolygon,
}: RoomToolsProps) {
  const { t } = useTranslation()

  const buttons = [
    { mode: 'room-rect' as const, label: t('editor.tools.roomRect') },
    { mode: 'room-polygon' as const, label: t('editor.tools.roomPolygon') },
  ]

  return (
    <div className={styles.field}>
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