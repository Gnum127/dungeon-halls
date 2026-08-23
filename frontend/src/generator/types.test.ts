import { describe, expect, it } from 'vitest'
import type { CaveParams, DungeonParams, GenerationResult } from './types'

describe('generator types', () => {
  it('dungeon params carry type discriminator and room attempts', () => {
    const params: DungeonParams = {
      type: 'dungeon',
      seed: 42,
      width: 40,
      height: 30,
      roomAttempts: 100,
    }

    expect(params.type).toBe('dungeon')
  })

  it('cave params carry fill probability and iterations', () => {
    const params: CaveParams = {
      type: 'caves',
      seed: 7,
      width: 50,
      height: 50,
      fillProbability: 0.45,
      smoothingIterations: 4,
    }

    expect(params.type).toBe('caves')
  })

  it('generation result holds a tile grid sized to the map', () => {
    const result: GenerationResult = {
      width: 2,
      height: 2,
      tiles: new Uint8Array(4),
    }

    expect(result.tiles.length).toBe(result.width * result.height)
  })
})
