import { describe, expect, it } from 'vitest'
import { cellCenterAt, mapPixelBounds } from '../render/gridGeometry'
import {
  CANVAS_BACKGROUND_COLOR,
  DOOR_FILL_COLOR,
  GRID_LINE_COLOR,
  LIGHT_GLOW_COLOR,
  LIGHT_MARKER_COLOR,
  WALL_LINE_COLOR,
  WALL_LINE_WIDTH,
} from '../render/colors'
import { OBJECT_COLORS } from '../model/objects'
import { applyCommand } from '../model/commands'
import { createEmptyMap } from '../model/createEmptyMap'
import type { MapModel } from '../model/types'
import type { GridType } from '@/shared/tiles'
import { SVG_UNITS_PER_CELL, buildSvg } from './svg'

function squareRoom(): MapModel {
  let model = applyCommand(createEmptyMap(2, 2), { kind: 'setTile', x: 0, y: 0, tile: 1 })
  model = applyCommand(model, {
    kind: 'setWalls',
    updates: [
      { edge: { x: 0, y: 0, side: 'N' }, present: true },
      { edge: { x: 1, y: 0, side: 'W' }, present: true },
      { edge: { x: 0, y: 0, side: 'S' }, present: true },
      { edge: { x: 0, y: 0, side: 'W' }, present: true },
    ],
  })
  model = applyCommand(model, { kind: 'addDoor', edge: { x: 0, y: 0, side: 'N' } })
  return model
}

