import type { TileTypeName } from '../model/types'

/** Цвета плиток рендера без спрайтов; палитра UI — в src/index.css. */
export const TILE_COLORS: Record<TileTypeName, string> = {
  empty: '#14141f',
  floor: '#8a7f66',
  grass: '#3f6d3a',
  water: '#2f5f8a',
  stone: '#6e6e78',
  sand: '#c9b476',
  wall: '#3c3550',
}

export const GRID_LINE_COLOR = '#00000033'
export const CANVAS_BACKGROUND_COLOR = '#101018'
export const FALLBACK_OBJECT_COLOR = '#888888'
export const OBJECT_OUTLINE_COLOR = '#00000066'
export const HIGHLIGHT_COLOR = '#8b5cf6'
export const EDGE_HIGHLIGHT_COLOR = '#f0a63c'
export const WALL_LINE_COLOR = '#1d1a2e'
export const DOOR_FILL_COLOR = '#b0762f'
