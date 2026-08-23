import { useTranslation } from 'react-i18next'
import styles from './EditorPage.module.css'

export function EditorPage() {
  const { t } = useTranslation()

  return (
    <div className={styles.root}>
      <div className={styles.workspace}>
        <p className={styles.emptyState}>{t('editor.canvas.empty')}</p>
      </div>
    </div>
  )
}
