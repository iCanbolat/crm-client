import { KeyboardCode, type KeyboardCoordinateGetter } from "@dnd-kit/core"

/** Offset of a card inside the target column (below the header). */
const COLUMN_HEADER_OFFSET = 64

/**
 * Keyboard dragging on a board: ←/→ jump to the previous/next column
 * instead of nudging the card by a few pixels (dnd-kit's default).
 */
export const columnCoordinateGetter: KeyboardCoordinateGetter = (
  event,
  { context: { collisionRect, droppableRects, droppableContainers } }
) => {
  const direction =
    event.code === KeyboardCode.Right
      ? 1
      : event.code === KeyboardCode.Left
        ? -1
        : 0
  if (!direction || !collisionRect) return undefined
  event.preventDefault()

  const center = collisionRect.left + collisionRect.width / 2
  const columns = droppableContainers
    .getEnabled()
    .flatMap((container) => {
      const rect = droppableRects.get(container.id)
      return rect ? [rect] : []
    })
    .sort((a, b) => a.left - b.left)

  const target =
    direction > 0
      ? columns.find((rect) => rect.left > center)
      : [...columns].reverse().find((rect) => rect.left + rect.width < center)
  if (!target) return undefined

  return {
    x: target.left + (target.width - collisionRect.width) / 2,
    y: target.top + COLUMN_HEADER_OFFSET,
  }
}
