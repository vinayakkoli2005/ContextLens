# ContextChat — Inline AI Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an inline floating AI assistant that appears near selected text on any webpage, with quick actions (Ask, Summarize, Define), response display, and optional note saving — all rendered inside a Shadow DOM by the content script.

**Architecture:** The content script owns all inline UI (FAB, action panel, response card) rendered inside a Shadow DOM container. The service worker handles AI API calls, IndexedDB persistence, and message routing. The side panel is demoted to a secondary role: viewing saved notes and configuring settings/API keys.

**Tech Stack:** React 18, TypeScript, Vite + CRXJS, Tailwind CSS (inline styles in Shadow DOM), Zustand, idb, uuid, react-markdown, Chrome Extension Manifest V3.

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/content/shadow-host.ts` | Creates Shadow DOM container, injects styles |
| `src/content/selection-detector.ts` | Detects text selection via mouseup, computes position |
| `src/content/fab.ts` | Floating action button — shows/hides near selection |
| `src/content/action-panel.ts` | Action panel UI (input + quick action buttons) |
| `src/content/response-card.ts` | Displays AI response with close/save buttons |
| `src/content/note-marker.ts` | Renders saved note indicators on page |
| `src/content/inline-ui.ts` | Orchestrator — coordinates all inline UI components |
| `src/content/styles-inline.css` | All CSS for inline UI (injected into Shadow DOM) |
| `src/background/ai-client.ts` | AI API client (OpenAI-compatible, Anthropic, Ollama) |
| `src/background/db.ts` | IndexedDB wrapper using `idb` (notes + settings) |
| `src/background/message-handler.ts` | Service worker message router |
| `src/sidepanel/NotesView.tsx` | Saved notes list with expand/collapse |
| `src/sidepanel/SettingsView.tsx` | API key input + provider selection |
| `src/sidepanel/NoteCard.tsx` | Single note display component |
| `src/shared/note-types.ts` | New `Note`, `DOMAnchor`, `AIConfig`, `QuickAction` types |

### Modified Files
| File | Changes |
|------|---------|
| `src/shared/types.ts` | Add new message types for inline flow, keep existing types |
| `src/shared/constants.ts` | Add inline UI constants (panel width, z-index, etc.) |
| `src/shared/messaging.ts` | Complete the placeholder implementation |
| `src/content/index.ts` | Import and boot the inline UI orchestrator |
| `src/content/styles.css` | Minimal host-page styles (just the shadow host element) |
| `src/background/service-worker.ts` | Import message handler, init DB |
| `src/sidepanel/App.tsx` | Add routing between NotesView and SettingsView |
| `manifest.json` | No changes needed (content script + service worker already declared) |

---

## Task 1: Shared Types and Constants for Inline Flow

**Files:**
- Modify: `src/shared/types.ts`
- Create: `src/shared/note-types.ts`
- Modify: `src/shared/constants.ts`

- [ ] **Step 1: Create note-types.ts with new data model**

```ts
// src/shared/note-types.ts

/** Anchors a note to a specific DOM position for restoration */
export interface DOMAnchor {
  xpath: string;
  textSnippet: string; // first 80 chars of selected text for fuzzy matching
  offset: number;
}

/** A saved note bound to a text selection */
export interface Note {
  id: string;
  selectedText: string;
  context: string; // surrounding text for AI context
  action: QuickAction; // which action created this note
  query?: string; // user's custom question (for 'ask' action)
  response: string; // AI response (markdown)
  url: string;
  title: string; // page title at time of save
  anchor: DOMAnchor;
  createdAt: number;
}

/** Available quick actions in the action panel */
export type QuickAction = 'ask' | 'summarize' | 'define';

/** AI configuration stored in chrome.storage */
export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'ollama';
  apiKey: string;
  model: string;
  ollamaUrl: string; // default: http://localhost:11434
}

/** Position of inline UI relative to viewport */
export interface InlineUIPosition {
  top: number;
  left: number;
}
```

- [ ] **Step 2: Add new message types to types.ts**

Add these to the `MessageType` union in `src/shared/types.ts`:

```ts
// Add to the existing MessageType union:
export type MessageType =
  | 'CREATE_THREAD'
  | 'OPEN_THREAD'
  | 'SEND_MESSAGE'
  | 'STREAM_CHUNK'
  | 'STREAM_DONE'
  | 'STREAM_ERROR'
  | 'GET_THREADS'
  | 'GET_MESSAGES'
  | 'HIGHLIGHT_THREAD'
  | 'UNHIGHLIGHT_THREAD'
  | 'SIDE_PANEL_READY'
  | 'DELETE_THREAD'
  | 'CANCEL_STREAM'
  | 'GET_PAGE_TEXT'
  | 'SUMMARIZE_DOCUMENT'
  | 'TEST_API_KEY'
  // New inline flow messages:
  | 'AI_REQUEST'       // content script → service worker: run AI action
  | 'AI_RESPONSE'      // service worker → content script: AI result
  | 'AI_ERROR'         // service worker → content script: AI error
  | 'SAVE_NOTE'        // content script → service worker: persist note
  | 'GET_NOTES'        // side panel → service worker: load all notes
  | 'DELETE_NOTE'      // side panel → service worker: remove note
  | 'GET_NOTES_FOR_URL' // content script → service worker: notes for current page
  | 'GET_SETTINGS'     // any → service worker: read AI config
  | 'SAVE_SETTINGS';   // side panel → service worker: write AI config
```

- [ ] **Step 3: Add inline UI constants to constants.ts**

Append to the existing `src/shared/constants.ts`:

```ts
// --- Inline UI Constants ---

/** Width of the action panel in pixels */
export const ACTION_PANEL_WIDTH = 320;

/** Width of the response card in pixels */
export const RESPONSE_CARD_WIDTH = 360;

/** Max height of the response card before scrolling */
export const RESPONSE_CARD_MAX_HEIGHT = 400;

/** Z-index for all inline UI (high to sit above page content) */
export const INLINE_UI_Z_INDEX = 2147483647;

