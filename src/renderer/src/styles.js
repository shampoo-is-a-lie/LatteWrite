// A Style is a full look: color tokens + a heading/body/ui font pairing (family
// names) + reading measure + caret personality. Built-ins are IMMUTABLE — the
// app never mutates these; changing a font forks a custom copy instead.
// Fonts are family names; the theme engine builds the CSS stack and loads any
// non-bundled (Google) family on demand.

export const STYLES = {
  // ── Coffee ────────────────────────────────────────────────────────────────
  Espresso: {
    dark: true,
    fonts: { heading: 'Raleway', body: 'Source Serif 4', ui: 'Raleway' },
    measure: '46rem', scale: 1,
    tokens: {
      bg: '#17100a', surface: '#21160d', text: '#efe3d2', muted: '#b89b7d',
      accent: '#d4a373', selection: 'rgba(212,163,115,0.28)', caret: '#d4a373', rule: '#3a2a1b'
    }
  },
  Poppins: {
    dark: true,
    fonts: { heading: 'Poppins', body: 'Poppins', ui: 'Raleway' },
    measure: '52rem', scale: 1,
    tokens: {
      bg: '#17100a', surface: '#2e2014', text: '#efe3d2', muted: '#fbdab7',
      accent: '#ffc48a', selection: 'rgba(255,196,138,0.28)', caret: '#d4a373', rule: '#3a2a1b'
    }
  },
  Unbounded: {
    dark: true,
    fonts: { heading: 'Unbounded', body: 'Unbounded', ui: 'Raleway' },
    measure: '52rem', scale: 1,
    tokens: {
      bg: '#17100a', surface: '#21160d', text: '#efe3d2', muted: '#b89b7d',
      accent: '#d4a373', selection: 'rgba(212,163,115,0.28)', caret: '#d4a373', rule: '#3a2a1b'
    }
  },
  'Unbounded Light': {
    dark: false,
    fonts: { heading: 'Unbounded', body: 'Unbounded', ui: 'Raleway' },
    measure: '46rem', scale: 1,
    tokens: {
      bg: '#ffefe0', surface: '#ffdbbd', text: '#613900', muted: '#8f4a00',
      accent: '#d4a373', selection: 'rgba(212,163,115,0.28)', caret: '#ff8000', rule: '#3a2a1b'
    }
  },

  // ── Editorial ─────────────────────────────────────────────────────────────
  Ink: {
    dark: true,
    fonts: { heading: 'Space Grotesk', body: 'Inter', ui: 'Inter' },
    measure: '44rem', scale: 1,
    tokens: {
      bg: '#0b0b0d', surface: '#141417', text: '#f4f4f6', muted: '#9a9aa2',
      accent: '#8ab4ff', selection: 'rgba(138,180,255,0.24)', caret: '#f4f4f6', rule: '#26262b'
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
  Lora: {
    dark: false,
    fonts: { heading: 'Lora', body: 'Lora', ui: 'Inter' },
    measure: '42rem', scale: 1,
    tokens: {
      bg: '#f5efe4', surface: '#fbf7ef', text: '#2a241c', muted: '#7c7263',
      accent: '#b5651d', selection: 'rgba(181,101,29,0.2)', caret: '#b5651d', rule: '#ddd2bf'
    }
  },
  Caslon: {
    dark: false,
    fonts: { heading: 'Libre Caslon Text', body: 'Libre Caslon Text', ui: 'Inter' },
    measure: '42rem', scale: 1,
    tokens: {
      bg: '#f5efe4', surface: '#fbf7ef', text: '#2a241c', muted: '#7c7263',
      accent: '#b5651d', selection: 'rgba(181,101,29,0.2)', caret: '#b5651d', rule: '#ddd2bf'
    }
  },

  // ── Lecture ───────────────────────────────────────────────────────────────
  Lecture: {
    dark: true,
    fonts: { heading: 'Space Grotesk', body: 'Inter', ui: 'Inter' },
    measure: '52rem', scale: 1.15,
    tokens: {
      bg: '#0e131a', surface: '#141b25', text: '#eaf1f8', muted: '#93a4b8',
      accent: '#4bc0d9', selection: 'rgba(75,192,217,0.25)', caret: '#4bc0d9', rule: '#22303f'
    }
  },
  'Poppins Dark Blue': {
    dark: true,
    fonts: { heading: 'Poppins', body: 'Poppins', ui: 'Inter' },
    measure: '52rem', scale: 1.15,
    tokens: {
      bg: '#0e131a', surface: '#141b25', text: '#eaf1f8', muted: '#93a4b8',
      accent: '#4bc0d9', selection: 'rgba(75,192,217,0.28)', caret: '#4bc0d9', rule: '#22303f'
    }
  },
  'Unbounded Dark Blue': {
    dark: true,
    fonts: { heading: 'Unbounded', body: 'Unbounded', ui: 'Inter' },
    measure: '52rem', scale: 1.15,
    tokens: {
      bg: '#0e131a', surface: '#141b25', text: '#eaf1f8', muted: '#93a4b8',
      accent: '#4bc0d9', selection: 'rgba(75,192,217,0.28)', caret: '#4bc0d9', rule: '#22303f'
    }
  },

  // ── Typewriter ────────────────────────────────────────────────────────────
  'Special Elite': {
    dark: false,
    fonts: { heading: 'Special Elite', body: 'Special Elite', ui: 'Inter' },
    measure: '60rem', scale: 1,
    tokens: {
      bg: '#f5efe4', surface: '#fbf7ef', text: '#2a241c', muted: '#7c7263',
      accent: '#b5651d', selection: 'rgba(181,101,29,0.2)', caret: '#b5651d', rule: '#ddd2bf'
    }
  },
  'Special Elite Dark': {
    dark: true,
    fonts: { heading: 'Special Elite', body: 'Special Elite', ui: 'Inter' },
    measure: '60rem', scale: 1,
    tokens: {
      bg: '#30302c', surface: '#373634', text: '#fdffdb', muted: '#cfd2a7',
      accent: '#a1a87a', selection: 'rgba(161,168,122,0.28)', caret: '#ffffff', rule: '#ddd2bf'
    }
  },

  // ── Retro ─────────────────────────────────────────────────────────────────
  'Press Start 2P': {
    dark: true,
    fonts: { heading: 'Press Start 2P', body: 'Press Start 2P', ui: 'Inter' },
    measure: '52rem', scale: 1.15,
    tokens: {
      bg: '#0e131a', surface: '#141b25', text: '#eaf1f8', muted: '#93a4b8',
      accent: '#4bc0d9', selection: 'rgba(75,192,217,0.25)', caret: '#4bc0d9', rule: '#22303f'
    }
  },
  'GAMEBOY DMG': {
    dark: false,
    fonts: { heading: 'Press Start 2P', body: 'Press Start 2P', ui: 'Inter' },
    measure: '52rem', scale: 1.15,
    tokens: {
      bg: '#7e8b5b', surface: '#b8b8b8', text: '#24301c', muted: '#610022',
      accent: '#003d5c', selection: 'rgba(0,61,92,0.28)', caret: '#054d1e', rule: '#223f32'
    }
  },
  'Terminal Green': {
    dark: true,
    fonts: { heading: 'Bungee', body: 'Sixtyfour', ui: 'Inter' },
    measure: '52rem', scale: 1.15,
    tokens: {
      bg: '#111e10', surface: '#13251b', text: '#77ff5c', muted: '#97b893',
      accent: '#83d94a', selection: 'rgba(131,217,74,0.28)', caret: '#4ad94c', rule: '#273f22'
    }
  },
  'Terminal Orange': {
    dark: true,
    fonts: { heading: 'Faster One', body: 'Sixtyfour', ui: 'Inter' },
    measure: '52rem', scale: 1.15,
    tokens: {
      bg: '#1e1810', surface: '#251d13', text: '#ffbb5c', muted: '#b8a993',
      accent: '#d99d4a', selection: 'rgba(217,157,74,0.28)', caret: '#d9a44a', rule: '#3f3022'
    }
  },

  // ── Playful ───────────────────────────────────────────────────────────────
  Lucy: {
    dark: true,
    fonts: { heading: 'Fredoka', body: 'Indie Flower', ui: 'Inter' },
    measure: '52rem', scale: 1.15,
    tokens: {
      bg: '#1e101c', surface: '#241325', text: '#f7e8f7', muted: '#b693b8',
      accent: '#d94a88', selection: 'rgba(217,74,136,0.28)', caret: '#d94aba', rule: '#3d223f'
    }
  },
  'Lucy Light': {
    dark: false,
    fonts: { heading: 'Fredoka', body: 'Indie Flower', ui: 'Inter' },
    measure: '52rem', scale: 1.15,
    tokens: {
      bg: '#ffe0fa', surface: '#fcc2ff', text: '#4d004d', muted: '#6f0075',
      accent: '#d94a88', selection: 'rgba(217,74,136,0.28)', caret: '#ff00c8', rule: '#3d223f'
    }
  },
  'Poppins Candy Light': {
    dark: false,
    fonts: { heading: 'Poppins', body: 'Poppins', ui: 'Inter' },
    measure: '52rem', scale: 1,
    tokens: {
      bg: '#ebebeb', surface: '#d7fbfe', text: '#33000f', muted: '#7a0025',
      accent: '#c7006a', selection: 'rgba(199,0,106,0.28)', caret: '#1a1a1a', rule: '#e2e2e2'
    }
  },
  Orange: {
    dark: false,
    fonts: { heading: 'Righteous', body: 'Outfit', ui: 'Inter' },
    measure: '42rem', scale: 1,
    tokens: {
      bg: '#f5efe4', surface: '#fb983c', text: '#2a241c', muted: '#573400',
      accent: '#b5651d', selection: 'rgba(181,101,29,0.2)', caret: '#b5651d', rule: '#ddd2bf'
    }
  },

  // ── Systems ─────────────────────────────────────────────────────────────────
  // Each carries a `skin`: theme.applyStyle sets data-skin on <html> and app.css
  // repaints the whole shell (chrome + desktop) to portray that vintage OS.
  'MS-DOS': {
    dark: true, skin: 'dos',
    fonts: { heading: 'PxPlus IBM VGA8', body: 'PxPlus IBM VGA8', ui: 'PxPlus IBM VGA8' },
    measure: '60rem', scale: 1,
    tokens: {
      bg: '#0a0a0a', surface: '#000000', text: '#d2d2d2', muted: '#7a7a7a',
      accent: '#ffffff', selection: 'rgba(255,255,255,0.20)', caret: '#d2d2d2', rule: '#262626'
    }
  },
  'Commodore 64': {
    dark: true, skin: 'c64',
    fonts: { heading: 'C64 Pro Mono', body: 'C64 Pro Mono', ui: 'C64 Pro Mono' },
    measure: '60rem', scale: 1,
    tokens: {
      bg: '#0000aa', surface: '#0000aa', text: '#7c78f8', muted: '#5a55d0',
      accent: '#aaaaff', selection: 'rgba(170,170,255,0.30)', caret: '#7878f8', rule: '#3535c7'
    }
  },
  'MacOS 1.0': {
    dark: false, skin: 'mac1',
    fonts: { heading: 'ChicagoFLF', body: 'ChicagoFLF', ui: 'ChicagoFLF' },
    measure: '46rem', scale: 1,
    tokens: {
      bg: '#ffffff', surface: '#ffffff', text: '#000000', muted: '#555555',
      accent: '#000000', selection: 'rgba(0,0,0,0.16)', caret: '#000000', rule: '#000000'
    }
  },
  'Classic MacOS': {
    dark: false, skin: 'macos',
    fonts: { heading: 'ChicagoFLF', body: 'ChicagoFLF', ui: 'ChicagoFLF' },
    measure: '46rem', scale: 1,
    tokens: {
      bg: '#cfcfcf', surface: '#e4e4e4', text: '#000000', muted: '#565656',
      accent: '#2b2b9c', selection: 'rgba(43,43,156,0.22)', caret: '#000000', rule: '#7c7c7c'
    }
  },
  'Windows 95': {
    dark: false, skin: 'win95',
    fonts: { heading: 'Inter', body: 'Inter', ui: 'Inter' },
    measure: '46rem', scale: 1,
    tokens: {
      bg: '#c0c0c0', surface: '#c0c0c0', text: '#000000', muted: '#404040',
      accent: '#000080', selection: 'rgba(0,0,128,0.28)', caret: '#000000', rule: '#808080'
    }
  },
  'Amiga Workbench': {
    dark: false, skin: 'amiga',
    fonts: { heading: 'BigBlue Terminal', body: 'BigBlue Terminal', ui: 'BigBlue Terminal' },
    measure: '52rem', scale: 1,
    tokens: {
      bg: '#a6a6a6', surface: '#b2b2b2', text: '#000000', muted: '#33337a',
      accent: '#2b5db0', selection: 'rgba(43,93,176,0.26)', caret: '#000000', rule: '#000000'
    }
  },
  'Windows XP': {
    dark: false, skin: 'xp',
    fonts: { heading: 'Inter', body: 'Inter', ui: 'Inter' },
    measure: '46rem', scale: 1,
    tokens: {
      bg: '#ece9d8', surface: '#ffffff', text: '#000000', muted: '#5a5a5a',
      accent: '#2f6fd6', selection: 'rgba(47,111,214,0.24)', caret: '#000000', rule: '#aca899'
    }
  },
  'BeOS': {
    dark: false, skin: 'beos',
    fonts: { heading: 'Inter', body: 'Inter', ui: 'Inter' },
    measure: '46rem', scale: 1,
    tokens: {
      bg: '#d8d8d0', surface: '#eaeae2', text: '#000000', muted: '#555555',
      accent: '#2855b0', selection: 'rgba(40,85,176,0.22)', caret: '#000000', rule: '#888888'
    }
  },
  'NeXTSTEP': {
    dark: false, skin: 'next',
    fonts: { heading: 'Inter', body: 'Inter', ui: 'Inter' },
    measure: '46rem', scale: 1,
    tokens: {
      bg: '#dedede', surface: '#ffffff', text: '#000000', muted: '#666666',
      accent: '#26408b', selection: 'rgba(38,64,139,0.22)', caret: '#000000', rule: '#7a7a7a'
    }
  },
  'ZX Spectrum': {
    dark: true, skin: 'zx',
    fonts: { heading: 'BigBlue Terminal', body: 'BigBlue Terminal', ui: 'BigBlue Terminal' },
    measure: '56rem', scale: 1,
    tokens: {
      bg: '#000000', surface: '#000000', text: '#ffffff', muted: '#b0b0b0',
      accent: '#00d8d8', selection: 'rgba(0,216,216,0.28)', caret: '#ffffff', rule: '#303030'
    }
  },
  'Atari ST': {
    dark: false, skin: 'atari',
    fonts: { heading: 'PxPlus IBM VGA8', body: 'PxPlus IBM VGA8', ui: 'PxPlus IBM VGA8' },
    measure: '56rem', scale: 1,
    tokens: {
      bg: '#ffffff', surface: '#ffffff', text: '#000000', muted: '#4a4a4a',
      accent: '#007000', selection: 'rgba(0,112,0,0.20)', caret: '#000000', rule: '#000000'
    }
  },
  'Amber CRT': {
    dark: true, skin: 'amber',
    fonts: { heading: 'PxPlus IBM VGA8', body: 'PxPlus IBM VGA8', ui: 'PxPlus IBM VGA8' },
    measure: '60rem', scale: 1,
    tokens: {
      bg: '#140d00', surface: '#140d00', text: '#ffb000', muted: '#9a6a00',
      accent: '#ffcc44', selection: 'rgba(255,176,0,0.25)', caret: '#ffb000', rule: '#3a2600'
    }
  },
  'Green CRT': {
    dark: true, skin: 'green',
    fonts: { heading: 'PxPlus IBM VGA8', body: 'PxPlus IBM VGA8', ui: 'PxPlus IBM VGA8' },
    measure: '60rem', scale: 1,
    tokens: {
      bg: '#001400', surface: '#001400', text: '#37ff6a', muted: '#1f9f3f',
      accent: '#7dff9e', selection: 'rgba(55,255,106,0.22)', caret: '#37ff6a', rule: '#063a16'
    }
  },
  'Teletext': {
    dark: true, skin: 'teletext',
    fonts: { heading: 'BigBlue Terminal', body: 'BigBlue Terminal', ui: 'BigBlue Terminal' },
    measure: '56rem', scale: 1,
    tokens: {
      bg: '#000000', surface: '#000000', text: '#ffffff', muted: '#a0a0a0',
      accent: '#ffff00', selection: 'rgba(255,255,0,0.25)', caret: '#ffffff', rule: '#222222'
    }
  },
  'Windows 3.1': {
    dark: false, skin: 'win31',
    fonts: { heading: 'Inter', body: 'Inter', ui: 'Inter' },
    measure: '46rem', scale: 1,
    tokens: {
      bg: '#c0c0c0', surface: '#c0c0c0', text: '#000000', muted: '#404040',
      accent: '#000080', selection: 'rgba(0,0,128,0.28)', caret: '#000000', rule: '#808080'
    }
  },
  'OS/2 Warp': {
    dark: false, skin: 'os2',
    fonts: { heading: 'Inter', body: 'Inter', ui: 'Inter' },
    measure: '46rem', scale: 1,
    tokens: {
      bg: '#cececa', surface: '#d6d6d0', text: '#000000', muted: '#45454a',
      accent: '#00337f', selection: 'rgba(0,51,127,0.24)', caret: '#000000', rule: '#7a7a7a'
    }
  },
  'IBM 3270': {
    dark: true, skin: 'i3270',
    fonts: { heading: 'BigBlue Terminal', body: 'BigBlue Terminal', ui: 'BigBlue Terminal' },
    measure: '60rem', scale: 1,
    tokens: {
      bg: '#051005', surface: '#051005', text: '#33cc33', muted: '#1f8f1f',
      accent: '#66ff66', selection: 'rgba(51,204,51,0.22)', caret: '#33cc33', rule: '#0d3a0d'
    }
  },
  'Solaris CDE': {
    dark: false, skin: 'cde',
    fonts: { heading: 'Inter', body: 'Inter', ui: 'Inter' },
    measure: '46rem', scale: 1,
    tokens: {
      bg: '#aeb6c2', surface: '#bcc4d0', text: '#000000', muted: '#3a4656',
      accent: '#33518a', selection: 'rgba(51,81,138,0.24)', caret: '#000000', rule: '#6a7688'
    }
  },
  'RISC OS': {
    dark: false, skin: 'riscos',
    fonts: { heading: 'Inter', body: 'Inter', ui: 'Inter' },
    measure: '46rem', scale: 1,
    tokens: {
      bg: '#d7d7c8', surface: '#e8e8dc', text: '#000000', muted: '#555548',
      accent: '#005a9c', selection: 'rgba(0,90,156,0.22)', caret: '#000000', rule: '#8a8a7c'
    }
  },
  'GEOS': {
    dark: false, skin: 'geos',
    fonts: { heading: 'ChicagoFLF', body: 'ChicagoFLF', ui: 'ChicagoFLF' },
    measure: '46rem', scale: 1,
    tokens: {
      bg: '#ffffff', surface: '#ffffff', text: '#000000', muted: '#555555',
      accent: '#000000', selection: 'rgba(0,0,0,0.16)', caret: '#000000', rule: '#000000'
    }
  }
}

// The style a fresh install opens with.
export const DEFAULT_STYLE = 'Poppins'

// Built-in styles grouped for the theme chooser. Every built-in name appears in
// exactly one category; a "Custom" tab is added at runtime for saved styles.
export const STYLE_CATEGORIES = {
  Coffee:     ['Espresso', 'Poppins', 'Unbounded', 'Unbounded Light'],
  Editorial:  ['Ink', 'Paper', 'Manuscript', 'Lora', 'Caslon'],
  Lecture:    ['Lecture', 'Poppins Dark Blue', 'Unbounded Dark Blue'],
  Typewriter: ['Special Elite', 'Special Elite Dark'],
  Retro:      ['Press Start 2P', 'GAMEBOY DMG', 'Terminal Green', 'Terminal Orange'],
  Playful:    ['Lucy', 'Lucy Light', 'Poppins Candy Light', 'Orange'],
  Systems:    ['MS-DOS', 'Commodore 64', 'MacOS 1.0', 'Classic MacOS', 'Windows 95', 'Amiga Workbench', 'Windows XP', 'BeOS', 'NeXTSTEP',
               'ZX Spectrum', 'Atari ST', 'Amber CRT', 'Green CRT', 'Teletext', 'Windows 3.1', 'OS/2 Warp', 'IBM 3270', 'Solaris CDE', 'RISC OS', 'GEOS']
}

export const STYLE_NAMES = Object.keys(STYLES)

export function isBuiltin(name) {
  return Object.prototype.hasOwnProperty.call(STYLES, name)
}

// Deep clone a style so a custom copy never shares references with a built-in.
export function cloneStyle(style) {
  return {
    dark: style.dark,
    skin: style.skin,
    fonts: { ...style.fonts },
    measure: style.measure,
    scale: style.scale,
    tokens: { ...style.tokens }
  }
}
