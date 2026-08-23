export { EditorPage } from './EditorPage'

export { createEmptyMap } from './model/createEmptyMap'
export { applyCommand } from './model/commands'
export type { Command, TileUpdate } from './model/commands'
export { EMPTY_TILE, MAX_MAP_DIMENSION, TILE_TYPES } from './model/types'
export type { MapModel, MapObject, TileGrid, TileValue } from './model/types'
export { OBJECT_KINDS, isKnownKind } from './model/objects'
export type { ObjectKindId } from './model/objects'

export { EditorStore, HISTORY_LIMIT } from './store/EditorStore'
export { useEditor } from './hooks/useEditor'

export { deserializeMap, MapLoadError, serializeMap } from './io'

export { commitStroke, isInsideMap } from './tools/brush'
export type { Cell } from './tools/brush'
export type { EditorTool } from './tools/editorTool'
