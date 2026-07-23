import fs from 'fs'
import os from 'os'
import path from 'path'
import { readBundle, EXT } from './bundle.js'
import { MIRROR_DIR, MIRROR_SUFFIX, mirrorPathFor, originOfMirror } from './autosave.js'

// Everything that can bring a document back, in one place:
//   mirror  — the read-only twin written on every save (.mirror/<name>_bkup.latte)
//   trash   — a .latte the OS trash still holds (deletes go through shell.trashItem)
//   backup  — a timestamped snapshot in .backups/
// Only documents whose live file is gone are offered; a file you still have is
// not "recoverable", it's just open.

const BACKUP_DIR = '.backups'

// freedesktop.org trash: the home one plus any on other mounted volumes.
function trashRoots() {
  const home = path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'Trash')
  return [home].filter((d) => fs.existsSync(path.join(d, 'info')))
}

function parseTrashInfo(file) {
  const out = {}
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const i = line.indexOf('=')
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  if (!out.Path) return null
  return { origin: decodeURIComponent(out.Path), deletedAt: out.DeletionDate || null }
}

// Plain text of a .latte, for the preview line. Also proves the file still reads.
function digest(file) {
  const { doc, meta } = readBundle(file)
  let text = ''
  const walk = (n) => {
    if (!n) return
    if (n.text) text += n.text
    if (Array.isArray(n.content)) { n.content.forEach(walk); if (n.type === 'paragraph' || n.type === 'heading') text += ' ' }
  }
  if (doc && Array.isArray(doc.content)) doc.content.forEach(walk)
  return { title: meta?.title || null, preview: text.replace(/\s+/g, ' ').trim().slice(0, 220) }
}

function walkDirs(root, name, hit) {
  let entries
  try { entries = fs.readdirSync(root, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    if (!e.isDirectory()) continue
    const dir = path.join(root, e.name)
    if (e.name === name) hit(dir)
    else if (!e.name.startsWith('.')) walkDirs(dir, name, hit)
  }
}

function candidate(file, source, origin, when) {
  let info
  try { info = digest(file) } catch { return null }   // unreadable/corrupt: not a candidate
  const st = fs.statSync(file)
  return {
    file, source, origin,
    name: path.basename(origin, EXT),
    folder: path.dirname(origin),
    date: when || st.mtimeMs,
    size: st.size,
    ...info
  }
}

// Every recoverable candidate for documents that no longer exist, newest first,
// grouped one row per missing document (the freshest source wins, the rest are
// listed as alternatives).
export function listRecoverable(root) {
  const found = []

  for (const trash of trashRoots()) {
    const infoDir = path.join(trash, 'info')
    let infos
    try { infos = fs.readdirSync(infoDir) } catch { continue }
    for (const f of infos) {
      if (!f.endsWith('.trashinfo')) continue
      let meta
      try { meta = parseTrashInfo(path.join(infoDir, f)) } catch { continue }
      if (!meta || path.extname(meta.origin).toLowerCase() !== EXT) continue
      const file = path.join(trash, 'files', f.slice(0, -'.trashinfo'.length))
      if (!fs.existsSync(file)) continue
      const when = meta.deletedAt ? Date.parse(meta.deletedAt) : null
      const c = candidate(file, 'trash', meta.origin, Number.isNaN(when) ? null : when)
      if (c) found.push(c)
    }
  }

  walkDirs(root, MIRROR_DIR, (dir) => {
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(MIRROR_SUFFIX + EXT)) continue
      const file = path.join(dir, f)
      const origin = originOfMirror(file)
      if (!origin) continue
      const c = candidate(file, 'mirror', origin, null)
      if (c) found.push(c)
    }
  })

  walkDirs(root, BACKUP_DIR, (dir) => {
    // Only the newest snapshot per document — the older ones are offered by the
    // per-document history, not by the recovery list.
    const newest = new Map()
    for (const f of fs.readdirSync(dir)) {
      const m = f.match(/^(.*)_(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})\.latte$/)
      if (!m) continue
      const prev = newest.get(m[1])
      if (!prev || m[2] > prev.stamp) newest.set(m[1], { stamp: m[2], file: path.join(dir, f) })
    }
    for (const [base, v] of newest) {
      const c = candidate(v.file, 'backup', path.join(path.dirname(dir), base + EXT), null)
      if (c) found.push(c)
    }
  })

  const missing = found.filter((c) => !fs.existsSync(c.origin))
  const byOrigin = new Map()
  for (const c of missing.sort((a, b) => b.date - a.date)) {
    const k = c.origin
    if (byOrigin.has(k)) byOrigin.get(k).alternatives.push({ source: c.source, file: c.file, date: c.date, size: c.size })
    else byOrigin.set(k, { ...c, alternatives: [] })
  }
  return [...byOrigin.values()].sort((a, b) => b.date - a.date)
}

// Bring a candidate back to where it came from. Never overwrites: an existing
// file at the target gets the recovered copy beside it.
export function restoreFile(file, origin) {
  if (!fs.existsSync(file)) throw new Error('That copy is no longer there.')
  const dir = path.dirname(origin)
  fs.mkdirSync(dir, { recursive: true })
  const base = path.basename(origin, EXT)
  let target = origin
  for (let i = 2; fs.existsSync(target); i++) target = path.join(dir, `${base} (recovered ${i})${EXT}`)
  fs.copyFileSync(file, target)
  fs.chmodSync(target, 0o644)          // mirrors are read-only; the restored file must not be
  return target
}

// Timestamped snapshots of one document, newest first — the per-save history
// behind "restore the state before I broke it".
export function listSnapshots(filePath) {
  const dir = path.join(path.dirname(filePath), BACKUP_DIR)
  const base = path.basename(filePath, EXT)
  let files
  try { files = fs.readdirSync(dir) } catch { return [] }
  const out = []
  for (const f of files) {
    const m = f.match(/^(.*)_(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})\.latte$/)
    if (!m || m[1] !== base) continue
    const file = path.join(dir, f)
    let info
    try { info = digest(file) } catch { continue }
    out.push({
      file,
      at: Date.parse(`${m[2]}T${m[3]}:${m[4]}:${m[5]}`),
      size: fs.statSync(file).size,
      ...info
    })
  }
  const mirror = mirrorPathFor(filePath)
  if (fs.existsSync(mirror)) {
    try {
      out.push({ file: mirror, at: fs.statSync(mirror).mtimeMs, size: fs.statSync(mirror).size, mirror: true, ...digest(mirror) })
    } catch { /* unreadable mirror: nothing to offer */ }
  }
  return out.sort((a, b) => b.at - a.at)
}