/** ID for the Shadow DOM host element */
export const SHADOW_HOST_ID = 'contextchat-root';

/** Delay before hiding FAB after selection clears (ms) */
export const FAB_HIDE_DELAY = 200;
```

- [ ] **Step 4: Verify the build still passes**

Run: `cd contextchat && npm run build`
Expected: Build succeeds with no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/note-types.ts src/shared/types.ts src/shared/constants.ts
git commit -m "feat: add shared types and constants for inline AI flow"
```

---

## Task 2: Shadow DOM Host and Style Injection

**Files:**
- Create: `src/content/shadow-host.ts`
- Create: `src/content/styles-inline.css`
- Modify: `src/content/styles.css`

- [ ] **Step 1: Create the Shadow DOM host module**

```ts
// src/content/shadow-host.ts
import { SHADOW_HOST_ID, INLINE_UI_Z_INDEX } from '../shared/constants';

let shadowRoot: ShadowRoot | null = null;
let hostElement: HTMLDivElement | null = null;

/**
 * Creates a Shadow DOM container attached to document.body.
 * All inline UI (FAB, action panel, response card) renders inside this shadow root.
 * Returns the existing shadow root if already created.
 */
export function getShadowRoot(): ShadowRoot {
  if (shadowRoot) return shadowRoot;

  hostElement = document.createElement('div');
  hostElement.id = SHADOW_HOST_ID;
  hostElement.style.position = 'fixed';
  hostElement.style.top = '0';
  hostElement.style.left = '0';
  hostElement.style.width = '0';
  hostElement.style.height = '0';
  hostElement.style.overflow = 'visible';
  hostElement.style.zIndex = String(INLINE_UI_Z_INDEX);
  hostElement.style.pointerEvents = 'none'; // pass-through; children re-enable

  document.body.appendChild(hostElement);
  shadowRoot = hostElement.attachShadow({ mode: 'open' });

  // Inject inline styles
  const style = document.createElement('style');
  style.textContent = getInlineStyles();
  shadowRoot.appendChild(style);

  return shadowRoot;
}

/** Returns the CSS string for all inline UI components */
function getInlineStyles(): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }

    .cc-fab {
      position: fixed;
      pointer-events: auto;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #2563eb;
      color: white;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      transition: transform 0.15s ease, opacity 0.15s ease;
      z-index: 1;
    }
    .cc-fab:hover { transform: scale(1.1); }

    .cc-panel {
      position: fixed;
      pointer-events: auto;
      width: 320px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.15);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      color: #1a1a1a;
      overflow: hidden;
      z-index: 2;
    }

    .cc-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      border-bottom: 1px solid #e5e7eb;
      background: #f9fafb;
    }

    .cc-panel-header-title {
      font-weight: 600;
      font-size: 13px;
      color: #374151;
    }

    .cc-close-btn {
      pointer-events: auto;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 16px;
      color: #9ca3af;
      padding: 2px;
      line-height: 1;
    }
    .cc-close-btn:hover { color: #374151; }

    .cc-actions {
      display: flex;
      gap: 6px;
      padding: 10px 14px;
    }

    .cc-action-btn {
      pointer-events: auto;
      flex: 1;
      padding: 6px 10px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: white;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      color: #374151;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .cc-action-btn:hover {
      background: #eff6ff;
      border-color: #2563eb;
      color: #2563eb;
    }

    .cc-input-row {
      display: flex;
      gap: 8px;
      padding: 0 14px 12px;
    }

    .cc-input {
      pointer-events: auto;
      flex: 1;
      padding: 8px 12px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 13px;
      outline: none;
      font-family: inherit;
    }
    .cc-input:focus { border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,0.1); }

    .cc-send-btn {
      pointer-events: auto;
      padding: 8px 14px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
    }
    .cc-send-btn:hover { background: #1d4ed8; }
    .cc-send-btn:disabled { background: #93c5fd; cursor: not-allowed; }

    .cc-response {
      position: fixed;
      pointer-events: auto;
      width: 360px;
      max-height: 400px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.15);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      color: #1a1a1a;
      overflow: hidden;
      z-index: 2;
    }

    .cc-response-body {
      padding: 14px;
      overflow-y: auto;
      max-height: 320px;
      line-height: 1.6;
    }

    .cc-response-body p { margin-bottom: 8px; }
    .cc-response-body p:last-child { margin-bottom: 0; }
    .cc-response-body code {
      background: #f3f4f6;
      padding: 1px 4px;
      border-radius: 4px;
      font-size: 13px;
    }
    .cc-response-body pre {
      background: #f3f4f6;
      padding: 10px;
      border-radius: 8px;
      overflow-x: auto;
      margin-bottom: 8px;
    }

    .cc-response-footer {
      display: flex;
      gap: 8px;
      padding: 10px 14px;
      border-top: 1px solid #e5e7eb;
    }

    .cc-save-btn {
      pointer-events: auto;
      padding: 6px 14px;
      background: #059669;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
    }
    .cc-save-btn:hover { background: #047857; }

    .cc-loading {
      padding: 20px 14px;
      text-align: center;
      color: #6b7280;
    }

    .cc-loading-dots::after {
      content: '';
      animation: cc-dots 1.5s steps(4, end) infinite;
    }

    @keyframes cc-dots {
      0% { content: ''; }
      25% { content: '.'; }
      50% { content: '..'; }
      75% { content: '...'; }
    }

    .cc-error {
      padding: 12px 14px;
      color: #dc2626;
      font-size: 13px;
    }

    .cc-note-marker {
      pointer-events: auto;
      position: absolute;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #059669;
      color: white;
      font-size: 11px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    }
    .cc-note-marker:hover { transform: scale(1.15); }

    .cc-selected-text {
      padding: 8px 14px;
      background: #fffbeb;
      border-left: 3px solid #f59e0b;
      font-size: 12px;
      color: #92400e;
      max-height: 60px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .cc-hidden { display: none !important; }
  `;
}

