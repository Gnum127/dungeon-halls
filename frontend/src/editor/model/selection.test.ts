import { describe, expect, it } from 'vitest'
import { footprintRect, resizeHandleAt, resizeHandlePoints, resizedFootprint } from './selection'
import type { MapObject } from './types'

const object: MapObject = { id: 1, kindId: 'table', x: 1, y: 2, scale: { w: 2, h: 3 } }

describe('footprintRect / resizeHandlePoints', () => {
  it('derives the footprint and its four corners', () => {
    expect(footprintRect(object)).toEqual({ x: 1, y: 2, w: 2, h: 3 })
    expect(resizeHandlePoints(object)).toEqual({
      nw: { x: 1, y: 2 },
      ne: { x: 3, y: 2 },
      se: { x: 3, y: 5 },
      sw: { x: 1, y: 5 },
    })
  })

  it('defaults a missing scale to 1×1', () => {
    expect(footprintRect({ id: 1, kindId: 'chair', x: 4, y: 5 })).toEqual({
      x: 4,
      y: 5,
      w: 1,
      h: 1,
    })
  })
})

describe('resizeHandleAt', () => {
  it('hits a corner within the pixel-based reach', () => {
    expect(resizeHandleAt(object, { x: 3, y: 5 }, 32)).toBe('se')
    expect(resizeHandleAt(object, { x: 1.1, y: 1.9 }, 32)).toBe('nw')
  })

  it('returns null away from every corner', () => {
    expect(resizeHandleAt(object, { x: 2, y: 3.5 }, 32)).toBeNull()
  })

  it('keeps a minimum 7px reach at tiny cell sizes', () => {
    // cellSize 8: пиксельный reach 7px = 0.875 клетки, но клампится долей
    // меньшей стороны (0.4·2 = 0.8) — угол (3,5) ловит точку на 0.8 в стороне.
    expect(resizeHandleAt(object, { x: 3.8, y: 5.8 }, 8)).toBe('se')
  })

  it('does not turn a tiny 1×1 drag into a resize', () => {
    // 1×1 при мелком зуме: центр клетки (0.5,0.5) — «перемещение», не хендл.
    const tiny: MapObject = { id: 9, kindId: 'chair', x: 0, y: 0 }
    expect(resizeHandleAt(tiny, { x: 0.5, y: 0.5 }, 8)).toBeNull()
    // У самого угла хендл всё ещё ловится.
    expect(resizeHandleAt(tiny, { x: 0.1, y: 0.1 }, 8)).toBe('nw')
  })
})

describe('resizedFootprint', () => {
  it('grows from the se corner keeping the opposite (nw) corner anchored', () => {
    expect(resizedFootprint(object, 'se', { x: 4.2, y: 7.4 })).toEqual({
      x: 1,
      y: 2,
      scale: { w: 3, h: 5 },
    })
  })

  it('grows from the nw corner keeping the se corner anchored', () => {
    // Якорь — (3,5); тянем к (0,1) → origin (0,1), размер 3×4.
    expect(resizedFootprint(object, 'nw', { x: 0, y: 1 })).toEqual({
      x: 0,
      y: 1,
      scale: { w: 3, h: 4 },
    })
  })

  it('handles the ne and sw corners symmetrically', () => {
    expect(resizedFootprint(object, 'ne', { x: 5, y: 1 })).toEqual({
      x: 1,
      y: 1,
      scale: { w: 4, h: 4 },
    })
    expect(resizedFootprint(object, 'sw', { x: 0, y: 6 })).toEqual({
      x: 0,
      y: 2,
      scale: { w: 3, h: 4 },
    })
  })

  it('keeps a minimum 1×1 size when dragged onto the anchor', () => {
    expect(resizedFootprint(object, 'se', { x: 1, y: 2 })).toEqual({
      x: 1,
      y: 2,
      scale: { w: 1, h: 1 },
    })
  })

  it('never lets the origin go negative', () => {
    // Якорь se-хендла — противоположный (nw) угол (1,2): origin зажимается
    // до 0, размер — от (0,0) до якоря.
    expect(resizedFootprint(object, 'se', { x: -5, y: -5 })).toEqual({
      x: 0,
      y: 0,
      scale: { w: 1, h: 2 },
    })
  })

  it('snaps a fractional origin to integer cells (never a fractional size)', () => {
    // Объект, размещённый кликом, может иметь дробный origin (x=2.5).
    const float = { id: 2, kindId: 'chair' as const, x: 2.5, y: 3.5 }
    // Округление границ: nw → (3,4); тянем se к (5,6) → размер 2×2.
    expect(resizedFootprint(float, 'se', { x: 5, y: 6 })).toEqual({
      x: 3,
      y: 4,
      scale: { w: 2, h: 2 },
    })
    // Все якоря дают целый размер при дробном origin.
    for (const handle of ['nw', 'ne', 'sw'] as const) {
      const bounds = resizedFootprint(float, handle, { x: 6, y: 7 })
      expect(Number.isInteger(bounds.scale.w)).toBe(true)
      expect(Number.isInteger(bounds.scale.h)).toBe(true)
      expect(bounds.scale.w).toBeGreaterThanOrEqual(1)
      expect(bounds.scale.h).toBeGreaterThanOrEqual(1)
    }
  })

  it('keeps at least 1×1 when the anchor sits at the grid origin', () => {
    const atZero = { id: 3, kindId: 'chair' as const, x: 0, y: 0 }
    // Клампим origin в 0, но размер не вырождается в 0.
    expect(resizedFootprint(atZero, 'se', { x: -3, y: -3 })).toEqual({
      x: 0,
      y: 0,
      scale: { w: 1, h: 1 },
    })
  })

  it('clamps the moving edge to the grid bounds', () => {
    // Границы 10×10: тянем se далеко вправо-вниз — origin остаётся внутри.
    expect(resizedFootprint(object, 'se', { x: 50, y: 60 }, { width: 10, height: 10 })).toEqual({
      x: 1,
      y: 2,
      scale: { w: 8, h: 7 },
    })
    // nw: тянем за пределы слева-сверху — origin клампится в 0.
    expect(resizedFootprint(object, 'nw', { x: -5, y: -5 }, { width: 10, height: 10 })).toEqual({
      x: 0,
      y: 0,
      scale: { w: 3, h: 5 },
    })
  })
})
