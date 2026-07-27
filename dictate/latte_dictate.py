#!/usr/bin/env python3
"""Latte Dictate - dictation into any window.

Chrome does the speech recognition (it is the only browser carrying Google's
speech API key, and since Chrome 150 it can run the model on-device, offline).
This daemon hosts the page Chrome runs, and types what comes back into whatever
window has focus.

  latte_dictate.py                 start the daemon in the foreground
  latte_dictate.py toggle          start/stop listening (bind this to a hotkey)
  latte_dictate.py start | stop
  latte_dictate.py status
  latte_dictate.py quit            shut the daemon down

`toggle` launches the daemon itself if it is not already running, so a single
hotkey is enough to go from nothing to dictating.

Stdlib only.
"""
import argparse
import http.server
import json
import os
import queue
import shutil
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request

from inject import ensure_ydotoold, type_text
from textproc import Punctuator, command_reference

HERE = os.path.dirname(os.path.abspath(__file__))
PAGE = os.path.join(HERE, 'engine.html')

# Pinned: Chrome scopes the microphone grant to the origin, so a stable port
# means approving the mic once rather than on every run.
PORT = 42815

ACTIONS = ('toggle', 'start', 'stop', 'status', 'quit')


class State:
    """Everything the daemon knows. One instance, guarded by a lock."""

    def __init__(self, opts):
        self.opts = opts
        self.lock = threading.Lock()
        self.listening = False
        self.availability = 'unknown'
        self.punct = Punctuator(auto_caps=not opts.no_caps)
        self.subscribers = set()      # queue.Queue, one per connected page
        self.stopping = threading.Event()
        self.typed = 0

    # ── page channel ─────────────────────────────────────────────────────────

    def subscribe(self):
        q = queue.Queue()
        with self.lock:
            self.subscribers.add(q)
        return q

    def unsubscribe(self, q):
        with self.lock:
            self.subscribers.discard(q)

    def broadcast(self, msg):
        with self.lock:
            targets = list(self.subscribers)
        for q in targets:
            q.put(msg)

    @property
    def connected(self):
        with self.lock:
            return len(self.subscribers)

    # ── control ──────────────────────────────────────────────────────────────

    def set_listening(self, on):
        on = bool(on)
        if on == self.listening:
            return self.snapshot()
        self.listening = on
        if on:
            # Spacing and capitalisation carry across phrases, so each session
            # starts from a clean slate.
            self.punct.reset()
            self.broadcast({'cmd': 'start'})
        else:
            # Release a half-command still held back, e.g. a trailing
            # "question" that never got its "mark".
            tail = self.punct.flush()
            if tail:
                self.write(tail)
            self.broadcast({'cmd': 'stop'})
        log('listening' if on else 'idle')
        return self.snapshot()

    def snapshot(self):
        return {
            'listening': self.listening,
            'availability': self.availability,
            'connected': self.connected,
            'typed': self.typed,
        }

    # ── output ───────────────────────────────────────────────────────────────

    def write(self, text):
        if not text or self.opts.no_type:
            return
        ok, err = type_text(text, paste=not self.opts.keystrokes)
        if ok:
            self.typed += len(text)
        else:
            log(f'! ydotool failed: {err}')


def log(msg):
    print(f'  {time.strftime("%H:%M:%S")}  {msg}', flush=True)


# ── HTTP ─────────────────────────────────────────────────────────────────────