/** Remove the shadow host from the DOM entirely */
export function destroyShadowHost(): void {
  if (hostElement) {
    hostElement.remove();
    hostElement = null;
    shadowRoot = null;
  }
}
```

- [ ] **Step 2: Update content/styles.css to minimal host-page style**

Replace `src/content/styles.css` with:

```css
/* ContextChat — Host page styles (minimal) */
/* All component styles live inside Shadow DOM — see shadow-host.ts */

#contextchat-root {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  z-index: 2147483647 !important;
}
```

- [ ] **Step 3: Verify build**

Run: `cd contextchat && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/content/shadow-host.ts src/content/styles.css
git commit -m "feat: add Shadow DOM host for inline UI isolation"
```

---

## Task 3: Text Selection Detection

**Files:**
- Create: `src/content/selection-detector.ts`

- [ ] **Step 1: Create the selection detector module**

```ts
// src/content/selection-detector.ts
import { MIN_SELECTION_LENGTH, MAX_SELECTION_LENGTH, SELECTION_DEBOUNCE_MS, MAX_CONTEXT_CHARS } from '../shared/constants';
import { InlineUIPosition } from '../shared/note-types';

export interface SelectionData {
  text: string;
  context: string;
  position: InlineUIPosition;
  range: Range;
}

type SelectionCallback = (data: SelectionData | null) => void;

let debounceTimer: number | null = null;

/**
 * Starts listening for text selections on the page.
 * Calls `onSelect` with selection data when a valid selection is detected,
 * or with `null` when the selection is cleared.
 */
export function startSelectionListener(onSelect: SelectionCallback): () => void {
  function handleMouseUp(): void {
    if (debounceTimer !== null) clearTimeout(debounceTimer);

    debounceTimer = window.setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) {
        onSelect(null);
        return;
      }

      const text = selection.toString().trim();
      if (text.length < MIN_SELECTION_LENGTH || text.length > MAX_SELECTION_LENGTH) {
        onSelect(null);
        return;
      }

      // Ignore selections inside our own Shadow DOM host
      const anchorNode = selection.anchorNode;
      if (anchorNode && isInsideShadowHost(anchorNode)) {
        return; // don't clear or trigger — user is interacting with our UI
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const context = extractSurroundingContext(range);

      onSelect({
        text: text.slice(0, MAX_SELECTION_LENGTH),
        context,
        position: {
          top: rect.bottom + window.scrollY + 8,
          left: rect.left + window.scrollX + (rect.width / 2),
        },
        range: range.cloneRange(),
      });
    }, SELECTION_DEBOUNCE_MS);
  }

  document.addEventListener('mouseup', handleMouseUp);

  return () => {
    document.removeEventListener('mouseup', handleMouseUp);
    if (debounceTimer !== null) clearTimeout(debounceTimer);
  };
}

/** Extract surrounding text for AI context */
function extractSurroundingContext(range: Range): string {
  const container = range.commonAncestorContainer;
  const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container as HTMLElement;
  if (!element) return '';

  // Walk up to find a reasonable block-level parent
  let block = element;
  const blockTags = ['P', 'DIV', 'ARTICLE', 'SECTION', 'LI', 'TD', 'BLOCKQUOTE'];
  while (block.parentElement && !blockTags.includes(block.tagName)) {
    block = block.parentElement;
  }

  const fullText = block.textContent || '';
  if (fullText.length <= MAX_CONTEXT_CHARS) return fullText;

  // Center the context window around the selection
  const selectedText = range.toString();
  const selIndex = fullText.indexOf(selectedText);
  if (selIndex === -1) return fullText.slice(0, MAX_CONTEXT_CHARS);

  const half = Math.floor((MAX_CONTEXT_CHARS - selectedText.length) / 2);
  const start = Math.max(0, selIndex - half);
  const end = Math.min(fullText.length, selIndex + selectedText.length + half);
  return fullText.slice(start, end);
}

/** Check if a node is inside our Shadow DOM host */
function isInsideShadowHost(node: Node): boolean {
  let current: Node | null = node;
  while (current) {
    if (current instanceof HTMLElement && current.id === 'contextchat-root') return true;
    current = current.parentNode || (current as any).host || null;
  }
  return false;
}
```

- [ ] **Step 2: Verify build**

Run: `cd contextchat && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/content/selection-detector.ts
git commit -m "feat: add text selection detection with debounce and context extraction"
```

---

## Task 4: Floating Action Button (FAB)

**Files:**
- Create: `src/content/fab.ts`

- [ ] **Step 1: Create the FAB module**

```ts
// src/content/fab.ts
import { getShadowRoot } from './shadow-host';
import { InlineUIPosition } from '../shared/note-types';

let fabElement: HTMLButtonElement | null = null;
let onClickCallback: (() => void) | null = null;

/** Show the FAB near the given position */
export function showFab(position: InlineUIPosition, onClick: () => void): void {
  const root = getShadowRoot();
  onClickCallback = onClick;

  if (!fabElement) {
    fabElement = document.createElement('button');
    fabElement.className = 'cc-fab';
    fabElement.textContent = '✦';
    fabElement.addEventListener('click', (e) => {
      e.stopPropagation();
      onClickCallback?.();
    });
    root.appendChild(fabElement);
  }

  fabElement.style.top = `${position.top}px`;
  fabElement.style.left = `${position.left}px`;
  fabElement.style.transform = 'translateX(-50%)';
  fabElement.classList.remove('cc-hidden');
}

/** Hide the FAB */
export function hideFab(): void {
  if (fabElement) {
    fabElement.classList.add('cc-hidden');
  }
}

/** Remove FAB from DOM entirely */
export function destroyFab(): void {
  if (fabElement) {
    fabElement.remove();
    fabElement = null;
  }
}
```

- [ ] **Step 2: Verify build**

Run: `cd contextchat && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/content/fab.ts
git commit -m "feat: add floating action button near text selection"
```

---

## Task 5: Action Panel UI

**Files:**
- Create: `src/content/action-panel.ts`

- [ ] **Step 1: Create the action panel module**

```ts
// src/content/action-panel.ts
import { getShadowRoot } from './shadow-host';
import { InlineUIPosition, QuickAction } from '../shared/note-types';
import { ACTION_PANEL_WIDTH } from '../shared/constants';

