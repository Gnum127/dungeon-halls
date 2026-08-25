import { describe, expect, it } from 'vitest'
import { applyCommand } from '../model/commands'
import { createEmptyMap } from '../model/createEmptyMap'
import { LIGHT_GLOW_COLOR, LIGHT_MARKER_COLOR } from './colors'
import { renderMap } from './renderMap'
import { makeFakeCtx } from './testFakeCtx'

describe('renderMap lights', () => {
  it('draws a glow of the light radius and a small marker', () => {
    let model = applyCommand(createEmptyMap(6, 6), {
      kind: 'addLight',
      x: 2,
      y: 2,
      radius: 3,
      color: '#ffd682',
    })
    model = applyCommand(model, { kind: 'addLight', x: 0, y: 0, radius: 1, color: '#88aaff' })

    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, model, {
      width: 192,
      height: 192,
      cellSize: 32,
      offsetX: 0,
      offsetY: 0,
    })

    const glows = calls.filter((c) => c.op === 'fill' && c.fillStyle === LIGHT_GLOW_COLOR)
    expect(glows).toHaveLength(2)
    // Радиус свечения = radius * cellSize (клетка (2,2), центр 80).
    const glowArcs = calls.filter((c) => c.op === 'arc')
    expect(glowArcs[0]?.args).toEqual([80, 80, 96, 0, Math.PI * 2])
    const markers = calls.filter((c) => c.op === 'fill' && c.fillStyle === LIGHT_MARKER_COLOR)
    expect(markers).toHaveLength(2)
  })

  it('does not draw anything when there are no lights', () => {
    const { ctx, calls } = makeFakeCtx()
    renderMap(ctx, createEmptyMap(3, 3), {
      width: 96,
      height: 96,
      cellSize: 32,
      offsetX: 0,
      offsetY: 0,
    })
    expect(calls.some((c) => c.fillStyle === LIGHT_GLOW_COLOR)).toBe(false)
    expect(calls.some((c) => c.fillStyle === LIGHT_MARKER_COLOR)).toBe(false)
  })
})
