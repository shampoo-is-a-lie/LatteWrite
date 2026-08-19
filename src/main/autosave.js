import fs from 'fs'
import path from 'path'
import { buildBundle } from './bundle.js'

function ts(d = new Date()) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`
}

// Read the stamp back out of a rotated backup's name.
function stampOf(name, base) {
  const m = name.slice(base.length + 1).match(/^(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})/)
  if (!m) return 0
  return Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4]}`) || 0
}

// Rolling timestamped backups in a sibling .backups folder; keeps the newest N.
//
// Rotation is throttled, because autosave fires ~1.2 s after you stop typing:
// one backup per save meant the ten we keep could all be from the same minute —
// churning the disk to produce a history that covered no history at all. At one
// every few minutes the same ten span most of a working session.
export const BACKUP_INTERVAL_MS = 5 * 60 * 1000

// Returns true when the live file has been MOVED aside (so the caller must put
// a new one in its place, which it is about to do anyway).
function rotateBackup(filePath, keep, intervalMs) {
  if (!fs.existsSync(filePath)) return false
  const dir = path.join(path.dirname(filePath), '.backups')
  const base = path.basename(filePath, path.extname(filePath))

  let mine = []
  try {
    mine = fs.readdirSync(dir).filter(f => f.startsWith(base + '_')).sort()
  } catch { /* no .backups yet — created below */ }

  const newest = mine.length ? stampOf(mine[mine.length - 1], base) : 0
  if (newest && Date.now() - newest < intervalMs) return false

  fs.mkdirSync(dir, { recursive: true })
  // A rename, not a copy: the live file is about to be replaced wholesale, so
  // there is nothing to preserve in place and no reason to read and rewrite it.
  const name = `${base}_${ts()}${path.extname(filePath)}`
  fs.renameSync(filePath, path.join(dir, name))

  // Stamps are second-resolution, so two rotations inside the same second land on
  // the same name and the second one replaces the first. Deduplicating keeps the
  // prune from counting that single file twice and deleting the backup it just made.
  mine = [...new Set([...mine, name])]
  while (mine.length > Math.max(1, keep)) {      // never prune away the one just made
    try { fs.unlinkSync(path.join(dir, mine.shift())) } catch { /* already gone */ }
  }
  return true
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

// Copy the finished bundle rather than building a second one: the twin is meant
// to be byte-for-byte the file it mirrors, and zipping the same payload twice
// doubled the cost of every save for no gain.
//
// FICLONE asks the filesystem for a copy-on-write clone, which on btrfs/XFS
// shares the extents and writes nothing but metadata — the twin of a 23 MB
// document costs no disk at all. It stays a fully independent file: overwriting
// or deleting the document leaves the clone untouched, which is the whole point
// of the mirror. Filesystems without reflinks (ext4, NTFS, …) silently get an
// ordinary copy, so this is safe everywhere the AppImage lands.
function writeMirror(filePath) {
  const target = mirrorPathFor(filePath)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  const tmp = `${target}.tmp-${process.pid}`
  fs.copyFileSync(filePath, tmp, fs.constants.COPYFILE_FICLONE)
  fs.chmodSync(tmp, 0o444)
  fs.renameSync(tmp, target)       // renaming over the read-only twin is fine
}

// Save the live file (always), rotating a backup of the previous version first.
// `payload.versions` may be omitted to keep the history already on disk.
export function saveDocument(filePath, payload, backupsToKeep = 10, backupIntervalMs = BACKUP_INTERVAL_MS) {
  // Built first, while the previous file is still in place: with `versions`
  // omitted this reads the history straight out of it.
  const tmp = buildBundle(filePath, payload)
  rotateBackup(filePath, backupsToKeep, backupIntervalMs)
  fs.renameSync(tmp, filePath)
  // A failed mirror must never cost you the save itself.
  try { writeMirror(filePath) } catch { /* surfaced by the recovery list being stale */ }
  return filePath
}
