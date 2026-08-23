import type { TileGrid } from '@/shared/tiles'

interface BaseGenerationParams {
  /** Сырой seed; нормализацию к uint32 выполняет PRNG (пункт 2.3). */
  readonly seed: number
  readonly width: number
  readonly height: number
}

export interface DungeonParams extends BaseGenerationParams {
  readonly type: 'dungeon'
  /** Сколько позиций попробовать, прежде чем сдаться с текущим числом комнат. */
  readonly roomAttempts: number
}

export interface CaveParams extends BaseGenerationParams {
  readonly type: 'caves'
  /** Доля стен в стартовом шуме [0..1]. */
  readonly fillProbability: number
  /** Типичные значения 3–5: меньше — зернистые пещеры, больше — крупные и гладкие. */
  readonly smoothingIterations: number
}

export type GenerationParams = DungeonParams | CaveParams

/** Результат генерации: сетка тайлов без объектов. */
export interface GenerationResult {
  readonly width: number
  readonly height: number
  readonly tiles: TileGrid
}