let panelElement: HTMLDivElement | null = null;
let inputElement: HTMLInputElement | null = null;

export interface ActionPanelCallbacks {
  onQuickAction: (action: QuickAction) => void;
  onAsk: (query: string) => void;
  onClose: () => void;
}

/** Show the action panel at the given position */
export function showActionPanel(
  position: InlineUIPosition,
  selectedText: string,
  callbacks: ActionPanelCallbacks
): void {
  const root = getShadowRoot();

  if (panelElement) panelElement.remove();

  panelElement = document.createElement('div');
  panelElement.className = 'cc-panel';

  // Clamp position to viewport
  const left = Math.min(
    position.left - ACTION_PANEL_WIDTH / 2,
    window.innerWidth - ACTION_PANEL_WIDTH - 16
  );
  const clampedLeft = Math.max(16, left);

  panelElement.style.top = `${position.top + 8}px`;
  panelElement.style.left = `${clampedLeft}px`;

  // Truncated selection preview
  const preview = selectedText.length > 80
    ? selectedText.slice(0, 77) + '...'
    : selectedText;

  panelElement.innerHTML = `
    <div class="cc-panel-header">
      <span class="cc-panel-header-title">ContextChat</span>
      <button class="cc-close-btn" data-action="close">&times;</button>
    </div>
    <div class="cc-selected-text">${escapeHtml(preview)}</div>
    <div class="cc-actions">
      <button class="cc-action-btn" data-action="summarize">Summarize</button>
      <button class="cc-action-btn" data-action="define">Define</button>
    </div>
    <div class="cc-input-row">
      <input class="cc-input" type="text" placeholder="Ask anything about this text..." />
      <button class="cc-send-btn" data-action="send">Ask</button>
    </div>
  `;

  // Wire up events
  panelElement.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const action = target.dataset.action;
    if (action === 'close') callbacks.onClose();
    else if (action === 'summarize') callbacks.onQuickAction('summarize');
    else if (action === 'define') callbacks.onQuickAction('define');
    else if (action === 'send') {
      const query = inputElement?.value.trim();
      if (query) callbacks.onAsk(query);
    }
    e.stopPropagation();
  });

  root.appendChild(panelElement);

  inputElement = panelElement.querySelector('.cc-input') as HTMLInputElement;
  inputElement?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const query = inputElement?.value.trim();
      if (query) callbacks.onAsk(query);
    }
    e.stopPropagation(); // prevent host page from capturing keystrokes
  });

  // Focus input
  setTimeout(() => inputElement?.focus(), 50);
}

/** Hide and remove the action panel */
export function hideActionPanel(): void {
  if (panelElement) {
    panelElement.remove();
    panelElement = null;
    inputElement = null;
  }
}

/** Escape HTML to prevent XSS from selected text */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

- [ ] **Step 2: Verify build**

Run: `cd contextchat && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/content/action-panel.ts
git commit -m "feat: add action panel with quick actions and text input"
```

---

## Task 6: Response Card

**Files:**
- Create: `src/content/response-card.ts`

- [ ] **Step 1: Create the response card module**

```ts
// src/content/response-card.ts
import { getShadowRoot } from './shadow-host';
import { InlineUIPosition } from '../shared/note-types';
import { RESPONSE_CARD_WIDTH } from '../shared/constants';

let cardElement: HTMLDivElement | null = null;

export interface ResponseCardCallbacks {
  onSave: () => void;
  onClose: () => void;
}

/** Show a loading state while waiting for AI response */
export function showResponseLoading(position: InlineUIPosition): void {
  const root = getShadowRoot();
  if (cardElement) cardElement.remove();

  cardElement = document.createElement('div');
  cardElement.className = 'cc-response';

  const left = Math.min(
    position.left - RESPONSE_CARD_WIDTH / 2,
    window.innerWidth - RESPONSE_CARD_WIDTH - 16
  );
  const clampedLeft = Math.max(16, left);

  cardElement.style.top = `${position.top}px`;
  cardElement.style.left = `${clampedLeft}px`;
  cardElement.innerHTML = `
    <div class="cc-panel-header">
      <span class="cc-panel-header-title">Response</span>
    </div>
    <div class="cc-loading">Thinking<span class="cc-loading-dots"></span></div>
  `;

  root.appendChild(cardElement);
}

/** Show the AI response with save/close buttons */
export function showResponse(
  position: InlineUIPosition,
  responseHtml: string,
  callbacks: ResponseCardCallbacks
): void {
  const root = getShadowRoot();
  if (cardElement) cardElement.remove();

  cardElement = document.createElement('div');
  cardElement.className = 'cc-response';

  const left = Math.min(
    position.left - RESPONSE_CARD_WIDTH / 2,
    window.innerWidth - RESPONSE_CARD_WIDTH - 16
  );
  const clampedLeft = Math.max(16, left);

  cardElement.style.top = `${position.top}px`;
  cardElement.style.left = `${clampedLeft}px`;

  cardElement.innerHTML = `
    <div class="cc-panel-header">
      <span class="cc-panel-header-title">Response</span>
      <button class="cc-close-btn" data-action="close">&times;</button>
    </div>
    <div class="cc-response-body">${responseHtml}</div>
    <div class="cc-response-footer">
      <button class="cc-save-btn" data-action="save">Save as Note</button>
      <button class="cc-close-btn" data-action="close" style="margin-left:auto;">Close</button>
    </div>
  `;

  cardElement.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const action = target.dataset.action;
    if (action === 'save') callbacks.onSave();
    else if (action === 'close') callbacks.onClose();
    e.stopPropagation();
  });

  root.appendChild(cardElement);
}

/** Show an error in the response card */
export function showResponseError(position: InlineUIPosition, message: string, onClose: () => void): void {
  const root = getShadowRoot();
  if (cardElement) cardElement.remove();

  cardElement = document.createElement('div');
  cardElement.className = 'cc-response';

  const left = Math.min(
    position.left - RESPONSE_CARD_WIDTH / 2,
    window.innerWidth - RESPONSE_CARD_WIDTH - 16
  );
  const clampedLeft = Math.max(16, left);

  cardElement.style.top = `${position.top}px`;
  cardElement.style.left = `${clampedLeft}px`;

  cardElement.innerHTML = `
    <div class="cc-panel-header">
      <span class="cc-panel-header-title">Error</span>
      <button class="cc-close-btn" data-action="close">&times;</button>
    </div>
    <div class="cc-error">${escapeHtml(message)}</div>
  `;

  cardElement.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).dataset.action === 'close') onClose();
    e.stopPropagation();
  });

  root.appendChild(cardElement);
}

/** Hide and remove the response card */
export function hideResponseCard(): void {
  if (cardElement) {
    cardElement.remove();
    cardElement = null;
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

- [ ] **Step 2: Verify build**

Run: `cd contextchat && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/content/response-card.ts
git commit -m "feat: add response card with loading, result, and error states"
```

---

## Task 7: Complete Message Passing System

**Files:**
- Modify: `src/shared/messaging.ts`

- [ ] **Step 1: Implement the full messaging module**

Replace `src/shared/messaging.ts` with:

```ts
// src/shared/messaging.ts
import { ExtensionMessage, MessageType } from './types';