class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    state = None

    def log_message(self, *a):
        pass

    def _send(self, code, body=b'', ctype='text/plain'):
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        if body:
            self.wfile.write(body)

    def _json(self, obj, code=200):
        self._send(code, json.dumps(obj).encode(), 'application/json')

    # ── GET ──────────────────────────────────────────────────────────────────

    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/ping':
            return self._json({'ok': True, **self.state.snapshot()})
        if path == '/commands':
            # Served rather than duplicated in the page, so textproc.py stays
            # the single source of truth for what you can say.
            return self._send(200, command_reference().encode(),
                              'text/plain; charset=utf-8')
        if path == '/stream':
            return self._stream()
        if path in ('/', '/index.html'):
            try:
                with open(PAGE, 'rb') as f:
                    return self._send(200, f.read(), 'text/html; charset=utf-8')
            except OSError as e:
                return self._send(500, str(e).encode())
        self._send(404, b'not found')

    def _stream(self):
        """Server-sent events: how the hotkey reaches the page.

        No Content-Length, and 'Connection: close' so the client reads until
        EOF rather than expecting chunked framing. EventSource reconnects on
        its own if this drops.
        """
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream')
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Connection', 'close')
        self.end_headers()

        st = self.state
        q = st.subscribe()
        try:
            # Tell a page that just loaded (or reconnected) where things stand.
            self._push({'cmd': 'start' if st.listening else 'stop'})
            while not st.stopping.is_set():
                try:
                    self._push(q.get(timeout=15))
                except queue.Empty:
                    self.wfile.write(b': ping\n\n')   # keep the connection warm
                    self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass
        finally:
            st.unsubscribe(q)

    def _push(self, msg):
        self.wfile.write(f'data: {json.dumps(msg)}\n\n'.encode())
        self.wfile.flush()

    # ── POST ─────────────────────────────────────────────────────────────────

    def do_POST(self):
        path = self.path.split('?')[0]
        n = int(self.headers.get('Content-Length', 0))
        try:
            body = json.loads(self.rfile.read(n) or b'{}')
        except json.JSONDecodeError:
            return self._send(400, b'bad json')

        if path == '/control':
            return self._control(body)
        if path == '/event':
            return self._event(body)
        self._send(404, b'not found')

    def _control(self, body):
        st = self.state
        action = body.get('action')
        if action == 'toggle':
            return self._json(st.set_listening(not st.listening))
        if action in ('start', 'stop'):
            return self._json(st.set_listening(action == 'start'))
        if action == 'status':
            return self._json(st.snapshot())
        if action == 'quit':
            st.set_listening(False)
            self._json({'ok': True})
            threading.Thread(target=st.stopping.set, daemon=True).start()
            return
        self._json({'error': f'unknown action {action!r}'}, 400)

    def _event(self, ev):
        st = self.state
        kind = ev.get('kind')

        if kind == 'ready':
            st.availability = ev.get('availability', 'unknown')
            log(f'page connected - on-device model: {st.availability}')
            return self._json({'ok': True})

        if kind == 'status':
            log(f'engine: {ev.get("text", "")}')
            return self._json({'ok': True})

        if kind == 'final':
            text = (ev.get('text') or '').strip()
            if not text or not st.listening:
                return self._json({'out': ''})
            st.punct.enabled = not st.opts.no_punct
            out = st.punct.feed(text)
            log(f'{text!r} -> {out!r}')
            st.write(out)
            return self._json({'out': out})

        self._json({'ok': True})


