/**
 * Габариты и лимиты карты. Вынесены в отдельный модуль, чтобы автор мог
 * быстро менять дефолтные размеры без правок по коду.
 *
 * DEV-NOTE: до стадии 14.2 (переключение MapModel на v5) действующий лимит
 * сетки — `MAX_MAP_DIMENSION` (300) из `shared/tiles.ts`. `MAX_MAP_SIZE`
 * (1000) станет источником правды после удаления клеточной модели; сейчас
 * значения сосуществуют намеренно и не применяются согласованно.
 */
export const DEFAULT_MAP_WIDTH = 200

export const DEFAULT_MAP_HEIGHT = 200

/** Верхняя граница любого измерения карты (клеток). */
export const MAX_MAP_SIZE = 1000

/** Размер клетки в пикселях при рендере/экспорте. */
export const DEFAULT_CELL_SIZE = 64

export function isMapDimension(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= MAX_MAP_SIZE
}
