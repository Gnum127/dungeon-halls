import type { ObjectKindId } from '../model/objects'
import type { TileValue } from '../model/types'

/**
 * Активный инструмент редактора. Выбирается в панели слева:
 * клик по тайлу палитры → terrain, по виду объекта → object,
 * отдельная кнопка → select.
 */
export type EditorTool =
  | { readonly type: 'terrain'; readonly tile: TileValue }
  | { readonly type: 'object'; readonly kindId: ObjectKindId }
  | { readonly type: 'select' }
  | { readonly type: 'wall' }
  | { readonly type: 'wall-eraser' }
  | { readonly type: 'door' }
  | { readonly type: 'light' }
