// A Style is a full look: color tokens + a heading/body/ui font pairing (family
// names) + reading measure + caret personality. Built-ins are IMMUTABLE — the
// app never mutates these; changing a font forks a custom copy instead.
// Fonts are family names; the theme engine builds the CSS stack and loads any
// non-bundled (Google) family on demand.

export const STYLES = {
  Espresso: {
    dark: true,
    fonts: { heading: 'Raleway', body: 'Source Serif 4', ui: 'Raleway' },
    measure: '46rem', scale: 1,
    tokens: {
      bg: '#17100a', surface: '#21160d', text: '#efe3d2', muted: '#b89b7d',
      accent: '#d4a373', selection: 'rgba(212,163,115,0.28)', caret: '#d4a373', rule: '#3a2a1b'
    }
  },
  Ink: {
    dark: true,
    fonts: { heading: 'Space Grotesk', body: 'Inter', ui: 'Inter' },
    measure: '44rem', scale: 1,
    tokens: {
      bg: '#0b0b0d', surface: '#141417', text: '#f4f4f6', muted: '#9a9aa2',
      accent: '#8ab4ff', selection: 'rgba(138,180,255,0.24)', caret: '#f4f4f6', rule: '#26262b'
    }
  },
  Manuscript: {
    dark: false,
    fonts: { heading: 'Lora', body: 'Source Serif 4', ui: 'Inter' },
    measure: '42rem', scale: 1,
    tokens: {
      bg: '#f5efe4', surface: '#fbf7ef', text: '#2a241c', muted: '#7c7263',
      accent: '#b5651d', selection: 'rgba(181,101,29,0.2)', caret: '#b5651d', rule: '#ddd2bf'
    }
  },
  Lecture: {
    dark: true,
    fonts: { heading: 'Space Grotesk', body: 'Inter', ui: 'Inter' },
    measure: '52rem', scale: 1.15,
    tokens: {
      bg: '#0e131a', surface: '#141b25', text: '#eaf1f8', muted: '#93a4b8',
      accent: '#4bc0d9', selection: 'rgba(75,192,217,0.25)', caret: '#4bc0d9', rule: '#22303f'
    }
  },
  Paper: {
    dark: false,
    fonts: { heading: 'Lora', body: 'Source Serif 4', ui: 'Inter' },
    measure: '46rem', scale: 1,
    tokens: {
      bg: '#ffffff', surface: '#ffffff', text: '#1a1a1a', muted: '#6a6a6a',
      accent: '#444444', selection: 'rgba(0,0,0,0.12)', caret: '#1a1a1a', rule: '#e2e2e2'
    }
  }
}

export const STYLE_NAMES = Object.keys(STYLES)

export function isBuiltin(name) {
  return Object.prototype.hasOwnProperty.call(STYLES, name)
}

// Deep clone a style so a custom copy never shares references with a built-in.
export function cloneStyle(style) {
  return {
    dark: style.dark,
    fonts: { ...style.fonts },
    measure: style.measure,
    scale: style.scale,
    tokens: { ...style.tokens }
  }
}
