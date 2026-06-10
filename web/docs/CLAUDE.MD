# Piano Teacher — Web App Documentation

## Overview

Piano Teacher is a French-language piano learning app. Users import MIDI files, study songs phrase by phrase, and practice with real-time feedback.

Tech stack: **React 19**, **Vite 7**, **Tone.js 15** (audio), **@tonejs/midi** (MIDI parse), LocalStorage persistence.

---

## Entry Points

`src/main.jsx` selects the app shell at build time via `VITE_PLATFORM`:

| `VITE_PLATFORM` | Shell | Target |
|---|---|---|
| *(unset / desktop)* | `AppDesktop.jsx` | Tauri desktop + browser |
| `mobile` | `AppMobile.jsx` | Android WebView (Tauri mobile) |

Both shells share the same pages and services; they differ only in layout chrome (top nav vs. bottom tab bar).

---

## Pages / Modes

| Mode ID | Component | Description |
|---|---|---|
| `library` | `SongLibrary.jsx` | Browse, import, delete songs |
| `editor` | `SongEditor.jsx` + `PianoRollEditor` | Note editing, phrase management |
| `learn` | `LiveLearning.jsx` | Phrase-by-phrase practice (Apprentissage) |
| `sheet` | `SheetMusicLearning.jsx` | Sheet music reading practice (Partition) |
| `liveplay` | `LivePlayViewOptimized.jsx` | Synthesia falling-note view (LivePlay) |

---

## Project Structure

```
web/src/
├── AppDesktop.jsx          # Desktop shell (top nav, sidebar)
├── AppMobile.jsx           # Mobile shell (bottom tab bar)
├── main.jsx                # Entry point — platform branch + theme init
├── index.css               # Element resets & spacing; vars from tokens.css
├── styles/
│   └── tokens.css          # SOLE source of CSS design tokens (see below)
├── components/
│   ├── SongLibrary.jsx
│   ├── SongEditor.jsx
│   ├── LiveLearning.jsx
│   ├── SheetMusicLearning.jsx
│   ├── LivePlayViewOptimized.jsx
│   ├── LivePlayCanvas.jsx  # Canvas renderer for falling notes
│   ├── PianoRoll.jsx       # Compact inline piano roll (practice view)
│   ├── editor/             # PianoRollEditor + canvas + controls
│   ├── learn/              # Sub-components for LiveLearning
│   └── ui/                 # Design primitives (Cover, Pill, HandBadge…)
├── hooks/
│   ├── usePlaybackPosition.js
│   ├── useCanvasLayers.js
│   ├── useMidiAudio.js
│   └── …
├── services/
│   ├── AudioEngine.js      # Tone.js clock + Salamander sampler + metronome
│   ├── MidiInputService.js # Web MIDI API — physical keyboard input
│   ├── MidiService.js      # MIDI file import/export
│   ├── StorageService.js   # LocalStorage CRUD for songs
│   ├── ScoreService.js     # Practice score / accuracy tracking
│   └── ThemeService.js     # data-theme/accent/hands attribute sync
├── models/
│   └── song.js             # Song/phrase/note schema + helpers
└── utils/
    └── sheetMusic.js       # Sheet music layout helpers
```

---

## Design Tokens

`src/styles/tokens.css` is the **single source of truth** for all CSS variables.

Switches applied to `<html>` via `data-*` attributes:

| Attribute | Values | Effect |
|---|---|---|
| `data-theme` | `dark` *(default)*, `light` | Background / surface / text palette |
| `data-accent` | `blue` *(default)*, `violet`, `emerald`, `amber` | `--accent`, `--accent-hover`, `--accent-dim` |
| `data-hands` | `classic` *(default)*, `ocean`, `forest`, `sunset`, `mono` | `--hand-right`, `--hand-left` |

Key token families: `--bg`, `--surface-{1-3}`, `--text-*`, `--accent*`, `--hand-*`, `--border*`, `--r-*` (radius), `--t-*` (timing), `--s-*` (spacing).

Compatibility aliases (`--bg-primary`, `--radius-md`, `--transition-fast` …) are re-exported in the same file so older components still work.

`main.jsx` imports `index.css` before `tokens.css`, so tokens.css always wins.

---

## Services

### AudioEngine.js
Tone.js wrapper — single audio clock for the whole app.
- `Tone.Sampler` loaded with Salamander Grand Piano samples.
- Integrated metronome (`MembraneSynth`).
- `schedulePhrase()` pre-queues notes at exact Transport times.
- `getMusicSeconds()` / `getIsActuallyPlaying()` for cross-component sync.

### MidiInputService.js
Web MIDI API wrapper for physical MIDI keyboard input. Emits `noteOn`, `noteOff`, `sustainPedal` events.

### MidiService.js
MIDI file import: parses via `@tonejs/midi`, maps tracks to internal melody/chord format.

### StorageService.js
LocalStorage CRUD. Saves songs as JSON; supports Tauri file-system export on desktop.

### ScoreService.js
Accuracy tracking: correct/missed notes, streak, percentage score per session.

### ThemeService.js
Reads/writes `data-theme`, `data-accent`, `data-hands` on `document.documentElement`. Uses a `MutationObserver` to notify listeners on change.

---

## Packaging

- **Web / Desktop**: Tauri (`src-tauri/`). `vite build` → Tauri bundles into a native app.
- **Android**: Separate native Kotlin/Compose app in `../android/`. Not a WebView wrapper — it is a fully independent codebase with its own design token system.

---

## Development

```bash
npm install
npm run dev        # Vite dev server (http://localhost:5173)
npm run build      # Production build
npm run lint       # ESLint
```

Set `VITE_PLATFORM=mobile` to develop the mobile shell in the browser.
