import AdmZip from 'adm-zip'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

// A .latte file is a zip bundle: the document JSON, its metadata, the version
// history, and images/ — one entry per distinct picture, stored uncompressed.
export const EXT = '.latte'

const IMG_DIR = 'images/'
const STORED = 0                      // zip method 0: no deflate
const DATA_URL = /^data:image\/([\w.+-]+);base64,/

// Only where the file extension and the MIME subtype disagree.
const EXT_FOR = { jpeg: 'jpg', 'svg+xml': 'svg' }
const SUBTYPE_FOR = { jpg: 'jpeg', svg: 'svg+xml' }

// Every node in a Tiptap document that carries a src attribute.
function walkNodes(node, fn) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) { for (const n of node) walkNodes(n, fn); return }
  if (node.attrs && typeof node.attrs.src === 'string') fn(node.attrs)
  if (node.content) walkNodes(node.content, fn)
}

const treesOf = (doc, versions) => [doc, ...(versions || []).map(v => v && v.doc)]

// ── images ───────────────────────────────────────────────────────────────────
// Pictures used to live in doc.json as base64 data URLs. That cost three times
// over: base64 inflates the bytes by a third, deflating an already-compressed
// PNG or JPEG is pure wasted CPU, and every daily version snapshot carried its
// own complete copy of every image — three snapshots of one document meant the
// same photos written four times into the same file.
//
// Now each distinct picture is one entry named after the SHA-1 of its bytes and
// stored with no compression, and the document just points at it. Snapshots that
// share a picture share the entry, so history costs only the text that changed.

function addStored(zip, name, buf) {
  zip.addFile(name, buf)
  zip.getEntry(name).header.method = STORED
}

// Rewrite data URLs to entry names, adding any picture the bundle doesn't hold
// yet. Records every name still in use so the caller can drop the rest.
function externalize(zip, trees, used) {
  for (const tree of trees) walkNodes(tree, (attrs) => {
    const m = DATA_URL.exec(attrs.src)
    if (!m) {
      if (attrs.src.startsWith(IMG_DIR)) used.add(attrs.src)   // already externalised
      return
    }
    // Hash the decoded bytes, never the base64 text: the web editor names entries
    // the same way, and the two must agree or one picture ends up stored twice
    // under two names. Only newly-pasted images reach here — once externalised a
    // src is an entry name, so this does not run again on later saves.
    const buf = Buffer.from(attrs.src.slice(attrs.src.indexOf(',') + 1), 'base64')
    const sub = m[1].toLowerCase()
    const name = `${IMG_DIR}${crypto.createHash('sha1').update(buf).digest('hex')}.${EXT_FOR[sub] || sub}`
    if (!zip.getEntry(name)) addStored(zip, name, buf)
    used.add(name)
    attrs.src = name
  })
}

// The reverse, so the editor only ever sees self-contained data URLs and nothing
// downstream of here — node views, copy/paste, HTML and PDF export, the web
// editor — has to know the bundle layout. Returns true if the bundle still holds
// images the old way, which is the cue to migrate it on the next save.
function inline(zip, trees) {
  const cache = new Map()      // decode a picture once however many snapshots use it
  let legacy = false
  for (const tree of trees) walkNodes(tree, (attrs) => {
    if (DATA_URL.test(attrs.src)) { legacy = true; return }
    if (!attrs.src.startsWith(IMG_DIR)) return
    if (!cache.has(attrs.src)) {
      const entry = zip.getEntry(attrs.src)
      const sub = path.extname(attrs.src).slice(1).toLowerCase()
      cache.set(attrs.src, entry
        ? `data:image/${SUBTYPE_FOR[sub] || sub};base64,${entry.getData().toString('base64')}`
        : null)
    }
    const url = cache.get(attrs.src)
    if (url) attrs.src = url                 // a missing picture keeps its ref rather than blanking
  })
  return legacy
}

