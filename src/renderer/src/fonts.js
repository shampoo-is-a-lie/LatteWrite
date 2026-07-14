// Font helpers. Built-in styles use bundled families (loaded at startup); any
// other family is a Google font, fetched+cached by the main process and injected
// as an @font-face <style> on demand.

const BUNDLED = new Set([
  'Inter', 'Space Grotesk', 'Lora', 'Source Serif 4', 'Raleway', 'JetBrains Mono',
  // Bundled bitmap/system fonts for the "Systems" styles (see retro-fonts.css).
  'ChicagoFLF', 'C64 Pro Mono', 'PxPlus IBM VGA8', 'BigBlue Terminal'
])

const SERIF = /serif|slab|lora|garamond|caslon|baskerville|playfair|spectral|newsreader|fraunces|cormorant|bitter|domine|vollkorn|arvo|cardo|neuton|gelasio|marcellus|cinzel|petrona|piazzolla|literata|merriweather|bodoni|alegreya|crimson|noto serif|pt serif|source serif|ibm plex serif|dm serif|libre|frank ruhl|philosopher/i
const MONO = /mono|code|consol|terminal|vga|bigblue|pxplus|c64/i

export function fallback(family) {
  if (MONO.test(family)) return 'monospace'
  if (SERIF.test(family)) return 'serif'
  return 'sans-serif'
}

export function fontStack(family) {
  return `'${family}', ${fallback(family)}`
}

export function isBundled(family) {
  return BUNDLED.has(family)
}

// Ensure a family's @font-face is present in the document (no-op for bundled).
export async function ensureFontLoaded(family) {
  if (!family || BUNDLED.has(family)) return
  try {
    const css = await window.api.fonts.load(family)
    const id = 'gf-' + family.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    let el = document.getElementById(id)
    if (!el) { el = document.createElement('style'); el.id = id; document.head.appendChild(el) }
    el.textContent = css
  } catch { /* invalid/offline family — falls back to the generic stack */ }
}
