/**
 * Global setup for the application level test suite (jsdom).
 */
import '@testing-library/jest-dom/vitest'

// jsdom does not implement `scrollIntoView`, which the messaging thread and
// the document viewer call on a scroll container.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {
    /* no-op in the test environment */
  }
}

// jsdom does not implement `matchMedia`, which the theme hook consults.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}