describe('buildSvg', () => {
  it('emits a root svg with viewBox and background for an empty map', () => {
    const svg = buildSvg(createEmptyMap(2, 2))
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"')
    expect(svg).toMatch(new RegExp(`fill="${CANVAS_BACKGROUND_COLOR}"`))
    expect(svg.endsWith('</svg>')).toBe(true)
  })

  it('paints every square cell as a rect and draws the grid path', () => {
    const svg = buildSvg(createEmptyMap(3, 2))
    // w·h плиток + фон.
    expect(svg.match(/<rect /g) ?? []).toHaveLength(3 * 2 + 1)
    expect(svg).toContain('<path d="')
  })

  it('is deterministic byte-for-byte including hex float coordinates', () => {
    const model = squareRoom()
    expect(buildSvg(model, { includeLight: true })).toBe(buildSvg(model, { includeLight: true }))
    // Мотивация фиксированного формата чисел: √3-координаты гексов.
    const hexModel = applyCommand(createEmptyMap(2, 2, 'hex-pointy'), {
      kind: 'setTile',
      x: 1,
      y: 1,
      tile: 1,
    })
    expect(buildSvg(hexModel)).toBe(buildSvg(hexModel))
    expect(buildSvg(createEmptyMap(2, 2, 'hex-flat'))).toBe(
      buildSvg(createEmptyMap(2, 2, 'hex-flat')),
    )
  })

  it('draws doors bound to their edge: closed is one panel, open two segments', () => {
    let closed = applyCommand(createEmptyMap(2, 2), {
      kind: 'toggleWall',
      edge: { x: 0, y: 0, side: 'N' },
    })
    closed = applyCommand(closed, { kind: 'addDoor', edge: { x: 0, y: 0, side: 'N' } })

    const closedSvg = buildSvg(closed)
    // Полотно по центру ребра N: y = −thickness/2 (выступает над ребром),
    // x > 0 (начинается с 20% длины ребра, а не с угла клетки).
    const doorRect = new RegExp(
      `<rect x="(-?[\\d.]+)" y="(-?[\\d.]+)" width="[\\d.]+" height="[\\d.]+" fill="${DOOR_FILL_COLOR}"`,
    ).exec(closedSvg)
    expect(doorRect).not.toBeNull()
    expect(Number(doorRect?.[2])).toBeLessThan(0)
    expect(Number(doorRect?.[1])).toBeGreaterThan(0)
    expect(closedSvg.match(new RegExp(`fill="${DOOR_FILL_COLOR}"`, 'g'))).toHaveLength(1)

    const open = applyCommand(closed, { kind: 'setDoorOpen', id: 1, open: true })
    // Открытая дверь — просвет: два коротких сегмента у концов ребра.
    expect(buildSvg(open).match(new RegExp(`fill="${DOOR_FILL_COLOR}"`, 'g'))).toHaveLength(2)
  })

  it('emits layers in renderMap order', () => {
    let model = squareRoom()
    model = applyCommand(model, { kind: 'addObject', x: 1, y: 1, kindId: 'chest' })
    model = applyCommand(model, {
      kind: 'addLight',
      x: 1,
      y: 0,
      radius: 2,
      color: '#ffd682',
    })
    const svg = buildSvg(model, { includeLight: true })

    const background = svg.indexOf(`fill="${CANVAS_BACKGROUND_COLOR}"`)
    const grid = svg.indexOf(`stroke="${GRID_LINE_COLOR}"`)
    const object = svg.indexOf(`fill="${OBJECT_COLORS.chest}"`)
    const wall = svg.indexOf(WALL_LINE_COLOR)
    const door = svg.indexOf(`fill="${DOOR_FILL_COLOR}"`)
    const light = svg.indexOf(`fill="${LIGHT_GLOW_COLOR}"`)

    expect(background).toBeLessThan(grid)
    expect(grid).toBeLessThan(object)
    expect(object).toBeLessThan(wall)
    expect(wall).toBeLessThan(door)
    expect(door).toBeLessThan(light)
  })

  it('keeps every square cell inside the viewBox', () => {
    const s = SVG_UNITS_PER_CELL
    const svg = buildSvg(createEmptyMap(3, 3))
    expect(svg).toContain('viewBox="0 0 192 192"')
    // Крайняя клетка (2,2) на месте.
    expect(svg).toContain(`<rect x="${2 * s}" y="${2 * s}"`)
    // Линии сетки доходят до правого нижнего угла.
    expect(svg).toContain(`L${3 * s} 0`)
    expect(svg).toContain(`L192 ${3 * s}`)
  })

  it.each<GridType>(['hex-flat', 'hex-pointy'])(
    'keeps every %s cell polygon inside the viewBox',
    (gridType) => {
      const s = SVG_UNITS_PER_CELL
      const svg = buildSvg(createEmptyMap(3, 3, gridType))
      // Полнота покрытия: все 9 клеток нарисованы.
      expect(svg.match(/<polygon /g) ?? []).toHaveLength(3 * 3)
      const bounds = mapPixelBounds(3, 3, gridType, s)
      const maxX = Math.ceil(bounds.width)
      const maxY = Math.ceil(bounds.height)

      const coordinatePairs = [...svg.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)]
      expect(coordinatePairs.length).toBeGreaterThan(0)
      for (const match of coordinatePairs) {
        const x = Number(match[1])
        const y = Number(match[2])
        expect(x).toBeGreaterThanOrEqual(-1e-9)
        expect(y).toBeGreaterThanOrEqual(-1e-9)
        expect(x).toBeLessThanOrEqual(maxX + 1e-9)
        expect(y).toBeLessThanOrEqual(maxY + 1e-9)
      }
    },
  )

  it('draws objects as circles with registry colors in array order', () => {
    let model = applyCommand(createEmptyMap(3, 3), {
      kind: 'addObject',
      x: 1,
      y: 1,
      kindId: 'chest',
    })
    model = applyCommand(model, { kind: 'addObject', x: 2, y: 2, kindId: 'torch' })
    const svg = buildSvg(model)
    const circles = svg.match(/<circle /g) ?? []
    expect(circles).toHaveLength(2)
    expect(svg).toContain(`fill="${OBJECT_COLORS.chest}"`)
    expect(svg.indexOf(OBJECT_COLORS.chest)).toBeLessThan(svg.indexOf(OBJECT_COLORS.torch))
  })

  it('renders walls and doors only on square grids (defense-in-depth)', () => {
    const hexWithWalls: MapModel = {
      ...createEmptyMap(2, 2, 'hex-pointy'),
      walls: squareRoom().walls,
    }
    const svg = buildSvg(hexWithWalls)
    expect(svg).not.toContain(`stroke="${WALL_LINE_COLOR}"`)

    expect(buildSvg(squareRoom())).toContain(
      `stroke="${WALL_LINE_COLOR}" stroke-width="${WALL_LINE_WIDTH}"`,
    )
    expect(buildSvg(squareRoom())).toContain(`fill="${DOOR_FILL_COLOR}"`)
  })

  it('omits lights by default and draws glow plus marker with includeLight', () => {
    const model = applyCommand(createEmptyMap(4, 4), {
      kind: 'addLight',
      x: 2,
      y: 2,
      radius: 6,
      color: '#ffd682',
    })

    expect(buildSvg(model)).not.toContain(LIGHT_GLOW_COLOR)

    const svg = buildSvg(model, { includeLight: true })
    expect(svg).toContain(`fill="${LIGHT_GLOW_COLOR}"`)
    expect(svg).toContain(`fill="${LIGHT_MARKER_COLOR}"`)
    const center = cellCenterAt(2, 2, 'square', SVG_UNITS_PER_CELL)
    expect(svg).toContain(`r="${SVG_UNITS_PER_CELL * 6}"`)
    expect(svg).toContain(`cx="${center.x}"`)
  })
})
