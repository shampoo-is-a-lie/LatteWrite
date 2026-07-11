// Text and highlight colours are stored as a hue+saturation and take their
// lightness from the theme (CSS vars --fg-l / --hl-l), so a colour stays legible
// when the Style flips between light and dark: e.g. a purple highlight is dark in
// a dark Style and light in a light one, and coloured text does the opposite.

// Seed palettes shown in the pickers before the user saves their own.
export const DEFAULT_TEXT_COLORS = [
  '#e0524d', '#e0803c', '#d9a83f', '#5aa84a', '#33a3a0', '#3b82f6', '#6366f1', '#9b5de5', '#e05a8a'
]
export const DEFAULT_HL_COLORS = [
  '#e0524d', '#e0803c', '#d9a83f', '#5aa84a', '#33a3a0', '#3b82f6', '#6366f1', '#9b5de5', '#e05a8a'
]

// Hex → { h: 0-360, s: 0-100 }, discarding the picked lightness.
export function hexToHS(hex) {
  const h = hex.replace('#', '')
  const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const r = parseInt(n.slice(0, 2), 16) / 255
  const g = parseInt(n.slice(2, 4), 16) / 255
  const b = parseInt(n.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const d = max - min
  const l = (max + min) / 2
  let hue = 0, sat = 0
  if (d) {
    sat = d / (1 - Math.abs(2 * l - 1))
    if (max === r) hue = ((g - b) / d) % 6
    else if (max === g) hue = (b - r) / d + 2
    else hue = (r - g) / d + 4
    hue *= 60
    if (hue < 0) hue += 360
  }
  return { h: Math.round(hue), s: Math.round(sat * 100) }
}

// A CSS colour whose lightness is driven by the theme. `kind` is 'text' or 'highlight'.
export function adaptiveColor(hex, kind) {
  const { h, s } = hexToHS(hex)
  const lvar = kind === 'highlight' ? 'var(--hl-l)' : 'var(--fg-l)'
  return `hsl(${h} ${Math.max(s, 12)}% ${lvar})`
}
