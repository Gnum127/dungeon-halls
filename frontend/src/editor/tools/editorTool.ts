import type { ObjectKindId } from '../model/objects'
import type { ObjectRotation, ObjectScale, TileTypeName } from '../model/types'

/**
 * Активный инструмент редактора. Выбирается в панелях:
 * клик по тайлу палитры → region-rect, по виду объекта → object,
 * кнопки разделов → wall/door/light/select.
 * Ластик области — region-rect/region-polygon с tileType 'empty'.
 */
export type EditorTool =
  | { readonly type: 'select' }
  | {
      readonly type: 'object'
      readonly kindId: ObjectKindId
      readonly rotation: ObjectRotation
      readonly scale: ObjectScale
    }
  | { readonly type: 'region-rect'; readonly tileType: TileTypeName }
  | {
      readonly type: 'region-polygon'
      readonly tileType: TileTypeName
      readonly vertices: number
    }
  | { readonly type: 'wall' }
  | { readonly type: 'door'; readonly imageId: string | null; readonly openAngle: number }
  | { readonly type: 'stairs' }
  | { readonly type: 'light' }
