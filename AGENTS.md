# AGENTS.md

## Project Overview

ContextChat is a Chrome Extension (Manifest V3) that enables inline AI interactions on selected webpage text.

Core flow:
Select text → show floating UI → perform action (ask/summarize/define) → display AI response → optionally save as note.

Stack:
- React 18
- TypeScript
- Vite
- CRXJS

Status:
- MVP scaffold complete
- Further steps defined in plan.md

---

## UI Architecture

Primary: Inline floating UI (content script)
- Rendered inside Shadow DOM
- Ephemeral (disappears when closed)

Secondary: Side panel
- Used only for saved notes and settings
- NOT for primary interactions

---

## Commands

Run from project root:

npm run dev
npm run build
npm run preview

Load extension:
- chrome://extensions
- Enable Developer Mode
- Load unpacked → select dist/

---

## System Architecture

Three execution contexts:

### 1. Content Script (UI Layer)
- Handles text selection
- Renders UI (FAB, panel, response card)
- Runs inside Shadow DOM
- No direct API calls

### 2. Service Worker (Backend)
- Handles AI API calls
- Manages IndexedDB and settings
- Routes messages
- No DOM access

### 3. Side Panel
- Displays saved notes
- Settings UI

---

## Data Flow

Selection → Content Script  
→ Send AI_REQUEST  
→ Service Worker calls AI  
→ Return response  
→ Display UI  
→ Optional SAVE_NOTE → IndexedDB  

---

## Shared Modules

- types.ts → core types
- messaging.ts → communication system
- constants.ts → config values
- db.ts → IndexedDB wrapper

---

## Data Model

Note:
- id
- selectedText
- context
- action
- response
- url
- anchor
- createdAt

Settings:
- provider
- apiKey
- model

---

## Rules

- All UI must be in content script (Shadow DOM)
- Service worker must not use DOM APIs
- Use message passing for communication
- Keep components modular
- Escape user content to prevent XSS
- Use IndexedDB for notes, chrome.storage for settings

---

## AI Providers

Supported:
- OpenAI
- Anthropic
- Ollama

Only service worker makes API calls.

---

## Development Guidelines

- Prefer inline UI for new features
- Use side panel only for persistent data
- Add new message types in a structured way
- Keep files small and modular
- Follow existing architecture strictly

---