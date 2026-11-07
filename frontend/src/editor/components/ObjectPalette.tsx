import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ObjectCategory, ObjectKindEntry, ObjectKindId } from '../model/objects'
import type { ObjectRotation, ObjectScale } from '../model/types'
import { OBJECT_KIND_ENTRIES } from '../model/objects'
import styles from './ObjectPalette.module.css'

const CATEGORY_ORDER: ObjectCategory[] = ['structural', 'furniture', 'dungeon']

const CATEGORY_LABELS: Record<ObjectCategory, string> = {
  structural: 'editor.objects.categories.structural',
  furniture: 'editor.objects.categories.furniture',
  dungeon: 'editor.objects.categories.dungeon',
}

const BY_CATEGORY = new Map<ObjectCategory, ObjectKindEntry[]>()
for (const kind of OBJECT_KIND_ENTRIES) {
  const list = BY_CATEGORY.get(kind.category) ?? []
  list.push(kind)
  BY_CATEGORY.set(kind.category, list)
}

interface ObjectPaletteProps {
  /** kindId активного инструмента-объекта, иначе null. */
  activeKindId: ObjectKindId | null
  onSelectKind: (kindId: ObjectKindId) => void
  objectRotation: ObjectRotation
  objectScale: ObjectScale
  onRotate: () => void
  /** Цикл по доступным размерам активного вида («Размер»). */
  onResize: () => void
  /** Выбранные изображения видов; null = «по умолчанию». */
  elementImageOverrides: Readonly<Partial<Record<ObjectKindId, string | null>>>
  onSelectElementImage: (kindId: ObjectKindId, imageId: string | null) => void
}

/**
 * Палитра объектов: категории и виды, поворот/размер и выбор изображения
 * активного вида. Выбор объекта — по клику; режим перемещения — «Курсор»
 * из нижней плашки.
 */
export function ObjectPalette({
  activeKindId,
  onSelectKind,
  objectRotation,
  objectScale,
  onRotate,
  onResize,
  elementImageOverrides,
  onSelectElementImage,
}: ObjectPaletteProps) {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState<Partial<Record<ObjectCategory, boolean>>>({})

  const isActive = activeKindId !== null
  const activeKind = activeKindId
    ? OBJECT_KIND_ENTRIES.find((entry) => entry.id === activeKindId)
    : undefined
  const hasSizes = activeKind?.scales !== undefined
  const hasImagePool = activeKind?.imagePool !== undefined

  return (
    <div className={styles.palette}>
      {isActive && (
        <div className={styles.rotationBar}>
          <span className={styles.rotationLabel}>{objectRotation}°</span>
          <button
            type="button"
            className={styles.rotateButton}
            onClick={onRotate}
            title={t('editor.objects.rotate')}
          >
            ↻
          </button>
          {hasSizes && (
            <>
              <button
                type="button"
                className={styles.sizeButton}
                onClick={onResize}
                title={t('editor.objects.resize')}
              >
                ▦
              </button>
              <span className={styles.scaleBadge}>
                {objectScale.w}×{objectScale.h}
              </span>
            </>
          )}
          {hasImagePool && activeKindId && activeKind && (
            <select
              className={styles.imagePick}
              aria-label={t('editor.objects.image')}
              title={t('editor.objects.image')}
              value={elementImageOverrides[activeKindId] ?? ''}
              onChange={(e) =>
                onSelectElementImage(activeKindId, e.target.value === '' ? null : e.target.value)
              }
            >
              <option value="">{t('editor.objects.imageDefault')}</option>
              {activeKind.imagePool?.map((imageId) => (
                <option key={imageId} value={imageId}>
                  {imageId}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
      {CATEGORY_ORDER.map((cat) => {
        const kinds = BY_CATEGORY.get(cat)
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
                    <span style={{ backgroundColor: kind.color }} className={styles.dot} />
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
