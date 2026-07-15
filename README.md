# LatteWrite

A beautiful, themeable, **presentation-first** word processor. Built to be gorgeous
enough to write in live during online classes and meetings — edit view and audience
view are the same view.

Electron + `electron-vite` + Svelte, with a Tiptap editing core.

## Features (v1 scaffold)

- **Tiptap editor** — headings, bold/italic/underline, quotes, lists, alignment.
- **Styles** — pick a whole look (colors + font pairing + reading measure) from the
  menu: Espresso, Ink, Manuscript, Lecture, Paper. Applied as CSS variables, so any
  Style can be forked later.
- **Presentation mode** (`Ctrl+Shift+P`) — full screen, chrome hidden, only a discreet
  floating control pill remains.
- **Dictation** (`Ctrl+D`) — English speech-to-text. Web Speech engine (online, free)
  today; local Whisper engine is stubbed for phase 2. Toggle in Settings.
- **Autosave + backups** — atomic writes to the live `.latte` file plus a rolling ring
  of timestamped backups in a sibling `.backups/` folder.
- **`.latte` bundle format** — a zip holding the document JSON and its metadata, so a
  file reopens identically anywhere (fonts/images embedding is phase 2).
- **Export** — PDF (white "Paper" theme, via Chromium print-to-PDF), HTML, Markdown,
  and best-effort DOCX.
- **Google Drive sync** — reused OAuth loopback flow (scope `drive.file`); enable in
  Settings. OneDrive is stubbed for phase 2.

## Develop

```bash
npm install
npm run dev
```

## Build the AppImage

```bash
npm run dist        # → dist/*.AppImage, copied to ~/LatteWrite/
```

## Google Drive setup

In Settings, paste a Google OAuth **Client ID** and **Client Secret** (Desktop app
credentials from Google Cloud Console), choose Google Drive as the provider, then
CONNECT. The redirect URI is `http://localhost:42814/callback`.

## Roadmap (phase 2)

- Local Whisper dictation (bundled `whisper.cpp` + model)
- OneDrive sync (Microsoft Graph)
- Any-Google-Font loading at runtime + font embedding in exports
- Custom Style editor
- Per-paragraph reveal (teleprompter mode)

## License

GNU General Public License v3.0 or later — see [LICENSE](LICENSE).
