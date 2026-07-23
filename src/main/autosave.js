import fs from 'fs'
import path from 'path'
import { writeBundle } from './bundle.js'

function ts(d = new Date()) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`
}

// Rolling timestamped backups in a sibling .backups folder; keeps the newest N.
function rotateBackup(filePath, keep) {
  if (!fs.existsSync(filePath)) return
  const dir = path.join(path.dirname(filePath), '.backups')
  fs.mkdirSync(dir, { recursive: true })

  const base = path.basename(filePath, path.extname(filePath))
  fs.copyFileSync(filePath, path.join(dir, `${base}_${ts()}${path.extname(filePath)}`))

  const mine = fs.readdirSync(dir)
    .filter(f => f.startsWith(base + '_'))
    .sort()
  while (mine.length > keep) {
    fs.unlinkSync(path.join(dir, mine.shift()))
  }
}

// Every save also writes a twin in a sibling .mirror folder, always in the
// document's current state. Unlike .backups it is never rotated and — crucially —
// never deleted or renamed along with the document, so a file that is destroyed
// or vanishes can always be recovered from it. It is left read-only so nothing
// (including this app) overwrites it by accident.
export const MIRROR_DIR = '.mirror'
export const MIRROR_SUFFIX = '_bkup'

export function mirrorPathFor(filePath) {
  const ext = path.extname(filePath)
  return path.join(path.dirname(filePath), MIRROR_DIR, `${path.basename(filePath, ext)}${MIRROR_SUFFIX}${ext}`)
}

// The document a mirror belongs to, or null if the path isn't a mirror.
export function originOfMirror(mirrorPath) {
  const dir = path.dirname(mirrorPath)
  if (path.basename(dir) !== MIRROR_DIR) return null
  const ext = path.extname(mirrorPath)
  const base = path.basename(mirrorPath, ext)
  if (!base.endsWith(MIRROR_SUFFIX)) return null
  return path.join(path.dirname(dir), base.slice(0, -MIRROR_SUFFIX.length) + ext)
}

function writeMirror(filePath, payload) {
  const target = mirrorPathFor(filePath)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  writeBundle(target, payload)     // temp + rename, so the read-only bit is no obstacle
  fs.chmodSync(target, 0o444)
}

// Save the live file (always), rotating a backup of the previous version first.
export function saveDocument(filePath, payload, backupsToKeep = 10) {
  rotateBackup(filePath, backupsToKeep)
  writeBundle(filePath, payload)
  // A failed mirror must never cost you the save itself.
  try { writeMirror(filePath, payload) } catch { /* surfaced by the recovery list being stale */ }
  return filePath
}
