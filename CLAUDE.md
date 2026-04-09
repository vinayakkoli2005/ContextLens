# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ContextChat** is a Chrome Extension (Manifest V3) that lets users select text on any webpage and interact with it using an **inline AI assistant**. Users can perform quick actions (Ask, Summarize, Define) on selected text, view responses in a floating card, and optionally save results as persistent notes. Built with React 18 + TypeScript + Vite + CRXJS.

**Current status:** Step 1 (MVP Scaffold) complete. Steps 2–15 defined in `plan.md`.

## UI Direction

**Primary interaction: Inline floating UI** (rendered by the content script inside Shadow DOM)
- User selects text → floating action button (FAB) appears → click opens action panel → AI responds in a floating response card → optionally save as a note
- All inline UI lives inside a Shadow DOM container to avoid CSS conflicts with host pages
- Interactions are temporary and ephemeral — the UI disappears when closed

**Secondary: Side Panel** (saved notes + settings only)
- The side panel is NOT the primary interaction surface
- It displays saved notes (expand/collapse) and settings (API key, provider selection)
- Do NOT build new features that rely on the side panel for primary user interaction

## Commands

All commands run from `contextchat/`:

```bash
npm run dev      # Dev server with HMR (localhost:5173)
npm run build    # TypeScript check + Vite bundle → dist/
npm run preview  # Preview production build locally
```

To load the extension in Chrome: open `chrome://extensions`, enable Developer Mode, click "Load unpacked", select `contextchat/dist/`.

There is no lint or test runner configured yet.

## Architecture

The extension has **three isolated execution contexts** that communicate via Chrome's message-passing API (`chrome.runtime.sendMessage`):

### Content Script (`src/content/`) — PRIMARY UI OWNER
- Injected into every webpage
- Owns all inline UI: FAB, action panel, response card, note markers
- Detects text selections (mouseup with debounce)
- Renders everything inside a **Shadow DOM** container (`#contextchat-root`)
- Orchestrated by `inline-ui.ts` which coordinates all UI components
- Key modules:
  - `shadow-host.ts` — creates/manages Shadow DOM + injects styles
  - `selection-detector.ts` — detects text selection, extracts context
  - `fab.ts` — floating action button
  - `action-panel.ts` — input field + quick action buttons
  - `response-card.ts` — displays AI response with save/close
  - `inline-ui.ts` — orchestrator that wires everything together

### Service Worker (`src/background/service-worker.ts`) — BACKEND
- Central coordinator with **no DOM access** (no `document`, `window`, `alert`)
- Handles all AI API calls (OpenAI, Anthropic, Ollama) — avoids CORS issues
- Owns all IndexedDB reads/writes (notes) and `chrome.storage` access (settings)
- Routes messages between content scripts and the side panel
- Key modules:
  - `message-handler.ts` — registers handlers for each message type
  - `ai-client.ts` — builds prompts and calls AI provider APIs
  - `db.ts` — IndexedDB wrapper for note CRUD

### Side Panel (`src/sidepanel/`) — SECONDARY
- React app (React 18 + Tailwind) with two tabs: Notes and Settings
- Displays saved notes with expand/collapse
- Settings UI for API key input and provider selection
- Does NOT handle primary AI interactions

### Data Flow
```
Text selected on page
  → Content Script detects (selection-detector.ts)
  → Shows FAB near selection (fab.ts)
  → User clicks FAB → action panel appears (action-panel.ts)
  → User picks action → sends AI_REQUEST to service worker (messaging.ts)
  → Service worker calls AI API (ai-client.ts)
  → Response returns → content script shows response card (response-card.ts)
  → User clicks "Save as Note" → sends SAVE_NOTE to service worker
  → Service worker persists to IndexedDB (db.ts)
  → Side panel can view saved notes via GET_NOTES
```

## Shared Code (`src/shared/`)

- **`types.ts`** — Core types (`Thread`, `Message`, `Document`, etc.) and `MessageType` union (25 message types including inline flow: `AI_REQUEST`, `AI_RESPONSE`, `SAVE_NOTE`, etc.)
- **`note-types.ts`** — New data model: `Note`, `DOMAnchor`, `AIConfig`, `QuickAction`, `InlineUIPosition`
- **`constants.ts`** — DB constants, highlight colors, selection limits, inline UI constants (`ACTION_PANEL_WIDTH`, `SHADOW_HOST_ID`, `INLINE_UI_Z_INDEX`, etc.)
- **`messaging.ts`** — `sendMessage()`, `onMessage()`, `initMessageListener()` — the complete message passing system

## Data Model

```
Note (IndexedDB)           Settings (chrome.storage.local)
├── id: string             ├── provider: openai | anthropic | ollama
├── selectedText           ├── apiKey
├── context                ├── model
├── action: ask|summarize|define  └── ollamaUrl
├── query? (for ask)
├── response (markdown)
├── url, title
├── anchor: DOMAnchor
└── createdAt
```

## Key Technical Constraints

- **Service worker has no DOM access** — never use `document`/`window` there
- **All UI must be rendered by the content script** inside Shadow DOM
- **IndexedDB** (via `idb` library) for notes — `chrome.storage` (100 KB limit) only for settings
- **Shadow DOM** is required to prevent CSS leaking in either direction
- **CRXJS Vite plugin** handles Chrome extension bundling; see `REFERENCE_CRXJS.md`
- **Escape all user-generated content** (selected text) before rendering in innerHTML to prevent XSS
- The `vite.config.ts` includes a custom plugin to copy content script styles into `dist/`

## AI Provider Support

Three backends via `AIConfig.provider`:
- `openai` — OpenAI Chat Completions API (default model: `gpt-4o-mini`)
- `anthropic` — Anthropic Messages API (default model: `claude-sonnet-4-20250514`)
- `ollama` — Local Ollama instance (default model: `llama3.2`)

Only the **service worker** makes AI API calls. The content script sends `AI_REQUEST` messages and receives responses through the message channel.

## Development Guidelines

- New features should default to the **inline floating UI** unless they specifically need persistent state display (use side panel for that)
- Keep inline UI components modular — each in its own file under `src/content/`
- All inline styles are defined in `shadow-host.ts` and injected into the Shadow DOM
- Follow the existing message type pattern: add new types to `MessageType` union, register handlers in `message-handler.ts`
- Test in Chrome with "Load unpacked" after every build — HMR does not work for content scripts
