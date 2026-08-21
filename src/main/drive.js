import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { getAuthClient } from './auth.js'

const ROOT_FOLDER_NAME = 'LatteWrite'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

function esc(name) { return String(name).replace(/\\/g, '\\\\').replace(/'/g, "\\'") }

async function getDriveClient() {
  return google.drive({ version: 'v3', auth: getAuthClient() })
}

async function ensureRootFolder(drive) {
  const q = `name='${ROOT_FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and 'root' in parents and trashed=false`
  const res = await drive.files.list({ q, fields: 'files(id)', spaces: 'drive' })
  if (res.data.files.length > 0) return res.data.files[0].id
  const folder = await drive.files.create({
    requestBody: { name: ROOT_FOLDER_NAME, mimeType: FOLDER_MIME, parents: ['root'] },
    fields: 'id'
  })
  return folder.data.id
}

async function findFile(drive, name, parentId) {
  const q = `name='${esc(name)}' and '${parentId}' in parents and trashed=false`
  const res = await drive.files.list({ q, fields: 'files(id, name)', spaces: 'drive' })
  return res.data.files[0] || null
}

// Find a subfolder by name under a parent, WITHOUT creating it. Used when we
// only want to reach into an existing tree (delete/rename), never build one.
async function findSubFolder(drive, name, parentId) {
  const q = `name='${esc(name)}' and mimeType='${FOLDER_MIME}' and '${parentId}' in parents and trashed=false`
  const res = await drive.files.list({ q, fields: 'files(id)', spaces: 'drive', pageSize: 10 })
  return res.data.files[0]?.id || null
}

// Find (or create) a subfolder by name under a given parent, returning its id.
async function ensureSubFolder(drive, name, parentId) {
  const existing = await findSubFolder(drive, name, parentId)
  if (existing) return existing
  const folder = await drive.files.create({
    requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
    fields: 'id'
  })
  return folder.data.id
}

// Walk (creating as needed) the subfolder chain under the LatteWrite root that
// mirrors the document's location inside the local latte folder. `relPath` is
// the file's path relative to that folder, e.g. "Novels/Book/Chapter1.latte";
// only the directory segments are recreated. Returns the deepest folder id.
async function ensureParentForRelPath(drive, rootId, relPath) {
  const dirs = relPath.split(/[\\/]+/).filter(Boolean).slice(0, -1)
  let parentId = rootId
  for (const dir of dirs) parentId = await ensureSubFolder(drive, dir, parentId)
  return parentId
}

// Uploads (or updates in place) a single .latte bundle into the LatteWrite Drive
// folder, recreating any subfolders the document lives in so the tree mirrors
// the desktop's latte folder. `relPath` is the path relative to that folder;
// when omitted the bundle syncs flat, straight under LatteWrite. This is the
// per-save path — it never deletes; whole-tree mirroring is mirrorTree() below.
export async function syncBundle(localPath, relPath) {
  const drive = await getDriveClient()
  const rootId = await ensureRootFolder(drive)
  const rel = relPath || path.basename(localPath)
  const name = path.basename(rel)
  const parentId = await ensureParentForRelPath(drive, rootId, rel)
  const existing = await findFile(drive, name, parentId)
  const media = { body: fs.createReadStream(localPath) }

  if (existing) {
    await drive.files.update({ fileId: existing.id, media })
    return { id: existing.id, updated: true }
  }
  const created = await drive.files.create({
    requestBody: { name, parents: [parentId] },
    media,
    fields: 'id'
  })
  return { id: created.data.id, updated: false }
}

// ── Sync primitives ─────────────────────────────────────────────────────────────
// Shared by the live delete/rename hooks and the two-way reconcile below. Only
// .latte documents and the folders that hold them are ever managed; hidden dirs
// (.backups and friends) are never touched. Because the app uses the drive.file
// scope, Drive only ever shows files this app created, so listing/trashing what
// it manages is safe.

function isFolder(entry) { return entry?.mimeType === FOLDER_MIME }

function md5File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5')
    const stream = fs.createReadStream(filePath)
    stream.on('error', reject)
    stream.on('data', (d) => hash.update(d))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

// All immediate children of a Drive folder (paginated), with the md5 we use to
// skip re-uploading unchanged documents.
async function listChildren(drive, parentId) {
  const out = []
  let pageToken
  do {
    const res = await drive.files.list({
      q: `'${parentId}' in parents and trashed=false`,
      fields: 'nextPageToken, files(id,name,mimeType,md5Checksum)',
      spaces: 'drive',
      pageSize: 1000,
      pageToken
    })
    out.push(...res.data.files)
    pageToken = res.data.nextPageToken
  } while (pageToken)
  return out
}

// Move a Drive item to the trash rather than hard-deleting, mirroring how the
// desktop trashes documents locally — a mistaken delete stays recoverable from
// Drive's trash, and the reconcile only ever lists un-trashed files so it won't
// come back.
async function trashFile(drive, fileId) {
  await drive.files.update({ fileId, requestBody: { trashed: true } })
}

const isLatte = (name) => name.toLowerCase().endsWith('.latte')

// Live delete: trash the Drive copy of a document the user just deleted locally.
// `relPath` is the path relative to the latte folder. Missing folders/file are a
// no-op (it was never synced).
export async function removeRemote(relPath) {
  const drive = await getDriveClient()
  const rootId = await ensureRootFolder(drive)
  const parts = relPath.split(/[\\/]+/).filter(Boolean)
  const name = parts.pop()
  let parentId = rootId
  for (const dir of parts) {
    parentId = await findSubFolder(drive, dir, parentId)
    if (!parentId) return { ok: true, missing: true }
  }
  const existing = await findFile(drive, name, parentId)
  if (existing) await trashFile(drive, existing.id)
  return { ok: true, deleted: !!existing }
}

// Live rename: rename the Drive copy in place (keeping its id/history) when the
// user renames a document locally. `oldRel` is the pre-rename path relative to
// the latte folder; `newName` is the new basename. If the old copy isn't on
// Drive yet, it's a no-op — the next save uploads it under the new name.
export async function renameRemote(oldRel, newName) {
  const drive = await getDriveClient()
  const rootId = await ensureRootFolder(drive)
  const parts = oldRel.split(/[\\/]+/).filter(Boolean)
  const oldName = parts.pop()
  let parentId = rootId
  for (const dir of parts) {
    parentId = await findSubFolder(drive, dir, parentId)
    if (!parentId) return { ok: true, missing: true }
  }
  const existing = await findFile(drive, oldName, parentId)
  if (!existing) return { ok: true, missing: true }
  await drive.files.update({ fileId: existing.id, requestBody: { name: newName } })
  return { ok: true, renamed: true }
}

// ── Two-way sync ────────────────────────────────────────────────────────────────
// Reconcile the local latte folder and the Drive tree against a baseline
// manifest (each path's Drive id + checksum as of the last sync). Every path is
// classified from what changed on each side since that baseline and the change
// is carried the right way: new/edited files copied across, deletions
// propagated, and a file edited on BOTH sides kept as two files (the local copy
// stays; Drive's copy is saved beside it as "Name (conflict YYYY-MM-DD).latte")
// so nothing is ever silently overwritten. Returns { stats, manifest } — the
// caller persists the new manifest as the next baseline.

async function walkDriveTree(drive, folderId, rel, out) {
  for (const c of await listChildren(drive, folderId)) {
    const childRel = rel ? `${rel}/${c.name}` : c.name
    if (isFolder(c)) await walkDriveTree(drive, c.id, childRel, out)
    else if (isLatte(c.name) && !out.has(childRel)) out.set(childRel, { id: c.id, md5: c.md5Checksum })
  }
  return out
}

async function walkLocalTree(dir, rel, out) {
  let entries = []
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.isSymbolicLink()) continue
    const childRel = rel ? `${rel}/${e.name}` : e.name
    const abs = path.join(dir, e.name)
    if (e.isDirectory()) await walkLocalTree(abs, childRel, out)
    else if (e.isFile() && isLatte(e.name)) out.set(childRel, { abs, md5: await md5File(abs) })
  }
  return out
}

