# Latte Dictate - Web Speech probe

Feasibility test for a standalone dictation app that uses **Chrome's**
`SpeechRecognition` and types the result into whatever window has focus.

Electron cannot do this: `webkitSpeechRecognition` is backed by an API key
compiled into official Google Chrome builds, and Electron's Chromium ships
without it. Chromium, Brave and ungoogled-chromium have the same gap. A separate
process driving real Chrome does not.

## Run

```sh
python3 dictate/probe.py            # simulated keystrokes
python3 dictate/probe.py --paste    # clipboard + ctrl+v (faster, unicode-safe)
python3 dictate/probe.py --no-type  # log only, inject nothing
python3 dictate/probe.py --no-punct # literal words, no spoken punctuation
python3 dictate/probe.py --no-caps  # no automatic sentence capitalisation
```

Stdlib only - no pip install.

## Spoken punctuation

`textproc.py` turns recognised words into written prose. Chrome's on-device
recogniser returns almost no punctuation and little capitalisation, so this is
what makes it usable for a word processor rather than a search box.

```sh
python3 dictate/textproc.py             # list every command
python3 dictate/textproc.py --selftest  # 20 cases
```

Say "hello comma this is latte dictate period" and you get
`Hello, this is latte dictate.` Also `new paragraph`, `new line`, `open paren`,
`quote` (alternates open/close), `cap` for the next word only, and `all caps`.

Two design points worth knowing:

- **It is stateful, and order matters.** Spacing and capitalisation depend on the
  previous phrase, so the processor emits a *leading* space and never a trailing
  one - that is how a chunk starting with "comma" avoids `hello ,`. Finals must
  therefore reach the server in order; the page serialises them on a promise
  chain. Anything that parallelises event delivery later will corrupt spacing.
- **Command words are ambiguous by nature.** Dictating "the comma is a
  punctuation mark" produces "the, is a punctuation mark". Every dictation
  product has this; the escape hatch is the SPOKEN PUNCTUATION toggle. A
  "literal" prefix would be the usual fix if it becomes annoying.

### Why punctuation used to fire only sometimes

Chrome is not consistent about how it transcribes a compound command. The same
spoken "question mark" comes back as `question mark`, `question-mark` or
`questionmark` at random, and matching only the spaced form made punctuation
look unreliable. `COMMANDS` is now keyed by every spelling, and `_norm` treats
hyphens and underscores as word separators.

The other half of the problem is a command cut in two by a phrase boundary: one
final ends `...pizza question`, the next starts `mark`, and neither matches.
A trailing word listed in `SPLIT_SAFE` is held back and rejoined with the next
phrase. Only words that rarely end a real sentence are eligible - holding "at",
"new" or "open" would delay very common words, so those stay imperfect.

A held word is released by `flush()`, which the page triggers on STOP. Without
that, saying "I have a question" and stopping would swallow the last word.

Not implemented yet: "scratch that" (needs tracked backspaces), and a
substitution map so "latte dictate" comes out as "Latte Dictate".

## What it is testing

1. **On-device model.** Chrome 150 reports `available({langs:['en-US'],
   processLocally:true})` as `downloadable` here. Press INSTALL ON-DEVICE MODEL
   (needs a user gesture), then recognition runs offline with no audio leaving
   the machine. Confirm by turning off wifi with On-device selected.
2. **Recognition survives loss of focus.** The design depends on it - you speak
   while a *different* app is focused. Click into another window and watch
   RESULTS WHILE UNFOCUSED climb. If it stays at zero, the architecture needs
   rethinking.
3. **Latency and accuracy**, versus the bundled Whisper in
   `src/renderer/src/dictation.js`.

Typing is skipped while the probe window itself has focus, otherwise the text
would land back in the probe.

## Input injection on Wayland

Wayland blocks apps from synthesising input into other apps. `ydotool` gets
around it at the kernel level via `/dev/uinput`, so it works on Wayland, X11 and
the TTY alike. `xdotool` only reaches XWayland clients and is not enough.

`probe.py` starts `ydotoold` if it is not running. That needs `/dev/uinput`
writable by your user - on this machine systemd-logind already grants it by ACL
for the active seat. If it is not writable:

```sh
echo 'KERNEL=="uinput", GROUP="input", MODE="0660", OPTIONS+="static_node=uinput"' \
  | sudo tee /etc/udev/rules.d/80-uinput.rules
sudo usermod -aG input "$USER"     # log out and back in
```

For a real install, run `ydotoold` as a user service rather than letting the
probe spawn it.

## Known rough edges

- Results post over HTTP, one request per final. Fine on loopback; the real app
  should use a WebSocket so interim text can drive an in-editor overlay.
- The clipboard path clobbers the clipboard. Save and restore it.
- `continuous` recognition still stops on its own; the page restarts it, which
  can drop a word at the seam.
- The mic grant is scoped to `localhost:42815`, so the port is pinned. A
  dedicated `--user-data-dir` would keep this out of your main Chrome profile,
  but then the on-device model downloads into that profile instead.
