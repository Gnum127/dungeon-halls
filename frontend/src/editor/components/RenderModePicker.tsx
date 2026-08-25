import { useTranslation } from 'react-i18next'
import type { RenderMode } from '../render/renderMode'
import styles from './RenderModePicker.module.css'

export interface RenderModePickerProps {
  mode: RenderMode
  /** Состояние атласа: подсказка видна только в режиме спрайтов. */
  atlasStatus: 'loading' | 'ready' | 'unavailable'
  onChange: (mode: RenderMode) => void
}

const MODE_KEYS = [
  { mode: 'colors', key: 'editor.renderMode.colors' },
  { mode: 'sprites', key: 'editor.renderMode.sprites' },
] as const

/** Переключатель «цветные плитки / спрайты» — свойство просмотра, не документа. */
export function RenderModePicker({ mode, atlasStatus, onChange }: RenderModePickerProps) {
  const { t } = useTranslation()

  return (
    <div className={styles.field}>
      <span className={styles.label} id="render-mode-label">
        {t('editor.renderMode.label')}
      </span>
      <div role="group" aria-labelledby="render-mode-label" className={styles.group}>
        {MODE_KEYS.map(({ mode: value, key }) => (
          <button
            key={value}
            type="button"
            className={[styles.button, value === mode ? styles.selected : '']
              .filter(Boolean)
              .join(' ')}
            aria-pressed={value === mode}
            onClick={() => onChange(value)}
          >
            {t(key)}
          </button>
        ))}
      </div>
      {mode === 'sprites' && atlasStatus !== 'ready' && (
        <p className={styles.hint} role="note">
          {t(atlasStatus === 'loading' ? 'editor.renderMode.loading' : 'editor.renderMode.unavailable')}
        </p>
      )}
    </div>
  )
}
