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
    expect(normalizeSeed(Number.NaN)).toBe(normalizeSeed(0))
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

  it('covers all buckets without heavy bias (smoke)', () => {
    const rng = createRng(11)
    const buckets = [0, 0, 0]
    for (let i = 0; i < 3000; i += 1) buckets[rng.nextInt(3)]! += 1

    // Без rejection sampling перекос доходил бы до ~25%; здесь его нет.
    for (const count of buckets) expect(count).toBeGreaterThan(700)
  })

  it.each([0, -1, 2.5, Number.NaN])('rejects invalid maxExclusive %s', (bad) => {
    const rng = createRng(1)
    expect(() => rng.nextInt(bad)).toThrow(RangeError)
  })

  it('rejects maxExclusive above the uint32 domain instead of hanging', () => {
    const rng = createRng(1)
    expect(() => rng.nextInt(0x100000000 + 1)).toThrow(RangeError)
    // Верхняя граница домена допустима и завершается.
    expect(rng.nextInt(0x100000000)).toBeGreaterThanOrEqual(0)
  })
})
