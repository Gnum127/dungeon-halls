import { useTranslation } from 'react-i18next'
import i18n, { changeLanguage, LANGUAGES } from './i18n'
import type { Language } from './i18n'
import styles from './App.module.css'

export default function App() {
  const { t } = useTranslation()

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('app.title')}</h1>
        <select
          className={styles.langSelect}
          aria-label={t('app.language')}
          defaultValue={i18n.language}
          onChange={(e) => changeLanguage(e.target.value as Language)}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {t(`app.lang.${lang}`)}
            </option>
          ))}
        </select>
      </header>
      <main className={styles.workspace}>
        <p className={styles.placeholder}>{t('editor.placeholder')}</p>
      </main>
    </div>
  )
}
