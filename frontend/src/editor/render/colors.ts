import type { TileTypeName } from '../model/types'

/** Цвета плиток рендера без спрайтов; палитра UI — в src/index.css. */
export const TILE_COLORS: Record<TileTypeName, string> = {
  // «Пусто» совпадает с фоном холста: стёртая область читается как чистый лист.
  empty: '#ffffff',
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
export const CANVAS_BACKGROUND_COLOR = '#ffffff'
export const FALLBACK_OBJECT_COLOR = '#888888'
export const OBJECT_OUTLINE_COLOR = '#00000066'
export const HIGHLIGHT_COLOR = '#6c47c8'
/** Цвет точек-кандидатов привязки при наведении. */
export const SNAP_CANDIDATE_COLOR = '#7d7da3'
/** Радиус точки-кандидата в экранных пикселях. */
export const SNAP_CANDIDATE_RADIUS = 2
/** Цвет ближайшей к курсору точки-кандидата (контрастная подсветка). */
export const SNAP_NEAREST_COLOR = '#1a1a2e'
/** Радиус ближайшей точки-кандидата в экранных пикселях. */
export const SNAP_NEAREST_RADIUS = 3.5
export const WALL_LINE_COLOR = '#1d1a2e'
/** Цвет тела стены (утолщение от осевой линии). */
export const WALL_BODY_COLOR = '#332c4a'
export const DOOR_FILL_COLOR = '#b0762f'
/** Толщина полотна двери в долях клетки. */
export const DOOR_THICKNESS_FRACTION = 0.18
export const LIGHT_GLOW_COLOR = 'rgba(255, 214, 130, 0.28)'
export const LIGHT_MARKER_COLOR = '#ffb340'
