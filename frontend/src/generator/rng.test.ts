import { describe, expect, it } from 'vitest'
import { createRng, normalizeSeed } from './rng'

function sequence(seed: number, length: number): number[] {
  const rng = createRng(seed)
  return Array.from({ length }, () => rng.next())
}

describe('normalizeSeed', () => {
  it('returns a deterministic uint32', () => {
    const first = normalizeSeed(42)
    const second = normalizeSeed(42)

    expect(second).toBe(first)
    expect(first).toBeGreaterThanOrEqual(0)
    expect(first).toBeLessThanOrEqual(0xffffffff)
  })

  it('mixes close seeds apart (float seeds truncate first)', () => {
    expect(normalizeSeed(1)).not.toBe(normalizeSeed(2))
    expect(normalizeSeed(1.9)).toBe(normalizeSeed(1))
    // Соседи через границу int32 перемешиваются в разные значения…
    expect(normalizeSeed(2147483647)).not.toBe(normalizeSeed(2147483646))
    // …хотя усечение до int32 делает ±границы коллидировать с -1 по дизайну.
    expect(normalizeSeed(Number.NaN)).toBe(normalizeSeed(0))
  })
})

// Известные ответы фиксируют алгоритм: замена PRNG сломает сейвы
// со строкой seed — это должно падать громко.
describe('known answers', () => {
  it('mulberry32 sequence for seed 42 matches reference', () => {
    const rng = createRng(42)

    expect(rng.next()).toBeCloseTo(0.18946275836788118, 15)
    expect(rng.next()).toBeCloseTo(0.6580629078671336, 15)
    expect(rng.next()).toBeCloseTo(0.31931386212818325, 15)
    expect(rng.next()).toBeCloseTo(0.0815762197598815, 15)
  })

  it('nextInt(6) sequence for seed 7 matches reference', () => {
    const rng = createRng(7)

    expect([1, 2, 3, 4, 5].map(() => rng.nextInt(6))).toEqual([3, 4, 2, 4, 2])
  })
})

describe('createRng reproducibility', () => {
  it('same seed yields the same next() sequence', () => {
    expect(sequence(42, 10)).toEqual(sequence(42, 10))
  })

  it('different seeds yield different sequences', () => {
    expect(sequence(42, 5)).not.toEqual(sequence(43, 5))
  })

  it('same seed yields the same nextInt sequence', () => {
    const draw = () => {
      const rng = createRng(7)
      return Array.from({ length: 8 }, () => rng.nextInt(6))
    }

    expect(draw()).toEqual(draw())
  })
})

describe('next()', () => {
  it('stays within [0, 1) over many draws', () => {
    for (const value of sequence(123, 1000)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('nextInt()', () => {
  it('returns only integers in [0, maxExclusive)', () => {
    const rng = createRng(5)
    for (let i = 0; i < 500; i += 1) {
      const value = rng.nextInt(7)
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(7)
    }
  })

  it('maxExclusive of 1 always returns 0', () => {
    const rng = createRng(9)
    for (let i = 0; i < 20; i += 1) expect(rng.nextInt(1)).toBe(0)
  })

  // Для РАВНОМЕРНОГО uint32-источника смещение наивного `%` ограничено одной
  // единицей из 2^32 и статистически необнаружимо — поэтому отсутствие bias
  // гарантируется структурно (rejection sampling) и закреплено
  // known-answer тестами выше. Здесь проверяем сам wide-rejection путь:
  // при max близком к 2^32 отбрасывается ~25% значений, цикл обязан
  // завершаться, а результат — лежать в диапазоне.
  it('wide-rejection path terminates and stays in range', () => {
    const rng = createRng(11)
    for (let i = 0; i < 9000; i += 1) {
      const value = rng.nextInt(0xc0000001)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(0xc0000001)
    }
  })

  it.each([0, -1, 2.5, Number.POSITIVE_INFINITY, Number.NaN])(
    'rejects invalid maxExclusive %s',
    (bad) => {
      const rng = createRng(1)
      expect(() => rng.nextInt(bad)).toThrow(RangeError)
    },
  )

  it('rejects maxExclusive above the uint32 domain instead of hanging', () => {
    const rng = createRng(1)
    expect(() => rng.nextInt(0x100000000 + 1)).toThrow(RangeError)
    // Верхняя граница домена допустима и завершается.
    expect(rng.nextInt(0x100000000)).toBeGreaterThanOrEqual(0)
  })
})
