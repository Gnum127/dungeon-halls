import { describe, expect, it } from 'vitest'
import {
  CANVAS_BACKGROUND_COLOR,
  HIGHLIGHT_COLOR,
  SNAP_CANDIDATE_COLOR,
  SNAP_NEAREST_COLOR,
  TILE_COLORS,
} from './colors'

const HEX_COLOR = /^#[0-9a-f]{6}$/i

/** Относительная яркость (sRGB, WCAG) — грубая оценка светлоты цвета. */
function relativeLuminance(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16)
  const channels = [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

describe('render colors (светлая тема)', () => {
  it('«Пусто» совпадает с фоном холста: стёртая область читается как чистый лист', () => {
    expect(TILE_COLORS.empty).toBe(CANVAS_BACKGROUND_COLOR)
  })

  it('фон холста светлый — тёмные оверлеи (снап, стены, сетка) остаются читаемыми', () => {
    expect(relativeLuminance(CANVAS_BACKGROUND_COLOR)).toBeGreaterThan(0.8)
  })

  it('ближайшая точка снапа отличается цветом от прочих кандидатов', () => {
    expect(SNAP_NEAREST_COLOR).not.toBe(SNAP_CANDIDATE_COLOR)
  })

  it('палитра рендера — корректные hex-цвета', () => {
    const palette = [CANVAS_BACKGROUND_COLOR, HIGHLIGHT_COLOR, ...Object.values(TILE_COLORS)]
    for (const color of palette) {
      expect(color).toMatch(HEX_COLOR)
    }
  })
})
