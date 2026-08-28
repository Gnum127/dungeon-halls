import type { ObjectKindId } from '../model/objects'
import type { ObjectRotation, ObjectScale, TileValue } from '../model/types'

/**
 * Активный инструмент редактора. Выбирается в панели слева:
 * клик по тайлу палитры → terrain, по виду объекта → object,
 * отдельная кнопка → select.
 */
export type EditorTool =
  | { readonly type: 'terrain'; readonly tile: TileValue }
  | {
      readonly type: 'object'
      readonly kindId: ObjectKindId
      readonly rotation: ObjectRotation
      readonly scale: ObjectScale
    }
  | { readonly type: 'select' }
  | { readonly type: 'wall' }
  | { readonly type: 'wall-eraser' }
  | { readonly type: 'door' }
  | { readonly type: 'light' }
  | { readonly type: 'room-rect' }
  | { readonly type: 'room-polygon' }
