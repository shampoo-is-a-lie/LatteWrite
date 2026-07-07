import { STYLES } from './styles.js'

export function applyStyle(name, fontScale = 1) {
  const style = STYLES[name] || STYLES.Espresso
  const root = document.documentElement
  const t = style.tokens

  root.style.setProperty('--bg', t.bg)
  root.style.setProperty('--surface', t.surface)
  root.style.setProperty('--text', t.text)
  root.style.setProperty('--muted', t.muted)
  root.style.setProperty('--accent', t.accent)
  root.style.setProperty('--selection', t.selection)
  root.style.setProperty('--caret', t.caret)
  root.style.setProperty('--rule', t.rule)

  root.style.setProperty('--font-heading', style.fonts.heading)
  root.style.setProperty('--font-body', style.fonts.body)
  root.style.setProperty('--font-ui', style.fonts.ui)
  root.style.setProperty('--measure', style.measure)
  root.style.setProperty('--font-scale', String(style.scale * fontScale))

  root.setAttribute('data-dark', style.dark ? 'true' : 'false')
  return style
}
