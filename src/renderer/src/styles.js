// A Style is a full look: color tokens + a Google-Fonts heading/body pairing +
// reading measure + caret personality. The theming engine applies it as CSS
// variables, so any Style can be forked into a custom one later.

const RALEWAY = "'Raleway', sans-serif"
const INTER = "'Inter', sans-serif"
const GROTESK = "'Space Grotesk', sans-serif"
const LORA = "'Lora', serif"
const SOURCE_SERIF = "'Source Serif 4', Georgia, serif"

export const STYLES = {
  Espresso: {
    dark: true,
    fonts: { heading: RALEWAY, body: SOURCE_SERIF, ui: RALEWAY },
    measure: '46rem', scale: 1,
    tokens: {
      bg: '#17100a', surface: '#21160d', text: '#efe3d2', muted: '#b89b7d',
      accent: '#d4a373', selection: 'rgba(212,163,115,0.28)', caret: '#d4a373', rule: '#3a2a1b'
    }
  },
  Ink: {
    dark: true,
    fonts: { heading: GROTESK, body: INTER, ui: INTER },
    measure: '44rem', scale: 1,
    tokens: {
      bg: '#0b0b0d', surface: '#141417', text: '#f4f4f6', muted: '#9a9aa2',
      accent: '#8ab4ff', selection: 'rgba(138,180,255,0.24)', caret: '#f4f4f6', rule: '#26262b'
    }
  },
  Manuscript: {
    dark: false,
    fonts: { heading: LORA, body: SOURCE_SERIF, ui: INTER },
    measure: '42rem', scale: 1,
    tokens: {
      bg: '#f5efe4', surface: '#fbf7ef', text: '#2a241c', muted: '#7c7263',
      accent: '#b5651d', selection: 'rgba(181,101,29,0.2)', caret: '#b5651d', rule: '#ddd2bf'
    }
  },
  Lecture: {
    dark: true,
    fonts: { heading: GROTESK, body: INTER, ui: INTER },
    measure: '52rem', scale: 1.15,
    tokens: {
      bg: '#0e131a', surface: '#141b25', text: '#eaf1f8', muted: '#93a4b8',
      accent: '#4bc0d9', selection: 'rgba(75,192,217,0.25)', caret: '#4bc0d9', rule: '#22303f'
    }
  },
  Paper: {
    dark: false,
    fonts: { heading: LORA, body: SOURCE_SERIF, ui: INTER },
    measure: '46rem', scale: 1,
    tokens: {
      bg: '#ffffff', surface: '#ffffff', text: '#1a1a1a', muted: '#6a6a6a',
      accent: '#444444', selection: 'rgba(0,0,0,0.12)', caret: '#1a1a1a', rule: '#e2e2e2'
    }
  }
}

export const STYLE_NAMES = Object.keys(STYLES)
