import { describe, expect, it } from 'vitest'
import { buildRegionCommand } from './regionCommit'
import { createEmptyMap } from '../model/createEmptyMap'
import type { Point } from '@/shared/point'

const square: Point[] = [
  { x: 1, y: 1 },
  { x: 4, y: 1 },
  { x: 4, y: 4 },
  { x: 1, y: 4 },
]

describe('buildRegionCommand', () => {
  it('uses a plain addRegion when auto walls are disabled', () => {
    const command = buildRegionCommand(createEmptyMap(10, 10), 'floor', square, false)
    expect(command.kind).toBe('addRegion')
  })

  it('collects the contour walls when auto walls are enabled', () => {
    const command = buildRegionCommand(createEmptyMap(10, 10), 'floor', square, true)
    expect(command.kind).toBe('addRegionWithWalls')
    if (command.kind === 'addRegionWithWalls') {
      expect(command.region.tileType).toBe('floor')
      // One closed contour → a single wall segment whose ends coincide.
      expect(command.walls).toHaveLength(1)
      const [wall] = command.walls
      expect(wall.points[0]).toEqual(wall.points[wall.points.length - 1])
    }
  })

  it('accepts an empty (eraser) region but derives no walls from it', () => {
    const command = buildRegionCommand(createEmptyMap(10, 10), 'empty', square, true)
    expect(command.kind).toBe('addRegionWithWalls')
    if (command.kind === 'addRegionWithWalls') {
      expect(command.region.tileType).toBe('empty')
      expect(command.walls).toEqual([])
    }
  })
})
