/**
 * Детерминированный PRNG mulberry32: одинаковый seed даёт одинаковую
 * последовательность на любой платформе (только целочисленная математика).
 */

export interface Rng {
  /** Равномерное [0, 1). */
  next(): number
  /**
   * Целое [0, maxExclusive) без modulo bias (rejection sampling).
   * Гарантированно завершается; ожидаемо тратится <2 вызова генератора.
   * Домен: целые [1, 2^32].
   */
  nextInt(maxExclusive: number): number
}

/** Перемешивание seed к uint32: близкие сиды дают далёкие последовательности. */
export function normalizeSeed(seed: number): number {
  // |0 усекает дробные и приводит NaN/±Infinity к 0 — коллизия с сидом 0
  // допустима и задокументирована.
  let value = seed | 0
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
  return (value ^ (value >>> 16)) >>> 0
}

const UINT32_RANGE = 0x100000000

export function createRng(seedInput: number): Rng {
  let state = normalizeSeed(seedInput)

  const nextUint32 = (): number => {
    state = (state + 0x6d2b79f5) | 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return (t ^ (t >>> 14)) >>> 0
  }

  const nextInt = (maxExclusive: number): number => {
    if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > UINT32_RANGE) {
      throw new RangeError(
        `nextInt expects an integer in [1, ${UINT32_RANGE}], got ${maxExclusive}`,
      )
    }
    // Отбрасываем значения верхней неполной полосы диапазона — иначе
    // младшие числа получали бы повышенную вероятность.
    const limit = UINT32_RANGE - (UINT32_RANGE % maxExclusive)
    let value = nextUint32()
    while (value >= limit) {
      value = nextUint32()
    }
    return value % maxExclusive
  }

  return { next: () => nextUint32() / UINT32_RANGE, nextInt }
}
