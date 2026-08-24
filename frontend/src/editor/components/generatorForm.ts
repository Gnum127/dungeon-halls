import type { GenerationParams } from '@/generator'

export interface GeneratorFormState {
  genType: 'dungeon' | 'caves'
  seed: string
  width: string
  height: string
  roomAttempts: string
  fillProbability: string
  smoothingIterations: string
}

export const DEFAULT_GENERATOR_FORM: GeneratorFormState = {
  genType: 'dungeon',
  seed: '42',
  width: '40',
  height: '30',
  roomAttempts: '150',
  fillProbability: '0.45',
  smoothingIterations: '4',
}

/** Целое или null — без исключений, валидность решает кнопка. */
function parseIntStrict(value: string): number | null {
  if (!/^-?\d+$/.test(value.trim())) return null
  return Number(value)
}

function parseFloatStrict(value: string): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Зеркалит контракты генераторов (минимальные размеры данжа/пещер,
 * диапазоны параметров), чтобы кнопка блокировалась до dispatch.
 * Авторитетная валидация остаётся в самих генераторах.
 */
export function parseGeneratorForm(state: GeneratorFormState): GenerationParams | null {
  const seed = parseIntStrict(state.seed)
  const width = parseIntStrict(state.width)
  const height = parseIntStrict(state.height)

  const dimsValid =
    width !== null && height !== null && width >= 6 && width <= 300 && height >= 6 && height <= 300
  if (seed === null || !dimsValid) return null

  if (state.genType === 'caves') {
    const fill = parseFloatStrict(state.fillProbability)
    const iterations = parseIntStrict(state.smoothingIterations)
    if (
      fill === null ||
      fill < 0 ||
      fill > 1 ||
      iterations === null ||
      iterations < 0 ||
      iterations > 20
    ) {
      return null
    }
    return {
      type: 'caves',
      seed,
      width,
      height,
      fillProbability: fill,
      smoothingIterations: iterations,
    }
  }

  const roomAttempts = parseIntStrict(state.roomAttempts)
  if (roomAttempts === null || roomAttempts < 1 || roomAttempts > 10000) return null

  return { type: 'dungeon', seed, width, height, roomAttempts }
}
