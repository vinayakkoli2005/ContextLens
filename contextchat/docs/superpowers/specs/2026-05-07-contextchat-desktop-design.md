# ContextChat Desktop — Design Spec
**Date:** 2026-05-07  
**Status:** Approved  
**Platform:** Windows 11  
**Stack:** Electron + React + TypeScript + Tailwind + Ollama

---

## Overview

ContextChat Desktop is a system-wide AI assistant that lives in the Windows system tray. It monitors for text selections and screenshots anywhere on the laptop and surfaces a transparent floating panel near the cursor. All AI inference runs locally via Ollama — no cloud API required.

---

## Core Flows

### 1. Text Selection Flow
1. User selects text in any application (browser, Word, VS Code, PDF viewer, etc.)
2. On mouseup, global hook detects a drag occurred (start position ≠ end position)
3. Main process simulates Ctrl+C into a temp slot, saves previous clipboard, reads selected text, restores clipboard
4. If selected text length > 3 characters → floating icon (16×16px app logo) appears near cursor, always on top
5. User clicks icon → transparent frosted-glass panel slides in near the selection (draggable to anywhere on screen)
6. Panel shows: truncated text preview, action pills (Explain / Summarize / Ask), free-form input, model selector
7. User picks action or types a question → IPC to main process → streamed request to Ollama
8. Tokens stream back via IPC → panel displays response live word-by-word
9. User can continue chatting (conversation memory retained within session)
10. User closes panel (✕ or clicks away) → icon hidden, conversation discarded, clipboard fully restored

### 2. Screenshot Flow
1. Clipboard poller runs every 500ms in main process
2. User takes screenshot (Win+Shift+S or PrtSc) → image lands in clipboard
3. Main process detects clipboard now contains an image
4. Toast notification appears bottom-right: "📸 Screenshot ready — Ask ContextChat? [Yes] [Dismiss]"
5. User clicks Yes → panel opens with screenshot embedded at top
6. User types question → main process sends image + prompt to Ollama (vision model required: llava, moondream)
7. Response streams back identically to text flow
8. User can drag screenshot onto tray icon as an alternative entry point

### 3. System Tray
- App auto-starts with Windows on login (electron-auto-launch)
- Tray icon always visible in taskbar notification area
- Right-click menu: Open Settings | Quit
- Left-click: Open Settings panel

---

## UI Design

### Floating Icon
- 16×16px app logo
- Appears within 20px of text selection end point
- `alwaysOnTop: true`, no frame, transparent background
- Auto-hides after 4 seconds if not clicked
- Disappears immediately when panel opens

### Transparent Panel
- Size: 320px wide, height dynamic (min 280px, max 600px)
- `BrowserWindow` with `transparent: true`, `frame: false`, `alwaysOnTop: true`
- Frosted glass effect: `backdrop-filter: blur(20px)` + semi-transparent dark background (`rgba(20,20,20,0.75)`)
- Draggable via title bar area
- Positions near cursor on open; user can drag anywhere on screen
- Sections (top to bottom):
  1. **Header** — drag handle, app name, minimize (—) and close (✕) buttons
  2. **Context preview** — selected text or screenshot thumbnail, dimmed, max 3 lines truncated
  3. **Divider**
  4. **Action pills** — [Explain] [Summarize] [Ask] (quick actions, single click)
  5. **Chat history** — scrollable message thread (user + assistant turns)
  6. **Input area** — free-form text input, always visible
  7. **Footer** — Model selector dropdown + Send button

### Screenshot Toast
- Fixed position: bottom-right, 20px margin
- Auto-dismisses after 8 seconds
- Frosted glass style consistent with panel

### Settings Panel
- Opens as a separate `BrowserWindow` (not transparent)
- Sections:
  - Hardware info: detected RAM, recommended model with explanation
  - Model selector: lists all models from `GET /api/tags`, highlights recommended
  - Ollama URL: configurable (default `http://localhost:11434`)
  - Launch at startup: toggle

---

## Conversation Memory

Each panel session maintains an in-memory conversation:

```
Conversation {
  id: uuid (new per panel open)
  messages: Message[]
}

Message {
  role: "system" | "user" | "assistant"
  content: string | { type: "image", data: base64 }
}
```

**System prompt** (always first, never dropped):
> "You are a helpful assistant. The user has selected the following content from their screen: [original text or image]. Help them understand, summarize, or discuss it."