// The recovery list builds a 220-character preview for every backup and mirror it
// can find, and wants neither the pictures nor the history to do it. Decoding the
// images, and parsing a versions.json that in an unmigrated file can be tens of
// megabytes, cost far more than everything else about that read put together.
export function readBundle(filePath, { images = true, history = true } = {}) {
  const zip = new AdmZip(filePath)
  const docEntry = zip.getEntry('doc.json')
  const metaEntry = zip.getEntry('meta.json')
  const verEntry = history ? zip.getEntry('versions.json') : null
  if (!docEntry) throw new Error('Not a valid LatteWrite file (missing doc.json)')
  const doc = JSON.parse(zip.readAsText(docEntry))
  const meta = metaEntry ? JSON.parse(zip.readAsText(metaEntry)) : {}
  const versions = verEntry ? JSON.parse(zip.readAsText(verEntry)) : []
  const legacy = images ? inline(zip, treesOf(doc, versions)) : false
  return { doc, meta, versions, legacy }
}

function putEntry(zip, name, buf) {
  if (zip.getEntry(name)) zip.updateFile(name, buf)
  else zip.addFile(name, buf)
}

// Build the bundle into a temp file beside the target and return that path; the
// caller renames it into place. Keeping the build separate from the swap lets a
// backup rotation slot in between, so the only moment the live file is missing
// is the gap between two renames.
//
// `versions` may be omitted, meaning "whatever is already in the file". That is
// the autosave case, and it matters enormously: re-opening the existing archive
// carries the history across as its already-compressed bytes instead of
// re-deflating tens of megabytes on every keystroke pause.
//
// The doc passed in is modified in place (its image srcs become entry names).
// It is always either freshly parsed here or a structured-clone copy that came
// over IPC, never something the caller still holds a live reference to.
export function buildBundle(filePath, { doc, meta, versions }) {
  let zip = null

  if (versions === undefined && fs.existsSync(filePath)) {
    // A corrupt or unreadable file must not block the save; fall through to a
    // fresh archive and let the version history be the thing that's lost.
    try {
      const existing = new AdmZip(filePath)
      if (existing.getEntry('versions.json')) zip = existing
    } catch { /* fresh archive below */ }
  }

  const rewritingHistory = versions !== undefined
  const fresh = !zip
  if (fresh) zip = new AdmZip()

  const used = new Set()
  externalize(zip, rewritingHistory ? treesOf(doc, versions) : [doc], used)

  putEntry(zip, 'doc.json', Buffer.from(JSON.stringify(doc), 'utf8'))
  putEntry(zip, 'meta.json', Buffer.from(JSON.stringify(meta ?? {}, null, 2), 'utf8'))
  if (fresh || rewritingHistory) {
    putEntry(zip, 'versions.json', Buffer.from(JSON.stringify(versions ?? []), 'utf8'))
  }

  // Only collect garbage when the history was rewritten too. Otherwise a picture
  // the document just dropped may still be the one an untouched snapshot shows,
  // and `used` — built from the document alone — cannot tell the difference.
  if (rewritingHistory) {
    // Directory entries are skipped, and removal is deleteEntry rather than
    // deleteFile: a bundle written by the web editor carries an `images/` folder
    // marker, and deleteFile would take the whole folder — every picture with it.
    for (const entry of zip.getEntries().slice()) {
      const name = entry.entryName
      if (entry.isDirectory || !name.startsWith(IMG_DIR) || used.has(name)) continue
      zip.deleteEntry(name)
    }
  }

  const tmp = path.join(path.dirname(filePath), `.${path.basename(filePath)}.tmp-${process.pid}`)
  zip.writeZip(tmp)
  return tmp
}

// Atomic write: build the zip to a temp path, then rename over the target so a
// crash mid-write can never corrupt the live file.
export function writeBundle(filePath, payload) {
  fs.renameSync(buildBundle(filePath, payload), filePath)
}