class Server(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


# ── Chrome ───────────────────────────────────────────────────────────────────

def profile_dir():
    """A profile Chrome can actually reach. The Flatpak build cannot see
    ~/.local/share, so put it inside the Flatpak's own data directory."""
    flatpak = os.path.expanduser('~/.var/app/com.google.Chrome')
    if os.path.isdir(flatpak):
        return os.path.join(flatpak, 'data', 'latte-dictate')
    return os.path.expanduser('~/.local/share/latte-dictate/chrome')


def launch_chrome(url, dedicated=False):
    """Open the engine page in real Google Chrome. Chromium, Brave and
    ungoogled-chromium do not carry Google's speech API key."""
    flags = [f'--app={url}', '--window-size=420,150',
             '--no-first-run', '--no-default-browser-check']
    if dedicated:
        d = profile_dir()
        os.makedirs(d, exist_ok=True)
        flags.append(f'--user-data-dir={d}')
        log(f'using dedicated profile {d}')

    native = shutil.which('google-chrome-stable') or shutil.which('google-chrome')
    if native:
        cmd = [native, *flags]
    elif shutil.which('flatpak') and subprocess.run(
            ['flatpak', 'info', 'com.google.Chrome'],
            capture_output=True).returncode == 0:
        cmd = ['flatpak', 'run', 'com.google.Chrome', *flags]
    else:
        return None
    subprocess.Popen(cmd, start_new_session=True,
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return cmd[0]


# ── client mode ──────────────────────────────────────────────────────────────

def call(port, action, timeout=3):
    req = urllib.request.Request(
        f'http://127.0.0.1:{port}/control',
        data=json.dumps({'action': action}).encode(),
        headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def running(port):
    try:
        with urllib.request.urlopen(f'http://127.0.0.1:{port}/ping', timeout=1) as r:
            return json.load(r)
    except (urllib.error.URLError, OSError, json.JSONDecodeError):
        return None


def spawn_daemon(argv_extra):
    """Start the daemon detached, so the first hotkey press does everything."""
    subprocess.Popen([sys.executable, os.path.abspath(__file__), *argv_extra],
                     start_new_session=True,
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def client(action, opts):
    st = running(opts.port)
    if not st:
        if action in ('stop', 'quit'):
            print('not running')
            return 0
        if action == 'status':
            print('not running')
            return 1
        # toggle/start with nothing up: bring the whole thing online.
        print('starting Latte Dictate...')
        spawn_daemon(['--listen-on-start'] + (['--dedicated-profile']
                                              if opts.dedicated_profile else []))
        return 0
    try:
        out = call(opts.port, action)
    except (urllib.error.URLError, OSError) as e:
        print(f'could not reach daemon: {e}')
        return 1
    if action == 'quit':
        print('stopped')
        return 0
    print('listening' if out.get('listening') else 'idle',
          f'| model {out.get("availability")}',
          f'| {out.get("connected")} page(s)')
    return 0


# ── main ─────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('action', nargs='?', choices=ACTIONS,
                    help='control a running daemon; omit to start one')
    ap.add_argument('--port', type=int, default=PORT)
    ap.add_argument('--keystrokes', action='store_true',
                    help='simulate each key instead of pasting via the clipboard')
    ap.add_argument('--no-type', action='store_true', help='log only, inject nothing')
    ap.add_argument('--no-punct', action='store_true',
                    help='disable spoken punctuation commands')
    ap.add_argument('--no-caps', action='store_true',
                    help='disable automatic sentence capitalisation')
    ap.add_argument('--no-launch', action='store_true', help='do not open Chrome')
    ap.add_argument('--dedicated-profile', action='store_true',
                    help='run Chrome in its own profile, isolated from your browsing')
    ap.add_argument('--listen-on-start', action='store_true',
                    help='begin listening as soon as the page connects')
    opts = ap.parse_args()

    if opts.action:
        return client(opts.action, opts)

    if running(opts.port):
        print(f'already running on port {opts.port}')
        return 1

    state = State(opts)
    Handler.state = state

    if not opts.no_type:
        ok, msg = ensure_ydotoold()
        log(msg if ok else f'! {msg}')
        if not ok:
            log('! typing disabled; results will only be logged')
            opts.no_type = True

    try:
        srv = Server(('127.0.0.1', opts.port), Handler)
    except OSError as e:
        sys.exit(f'cannot bind {opts.port}: {e}')
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    url = f'http://localhost:{opts.port}/'
    log(f'Latte Dictate on {url}')
    if not opts.no_launch:
        which = launch_chrome(url, dedicated=opts.dedicated_profile)
        log(f'launched {which}' if which
            else f'! Google Chrome not found - open {url} in Chrome yourself')

    if opts.listen_on_start:
        # Wait for the page to subscribe, otherwise the start command goes
        # nowhere - broadcast only reaches pages already connected.
        for _ in range(200):
            if state.connected:
                break
            time.sleep(0.1)
        state.set_listening(True)

    try:
        while not state.stopping.wait(0.5):
            pass
    except KeyboardInterrupt:
        pass
    log('shutting down')
    state.set_listening(False)
    srv.shutdown()
    return 0


if __name__ == '__main__':
    sys.exit(main())
