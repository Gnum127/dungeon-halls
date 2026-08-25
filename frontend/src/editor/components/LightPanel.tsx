import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './LightPanel.module.css'

export interface LightPanelProps {
  active: boolean
  radius: number
  color: string
  onToggle: () => void
  onRadiusChange: (radius: number) => void
  onColorChange: (color: string) => void
}

const LIGHT_COLOR_PRESETS = ['#ffd682', '#88aaff', '#ff8866', '#f5f5ef'] as const

/** Панель инструмента света: переключатель + свойства размещения. */
export function LightPanel({
  active,
  radius,
  color,
  onToggle,
  onRadiusChange,
  onColorChange,
}: LightPanelProps) {
  const { t } = useTranslation()
  const id = useId()

  return (
    <div className={styles.field}>
      <button
        type="button"
        className={styles.toggle}
        aria-pressed={active}
        onClick={onToggle}
      >
        {t('editor.light.label')}
      </button>
      {active && (
        <div className={styles.props}>
          <label className={styles.row} htmlFor={id}>
            <span>{t('editor.light.radius')}</span>
            <input
              id={id}
              type="number"
              min={1}
              max={30}
              value={radius}
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10)
                if (Number.isInteger(parsed)) onRadiusChange(parsed)
              }}
            />
          </label>
          <div role="group" aria-label={t('editor.light.color')} className={styles.swatches}>
            {LIGHT_COLOR_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={preset === color}
                title={preset}
                style={{ backgroundColor: preset }}
                className={styles.swatch}
                onClick={() => onColorChange(preset)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
