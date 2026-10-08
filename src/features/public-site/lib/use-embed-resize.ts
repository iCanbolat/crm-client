import { useEffect, type RefObject } from "react"

import { FORM_EMBED_RESIZE_MESSAGE } from "@/engine/forms"

/**
 * Embedded forms report their height to the host page (B5.4, TC-5.4-05):
 * the embed script resizes its iframe on `crm-form:resize` messages.
 */
export function useEmbedResize(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean
) {
  useEffect(() => {
    const element = ref.current
    if (!enabled || !element || window.parent === window) return

    let last = -1
    const report = () => {
      const height = Math.ceil(element.getBoundingClientRect().height)
      if (height === last) return
      last = height
      window.parent.postMessage(
        { type: FORM_EMBED_RESIZE_MESSAGE, height },
        "*"
      )
    }
    report()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(report)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, enabled])
}
