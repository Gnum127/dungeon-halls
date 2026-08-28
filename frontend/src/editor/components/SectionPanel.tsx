import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './SectionPanel.module.css'

export interface SectionPanelProps {
  title: string
  /** Панель скрываемая: коллапс управляется через onToggleCollapsed. */
  collapsible?: boolean
  collapsed?: boolean
  onToggleCollapsed?: () => void
  children: ReactNode
}

/** Обёртка раздела: заголовок + тело; у скрываемых панелей — кнопка свёртки. */
export function SectionPanel({
  title,
  collapsible = false,
  collapsed = false,
  onToggleCollapsed,
  children,
}: SectionPanelProps) {
  const { t } = useTranslation()

  return (
    <section className={styles.panel} aria-label={title}>
      <header className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {collapsible && (
          <button
            type="button"
            className={[styles.toggle, collapsed ? styles.toggleCollapsed : '']
              .filter(Boolean)
              .join(' ')}
            aria-label={t(collapsed ? 'editor.sections.expand' : 'editor.sections.collapse')}
            aria-expanded={!collapsed}
            onClick={onToggleCollapsed}
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        )}
      </header>
      {!collapsed && <div className={styles.body}>{children}</div>}
    </section>
  )
}