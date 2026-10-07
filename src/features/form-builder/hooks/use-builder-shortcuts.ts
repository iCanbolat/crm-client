import { useEffect } from "react"

import { useBuilderStore } from "../lib/builder-store"

/** Typing targets keep their own shortcuts (text undo, Backspace, …). */
function isEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    !!target.closest(
      'input, textarea, select, [role="combobox"], [role="textbox"], [role="listbox"], [role="menu"], [role="dialog"], [role="alertdialog"]'
    )
  )
}

/**
 * Builder keyboard shortcuts (B4.2): ⌘/Ctrl+Z undo, ⇧⌘Z / Ctrl+Y redo and —
 * while `fieldShortcuts` is on (build tab) — ⌘/Ctrl+D duplicate, Delete /
 * Backspace remove and Escape deselect the selected field.
 */
export function useBuilderShortcuts({
  fieldShortcuts,
}: {
  fieldShortcuts: boolean
}) {
  const store = useBuilderStore()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || isEditable(event.target)) return
      const mod = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()
      const history = store.temporal.getState()
      const state = store.getState()

      if (mod && key === "z") {
        event.preventDefault()
        if (event.shiftKey) history.redo()
        else history.undo()
        return
      }
      if (mod && key === "y") {
        event.preventDefault()
        history.redo()
        return
      }
      if (!fieldShortcuts || !state.selectedId) return
      if (mod && key === "d") {
        event.preventDefault()
        state.duplicateField(state.selectedId)
      } else if (
        !mod &&
        (event.key === "Delete" || event.key === "Backspace")
      ) {
        event.preventDefault()
        state.removeField(state.selectedId)
      } else if (event.key === "Escape") {
        state.select(null)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [store, fieldShortcuts])
}
