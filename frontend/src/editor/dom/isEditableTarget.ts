const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/** true, если событие пришло из поля ввода — хоткеи там не действуют. */
export function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement && (EDITABLE_TAGS.has(target.tagName) || target.isContentEditable)
  )
}
