#!/usr/bin/env python3
"""Typing text into whichever window has focus.

Wayland forbids apps from synthesising input into other apps, so this goes
through ydotool, which writes to /dev/uinput at the kernel level and is
therefore compositor-agnostic. xdotool only reaches XWayland clients.
"""
import os
import shutil
import subprocess
import threading
import time

YDOTOOL_SOCKET = f"/run/user/{os.getuid()}/.ydotool_socket"

# /usr/include/linux/input-event-codes.h
KEY_CTRL, KEY_V = 29, 47

# How long to leave our text on the clipboard before restoring the previous
# contents. The Wayland clipboard is a handshake, not a buffer: wl-copy serves
# the data from a background process, and the paste target reads it
# asynchronously. Restoring too early makes the paste arrive empty.
RESTORE_DELAY = 0.4


def ensure_ydotoold():
    """Start ydotoold if it is not already up. Runs unprivileged when
    /dev/uinput is ACL-writable, which systemd-logind grants on the active
    seat. Returns (ok, message)."""
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


# ── clipboard ────────────────────────────────────────────────────────────────

def _clip_read():
    """Current clipboard as bytes, or None if empty/unreadable.

    Only text is preserved. If you had an image on the clipboard it is lost -
    restoring arbitrary MIME types would mean re-serving every offered type,
    which is more machinery than this is worth.
    """
    if not shutil.which('wl-paste'):
        return None
    r = subprocess.run(['wl-paste', '--no-newline'], capture_output=True)
    return r.stdout if r.returncode == 0 else None


def _clip_write(data):
    subprocess.run(['wl-copy'], input=data, check=False,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def _clip_clear():
    subprocess.run(['wl-copy', '--clear'], check=False,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def paste_text(text):
    """Put text on the clipboard, press ctrl+v, then put back what was there.

    One keystroke regardless of length, and immune to keyboard-layout and
    unicode problems that per-key simulation runs into.
    """
    saved = _clip_read()
    _clip_write(text.encode())
    time.sleep(0.06)
    r = ydotool(['key', f'{KEY_CTRL}:1', f'{KEY_V}:1', f'{KEY_V}:0', f'{KEY_CTRL}:0'])

    def restore():
        if saved:
            _clip_write(saved)
        else:
            _clip_clear()

    threading.Timer(RESTORE_DELAY, restore).start()
    return r


def type_text(text, paste=False):
    """Send text to the focused window. Returns (ok, error_message)."""
    if not text:
        return True, ''
    if paste and shutil.which('wl-copy'):
        r = paste_text(text)
    else:
        # -f - reads stdin with escaping disabled, so the text stays literal
        # and never goes near a shell.
        r = ydotool(['type', '-f', '-'], stdin=text)
    if r.returncode != 0:
        return False, (r.stderr or '').strip()
    return True, ''
