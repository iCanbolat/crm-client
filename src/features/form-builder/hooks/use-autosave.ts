import { useCallback, useEffect, useRef, useState } from "react"

import { useUpdateForm } from "../api/forms.mutations"
import type { UpdateFormInput } from "../api/forms.schemas"
import { useBuilderStore, type BuilderDoc } from "../lib/builder-store"

/** Quiet period after the last edit before the draft is saved. */
export const AUTOSAVE_DELAY_MS = 800

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error"

/**
 * Debounced draft autosave (B4.2): edits are sent `AUTOSAVE_DELAY_MS` after
 * the last change, one request at a time, always with the latest state.
 * `flush()` saves right away (navigation) and resolves to `false` on error.
 */
export function useAutosave(formId: string) {
  const store = useBuilderStore()
  const { mutateAsync } = useUpdateForm(formId)
  const [status, setStatus] = useState<SaveStatus>("idle")
  const saved = useRef<BuilderDoc>({
    name: store.getState().name,
    content: store.getState().content,
  })
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const inflight = useRef<Promise<boolean> | null>(null)
  const flushRef = useRef<() => Promise<boolean>>(async () => true)

  const schedule = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void flushRef.current(), AUTOSAVE_DELAY_MS)
  }, [])

  const isDirty = useCallback(() => {
    const { name, content } = store.getState()
    return name !== saved.current.name || content !== saved.current.content
  }, [store])

  const flush = useCallback(async (): Promise<boolean> => {
    clearTimeout(timer.current)
    // One request at a time; a waiting caller re-checks what is left.
    while (inflight.current) await inflight.current
    if (!isDirty()) return true

    const { name, content } = store.getState()
    const input: UpdateFormInput = {}
    if (name !== saved.current.name) input.name = name
    if (content !== saved.current.content) input.content = content

    setStatus("saving")
    const run = mutateAsync(input).then(
      () => {
        saved.current = { name, content }
        setStatus(isDirty() ? "pending" : "saved")
        return true
      },
      () => {
        setStatus("error")
        return false
      }
    )
    inflight.current = run
    const ok = await run
    inflight.current = null
    // Edits made while saving go out with the next debounce.
    if (ok && isDirty()) schedule()
    return ok
  }, [store, mutateAsync, isDirty, schedule])

  useEffect(() => {
    flushRef.current = flush
  }, [flush])

  useEffect(
    () =>
      store.subscribe((state, previous) => {
        if (
          state.name === previous.name &&
          state.content === previous.content
        ) {
          return
        }
        setStatus("pending")
        schedule()
      }),
    [store, schedule]
  )

  useEffect(() => () => clearTimeout(timer.current), [])

  return { status, flush, isDirty }
}
