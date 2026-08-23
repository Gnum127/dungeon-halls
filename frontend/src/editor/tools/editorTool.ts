import type { TileValue } from '../model/types'

/**
 * Активный инструмент редактора. Выбирается в панели слева:
 * клик по тайлу палитры → terrain, по виду объекта → object,
 * отдельная кнопка → select.
 */
export type EditorTool =
  | { readonly type: 'terrain'; readonly tile: TileValue }
  | { readonly type: 'object'; readonly kindId: string }
  | { readonly type: 'select' }
