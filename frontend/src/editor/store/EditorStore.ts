import { applyCommand } from '../model/commands'
import type { Command } from '../model/commands'
import type { MapModel } from '../model/types'

export const HISTORY_LIMIT = 50

type Listener = () => void

/**
 * Единственный владелец модели карты. React-компоненты читают её через
 * useSyncExternalStore и никогда не держат копию в useState.
 */
export class EditorStore {
  private current: MapModel
  private past: MapModel[] = []
  private future: MapModel[] = []

  private readonly listeners = new Set<Listener>()

  constructor(initial: MapModel) {
    this.current = initial
  }

  getModel = (): MapModel => this.current

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  canUndo = (): boolean => this.past.length > 0

  canRedo = (): boolean => this.future.length > 0

  dispatch = (command: Command): void => {
    const next = applyCommand(this.current, command)
    this.past.push(this.current)
    if (this.past.length > HISTORY_LIMIT) {
      this.past.shift()
    }
    this.future = []
    this.current = next
    this.emit()
  }

  undo = (): boolean => {
    const previous = this.past.pop()
    if (previous === undefined) {
      return false
    }
    this.future.push(this.current)
    this.current = previous
    this.emit()
    return true
  }

  redo = (): boolean => {
    const next = this.future.pop()
    if (next === undefined) {
      return false
    }
    this.past.push(this.current)
    this.current = next
    this.emit()
    return true
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }
}
