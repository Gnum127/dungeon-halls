import { describe, expect, it } from 'vitest'
import en from '../../app/i18n/locales/en.json'
import ru from '../../app/i18n/locales/ru.json'
import {
  OBJECT_COLORS,
  OBJECT_KIND_ENTRIES,
  OBJECT_KIND_REGISTRY,
  OBJECT_KINDS,
  isKnownKind,
} from './objects'

function resolveKey(resource: object, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (node, part) => (node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    resource,
  )
}

describe('OBJECT_KIND_REGISTRY', () => {
  it('derives kinds, colors and entries from a single source', () => {
    expect(OBJECT_KINDS).toEqual(['door', 'stairs', 'table', 'chair', 'chest', 'torch'])
    expect(OBJECT_KIND_ENTRIES.map((entry) => entry.id)).toEqual(OBJECT_KINDS)
    expect(Object.keys(OBJECT_COLORS)).toEqual(OBJECT_KINDS)
    for (const entry of OBJECT_KIND_ENTRIES) {
      expect(entry.color).toBe(OBJECT_COLORS[entry.id])
      expect(entry.labelKey).toBe(`editor.objects.${entry.id}`)
    }
  })

  it('has a label key for every kind in both locales', () => {
    for (const entry of OBJECT_KIND_ENTRIES) {
      expect(resolveKey(ru, entry.labelKey)).toBeDefined()
      expect(resolveKey(en, entry.labelKey)).toBeDefined()
    }
  })

  it('keeps every registry record consistent with its derived id', () => {
    for (const [id, meta] of Object.entries(OBJECT_KIND_REGISTRY)) {
      expect(meta.labelKey).toContain(id)
      expect(meta.color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('recognizes only registered kinds', () => {
    expect(isKnownKind('door')).toBe(true)
    expect(isKnownKind('torch')).toBe(true)
    expect(isKnownKind('dragon')).toBe(false)
    // Свойства прототипа не должны проходить guard.
    expect(isKnownKind('toString')).toBe(false)
    expect(isKnownKind('constructor')).toBe(false)
    expect(isKnownKind('')).toBe(false)
  })
})
