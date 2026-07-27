#!/usr/bin/env python3
"""Latte Dictate - Web Speech probe.

Drives Chrome's SpeechRecognition from outside Electron and types the result
into whatever window has focus. This is the feasibility test for the standalone
dictation app; it answers three questions:

  1. Does Chrome's on-device model install, and does processLocally work offline?
  2. Does recognition keep running while the Chrome window is UNFOCUSED?
     (the whole design depends on this - you type into a different app)
  3. What does latency and accuracy actually feel like?

Stdlib only. Run:  python3 dictate/probe.py
"""
import argparse
import http.server
import json
import os
import shutil
import socket
import subprocess
import sys
import threading
import time

# Python puts this script's directory on sys.path, so this resolves from any cwd.
from textproc import Punctuator, command_reference

HERE = os.path.dirname(os.path.abspath(__file__))
PAGE = os.path.join(HERE, 'probe.html')

# Single client, so one shared processor is enough.
PUNCT = Punctuator()

# Pinned: Chrome scopes the microphone grant to the origin, so a stable port
# means you approve the mic once rather than on every run.
PORT = 42815

YDOTOOL_SOCKET = f"/run/user/{os.getuid()}/.ydotool_socket"
CTRL, V = 29, 47   # linux/input-event-codes.h


# ── Input injection ──────────────────────────────────────────────────────────

