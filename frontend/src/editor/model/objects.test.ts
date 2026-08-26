import { describe, expect, it } from 'vitest'
import en from '../../app/i18n/locales/en.json'
import ru from '../../app/i18n/locales/ru.json'
import {
  OBJECT_COLORS,
  OBJECT_KIND_ENTRIES,
  OBJECT_KIND_REGISTRY,
  OBJECT_KINDS,
  footprintCells,
  footprintInBounds,
  isCellOccupied,
  isFootprintFree,
  isKnownKind,
  objectFootprint,
  rectsOverlap,
  topmostObjectAt,
} from './objects'
import type { MapObject } from './types'

function resolveKey(resource: object, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node !== null && typeof node === 'object'
          ? (node as Record<string, unknown>)[part]
          : undefined,
      resource,
    )
}

function obj(id: number, x: number, y: number, w = 1, h = 1): MapObject {
  return w === 1 && h === 1
    ? { id, kindId: 'door', x, y }
    : { id, kindId: 'door', x, y, scale: { w, h } }
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

describe('footprint utilities', () => {
  it('objectFootprint returns 1×1 for objects without scale', () => {
    const o = obj(1, 2, 3)
    expect(objectFootprint(o)).toEqual({ x: 2, y: 3, w: 1, h: 1 })
  })

  it('objectFootprint uses scale when present', () => {
    const o = obj(1, 2, 3, 3, 2)
    expect(objectFootprint(o)).toEqual({ x: 2, y: 3, w: 3, h: 2 })
  })

  it('footprintCells returns all cells for multi-cell objects', () => {
    const o = obj(1, 0, 0, 2, 2)
    expect(footprintCells(o).sort()).toEqual(['0,0', '0,1', '1,0', '1,1'].sort())
  })

  it('footprintCells returns single cell for 1×1 objects', () => {
    expect(footprintCells(obj(1, 5, 3))).toEqual(['5,3'])
  })

  it('rectsOverlap detects overlapping rectangles', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 2, h: 2 }, { x: 1, y: 1, w: 2, h: 2 })).toBe(true)
    expect(rectsOverlap({ x: 0, y: 0, w: 1, h: 1 }, { x: 1, y: 1, w: 1, h: 1 })).toBe(false)
    expect(rectsOverlap({ x: 0, y: 0, w: 2, h: 1 }, { x: 0, y: 1, w: 2, h: 1 })).toBe(false)
    expect(rectsOverlap({ x: 0, y: 0, w: 3, h: 3 }, { x: 1, y: 1, w: 1, h: 1 })).toBe(true)
  })

  it('footprintInBounds checks map dimensions', () => {
    const o = obj(1, 0, 0, 3, 3)
    expect(footprintInBounds(o, 3, 3)).toBe(true)
    expect(footprintInBounds(o, 2, 3)).toBe(false)
    expect(footprintInBounds(obj(1, 5, 5), 10, 10)).toBe(true)
    expect(footprintInBounds(obj(1, 9, 9, 2, 2), 10, 10)).toBe(false)
  })

  it('isCellOccupied checks footprint, not just origin', () => {
    const objects = [obj(1, 0, 0, 2, 2)]
    expect(isCellOccupied(objects, 0, 0)).toBe(true)
    expect(isCellOccupied(objects, 1, 1)).toBe(true)
    expect(isCellOccupied(objects, 2, 0)).toBe(false)
    expect(isCellOccupied(objects, 0, 2)).toBe(false)
  })

  it('isCellOccupied works with 1×1 objects', () => {
    const objects = [obj(1, 3, 4)]
    expect(isCellOccupied(objects, 3, 4)).toBe(true)
    expect(isCellOccupied(objects, 3, 5)).toBe(false)
  })

  it('isFootprintFree detects overlapping and non-overlapping areas', () => {
    const objects = [obj(1, 0, 0, 2, 2), obj(2, 5, 5)]
    expect(isFootprintFree(objects, 3, 3, 2, 2)).toBe(true) // no overlap
    expect(isFootprintFree(objects, 4, 4, 2, 2)).toBe(false) // overlaps object 2 at (5,5)
    expect(isFootprintFree(objects, 4, 4, 1, 1)).toBe(true) // (4,4) doesn't overlap
  })

  it('topmostObjectAt returns the last object whose footprint contains the cell', () => {
    const objects = [obj(1, 0, 0, 2, 2), obj(2, 1, 1)]
    expect(topmostObjectAt(objects, 1, 1)?.id).toBe(2)
    expect(topmostObjectAt(objects, 0, 0)?.id).toBe(1)
    expect(topmostObjectAt(objects, 5, 5)).toBeUndefined()
  })
})
