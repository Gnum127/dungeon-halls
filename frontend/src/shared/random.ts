/**
 * Детерминированный хеш целочисленных координат — для псевдослучайного выбора
 * варианта текстуры при тайлинге региона (тот же регион всегда рендерится
 * одинаково, без хранения выбора в модели).
 */
export function hashFromCoords(x: number, y: number): number {
  let hash =
    (Math.imul(Math.trunc(x) | 0, 0x27d4eb2d) ^ Math.imul(Math.trunc(y) | 0, 0x165667b1)) >>> 0
  hash = Math.imul(hash ^ (hash >>> 15), 0x2c1b3c6d) >>> 0
  hash = (hash ^ (hash >>> 12)) >>> 0
  return hash >>> 0
}

/** Индекс варианта текстуры для координаты в пуле заданного размера. */
export function pickIndexFromCoords(x: number, y: number, poolSize: number): number {
  if (!Number.isInteger(poolSize) || poolSize <= 0) {
    throw new RangeError(`Texture pool size must be a positive integer, got ${String(poolSize)}`)
  }
  return hashFromCoords(x, y) % poolSize
}
