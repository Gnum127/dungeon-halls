import type { ObjectKindId } from '../model/objects'
import type { ObjectRotation, ObjectScale, TileTypeName } from '../model/types'

/**
 * Активный инструмент редактора. Выбирается на нижней панели (курсор,
 * перетаскивание, фигуры, дверь) и в палитре объектов.
 * «Ластик» — региональные инструменты с `tileType: 'empty'`.
 * `wall`/`light` сохранены, но их UI убран (этапы 21/24): значения достижимы
 * только из кода/будущих этапов.
 */
export type EditorTool =
  | { readonly type: 'cursor' }
  | { readonly type: 'pan' }
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
