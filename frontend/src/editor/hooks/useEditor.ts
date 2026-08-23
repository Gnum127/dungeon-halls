import { useSyncExternalStore } from 'react'
import type { EditorStore } from '../store/EditorStore'
import type { MapModel } from '../model/types'

export function useEditor(store: EditorStore): MapModel {
  return useSyncExternalStore(store.subscribe, store.getModel)
}