def ensure_ydotoold():
    """Start ydotoold if it isn't up. Runs unprivileged when /dev/uinput is
    ACL-writable by the user (systemd-logind grants this on the active seat)."""
    if not shutil.which('ydotool'):
        return False, 'ydotool is not installed'
    if os.path.exists(YDOTOOL_SOCKET):
        return True, 'ydotoold already running'
    if not os.access('/dev/uinput', os.W_OK):
        return False, '/dev/uinput is not writable - see README for the udev rule'
    try:
        subprocess.Popen(['ydotoold'], start_new_session=True,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except OSError as e:
        return False, f'could not start ydotoold: {e}'
    for _ in range(40):
        if os.path.exists(YDOTOOL_SOCKET):
            return True, 'started ydotoold'
        time.sleep(0.05)
    return False, 'ydotoold did not create its socket'


def ydotool(args, stdin=None):
    env = {**os.environ, 'YDOTOOL_SOCKET': YDOTOOL_SOCKET}
    return subprocess.run(['ydotool', *args], input=stdin, env=env,
                          capture_output=True, text=True)


def type_text(text, paste=False):
    """Send text to the focused window.

    paste=True goes through the clipboard: one keystroke regardless of length,
    and immune to keyboard-layout and unicode problems. It does clobber the
    clipboard, so the real app will need to save and restore it.
    """
    if paste and shutil.which('wl-copy'):
        subprocess.run(['wl-copy', '--', text], check=False)
        time.sleep(0.05)
        r = ydotool(['key', f'{CTRL}:1', f'{V}:1', f'{V}:0', f'{CTRL}:0'])
    else:
        # -f - reads stdin with escaping disabled, so the text stays literal
        # and never touches a shell.
        r = ydotool(['type', '-f', '-'], stdin=text)
    if r.returncode != 0:
        print(f'  ! ydotool failed: {(r.stderr or "").strip()}', flush=True)


# ── Server ───────────────────────────────────────────────────────────────────

class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    opts = None

    def log_message(self, *a):
        pass

    def _send(self, code, body=b'', ctype='text/plain'):
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        if body:
            self.wfile.write(body)

    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/commands':
            # Served rather than duplicated in the page, so textproc.py stays
            # the single source of truth for what you can say.
            return self._send(200, command_reference().encode(),
                              'text/plain; charset=utf-8')
        if path not in ('/', '/index.html'):
            return self._send(404, b'not found')
        try:
            with open(PAGE, 'rb') as f:
                self._send(200, f.read(), 'text/html; charset=utf-8')
        except OSError as e:
            self._send(500, str(e).encode())

    def _json(self, obj):
        self._send(200, json.dumps(obj).encode(), 'application/json')

    def do_POST(self):
        if self.path != '/event':
            return self._send(404, b'not found')
        n = int(self.headers.get('Content-Length', 0))
        try:
            ev = json.loads(self.rfile.read(n) or b'{}')
        except json.JSONDecodeError:
            return self._send(400, b'bad json')

        kind = ev.get('kind')
        if kind == 'session-start':
            # Spacing and capitalisation carry across phrases, so a new
            # listening session has to start from a clean slate.
            PUNCT.reset()
            print('\n  --- session start ---', flush=True)
            return self._json({'out': ''})

        if kind == 'session-end':
            # Release any half-command still held back, e.g. a trailing
            # "question" that never got its "mark".
            out = PUNCT.flush()
            if out:
                print(f'  --- session end, flushed {out!r} ---', flush=True)
                self._inject(ev, out)
            return self._json({'out': out})

        text = (ev.get('text') or '').strip()
        if kind != 'final' or not text:
            return self._json({'out': ''})

        PUNCT.enabled = bool(ev.get('punct', True)) and not self.opts.no_punct
        out = PUNCT.feed(text)

        where = 'unfocused' if not ev.get('focused') else 'FOCUSED'
        conf = ev.get('confidence')
        conf = f' conf={conf:.2f}' if isinstance(conf, (int, float)) else ''
        print(f'  [{ev.get("mode", "?")}/{where}{conf}] {text}', flush=True)
        if out.strip() != text:
            print(f'    -> {out!r}', flush=True)

        self._inject(ev, out)
        return self._json({'out': out})

    def _inject(self, ev, out):
        if not out or not ev.get('inject') or self.opts.no_type:
            return
        if ev.get('focused'):
            # Typing now would go straight back into the probe page.
            print('  ! skipped typing: probe window has focus', flush=True)
            return
        type_text(out, paste=self.opts.paste)


class Server(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


# ── Chrome ───────────────────────────────────────────────────────────────────

def launch_chrome(url):
    """Open the probe in real Google Chrome. Chromium and Brave do not carry
    Google's speech API key, so they cannot do cloud recognition."""
    flags = [f'--app={url}', '--window-size=760,880']
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


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--port', type=int, default=PORT)
    ap.add_argument('--paste', action='store_true',
                    help='inject via clipboard + ctrl+v instead of simulated keystrokes')
    ap.add_argument('--no-type', action='store_true', help='log results, never inject')
    ap.add_argument('--no-launch', action='store_true', help='do not open Chrome')
    ap.add_argument('--no-punct', action='store_true',
                    help='disable spoken punctuation commands (spacing still applied)')
    ap.add_argument('--no-caps', action='store_true',
                    help='disable automatic sentence capitalisation')
    opts = ap.parse_args()
    Handler.opts = opts
    PUNCT.auto_caps = not opts.no_caps
    PUNCT.reset()

    if not opts.no_type:
        ok, msg = ensure_ydotoold()
        print(('  ' if ok else '  ! ') + msg, flush=True)
        if not ok:
            print('  ! typing disabled; results will only be logged', flush=True)
            opts.no_type = True

    url = f'http://localhost:{opts.port}/'
    try:
        srv = Server(('127.0.0.1', opts.port), Handler)
    except OSError as e:
        sys.exit(f'cannot bind {opts.port}: {e}')

    threading.Thread(target=srv.serve_forever, daemon=True).start()
    print(f'\n  Latte Dictate probe  ->  {url}', flush=True)

    if not opts.no_launch:
        which = launch_chrome(url)
        print(f'  launched {which}' if which
              else f'  ! Google Chrome not found - open {url} in Chrome yourself', flush=True)

    print(f'''
  TEST IT
    1. Allow the microphone when Chrome asks (once, remembered for this port).
    2. If the model says DOWNLOADABLE, press INSTALL ON-DEVICE MODEL and wait.
    3. Press START LISTENING, tick ARM TYPING, then click into another window
       and speak. Text should appear there, and RESULTS WHILE UNFOCUSED
       should climb - that is the test that matters.
    4. To verify it is truly offline, turn off wifi with On-device selected.

  Ctrl+C to stop.
''', flush=True)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print('\n  stopped', flush=True)
        srv.shutdown()


if __name__ == '__main__':
    main()
