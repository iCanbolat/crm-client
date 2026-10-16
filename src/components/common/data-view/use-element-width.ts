import { useLayoutEffect, useState, type RefObject } from "react"

/**
 * Content width of an element, kept current with a ResizeObserver. Measuring
 * the element (not the viewport) accounts for the sidebar and page gutters.
 * `0` means unknown (not mounted yet, or jsdom without layout).
 */
export function useElementWidth(ref: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    setWidth(element.getBoundingClientRect().width)
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return width
}
