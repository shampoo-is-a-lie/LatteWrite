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

// Save the live file (always), rotating a backup of the previous version first.
export function saveDocument(filePath, payload, backupsToKeep = 10) {
  rotateBackup(filePath, backupsToKeep)
  writeBundle(filePath, payload)
  return filePath
}
