import { useSyncExternalStore } from "react"

function subscribe(onChange: () => void) {
  window.addEventListener("resize", onChange)
  return () => window.removeEventListener("resize", onChange)
}

/** Window is at least `minWidth` px wide (re-renders on resize). */
export function useMinWidth(minWidth: number) {
  return useSyncExternalStore(
    subscribe,
    () => window.innerWidth >= minWidth,
    () => true
  )
}

/**
 * Builder panels docked next to the canvas (B4.2); otherwise they open in
 * sheets. The app sidebar takes ~16rem, hence the generous breakpoints.
 */
export function useBuilderLayout() {
  return {
    dockPalette: useMinWidth(1440),
    dockProperties: useMinWidth(1024),
  }
}
