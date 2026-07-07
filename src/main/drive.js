import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'
import { getAuthClient } from './auth.js'

const ROOT_FOLDER_NAME = 'LatteWrite'

async function getDriveClient() {
  return google.drive({ version: 'v3', auth: getAuthClient() })
}

async function ensureRootFolder(drive) {
  const q = `name='${ROOT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`
  const res = await drive.files.list({ q, fields: 'files(id)', spaces: 'drive' })
  if (res.data.files.length > 0) return res.data.files[0].id
  const folder = await drive.files.create({
    requestBody: { name: ROOT_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder', parents: ['root'] },
    fields: 'id'
  })
  return folder.data.id
}

async function findFile(drive, name, parentId) {
  const q = `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed=false`
  const res = await drive.files.list({ q, fields: 'files(id, name)', spaces: 'drive' })
  return res.data.files[0] || null
}

// Uploads (or updates in place) a .latte bundle into the LatteWrite Drive folder.
export async function syncBundle(localPath) {
  const drive = await getDriveClient()
  const rootId = await ensureRootFolder(drive)
  const name = path.basename(localPath)
  const existing = await findFile(drive, name, rootId)
  const media = { body: fs.createReadStream(localPath) }

  if (existing) {
    await drive.files.update({ fileId: existing.id, media })
    return { id: existing.id, updated: true }
  }
  const created = await drive.files.create({
    requestBody: { name, parents: [rootId] },
    media,
    fields: 'id'
  })
  return { id: created.data.id, updated: false }
}
