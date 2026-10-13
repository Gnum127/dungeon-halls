import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './ToolRail.module.css'

export type EditorSectionId =
  | 'landscape'
  | 'elements'
  | 'light'
  | 'view'
  | 'generation'
  | 'file'

export interface ToolRailProps {
  active: EditorSectionId | null
  onSelect: (id: EditorSectionId) => void
}

const SECTION_ORDER: readonly EditorSectionId[] = [
  'landscape',
  'elements',
  'light',
  'view',
  'generation',
  'file',
]

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

function BulbIcon() {
  return (
    <g>
      <path d="M12 2a5.5 5.5 0 0 0-3.3 10c1 .7 1.5 1.5 1.5 2.4V16h3.6v-1.6c0-.9.5-1.7 1.5-2.4A5.5 5.5 0 0 0 12 2z" />
      <path d="M9.5 18.5h5" />
      <path d="M10.5 21h3" />
    </g>
  )
}

function EyeIcon() {
  return (
    <g>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </g>
  )
}

function DiceIcon() {
  return (
    <g>
      <path d="M12 2.5l8 4.5v9l-8 4.5-8-4.5v-9l8-4.5z" />
      <path d="M8.5 11.5h.01" />
      <path d="M15.5 11.5h.01" />
      <path d="M12 15.5h.01" />
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
  elements: <BoxIcon />,
  light: <BulbIcon />,
  view: <EyeIcon />,
  generation: <DiceIcon />,
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