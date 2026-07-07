import AdmZip from 'adm-zip'
import fs from 'fs'
import path from 'path'

// A .latte file is a zip bundle: the document JSON plus its metadata, so a
// single file reopens identically anywhere. fonts/ and images/ are reserved
// for embedding later.
export const EXT = '.latte'

export function readBundle(filePath) {
  const zip = new AdmZip(filePath)
  const docEntry = zip.getEntry('doc.json')
  const metaEntry = zip.getEntry('meta.json')
  if (!docEntry) throw new Error('Not a valid LatteWrite file (missing doc.json)')
  const doc = JSON.parse(zip.readAsText(docEntry))
  const meta = metaEntry ? JSON.parse(zip.readAsText(metaEntry)) : {}
  return { doc, meta }
}

// Atomic write: build the zip to a temp path, then rename over the target so a
// crash mid-write can never corrupt the live file.
export function writeBundle(filePath, { doc, meta }) {
  const zip = new AdmZip()
  zip.addFile('doc.json', Buffer.from(JSON.stringify(doc), 'utf8'))
  zip.addFile('meta.json', Buffer.from(JSON.stringify(meta ?? {}, null, 2), 'utf8'))

  const tmp = path.join(path.dirname(filePath), `.${path.basename(filePath)}.tmp-${process.pid}`)
  zip.writeZip(tmp)
  fs.renameSync(tmp, filePath)
}
