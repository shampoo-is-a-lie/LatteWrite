import { google } from 'googleapis'
import { shell } from 'electron'
import http from 'http'
import url from 'url'
import store from './store.js'

// Reused from OAKANIZER — loopback OAuth flow. drive.file scope means the app
// only ever sees files it created itself.
const SCOPES = ['https://www.googleapis.com/auth/drive.file']
const REDIRECT = 'http://localhost:42814/callback'

function createOAuthClient() {
  const clientId = store.get('oauthClientId')
  const clientSecret = store.get('oauthClientSecret')
  if (!clientId || !clientSecret) throw new Error('OAuth credentials not configured')
  return new google.auth.OAuth2(clientId, clientSecret, REDIRECT)
}

export function getAuthClient() {
  const client = createOAuthClient()
  const token = store.get('oauthToken')
  if (token) client.setCredentials(token)
  return client
}

export function isAuthenticated() {
  return !!store.get('oauthToken')
}

export async function startAuthFlow() {
  const client = createOAuthClient()
  const authUrl = client.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' })

  return new Promise((resolve, reject) => {
    let settled = false
    const done = (fn, val) => { if (!settled) { settled = true; server.close(); fn(val) } }

    const server = http.createServer(async (req, res) => {
      const parsed = url.parse(req.url, true)
      if (parsed.pathname !== '/callback') return

      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<html><body style="font-family:sans-serif;background:#1a120b;color:#e9dccb;display:grid;place-items:center;height:100vh;margin:0"><h2>LatteWrite is connected. You can close this tab.</h2></body></html>')

      const code = parsed.query.code
      if (!code) return done(reject, new Error('No auth code received'))

      try {
        const { tokens } = await client.getToken(code)
        client.setCredentials(tokens)
        store.set('oauthToken', tokens)
        done(resolve, tokens)
      } catch (err) {
        done(reject, err)
      }
    })

    const timeout = setTimeout(() => done(reject, new Error('Auth timed out')), 5 * 60 * 1000)
    server.on('close', () => clearTimeout(timeout))
    server.listen(42814, () => shell.openExternal(authUrl))
    server.on('error', (err) => done(reject, err))
  })
}

export function signOut() {
  store.delete('oauthToken')
}
