export { EditorPage } from './EditorPage'

export { createEmptyMap } from './model/createEmptyMap'
export { applyCommand } from './model/commands'
export type { Command, MapSnapshot, WallUpdate } from './model/commands'
export { MAP_VERSION } from './model/types'
export type { MapGrid, MapModel, MapObject } from './model/types'
export type { TerrainRegion } from './model/regions'
export type { WallSegment, WallExtends } from './model/wallSegments'
export type { Door } from './model/doors'
export { OBJECT_KINDS, isKnownKind } from './model/objects'
export type { ObjectKindId } from './model/objects'

export { EditorStore, HISTORY_LIMIT } from './store/EditorStore'
export { useEditor } from './hooks/useEditor'

export { deserializeMap, MapLoadError, serializeMap } from './model/io'

export type { EditorTool } from './tools/editorTool'
