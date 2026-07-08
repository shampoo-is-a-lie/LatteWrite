import fs from 'fs'
import path from 'path'
import { dataPath } from './store.js'

// Downloads a Google font's latin @font-face CSS with the woff2 files inlined as
// data: URLs, and caches it on disk so it works offline after the first fetch.
const CACHE = path.join(dataPath, 'fonts')
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function fetchCss(family) {
  const fam = family.replace(/ /g, '+')
  const get = async (suffix) => {
    const res = await fetch(`https://fonts.googleapis.com/css2?family=${fam}${suffix}&display=swap`, { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`Google Fonts returned ${res.status} for ${family}`)
    return res.text()
  }
  try { return await get(':wght@400;600;700') }
  catch { return await get('') } // family may not have those weights
}

export async function loadFontCss(family) {
  fs.mkdirSync(CACHE, { recursive: true })
  const slug = family.replace(/[^a-z0-9]+/gi, '_').toLowerCase()
  const cached = path.join(CACHE, slug + '.css')
  if (fs.existsSync(cached)) return fs.readFileSync(cached, 'utf8')

  const css = await fetchCss(family)
  // Keep only the latin subsets to stay lean.
  const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)]
  let out
  if (blocks.length) {
    let kept = blocks.filter(b => b[1] === 'latin' || b[1] === 'latin-ext').map(b => b[2])
    if (!kept.length) kept = blocks.map(b => b[2])
    out = kept.join('\n')
  } else {
    out = css
  }

  const urls = [...out.matchAll(/url\((https:\/\/[^)]+)\)/g)].map(m => m[1])
  for (const u of urls) {
    try {
      const buf = Buffer.from(await (await fetch(u)).arrayBuffer())
      out = out.split(u).join(`data:font/woff2;base64,${buf.toString('base64')}`)
    } catch { /* leave the remote URL if a subset fails */ }
  }
  fs.writeFileSync(cached, out)
  return out
}