type MessageHandler = (payload: any, sender: chrome.runtime.MessageSender) => Promise<any> | any;

const handlers = new Map<MessageType, MessageHandler>();

/**
 * Send a message to the service worker and wait for a response.
 * Use from content scripts and side panel.
 */
export async function sendMessage<T = any>(
  type: MessageType,
  payload: any = {}
): Promise<T> {
  const response = await chrome.runtime.sendMessage({ type, payload } as ExtensionMessage);
  if (response?.error) throw new Error(response.error);
  return response;
}

/**
 * Register a handler for a specific message type.
 * Use in the service worker to handle incoming messages.
 */
export function onMessage(
  type: MessageType,
  handler: MessageHandler
): void {
  handlers.set(type, handler);
}

/**
 * Initialize the message listener — call once in the service worker.
 * Routes incoming messages to registered handlers.
 */
export function initMessageListener(): void {
  chrome.runtime.onMessage.addListener(
    (message: ExtensionMessage, sender, sendResponse) => {
      const handler = handlers.get(message.type);
      if (!handler) {
        sendResponse({ error: `No handler for message type: ${message.type}` });
        return false;
      }

      // Handle async responses
      const result = handler(message.payload, sender);
      if (result instanceof Promise) {
        result
          .then((data) => sendResponse(data))
          .catch((err) => sendResponse({ error: err.message }));
        return true; // keep the message channel open for async
      }

      sendResponse(result);
      return false;
    }
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd contextchat && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/shared/messaging.ts
git commit -m "feat: complete message passing system with async handler support"
```

---

## Task 8: IndexedDB Storage Layer

**Files:**
- Create: `src/background/db.ts`

- [ ] **Step 1: Create the IndexedDB wrapper**

```ts
// src/background/db.ts
import { openDB, IDBPDatabase } from 'idb';
import { DB_NAME, DB_VERSION } from '../shared/constants';
import { Note } from '../shared/note-types';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Notes store with URL index for per-page lookups
        if (!db.objectStoreNames.contains('notes')) {
          const noteStore = db.createObjectStore('notes', { keyPath: 'id' });
          noteStore.createIndex('by-url', 'url');
          noteStore.createIndex('by-createdAt', 'createdAt');
        }
      },
    });
  }
  return dbPromise;
}

/** Save a note */
export async function saveNote(note: Note): Promise<void> {
  const db = await getDB();
  await db.put('notes', note);
}

/** Get all notes, newest first */
export async function getAllNotes(): Promise<Note[]> {
  const db = await getDB();
  const notes = await db.getAll('notes');
  return notes.sort((a, b) => b.createdAt - a.createdAt);
}

/** Get notes for a specific URL */
export async function getNotesForUrl(url: string): Promise<Note[]> {
  const db = await getDB();
  const notes = await db.getAllFromIndex('notes', 'by-url', url);
  return notes.sort((a, b) => b.createdAt - a.createdAt);
}

/** Delete a note by ID */
export async function deleteNote(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('notes', id);
}
```

- [ ] **Step 2: Verify build**

Run: `cd contextchat && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/background/db.ts
git commit -m "feat: add IndexedDB storage layer for notes"
```

---

## Task 9: AI Client

**Files:**
- Create: `src/background/ai-client.ts`

- [ ] **Step 1: Create the AI client module**

```ts
// src/background/ai-client.ts
import { AIConfig, QuickAction } from '../shared/note-types';

interface AIRequest {
  selectedText: string;
  context: string;
  action: QuickAction;
  query?: string;
  config: AIConfig;
}

interface AIResponse {
  content: string; // markdown response
}

/** Build the system + user prompt based on the action */
function buildPrompt(req: AIRequest): { system: string; user: string } {
  const system = 'You are a helpful assistant embedded in a browser extension. Be concise and clear. Respond in markdown.';

  let user: string;
  switch (req.action) {
    case 'summarize':
      user = `Summarize the following text in 2-3 concise sentences:\n\n"${req.selectedText}"`;
      break;
    case 'define':
      user = `Define and explain the following term or phrase. Keep it brief:\n\n"${req.selectedText}"`;
      break;
    case 'ask':
      user = `Context: "${req.context}"\n\nSelected text: "${req.selectedText}"\n\nQuestion: ${req.query}`;
      break;
    default:
      user = `Help me understand: "${req.selectedText}"`;
  }

  return { system, user };
}

/** Call the AI API based on provider config */
export async function callAI(req: AIRequest): Promise<AIResponse> {
  const { system, user } = buildPrompt(req);
  const { provider, apiKey, model, ollamaUrl } = req.config;

  if (provider === 'openai') {
    return callOpenAI(apiKey, model, system, user);
  } else if (provider === 'anthropic') {
    return callAnthropic(apiKey, model, system, user);
  } else if (provider === 'ollama') {
    return callOllama(ollamaUrl, model, system, user);
  }

  throw new Error(`Unknown AI provider: ${provider}`);
}