**Rolling window:** When `messages.length > 22` (system + 10 user/assistant pairs), drop the oldest user+assistant pair (indices 1 and 2), keeping system prompt and all recent messages intact.

**Every Ollama request** sends the full current `messages[]` array — no stateless calls.

**Session ends** when panel is closed → conversation object garbage collected, nothing persisted.

---

## Hardware-Based Model Recommendation

On startup, query `os.totalmem()` and `GET /api/tags` (installed models):

| RAM | Recommended Text Model | Recommended Vision Model |
|-----|----------------------|------------------------|
| < 8GB | `moondream` | `moondream` |
| 8–16GB | `llama3.2` | `llava` |
| > 16GB | `llama3.1:8b` | `llava:13b` |

- Recommendation shown in Settings with plain-English explanation
- User can override; choice saved to `electron-store`
- If recommended model is not installed, show install command hint: `ollama pull <model>`

---

## Data Flow

```
[Any App on Windows]
        │ mouseup (drag detected)
        ▼
[uiohook-napi — Main Process]
        │ simulate Ctrl+C, read text, restore clipboard
        ▼
[Floating Icon BrowserWindow]
        │ user clicks
        ▼
[Panel BrowserWindow — Renderer]
        │ user action/question (IPC: ipcRenderer.invoke)
        ▼
[Main Process — ollama-client.ts]
        │ POST /api/chat with full messages[]
        ▼
[Ollama localhost:11434]
        │ streaming tokens
        ▼
[Main Process streams via ipcMain]
        │ ipcRenderer.on('token', ...)
        ▼
[Panel — ResponseStream.tsx updates live]
```

---

## Tech Stack

| Package | Purpose |
|---------|---------|
| `electron` | App shell |
| `electron-vite` | Vite bundler for main + renderer |
| `react` + `typescript` | Panel UI |
| `tailwindcss` | Styling |
| `uiohook-napi` | Global mouse events (cross-process, Windows) |
| `@nut-tree/nut-js` | Simulate Ctrl+C, clipboard access |
| `ollama` (npm) | Official Ollama JS client with streaming |
| `electron-store` | Settings persistence (JSON) |
| `electron-auto-launch` | Auto-start with Windows |
| `uuid` | Conversation session IDs |

---

## Project Structure

```
contextchat-desktop/
├── electron/
│   ├── main.ts                  ← Entry, BrowserWindow management
│   ├── tray.ts                  ← System tray icon + menu
│   ├── selection-monitor.ts     ← uiohook-napi hooks, clipboard save/restore
│   ├── clipboard-watcher.ts     ← 500ms poll for screenshot detection
│   ├── ollama-client.ts         ← Streaming Ollama calls, rolling window logic
│   ├── hardware-detector.ts     ← RAM query + model recommendation
│   └── store.ts                 ← electron-store wrapper
├── src/
│   ├── panel/
│   │   ├── Panel.tsx            ← Root panel component
│   │   ├── ActionButtons.tsx    ← Explain/Summarize/Ask pills
│   │   ├── ChatHistory.tsx      ← Scrollable message thread
│   │   ├── ModelSelector.tsx    ← Dropdown with recommendation highlight
│   │   └── ResponseStream.tsx   ← Live streaming token display
│   ├── settings/
│   │   └── Settings.tsx         ← Settings UI
│   └── toast/
│       └── ScreenshotToast.tsx  ← Screenshot detection toast
├── package.json
├── vite.config.ts
└── electron-builder.config.ts   ← Windows NSIS installer
```

---

## Key Constraints

- **No cloud API** — all inference via local Ollama only
- **Clipboard integrity** — always save and restore previous clipboard before/after reading selection
- **Vision queries require a vision model** — if user has no vision model installed, show friendly error in panel with install hint
- **Ollama must be running** — on startup check `GET /api/tags`; if unreachable, show tray tooltip "Ollama not detected — please start Ollama"
- **XSS prevention** — selected text rendered as plain text, never via `innerHTML`
- **No persistent note storage in v1** — ephemeral only; notes feature can be added in a later milestone

---

## Out of Scope (v1)

- macOS / Linux support
- Persistent notes / history
- Multiple simultaneous panel sessions
- Custom system prompts per action
- Hotkey to trigger panel without mouse selection
