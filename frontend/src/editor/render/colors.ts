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

/** Цвет поперечных линий-ступеней внутри лестницы (отдельная сущность). */
export const STAIRS_STEP_COLOR = '#2c2519'
/** Цвет контура лестницы (без заливки). */
export const STAIRS_OUTLINE_COLOR = '#6b5a3c'

export const GRID_POINT_COLOR = '#4a4a63'
/** Радиус точки сетки в экранных пикселях (постоянный, не зависит от зума). */
export const GRID_POINT_RADIUS = 1.5
/** Радиус точки сетки в SVG (доля клетки) — для печати. */
export const GRID_POINT_RADIUS_RATIO = 0.04
export const CANVAS_BACKGROUND_COLOR = '#101018'
export const FALLBACK_OBJECT_COLOR = '#888888'
export const OBJECT_OUTLINE_COLOR = '#00000066'
export const HIGHLIGHT_COLOR = '#8b5cf6'
export const WALL_LINE_COLOR = '#1d1a2e'
/** Цвет тела стены (утолщение от осевой линии). */
export const WALL_BODY_COLOR = '#332c4a'
export const DOOR_FILL_COLOR = '#b0762f'
/** Толщина полотна двери в долях клетки. */
export const DOOR_THICKNESS_FRACTION = 0.18
export const LIGHT_GLOW_COLOR = 'rgba(255, 214, 130, 0.28)'
export const LIGHT_MARKER_COLOR = '#ffb340'
