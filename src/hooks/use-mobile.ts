import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener("change", onChange)
  // `resize` also covers environments whose matchMedia never fires (jsdom).
  window.addEventListener("resize", onChange)
  return () => {
    mql.removeEventListener("change", onChange)
    window.removeEventListener("resize", onChange)
  }
}

const getSnapshot = () => window.innerWidth < MOBILE_BREAKPOINT

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, () => false)
}
