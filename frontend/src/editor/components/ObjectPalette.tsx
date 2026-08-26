import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ObjectCategory, ObjectKindEntry, ObjectKindId } from '../model/objects'
import { OBJECT_KIND_ENTRIES } from '../model/objects'
import styles from './ObjectPalette.module.css'

const CATEGORY_ORDER: ObjectCategory[] = ['structural', 'furniture', 'dungeon']

const CATEGORY_LABELS: Record<ObjectCategory, string> = {
  structural: 'editor.objects.categories.structural',
  furniture: 'editor.objects.categories.furniture',
  dungeon: 'editor.objects.categories.dungeon',
}

interface ObjectPaletteProps {
  /** kindId активного инструмента-объекта, иначе null. */
  activeKindId: ObjectKindId | null
  selectActive: boolean
  onSelectKind: (kindId: ObjectKindId) => void
  onSelectSelectTool: () => void
}

export function ObjectPalette({
  activeKindId,
  selectActive,
  onSelectKind,
  onSelectSelectTool,
}: ObjectPaletteProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Partial<Record<ObjectCategory, boolean>>>({})

  const filteredByCategory = useMemo(() => {
    const map = new Map<ObjectCategory, ObjectKindEntry[]>()
    for (const kind of OBJECT_KIND_ENTRIES) {
      if (search && !t(kind.labelKey).toLowerCase().includes(search.toLowerCase())) continue
      const list = map.get(kind.category) ?? []
      list.push(kind)
      map.set(kind.category, list)
    }
    return map
  }, [search, t])

  return (
    <div className={styles.palette}>
      <button
        type="button"
        className={[styles.toolButton, selectActive ? styles.selected : '']
          .filter(Boolean)
          .join(' ')}
        aria-pressed={selectActive}
        onClick={onSelectSelectTool}
      >
        {t('editor.objects.select')}
      </button>
      <input
        type="text"
        className={styles.search}
        placeholder={t('editor.objects.search')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {CATEGORY_ORDER.map((cat) => {
        const kinds = filteredByCategory.get(cat)
        if (!kinds || kinds.length === 0) return null
        const isCollapsed = collapsed[cat] ?? false
        return (
          <div key={cat} className={styles.categoryGroup}>
            <button
              type="button"
              className={styles.categoryHeader}
              aria-expanded={!isCollapsed}
              onClick={() => setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }))}
            >
              {t(CATEGORY_LABELS[cat])}
            </button>
            {!isCollapsed && (
              <div role="group" aria-label={t(CATEGORY_LABELS[cat])} className={styles.kindList}>
                {kinds.map((kind) => (
                  <button
                    key={kind.id}
                    type="button"
                    className={[styles.swatch, kind.id === activeKindId ? styles.selected : '']
                      .filter(Boolean)
                      .join(' ')}
                    aria-pressed={kind.id === activeKindId}
                    title={t(kind.labelKey)}
                    onClick={() => onSelectKind(kind.id)}
                  >
                    <span
                      style={{ backgroundColor: kind.color }}
                      className={styles.dot}
                    />
                    <span className={styles.name}>{t(kind.labelKey)}</span>
                    {kind.defaultScale && (
                      <span className={styles.scaleBadge}>
                        {kind.defaultScale.w}×{kind.defaultScale.h}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
