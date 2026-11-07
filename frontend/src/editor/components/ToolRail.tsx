import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './ToolRail.module.css'

export type EditorSectionId = 'landscape' | 'objects' | 'file'

export interface ToolRailProps {
  active: EditorSectionId | null
  onSelect: (id: EditorSectionId) => void
}

const SECTION_ORDER: readonly EditorSectionId[] = ['landscape', 'objects', 'file']

function SwatchIcon() {
  return <path d="M3 18l6-9 4 6 3-5 5 8H3z" />
}

function BoxIcon() {
  return (
    <g>
      <path d="M4 7l8-4 8 4v10l-8 4-8-4z" />
      <path d="M4 7l8 4 8-4" />
      <path d="M12 11v10" />
    </g>
  )
}

function ExportIcon() {
  return (
    <g>
      <path d="M12 3v10" />
      <path d="M8 7l4-4 4 4" />
      <path d="M4 13v6a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-6" />
    </g>
  )
}

const ICONS: Record<EditorSectionId, ReactNode> = {
  landscape: <SwatchIcon />,
  objects: <BoxIcon />,
  file: <ExportIcon />,
}

/** Вертикальный рейл-навигация: один раздел редактора за раз. */
export function ToolRail({ active, onSelect }: ToolRailProps) {
  const { t } = useTranslation()

  return (
    <nav className={styles.rail} aria-label={t('editor.sections.label')}>
      {SECTION_ORDER.map((id) => (
        <button
          key={id}
          type="button"
          className={[styles.button, active === id ? styles.active : '']
            .filter(Boolean)
            .join(' ')}
          aria-label={t(`editor.sections.${id}`)}
          aria-pressed={active === id}
          title={t(`editor.sections.${id}`)}
          onClick={() => onSelect(id)}
        >
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {ICONS[id]}
          </svg>
        </button>
      ))}
    </nav>
  )
}