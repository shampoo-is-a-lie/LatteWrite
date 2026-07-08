// Loads a Google font at runtime (via the main process, which caches it) and
// points the given CSS variable at it. kind is 'heading' or 'body'.

function fallback(family) {
  if (/serif|slab|garamond|caslon|baskerville/i.test(family)) return 'serif'
  if (/mono|code/i.test(family)) return 'monospace'
  return 'sans-serif'
}

export async function applyFont(kind, family) {
  if (!family) return
  const css = await window.api.fonts.load(family)
  const id = 'gf-' + family.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  let el = document.getElementById(id)
  if (!el) { el = document.createElement('style'); el.id = id; document.head.appendChild(el) }
  el.textContent = css
  const varName = kind === 'heading' ? '--font-heading' : '--font-body'
  document.documentElement.style.setProperty(varName, `'${family}', ${fallback(family)}`)
}
