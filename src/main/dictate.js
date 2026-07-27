// Drives the Latte Dictate sibling app over its --serve protocol.
//
// Speech recognition cannot happen inside Electron: webkitSpeechRecognition is
// backed by an API key compiled into official Google Chrome builds, and
// Electron's Chromium ships without it. Latte Dictate is a separate process
// that drives real Chrome, so it can. We spawn it and speak JSON Lines:
//
//   out (its stdout)  {"event":"ready"|"state"|"interim"|"final"|"bye"|"error"}
//   in  (its stdin)   {"cmd":"start"|"stop"|"quit"}
//
// stderr carries its logs, and closing stdin shuts it down - so it cannot
// outlive us.
import { spawn } from 'child_process'
import { join, dirname } from 'path'
import fs from 'fs'
import os from 'os'

// Deliberately not 42815: that is the standalone daemon's port, and the user
// may have it running behind their global hotkey. Sharing it would make one
// refuse to start.
const PORT = 42816

const CANDIDATE_DIRS = [
  () => (process.env.APPIMAGE ? dirname(process.env.APPIMAGE) : null),
  () => join(os.homedir(), 'LatteWrite'),
  () => join(os.homedir(), 'Applications'),
  () => join(os.homedir(), '.local', 'bin')
]

// Development checkout, used only when no AppImage is found.
const DEV_SCRIPT = join(os.homedir(), 'Documents', 'DEVELOPMENT', 'CLAUDE',
  'LatteDictate', 'latte_dictate.py')

let child = null
let onEvent = () => {}
let buf = ''

/** Newest LatteDictate*.AppImage in the usual places, or the dev checkout. */
export function findBinary() {
  const override = process.env.LATTE_DICTATE
  if (override && fs.existsSync(override)) return override

  for (const get of CANDIDATE_DIRS) {
    const dir = get()
    if (!dir || !fs.existsSync(dir)) continue
    const hits = fs.readdirSync(dir)
      .filter(f => /^LatteDictate.*\.AppImage$/i.test(f) && !/_old\./i.test(f))
      .map(f => join(dir, f))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
    if (hits.length) return hits[0]
  }
  return fs.existsSync(DEV_SCRIPT) ? DEV_SCRIPT : null
}

export function available() {
  return !!findBinary()
}

function argvFor(bin) {
  // --no-type is essential: without it Latte Dictate ALSO types the text into
  // the focused window with ydotool, so every phrase would land twice - once
  // from us and once from it.
  const args = ['--serve', '--no-type', '--no-tray', '--port', String(PORT)]
  return bin.endsWith('.py') ? ['python3', [bin, ...args]] : [bin, args]
}

function handleLine(line) {
  line = line.trim()
  if (!line) return
  let ev
  try { ev = JSON.parse(line) } catch { return }
  onEvent(ev)
}

/** Spawn if needed. Returns false when Latte Dictate is not installed. */
export function ensure(send) {
  onEvent = send
  if (child) return true

  const bin = findBinary()
  if (!bin) return false

  const [cmd, args] = argvFor(bin)
  try {
    child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] })
  } catch {
    child = null
    return false
  }

  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk) => {
    // A chunk is not a line: JSON objects can be split across reads and
    // several can arrive together.
    buf += chunk
    const lines = buf.split('\n')
    buf = lines.pop()
    lines.forEach(handleLine)
  })

  // Its logs, not ours - surface them for debugging without mixing streams.
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (d) => console.log('[latte-dictate]', d.trimEnd()))

  const gone = (why) => {
    child = null
    buf = ''
    onEvent({ event: 'exit', text: why })
  }
  child.on('error', (e) => gone(e.message))
  child.on('exit', (code) => gone(code ? `exited (${code})` : 'stopped'))
  return true
}

function send(msg) {
  if (!child || !child.stdin.writable) return false
  try {
    child.stdin.write(JSON.stringify(msg) + '\n')
    return true
  } catch {
    return false
  }
}

export function setListening(on, emit) {
  if (on && !ensure(emit)) return false
  return send({ cmd: on ? 'start' : 'stop' })
}

/** Called on app quit. Closing stdin is enough, but ask politely first. */
export function shutdown() {
  if (!child) return
  send({ cmd: 'quit' })
  try { child.stdin.end() } catch {}
  const c = child
  child = null
  setTimeout(() => { try { c.kill() } catch {} }, 1500)
}
