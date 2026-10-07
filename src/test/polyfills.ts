/**
 * Browser APIs that jsdom does not implement but Base UI / the app rely on.
 */

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

if (!Element.prototype.getAnimations) {
  Element.prototype.getAnimations = () => []
}

if (!document.getAnimations) {
  document.getAnimations = () => []
}

// Router scroll restoration calls window.scrollTo, which jsdom only stubs with a warning.
window.scrollTo = () => {}