async function downloadTo(drive, fileId, absPath) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true })
  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' })
  await new Promise((resolve, reject) => {
    const dest = fs.createWriteStream(absPath)
    res.data.on('error', reject)
    dest.on('error', reject)
    dest.on('finish', resolve)
    res.data.pipe(dest)
  })
}

async function pushLocal(drive, rootId, rel, absPath, existingId) {
  const media = { body: fs.createReadStream(absPath) }
  if (existingId) { await drive.files.update({ fileId: existingId, media }); return existingId }
  const parentId = await ensureParentForRelPath(drive, rootId, rel)
  const created = await drive.files.create({
    requestBody: { name: path.basename(rel), parents: [parentId] }, media, fields: 'id'
  })
  return created.data.id
}

export async function twoWaySync(localRoot, baseline = {}, { trashLocal, drive: injected, onProgress } = {}) {
  const emit = onProgress || (() => {})
  const drive = injected || await getDriveClient()   // injected client is for tests
  const rootId = await ensureRootFolder(drive)
  emit({ phase: 'scan', message: 'Scanning Google Drive…' })
  const driveFiles = await walkDriveTree(drive, rootId, '', new Map())
  emit({ phase: 'scan', message: 'Scanning local files…' })
  const localFiles = await walkLocalTree(localRoot, '', new Map())
  const next = {}
  const stats = { pushed: 0, pulled: 0, deletedLocal: 0, deletedRemote: 0, conflicts: 0, unchanged: 0, errors: 0 }

  const conflictName = (rel) => {
    const date = new Date().toISOString().slice(0, 10)
    const base = rel.replace(/\.latte$/i, '')
    let cand = `${base} (conflict ${date}).latte`
    let n = 2
    while (localFiles.has(cand) || driveFiles.has(cand) || next[cand]) { cand = `${base} (conflict ${date} ${n}).latte`; n++ }
    return cand
  }

  const keys = new Set([...Object.keys(baseline), ...driveFiles.keys(), ...localFiles.keys()])
  const total = keys.size
  let i = 0
  for (const rel of keys) {
    i++
    const L = localFiles.get(rel)
    const D = driveFiles.get(rel)
    const B = baseline[rel]
    try {
      if (L && D) {
        if (L.md5 === D.md5) {                                   // identical on both sides
          emit({ phase: 'file', index: i, total, file: rel, action: 'unchanged' })
          next[rel] = { driveId: D.id, md5: D.md5 }
          stats.unchanged++
          continue
        }
        const localChanged = !B || L.md5 !== B.md5
        const driveChanged = !B || D.md5 !== B.md5
        if (localChanged && driveChanged) {                      // both edited → keep both
          emit({ phase: 'file', index: i, total, file: rel, action: 'conflict' })
          const cRel = conflictName(rel)
          const cAbs = path.join(localRoot, cRel)
          await downloadTo(drive, D.id, cAbs)                    // their version → conflict copy on disk
          const mineId = await pushLocal(drive, rootId, rel, L.abs, D.id)  // your version wins the original name
          const theirsId = await pushLocal(drive, rootId, cRel, cAbs)      // upload the conflict copy too
          next[rel] = { driveId: mineId, md5: L.md5 }
          next[cRel] = { driveId: theirsId, md5: D.md5 }
          stats.conflicts++
        } else if (localChanged) {                               // only local moved → push
          emit({ phase: 'file', index: i, total, file: rel, action: 'push' })
          const id = await pushLocal(drive, rootId, rel, L.abs, D.id)
          next[rel] = { driveId: id, md5: L.md5 }
          stats.pushed++
        } else {                                                 // only Drive moved → pull
          emit({ phase: 'file', index: i, total, file: rel, action: 'pull' })
          await downloadTo(drive, D.id, L.abs)
          next[rel] = { driveId: D.id, md5: D.md5 }
          stats.pulled++
        }
      } else if (L && !D) {
        if (!B || L.md5 !== B.md5) {                             // new locally, or edited-here-but-gone-there → keep it
          emit({ phase: 'file', index: i, total, file: rel, action: 'push' })
          const id = await pushLocal(drive, rootId, rel, L.abs)
          next[rel] = { driveId: id, md5: L.md5 }
          stats.pushed++
        } else {                                                 // unchanged here, deleted on Drive → delete here
          emit({ phase: 'file', index: i, total, file: rel, action: 'deleteLocal' })
          if (trashLocal) await trashLocal(L.abs)
          stats.deletedLocal++
        }
      } else if (!L && D) {
        if (!B || D.md5 !== B.md5) {                             // new on Drive, or edited-there-but-gone-here → keep it
          emit({ phase: 'file', index: i, total, file: rel, action: 'pull' })
          await downloadTo(drive, D.id, path.join(localRoot, rel))
          next[rel] = { driveId: D.id, md5: D.md5 }
          stats.pulled++
        } else {                                                 // unchanged on Drive, deleted here → delete there
          emit({ phase: 'file', index: i, total, file: rel, action: 'deleteRemote' })
          await trashFile(drive, D.id)
          stats.deletedRemote++
        }
      }
      // else: gone from both → drop from the manifest
    } catch { stats.errors++ }
  }
  emit({ phase: 'done', index: total, total })
  return { stats, manifest: next }
}