async function callOpenAI(apiKey: string, model: string, system: string, user: string): Promise<AIResponse> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI API error: ${res.status}`);
  }

  const data = await res.json();
  return { content: data.choices[0].message.content };
}

async function callAnthropic(apiKey: string, model: string, system: string, user: string): Promise<AIResponse> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: model || 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Anthropic API error: ${res.status}`);
  }

  const data = await res.json();
  return { content: data.content[0].text };
}

async function callOllama(baseUrl: string, model: string, system: string, user: string): Promise<AIResponse> {
  const url = `${baseUrl || 'http://localhost:11434'}/api/chat`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || 'llama3.2',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      stream: false,
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama error: ${res.status}`);
  }

  const data = await res.json();
  return { content: data.message.content };
}
```

- [ ] **Step 2: Verify build**

Run: `cd contextchat && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/background/ai-client.ts
git commit -m "feat: add AI client with OpenAI, Anthropic, and Ollama support"
```

---

## Task 10: Service Worker Message Handler

**Files:**
- Create: `src/background/message-handler.ts`
- Modify: `src/background/service-worker.ts`

- [ ] **Step 1: Create the message handler**

```ts
// src/background/message-handler.ts
import { onMessage } from '../shared/messaging';
import { saveNote, getAllNotes, getNotesForUrl, deleteNote } from './db';
import { callAI } from './ai-client';
import { AIConfig, Note } from '../shared/note-types';

const DEFAULT_CONFIG: AIConfig = {
  provider: 'openai',
  apiKey: '',
  model: '',
  ollamaUrl: 'http://localhost:11434',
};

/** Load AI config from chrome.storage.local */
async function getConfig(): Promise<AIConfig> {
  const result = await chrome.storage.local.get('aiConfig');
  return result.aiConfig || DEFAULT_CONFIG;
}

/** Register all message handlers */
export function registerHandlers(): void {
  onMessage('AI_REQUEST', async (payload) => {
    const config = await getConfig();
    if (!config.apiKey && config.provider !== 'ollama') {
      return { error: 'No API key configured. Open the ContextChat side panel to add your key.' };
    }

    try {
      const result = await callAI({
        selectedText: payload.selectedText,
        context: payload.context,
        action: payload.action,
        query: payload.query,
        config,
      });
      return { content: result.content };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  onMessage('SAVE_NOTE', async (payload) => {
    await saveNote(payload as Note);
    return { success: true };
  });

  onMessage('GET_NOTES', async () => {
    return await getAllNotes();
  });

  onMessage('GET_NOTES_FOR_URL', async (payload) => {
    return await getNotesForUrl(payload.url);
  });

  onMessage('DELETE_NOTE', async (payload) => {
    await deleteNote(payload.id);
    return { success: true };
  });

  onMessage('GET_SETTINGS', async () => {
    return await getConfig();
  });

  onMessage('SAVE_SETTINGS', async (payload) => {
    await chrome.storage.local.set({ aiConfig: payload });
    return { success: true };
  });
}
```

- [ ] **Step 2: Update service-worker.ts to use message handler**

Replace `src/background/service-worker.ts` with:

```ts
// src/background/service-worker.ts
import { initMessageListener } from '../shared/messaging';
import { registerHandlers } from './message-handler';

console.log('[ContextChat] Service worker started');

// Set side panel to open on action click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('[ContextChat] Side panel setup error:', error));

// Initialize message routing and register all handlers
registerHandlers();
initMessageListener();
```

- [ ] **Step 3: Verify build**

Run: `cd contextchat && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/background/message-handler.ts src/background/service-worker.ts
git commit -m "feat: wire service worker with message routing, AI calls, and storage"
```

---

## Task 11: Inline UI Orchestrator (Content Script)

**Files:**
- Create: `src/content/inline-ui.ts`
- Modify: `src/content/index.ts`

- [ ] **Step 1: Create the inline UI orchestrator**

```ts
// src/content/inline-ui.ts
import { startSelectionListener, SelectionData } from './selection-detector';
import { showFab, hideFab } from './fab';
import { showActionPanel, hideActionPanel, ActionPanelCallbacks } from './action-panel';
import { showResponseLoading, showResponse, showResponseError, hideResponseCard } from './response-card';
import { sendMessage } from '../shared/messaging';
import { QuickAction, Note, DOMAnchor } from '../shared/note-types';
import { v4 as uuidv4 } from 'uuid';

/** State for the current interaction */
let currentSelection: SelectionData | null = null;
let lastResponse: string | null = null;
let lastAction: QuickAction | null = null;
let lastQuery: string | undefined = undefined;

/** Boot the inline UI system */
export function initInlineUI(): void {
  startSelectionListener(handleSelectionChange);

  // Close everything when user clicks outside our UI
  document.addEventListener('mousedown', (e) => {
    const target = e.target as HTMLElement;
    if (target.id === 'contextchat-root') return;
    // Only close if clicking outside and not on our shadow host
    if (!target.closest?.('#contextchat-root')) {
      closeAll();
    }
  });

  // Load existing notes for this page
  loadPageNotes();
}

function handleSelectionChange(data: SelectionData | null): void {
  if (!data) {
    // Don't hide if we already have a panel/response open
    if (!lastResponse) hideFab();
    return;
  }

  currentSelection = data;
  lastResponse = null;
  lastAction = null;
  lastQuery = undefined;

  hideActionPanel();
  hideResponseCard();

  showFab(data.position, () => {
    hideFab();
    openActionPanel();
  });
}

function openActionPanel(): void {
  if (!currentSelection) return;

  const callbacks: ActionPanelCallbacks = {
    onQuickAction: (action) => handleAction(action),
    onAsk: (query) => handleAction('ask', query),
    onClose: () => closeAll(),
  };

  showActionPanel(currentSelection.position, currentSelection.text, callbacks);
}

async function handleAction(action: QuickAction, query?: string): Promise<void> {
  if (!currentSelection) return;

  lastAction = action;
  lastQuery = query;

  hideActionPanel();

  // Show loading state
  const responsePos = {
    top: currentSelection.position.top,
    left: currentSelection.position.left,
  };
  showResponseLoading(responsePos);

  try {
    const result = await sendMessage<{ content?: string; error?: string }>('AI_REQUEST', {
      selectedText: currentSelection.text,
      context: currentSelection.context,
      action,
      query,
    });

    if (result.error) {
      showResponseError(responsePos, result.error, () => closeAll());
      return;
    }

    lastResponse = result.content || '';

    // Convert markdown to simple HTML for display
    const html = markdownToHtml(lastResponse);

    showResponse(responsePos, html, {
      onSave: () => saveCurrentNote(),
      onClose: () => closeAll(),
    });
  } catch (err: any) {
    showResponseError(responsePos, err.message || 'Failed to get AI response', () => closeAll());
  }
}

async function saveCurrentNote(): Promise<void> {
  if (!currentSelection || !lastResponse || !lastAction) return;

  const anchor: DOMAnchor = {
    xpath: getXPath(currentSelection.range.startContainer),
    textSnippet: currentSelection.text.slice(0, 80),
    offset: currentSelection.range.startOffset,
  };

  const note: Note = {
    id: uuidv4(),
    selectedText: currentSelection.text,
    context: currentSelection.context,
    action: lastAction,
    query: lastQuery,
    response: lastResponse,
    url: window.location.href,
    title: document.title,
    anchor,
    createdAt: Date.now(),
  };

  try {
    await sendMessage('SAVE_NOTE', note);
    closeAll();
    // Optionally show a brief confirmation
  } catch (err) {
    console.error('[ContextChat] Failed to save note:', err);
  }
}

function closeAll(): void {
  hideFab();
  hideActionPanel();
  hideResponseCard();
  currentSelection = null;
  lastResponse = null;
  lastAction = null;
  lastQuery = undefined;
}

/** Convert basic markdown to HTML (bold, italic, code, paragraphs) */
function markdownToHtml(md: string): string {
  return md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/```[\s\S]*?```/g, (m) => {
      const code = m.slice(3, -3).replace(/^\w*\n/, '');
      return `<pre><code>${code}</code></pre>`;
    })
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
}

/** Get a simple XPath for a DOM node */
function getXPath(node: Node): string {
  const parts: string[] = [];
  let current: Node | null = node;
  while (current && current !== document.body) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const el = current as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const siblings = el.parentElement?.children;
      if (siblings && siblings.length > 1) {
        let idx = 1;
        for (let i = 0; i < siblings.length; i++) {
          if (siblings[i] === el) break;
          if (siblings[i].tagName === el.tagName) idx++;
        }
        parts.unshift(`${tag}[${idx}]`);
      } else {
        parts.unshift(tag);
      }
    }
    current = current.parentNode;
  }
  return '//' + parts.join('/');
}

async function loadPageNotes(): Promise<void> {
  try {
    const notes = await sendMessage<Note[]>('GET_NOTES_FOR_URL', { url: window.location.href });
    // Future: render note markers on the page using note-marker.ts
    if (notes && notes.length > 0) {
      console.log(`[ContextChat] ${notes.length} saved note(s) on this page`);
    }
  } catch {
    // Service worker may not be ready yet — not critical
  }
}
```

- [ ] **Step 2: Update content/index.ts to boot the orchestrator**

Replace `src/content/index.ts` with:

```ts
// src/content/index.ts
import { initInlineUI } from './inline-ui';

console.log('[ContextChat] Content script loaded on:', window.location.href);

// Boot the inline AI assistant
initInlineUI();
```

- [ ] **Step 3: Verify build**

Run: `cd contextchat && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/content/inline-ui.ts src/content/index.ts
git commit -m "feat: wire inline UI orchestrator — FAB → action panel → AI → response"
```

---

## Task 12: Side Panel — Settings View

**Files:**
- Create: `src/sidepanel/SettingsView.tsx`

- [ ] **Step 1: Create the settings component**

```tsx
// src/sidepanel/SettingsView.tsx
import React, { useState, useEffect } from 'react';
import { AIConfig } from '../shared/note-types';

const DEFAULT_CONFIG: AIConfig = {
  provider: 'openai',
  apiKey: '',
  model: '',
  ollamaUrl: 'http://localhost:11434',
};

export default function SettingsView() {
  const [config, setConfig] = useState<AIConfig>(DEFAULT_CONFIG);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS', payload: {} })
      .then((result) => {
        if (result && !result.error) setConfig(result);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    await chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', payload: config });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return <div className="p-4 text-gray-500">Loading...</div>;

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold text-gray-800">Settings</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">AI Provider</label>
        <select
          value={config.provider}
          onChange={(e) => setConfig({ ...config, provider: e.target.value as AIConfig['provider'] })}
          className="w-full p-2 border rounded-lg text-sm"
        >
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="ollama">Ollama (Local)</option>
        </select>
      </div>

      {config.provider !== 'ollama' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
          <input
            type="password"
            value={config.apiKey}
            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
            placeholder={config.provider === 'openai' ? 'sk-...' : 'sk-ant-...'}
            className="w-full p-2 border rounded-lg text-sm"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Model (optional)</label>
        <input
          type="text"
          value={config.model}
          onChange={(e) => setConfig({ ...config, model: e.target.value })}
          placeholder={
            config.provider === 'openai' ? 'gpt-4o-mini' :
            config.provider === 'anthropic' ? 'claude-sonnet-4-20250514' :
            'llama3.2'
          }
          className="w-full p-2 border rounded-lg text-sm"
        />
      </div>

      {config.provider === 'ollama' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ollama URL</label>
          <input
            type="text"
            value={config.ollamaUrl}
            onChange={(e) => setConfig({ ...config, ollamaUrl: e.target.value })}
            placeholder="http://localhost:11434"
            className="w-full p-2 border rounded-lg text-sm"
          />
        </div>
      )}

      <button
        onClick={handleSave}
        className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
      >
        {saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd contextchat && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/sidepanel/SettingsView.tsx
git commit -m "feat: add settings view for API key and provider configuration"
```

---

## Task 13: Side Panel — Notes View

**Files:**
- Create: `src/sidepanel/NoteCard.tsx`
- Create: `src/sidepanel/NotesView.tsx`

- [ ] **Step 1: Create the NoteCard component**

```tsx
// src/sidepanel/NoteCard.tsx
import React, { useState } from 'react';
import { Note } from '../shared/note-types';

interface NoteCardProps {
  note: Note;
  onDelete: (id: string) => void;
}

export default function NoteCard({ note, onDelete }: NoteCardProps) {
  const [expanded, setExpanded] = useState(false);

  const date = new Date(note.createdAt).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const actionLabel = note.action === 'ask' ? `Asked: ${note.query}` :
                      note.action === 'summarize' ? 'Summary' : 'Definition';

  return (
    <div className="border rounded-lg p-3 mb-2 bg-white">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-400 mb-1">{date}</div>
          <div className="text-xs font-medium text-blue-600 mb-1">{actionLabel}</div>
          <div className="text-sm text-gray-700 truncate">
            "{note.selectedText.slice(0, 60)}{note.selectedText.length > 60 ? '...' : ''}"
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-2 text-xs text-gray-400 hover:text-gray-700"
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t">
          <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
            {note.response}
          </div>
          <div className="mt-2 flex justify-between items-center">
            <a
              href={note.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:underline truncate max-w-[200px]"
            >
              {note.title || note.url}
            </a>
            <button
              onClick={() => onDelete(note.id)}
              className="text-xs text-red-400 hover:text-red-600"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the NotesView component**

```tsx
// src/sidepanel/NotesView.tsx
import React, { useState, useEffect } from 'react';
import { Note } from '../shared/note-types';
import NoteCard from './NoteCard';

export default function NotesView() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadNotes() {
    try {
      const result = await chrome.runtime.sendMessage({ type: 'GET_NOTES', payload: {} });
      if (Array.isArray(result)) setNotes(result);
    } catch (err) {
      console.error('[ContextChat] Failed to load notes:', err);
    }
    setLoading(false);
  }

  useEffect(() => { loadNotes(); }, []);

  async function handleDelete(id: string) {
    await chrome.runtime.sendMessage({ type: 'DELETE_NOTE', payload: { id } });
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  if (loading) return <div className="p-4 text-gray-500">Loading notes...</div>;

  if (notes.length === 0) {
    return (
      <div className="p-4 text-center text-gray-400">
        <div className="text-3xl mb-2">📝</div>
        <div className="text-sm">No saved notes yet</div>
        <div className="text-xs mt-1">Select text on any page and save AI responses as notes</div>
      </div>
    );
  }

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-700">Saved Notes ({notes.length})</h2>
        <button onClick={loadNotes} className="text-xs text-blue-500 hover:underline">Refresh</button>
      </div>
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} onDelete={handleDelete} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd contextchat && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/sidepanel/NoteCard.tsx src/sidepanel/NotesView.tsx
git commit -m "feat: add notes view and note card for side panel"
```

---

## Task 14: Side Panel — App Routing

**Files:**
- Modify: `src/sidepanel/App.tsx`

- [ ] **Step 1: Update App.tsx with tab navigation**

Replace `src/sidepanel/App.tsx` with:

```tsx
// src/sidepanel/App.tsx
import React, { useState } from 'react';
import NotesView from './NotesView';
import SettingsView from './SettingsView';

type Tab = 'notes' | 'settings';

export default function App() {
  const [tab, setTab] = useState<Tab>('notes');

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b">
        <h1 className="text-sm font-bold text-gray-800">ContextChat</h1>
        <span className="text-xs text-gray-400">v0.1.0</span>
      </div>

      {/* Tab bar */}
      <div className="flex border-b bg-white">
        <button
          onClick={() => setTab('notes')}
          className={`flex-1 py-2 text-xs font-medium ${
            tab === 'notes'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Notes
        </button>
        <button
          onClick={() => setTab('settings')}
          className={`flex-1 py-2 text-xs font-medium ${
            tab === 'settings'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Settings
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'notes' ? <NotesView /> : <SettingsView />}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd contextchat && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/sidepanel/App.tsx
git commit -m "feat: update side panel with notes/settings tab navigation"
```

---

## Task 15: Integration Test — Full Flow

**Files:**
- No new files — manual testing

- [ ] **Step 1: Build the extension**

Run: `cd contextchat && npm run build`
Expected: Clean build with no errors.

- [ ] **Step 2: Load in Chrome and test the inline flow**

1. Open `chrome://extensions`, enable Developer Mode
2. Click "Load unpacked", select `contextchat/dist/`
3. Navigate to any webpage with text
4. Select some text — FAB should appear
5. Click FAB — action panel should appear
6. Click "Summarize" or type a question and click "Ask"
7. Response card should show loading, then the AI response
8. Click "Save as Note" — note should be saved
9. Open side panel (click extension icon) — note should appear in Notes tab
10. Go to Settings tab — configure API key

- [ ] **Step 3: Fix any issues found during testing**

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: integration fixes from manual testing"
```

---

## Summary: Data Flow

```
User selects text on page
  → selection-detector.ts fires callback
  → inline-ui.ts shows FAB near selection
  → User clicks FAB
  → inline-ui.ts shows action panel
  → User picks action (Summarize / Define / Ask)
  → inline-ui.ts sends AI_REQUEST via messaging.ts
  → service-worker.ts routes to message-handler.ts
  → message-handler.ts calls ai-client.ts
  → ai-client.ts calls OpenAI/Anthropic/Ollama API
  → Response returns through message channel
  → inline-ui.ts shows response card
  → User clicks "Save as Note"
  → inline-ui.ts sends SAVE_NOTE via messaging.ts
  → message-handler.ts calls db.ts to persist in IndexedDB
  → Side panel can load saved notes via GET_NOTES
```
