import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { EditorTool } from '../tools/editorTool'
import styles from './BottomBar.module.css'

export interface BottomBarProps {
  activeTool: EditorTool
  onSelectCursor: () => void
  onSelectPan: () => void
  onSelectRect: () => void
  onSelectPolygon: () => void
  onSelectStairs: () => void
  onSelectDoor: () => void
}

function CursorIcon() {
  return <path d="M6 3l12 8-5 1-2.5 5.5z" />
}

function PanIcon() {
  return (
    <g>
      <path d="M12 3v18M3 12h18" />
      <path d="M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5" />
      <path d="M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5" />
    </g>
  )
}

function RectIcon() {
  return <rect x="4" y="5" width="16" height="14" rx="1" />
}

function PolygonIcon() {
  return <path d="M12 3l8 6-3 11H7L4 9z" />
}

function StairsIcon() {
  return <path d="M3 20h4v-4h4v-4h4V8h4V4" />
}

function DoorIcon() {
  return (
    <g>
      <path d="M6 20V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v14" />
      <path d="M4 20h16" />
      <path d="M14 12h.01" />
    </g>
  )
}

interface ToolButton {
  key: string
  labelKey: string
  icon: ReactNode
  active: boolean
  onClick: () => void
}

/** Нижняя плашка: переключение инструментов построения и режимов курсора. */
export function BottomBar(props: BottomBarProps) {
  const { activeTool } = props
  const { t } = useTranslation()

  const tools: readonly ToolButton[] = [
    {
      key: 'cursor',
      labelKey: 'editor.bottomBar.cursor',
      icon: <CursorIcon />,
      active: activeTool.type === 'cursor',
      onClick: props.onSelectCursor,
    },
    {
      key: 'pan',
      labelKey: 'editor.bottomBar.pan',
      icon: <PanIcon />,
      active: activeTool.type === 'pan',
      onClick: props.onSelectPan,
    },
    {
      key: 'rect',
      labelKey: 'editor.bottomBar.rect',
      icon: <RectIcon />,
      active: activeTool.type === 'region-rect',
      onClick: props.onSelectRect,
    },
    {
      key: 'polygon',
      labelKey: 'editor.bottomBar.polygon',
      icon: <PolygonIcon />,
      active: activeTool.type === 'region-polygon',
      onClick: props.onSelectPolygon,
    },
    {
      key: 'stairs',
      labelKey: 'editor.bottomBar.stairs',
      icon: <StairsIcon />,
      active: activeTool.type === 'stairs',
      onClick: props.onSelectStairs,
    },
    {
      key: 'door',
      labelKey: 'editor.bottomBar.door',
      icon: <DoorIcon />,
      active: activeTool.type === 'door',
      onClick: props.onSelectDoor,
    },
  ]

  return (
    <div className={styles.bar} role="toolbar" aria-label={t('editor.bottomBar.label')}>
      {tools.map((tool) => {
        const label = t(tool.labelKey)
        return (
          <button
            key={tool.key}
            type="button"
            className={[styles.button, tool.active ? styles.active : ''].filter(Boolean).join(' ')}
            aria-pressed={tool.active}
            aria-label={label}
            title={label}
            onClick={tool.onClick}
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {tool.icon}
            </svg>
          </button>
        )
      })}
    </div>
  )
}
