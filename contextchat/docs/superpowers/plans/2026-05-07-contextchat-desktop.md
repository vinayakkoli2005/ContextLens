# ContextChat Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows desktop app (Electron + React + Ollama) that shows a transparent floating panel near any text selection or screenshot for instant local AI Q&A.

**Architecture:** Electron main process owns global mouse hooks (uiohook-napi), clipboard watching, and Ollama HTTP streaming. Two BrowserWindows render the floating icon and the transparent frosted-glass panel. A third settings window is opened on demand. All AI inference runs locally via Ollama (no cloud APIs).

**Tech Stack:** Electron, electron-vite, React 18, TypeScript, TailwindCSS, uiohook-napi, @nut-tree/nut-js, ollama (npm), electron-store, electron-builder.

**Project root for new app:** `contextchat-desktop/` (sibling to existing `contextchat/` extension; existing extension is **not** modified by this plan).

---

## File Structure

```
contextchat-desktop/
├── package.json
├── electron.vite.config.ts
├── electron-builder.config.cjs
├── tsconfig.json
├── tsconfig.node.json
├── tailwind.config.js
├── postcss.config.cjs
├── index.html                            ← panel renderer entry
├── settings.html                         ← settings renderer entry
├── toast.html                            ← screenshot toast renderer entry
├── icon.html                             ← floating icon renderer entry
├── electron/
│   ├── main.ts                           ← app entry, lifecycle, IPC wiring
│   ├── windows.ts                        ← create/manage all BrowserWindows
│   ├── tray.ts                           ← tray icon + menu
│   ├── selection-monitor.ts              ← uiohook-napi + clipboard read/restore
│   ├── clipboard-watcher.ts              ← 500ms image-clipboard poller
│   ├── ollama-client.ts                  ← streaming Ollama chat
│   ├── conversation.ts                   ← in-memory rolling-window history
│   ├── hardware-detector.ts              ← RAM check + model recommendation
│   ├── store.ts                          ← electron-store wrapper
│   └── ipc-channels.ts                   ← shared IPC channel name constants
├── src/
│   ├── shared/
│   │   └── types.ts                      ← Message, Conversation, Settings types
│   ├── panel/
│   │   ├── main.tsx                      ← panel React entry
│   │   ├── Panel.tsx                     ← root component
│   │   ├── ActionButtons.tsx
│   │   ├── ChatHistory.tsx
│   │   ├── ResponseStream.tsx
│   │   ├── ModelSelector.tsx
│   │   ├── ContextPreview.tsx
│   │   └── styles.css                    ← tailwind + frosted glass
│   ├── settings/
│   │   ├── main.tsx
│   │   └── Settings.tsx
│   ├── toast/
│   │   ├── main.tsx
│   │   └── ScreenshotToast.tsx
│   └── icon/
│       ├── main.tsx
│       └── FloatingIcon.tsx
├── resources/
│   ├── tray-icon.png                     ← 16x16 tray icon
│   └── app-icon.png                      ← 256x256 app/floating icon
└── tests/
    ├── conversation.test.ts
    ├── hardware-detector.test.ts
    └── ollama-client.test.ts
```

**Testing approach:** Unit tests with Vitest for pure logic modules (`conversation.ts`, `hardware-detector.ts`, `ollama-client.ts` with mocked fetch). Manual smoke testing for Electron-specific code (windows, hooks, tray) — these can't be meaningfully unit-tested. Each task that adds testable logic includes a failing-test step first.

---

## Task 1: Initialize project scaffold

**Files:**
- Create: `contextchat-desktop/package.json`
- Create: `contextchat-desktop/tsconfig.json`
- Create: `contextchat-desktop/tsconfig.node.json`
- Create: `contextchat-desktop/.gitignore`

- [ ] **Step 1: Create project directory and initialize package.json**

Run from repo root (`c:\Users\vinay\OneDrive\Desktop\Project\`):

```bash
mkdir contextchat-desktop && cd contextchat-desktop
npm init -y
```

- [ ] **Step 2: Replace generated package.json with the canonical one**

Overwrite `contextchat-desktop/package.json`:

```json
{
  "name": "contextchat-desktop",
  "version": "0.1.0",
  "description": "System-wide local AI assistant for text selections and screenshots",
  "main": "out/main/index.js",
  "type": "module",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "start": "electron-vite preview",
    "package": "electron-vite build && electron-builder --win --config electron-builder.config.cjs",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@nut-tree-fork/nut-js": "^4.2.2",
    "electron-store": "^10.0.0",
    "ollama": "^0.5.9",
    "uiohook-napi": "^1.5.4",
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.7.4",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.0",
    "@types/uuid": "^10.0.0",
    "@vitejs/plugin-react": "^4.3.2",
    "autoprefixer": "^10.4.20",
    "electron": "^32.1.2",
    "electron-builder": "^25.1.6",
    "electron-vite": "^2.3.0",
    "postcss": "^8.4.47",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tailwindcss": "^3.4.13",
    "typescript": "^5.6.2",
    "vite": "^5.4.8",
    "vitest": "^2.1.2"
  }
}
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["node", "vite/client"]
  },
  "include": ["src", "electron", "tests", "*.config.ts"]
}
```

- [ ] **Step 4: Create `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["electron"]
}
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules/
out/
dist/
release/
*.log
.DS_Store
```

- [ ] **Step 6: Install dependencies**

Run: `cd contextchat-desktop && npm install`
Expected: completes without errors. May show optional peer dep warnings — ignore.

- [ ] **Step 7: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: PASS (no errors — there's no source yet).

- [ ] **Step 8: Commit**

```bash
git add contextchat-desktop/package.json contextchat-desktop/tsconfig.json contextchat-desktop/tsconfig.node.json contextchat-desktop/.gitignore contextchat-desktop/package-lock.json
git commit -m "chore: scaffold contextchat-desktop project"
```

---

## Task 2: Electron-Vite + Tailwind config

**Files:**
- Create: `contextchat-desktop/electron.vite.config.ts`
- Create: `contextchat-desktop/tailwind.config.js`
- Create: `contextchat-desktop/postcss.config.cjs`
- Create: `contextchat-desktop/index.html`
- Create: `contextchat-desktop/settings.html`
- Create: `contextchat-desktop/toast.html`
- Create: `contextchat-desktop/icon.html`
- Create: `contextchat-desktop/src/panel/styles.css`

- [ ] **Step 1: Create `electron.vite.config.ts`**

```typescript
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  main: {
    build: {
      lib: { entry: 'electron/main.ts' },
      rollupOptions: {
        external: ['uiohook-napi', '@nut-tree-fork/nut-js', 'electron-store']
      }
    }
  },
  preload: {
    build: {
      lib: { entry: 'electron/preload.ts' }
    }
  },
  renderer: {
    plugins: [react()],
    root: '.',
    build: {
      rollupOptions: {
        input: {
          panel: resolve(__dirname, 'index.html'),
          settings: resolve(__dirname, 'settings.html'),
          toast: resolve(__dirname, 'toast.html'),
          icon: resolve(__dirname, 'icon.html')
        }
      }
    }
  }
});
```

- [ ] **Step 2: Create `tailwind.config.js`**

```javascript
export default {
  content: ['./src/**/*.{ts,tsx}', './*.html'],
  theme: { extend: {} },
  plugins: []
};
```

- [ ] **Step 3: Create `postcss.config.cjs`**

```javascript
module.exports = {
  plugins: { tailwindcss: {}, autoprefixer: {} }
};
```

- [ ] **Step 4: Create `src/panel/styles.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { margin: 0; padding: 0; height: 100%; background: transparent; }
body { font-family: -apple-system, "Segoe UI", system-ui, sans-serif; color: #f5f5f5; }

.frosted {
  background: rgba(20, 20, 20, 0.75);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}

.drag-region { -webkit-app-region: drag; }
.no-drag { -webkit-app-region: no-drag; }
```

- [ ] **Step 5: Create the four HTML entries**

`contextchat-desktop/index.html` (panel):
```html
<!doctype html>
<html><head><meta charset="utf-8"><title>ContextChat</title></head>
<body><div id="root"></div><script type="module" src="/src/panel/main.tsx"></script></body>
</html>
```

`contextchat-desktop/settings.html`:
```html
<!doctype html>
<html><head><meta charset="utf-8"><title>Settings</title></head>
<body><div id="root"></div><script type="module" src="/src/settings/main.tsx"></script></body>
</html>
```

`contextchat-desktop/toast.html`:
```html
<!doctype html>
<html><head><meta charset="utf-8"><title>Toast</title></head>
<body><div id="root"></div><script type="module" src="/src/toast/main.tsx"></script></body>
</html>
```

`contextchat-desktop/icon.html`:
```html
<!doctype html>
<html><head><meta charset="utf-8"><title>Icon</title></head>
<body><div id="root"></div><script type="module" src="/src/icon/main.tsx"></script></body>
</html>
```

- [ ] **Step 6: Commit**

```bash
git add contextchat-desktop/electron.vite.config.ts contextchat-desktop/tailwind.config.js contextchat-desktop/postcss.config.cjs contextchat-desktop/*.html contextchat-desktop/src/panel/styles.css
git commit -m "chore: add electron-vite, tailwind, and html entries"
```

---

## Task 3: Shared types + IPC channel constants

**Files:**
- Create: `contextchat-desktop/src/shared/types.ts`
- Create: `contextchat-desktop/electron/ipc-channels.ts`

- [ ] **Step 1: Create `src/shared/types.ts`**

```typescript
export type Role = 'system' | 'user' | 'assistant';

export interface Message {
  role: Role;
  content: string;
  image?: string;          // base64 PNG, attached to user messages only
}

export interface Conversation {
  id: string;
  context: { type: 'text' | 'image'; value: string };
  messages: Message[];
  model: string;
}

export interface Settings {
  ollamaUrl: string;       // default 'http://localhost:11434'
  selectedModel: string;   // empty until user picks
  launchAtStartup: boolean;
}

export interface OllamaModel {
  name: string;
  size: number;            // bytes
}

export interface HardwareInfo {
  totalRamGb: number;
  recommendedTextModel: string;
  recommendedVisionModel: string;
}

export type QuickAction = 'explain' | 'summarize' | 'ask';
```

- [ ] **Step 2: Create `electron/ipc-channels.ts`**

```typescript
export const IPC = {
  // panel ↔ main
  PANEL_READY: 'panel:ready',
  PANEL_CLOSE: 'panel:close',
  CHAT_SEND: 'chat:send',                   // renderer → main: { messages, model }
  CHAT_TOKEN: 'chat:token',                 // main → renderer: { delta }
  CHAT_DONE: 'chat:done',
  CHAT_ERROR: 'chat:error',

  // icon ↔ main
  ICON_CLICK: 'icon:click',

  // settings ↔ main
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  MODELS_LIST: 'models:list',
  HARDWARE_INFO: 'hardware:info',

  // toast ↔ main
  TOAST_ACCEPT: 'toast:accept',
  TOAST_DISMISS: 'toast:dismiss',

  // main → panel push
  CONTEXT_TEXT: 'context:text',             // payload: string
  CONTEXT_IMAGE: 'context:image'            // payload: base64
} as const;
```

- [ ] **Step 3: Commit**

```bash
git add contextchat-desktop/src/shared/types.ts contextchat-desktop/electron/ipc-channels.ts
git commit -m "feat: add shared types and ipc channel constants"
```

---

## Task 4: Conversation rolling-window logic (TDD)

**Files:**
- Create: `contextchat-desktop/electron/conversation.ts`
- Create: `contextchat-desktop/tests/conversation.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/conversation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createConversation, appendMessage, applyRollingWindow } from '../electron/conversation';

describe('conversation', () => {
  it('creates a conversation with system prompt and context', () => {
    const conv = createConversation({ type: 'text', value: 'hello world' }, 'llama3.2');
    expect(conv.messages).toHaveLength(1);
    expect(conv.messages[0].role).toBe('system');
    expect(conv.messages[0].content).toContain('hello world');
    expect(conv.model).toBe('llama3.2');
  });

  it('appends a user message', () => {
    const conv = createConversation({ type: 'text', value: 'x' }, 'm');
    const next = appendMessage(conv, { role: 'user', content: 'explain' });
    expect(next.messages).toHaveLength(2);
    expect(next.messages[1]).toEqual({ role: 'user', content: 'explain' });
  });

  it('keeps system prompt and drops oldest pair when window exceeded', () => {
    let conv = createConversation({ type: 'text', value: 'ctx' }, 'm');
    for (let i = 0; i < 12; i++) {
      conv = appendMessage(conv, { role: 'user', content: `u${i}` });
      conv = appendMessage(conv, { role: 'assistant', content: `a${i}` });
    }
    const trimmed = applyRollingWindow(conv);
    expect(trimmed.messages[0].role).toBe('system');
    expect(trimmed.messages.length).toBeLessThanOrEqual(21);
    expect(trimmed.messages[1].content).not.toBe('u0');
    expect(trimmed.messages[trimmed.messages.length - 1].content).toBe('a11');
  });

  it('does not trim when under threshold', () => {
    let conv = createConversation({ type: 'text', value: 'ctx' }, 'm');
    for (let i = 0; i < 5; i++) {
      conv = appendMessage(conv, { role: 'user', content: `u${i}` });
      conv = appendMessage(conv, { role: 'assistant', content: `a${i}` });
    }
    const trimmed = applyRollingWindow(conv);
    expect(trimmed.messages.length).toBe(11);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npm run test`
Expected: FAIL — module not found / functions undefined.

- [ ] **Step 3: Implement `electron/conversation.ts`**

```typescript
import { v4 as uuid } from 'uuid';
import type { Conversation, Message } from '../src/shared/types';

const MAX_MESSAGES = 21; // system + 10 user/assistant pairs

const buildSystemPrompt = (ctx: Conversation['context']): string => {
  if (ctx.type === 'text') {
    return `You are a helpful assistant. The user has selected the following text from their screen:\n\n"""\n${ctx.value}\n"""\n\nHelp them understand, summarize, or discuss it.`;
  }
  return `You are a helpful assistant. The user has shared a screenshot from their screen. Help them understand or discuss it.`;
};

export const createConversation = (
  context: Conversation['context'],
  model: string
): Conversation => ({
  id: uuid(),
  context,
  model,
  messages: [{ role: 'system', content: buildSystemPrompt(context) }]
});

export const appendMessage = (conv: Conversation, msg: Message): Conversation => ({
  ...conv,
  messages: [...conv.messages, msg]
});

export const applyRollingWindow = (conv: Conversation): Conversation => {
  if (conv.messages.length <= MAX_MESSAGES) return conv;
  const system = conv.messages[0];
  const rest = conv.messages.slice(1);
  const dropCount = rest.length - (MAX_MESSAGES - 1);
  const trimmedRest = rest.slice(dropCount);
  return { ...conv, messages: [system, ...trimmedRest] };
};
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `npm run test`
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add contextchat-desktop/electron/conversation.ts contextchat-desktop/tests/conversation.test.ts
git commit -m "feat: conversation rolling-window memory"
```

---

## Task 5: Hardware detector + model recommendation (TDD)

**Files:**
- Create: `contextchat-desktop/electron/hardware-detector.ts`
- Create: `contextchat-desktop/tests/hardware-detector.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/hardware-detector.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { recommendModels } from '../electron/hardware-detector';

describe('recommendModels', () => {
  it('recommends moondream for low RAM', () => {
    const r = recommendModels(6);
    expect(r.recommendedTextModel).toBe('moondream');
    expect(r.recommendedVisionModel).toBe('moondream');
  });
  it('recommends llama3.2 + llava for mid RAM', () => {
    const r = recommendModels(12);
    expect(r.recommendedTextModel).toBe('llama3.2');
    expect(r.recommendedVisionModel).toBe('llava');
  });
  it('recommends 8b/13b for high RAM', () => {
    const r = recommendModels(32);
    expect(r.recommendedTextModel).toBe('llama3.1:8b');
    expect(r.recommendedVisionModel).toBe('llava:13b');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npm run test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `electron/hardware-detector.ts`**

```typescript
import os from 'node:os';
import type { HardwareInfo } from '../src/shared/types';

export const recommendModels = (totalRamGb: number): HardwareInfo => {
  if (totalRamGb < 8) {
    return { totalRamGb, recommendedTextModel: 'moondream', recommendedVisionModel: 'moondream' };
  }
  if (totalRamGb <= 16) {
    return { totalRamGb, recommendedTextModel: 'llama3.2', recommendedVisionModel: 'llava' };
  }
  return { totalRamGb, recommendedTextModel: 'llama3.1:8b', recommendedVisionModel: 'llava:13b' };
};

export const detectHardware = (): HardwareInfo => {
  const totalRamGb = Math.round(os.totalmem() / (1024 ** 3));
  return recommendModels(totalRamGb);
};
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `npm run test`
Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add contextchat-desktop/electron/hardware-detector.ts contextchat-desktop/tests/hardware-detector.test.ts
git commit -m "feat: hardware-based model recommendation"
```

---

## Task 6: Ollama client with streaming (TDD)

**Files:**
- Create: `contextchat-desktop/electron/ollama-client.ts`
- Create: `contextchat-desktop/tests/ollama-client.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/ollama-client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listModels, streamChat } from '../electron/ollama-client';

describe('ollama-client', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('lists installed models', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ models: [{ name: 'llama3.2', size: 100 }, { name: 'llava', size: 200 }] })
    }) as any;
    const models = await listModels('http://localhost:11434');
    expect(models).toHaveLength(2);
    expect(models[0].name).toBe('llama3.2');
  });

  it('throws a friendly error when ollama unreachable', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(listModels('http://localhost:11434')).rejects.toThrow(/ollama/i);
  });

  it('streams chat tokens', async () => {
    const ndjson = [
      JSON.stringify({ message: { content: 'Hel' }, done: false }),
      JSON.stringify({ message: { content: 'lo' }, done: false }),
      JSON.stringify({ message: { content: '' }, done: true })
    ].join('\n') + '\n';
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(c) { c.enqueue(encoder.encode(ndjson)); c.close(); }
    });
    global.fetch = vi.fn().mockResolvedValue({ ok: true, body: stream }) as any;

    const tokens: string[] = [];
    await streamChat({
      url: 'http://localhost:11434',
      model: 'llama3.2',
      messages: [{ role: 'user', content: 'hi' }],
      onToken: (t) => tokens.push(t)
    });
    expect(tokens.join('')).toBe('Hello');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npm run test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `electron/ollama-client.ts`**

```typescript
import type { Message, OllamaModel } from '../src/shared/types';

export interface StreamChatArgs {
  url: string;
  model: string;
  messages: Message[];
  onToken: (delta: string) => void;
  signal?: AbortSignal;
}

export const listModels = async (url: string): Promise<OllamaModel[]> => {
  try {
    const res = await fetch(`${url}/api/tags`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (data.models ?? []).map((m: any) => ({ name: m.name, size: m.size }));
  } catch (err: any) {
    throw new Error(`Ollama unreachable at ${url}: ${err.message}`);
  }
};

export const streamChat = async (args: StreamChatArgs): Promise<void> => {
  const body = {
    model: args.model,
    messages: args.messages.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.image ? { images: [m.image] } : {})
    })),
    stream: true
  };
  const res = await fetch(`${args.url}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: args.signal
  });
  if (!res.ok || !res.body) throw new Error(`Ollama chat failed: HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.message?.content) args.onToken(obj.message.content);
        if (obj.done) return;
      } catch {
        // ignore malformed line
      }
    }
  }
};
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `npm run test`
Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add contextchat-desktop/electron/ollama-client.ts contextchat-desktop/tests/ollama-client.test.ts
git commit -m "feat: streaming ollama client with model listing"
```

---

## Task 7: Settings store

**Files:**
- Create: `contextchat-desktop/electron/store.ts`

- [ ] **Step 1: Implement `electron/store.ts`**

```typescript
import Store from 'electron-store';
import type { Settings } from '../src/shared/types';

const DEFAULTS: Settings = {
  ollamaUrl: 'http://localhost:11434',
  selectedModel: '',
  launchAtStartup: true
};

const store = new Store<Settings>({ defaults: DEFAULTS });

export const getSettings = (): Settings => ({
  ollamaUrl: store.get('ollamaUrl'),
  selectedModel: store.get('selectedModel'),
  launchAtStartup: store.get('launchAtStartup')
});

export const setSettings = (patch: Partial<Settings>): Settings => {
  for (const [k, v] of Object.entries(patch)) {
    (store as any).set(k, v);
  }
  return getSettings();
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add contextchat-desktop/electron/store.ts
git commit -m "feat: settings persistence via electron-store"
```

---

## Task 8: Preload script + window manager

**Files:**
- Create: `contextchat-desktop/electron/preload.ts`
- Create: `contextchat-desktop/electron/windows.ts`

- [ ] **Step 1: Create `electron/preload.ts`**

```typescript
import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from './ipc-channels';

contextBridge.exposeInMainWorld('cc', {
  // generic invokers
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
  on: (channel: string, listener: (...args: any[]) => void) => {
    const wrapped = (_e: unknown, ...args: any[]) => listener(...args);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
  channels: IPC
});

declare global {
  interface Window {
    cc: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      send: (channel: string, ...args: any[]) => void;
      on: (channel: string, listener: (...args: any[]) => void) => () => void;
      channels: typeof IPC;
    };
  }
}
```

- [ ] **Step 2: Create `electron/windows.ts`**

```typescript
import { BrowserWindow, screen } from 'electron';
import { join } from 'node:path';

const isDev = !!process.env['ELECTRON_RENDERER_URL'];
const preload = join(__dirname, '../preload/index.js');

const rendererUrl = (entry: string): string =>
  isDev
    ? `${process.env['ELECTRON_RENDERER_URL']}/${entry}`
    : `file://${join(__dirname, `../renderer/${entry}`)}`;

let panelWin: BrowserWindow | null = null;
let iconWin: BrowserWindow | null = null;
let toastWin: BrowserWindow | null = null;
let settingsWin: BrowserWindow | null = null;

export const showIcon = (x: number, y: number): BrowserWindow => {
  if (iconWin && !iconWin.isDestroyed()) {
    iconWin.setPosition(x, y);
    iconWin.showInactive();
    return iconWin;
  }
  iconWin = new BrowserWindow({
    width: 28, height: 28,
    x, y,
    frame: false, transparent: true, alwaysOnTop: true,
    resizable: false, skipTaskbar: true, focusable: false,
    hasShadow: false,
    webPreferences: { preload, sandbox: false, contextIsolation: true }
  });
  iconWin.setIgnoreMouseEvents(false);
  iconWin.loadURL(rendererUrl('icon.html'));
  return iconWin;
};

export const hideIcon = (): void => {
  if (iconWin && !iconWin.isDestroyed()) iconWin.hide();
};

export const showPanel = (x: number, y: number): BrowserWindow => {
  const display = screen.getPrimaryDisplay().workAreaSize;
  const w = 360, h = 480;
  const px = Math.min(Math.max(x, 0), display.width - w);
  const py = Math.min(Math.max(y, 0), display.height - h);
  if (panelWin && !panelWin.isDestroyed()) {
    panelWin.setPosition(px, py);
    panelWin.show();
    return panelWin;
  }
  panelWin = new BrowserWindow({
    width: w, height: h,
    x: px, y: py,
    frame: false, transparent: true, alwaysOnTop: true,
    resizable: true, skipTaskbar: true,
    hasShadow: false,
    webPreferences: { preload, sandbox: false, contextIsolation: true }
  });
  panelWin.loadURL(rendererUrl('index.html'));
  panelWin.on('closed', () => { panelWin = null; });
  return panelWin;
};

export const hidePanel = (): void => {
  if (panelWin && !panelWin.isDestroyed()) panelWin.hide();
};

export const sendToPanel = (channel: string, payload: unknown): void => {
  if (panelWin && !panelWin.isDestroyed()) panelWin.webContents.send(channel, payload);
};

export const showToast = (): BrowserWindow => {
  const display = screen.getPrimaryDisplay().workAreaSize;
  const w = 320, h = 96;
  if (toastWin && !toastWin.isDestroyed()) { toastWin.show(); return toastWin; }
  toastWin = new BrowserWindow({
    width: w, height: h,
    x: display.width - w - 20, y: display.height - h - 20,
    frame: false, transparent: true, alwaysOnTop: true,
    resizable: false, skipTaskbar: true, focusable: false,
    hasShadow: false,
    webPreferences: { preload, sandbox: false, contextIsolation: true }
  });
  toastWin.loadURL(rendererUrl('toast.html'));
  return toastWin;
};

export const hideToast = (): void => {
  if (toastWin && !toastWin.isDestroyed()) toastWin.hide();
};

export const showSettings = (): BrowserWindow => {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.focus(); return settingsWin;
  }
  settingsWin = new BrowserWindow({
    width: 520, height: 480,
    title: 'ContextChat Settings',
    webPreferences: { preload, sandbox: false, contextIsolation: true }
  });
  settingsWin.loadURL(rendererUrl('settings.html'));
  settingsWin.on('closed', () => { settingsWin = null; });
  return settingsWin;
};

export const isPanelOpen = (): boolean => !!panelWin && !panelWin.isDestroyed() && panelWin.isVisible();
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add contextchat-desktop/electron/preload.ts contextchat-desktop/electron/windows.ts
git commit -m "feat: preload bridge and BrowserWindow factories"
```

---

## Task 9: Selection monitor (global mouse hook + clipboard read/restore)

**Files:**
- Create: `contextchat-desktop/electron/selection-monitor.ts`

- [ ] **Step 1: Implement `electron/selection-monitor.ts`**

```typescript
import { uIOhook, UiohookMouseEvent } from 'uiohook-napi';
import { clipboard } from 'electron';
import { keyboard, Key } from '@nut-tree-fork/nut-js';

const MIN_TEXT_LEN = 4;
const MIN_DRAG_PX = 5;

let lastDownX = 0;
let lastDownY = 0;
let dragging = false;

export interface SelectionEvent {
  text: string;
  x: number;
  y: number;
}

export const startSelectionMonitor = (onSelection: (e: SelectionEvent) => void): (() => void) => {
  const onDown = (e: UiohookMouseEvent) => {
    if (e.button !== 1) return; // left button only
    lastDownX = e.x; lastDownY = e.y;
    dragging = true;
  };

  const onUp = async (e: UiohookMouseEvent) => {
    if (!dragging || e.button !== 1) return;
    dragging = false;
    const dx = Math.abs(e.x - lastDownX);
    const dy = Math.abs(e.y - lastDownY);
    if (dx < MIN_DRAG_PX && dy < MIN_DRAG_PX) return;

    const previous = clipboard.readText();
    const previousImage = clipboard.readImage();
    try {
      // small delay so the host app finalizes the selection
      await new Promise((r) => setTimeout(r, 60));
      await keyboard.pressKey(Key.LeftControl, Key.C);
      await keyboard.releaseKey(Key.LeftControl, Key.C);
      await new Promise((r) => setTimeout(r, 80));
      const text = clipboard.readText().trim();
      if (text && text.length >= MIN_TEXT_LEN && text !== previous.trim()) {
        onSelection({ text, x: e.x, y: e.y });
      }
    } catch (err) {
      console.error('selection read failed', err);
    } finally {
      // restore prior clipboard
      if (!previousImage.isEmpty()) clipboard.writeImage(previousImage);
      else clipboard.writeText(previous);
    }
  };

  uIOhook.on('mousedown', onDown);
  uIOhook.on('mouseup', onUp);
  uIOhook.start();

  return () => {
    uIOhook.off('mousedown', onDown);
    uIOhook.off('mouseup', onUp);
    uIOhook.stop();
  };
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add contextchat-desktop/electron/selection-monitor.ts
git commit -m "feat: global selection monitor with clipboard restore"
```

---

## Task 10: Clipboard watcher (screenshot detection)

**Files:**
- Create: `contextchat-desktop/electron/clipboard-watcher.ts`

- [ ] **Step 1: Implement `electron/clipboard-watcher.ts`**

```typescript
import { clipboard, nativeImage } from 'electron';

const POLL_MS = 500;

export const startClipboardWatcher = (onScreenshot: (base64Png: string) => void): (() => void) => {
  let lastImageHash = '';
  const interval = setInterval(() => {
    const img = clipboard.readImage();
    if (img.isEmpty()) { lastImageHash = ''; return; }
    const png = img.toPNG();
    // cheap hash: size + first 16 bytes hex
    const hash = `${png.length}:${png.slice(0, 16).toString('hex')}`;
    if (hash === lastImageHash) return;
    lastImageHash = hash;
    onScreenshot(png.toString('base64'));
  }, POLL_MS);
  return () => clearInterval(interval);
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add contextchat-desktop/electron/clipboard-watcher.ts
git commit -m "feat: clipboard image watcher for screenshot detection"
```

---

## Task 11: Tray icon + menu

**Files:**
- Create: `contextchat-desktop/electron/tray.ts`
- Create: `contextchat-desktop/resources/tray-icon.png` (placeholder — see step)
- Create: `contextchat-desktop/resources/app-icon.png` (placeholder — see step)

- [ ] **Step 1: Add icon assets**

Generate two solid-color PNG placeholders for now (can be replaced with real art later):

Run from `contextchat-desktop/`:
```bash
mkdir -p resources
node -e "const{nativeImage}=require('electron');const img=nativeImage.createFromBuffer(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGklEQVR4nGP8//8/AzGAiYFIMKpwVOGwUggALjMDAwfJrvAAAAAASUVORK5CYII=','base64'));require('fs').writeFileSync('resources/tray-icon.png',img.toPNG());require('fs').writeFileSync('resources/app-icon.png',img.toPNG());"
```

Expected: two PNG files written.

- [ ] **Step 2: Implement `electron/tray.ts`**

```typescript
import { Tray, Menu, nativeImage, app } from 'electron';
import { join } from 'node:path';
import { showSettings } from './windows';

let tray: Tray | null = null;

export const createTray = (): Tray => {
  const iconPath = join(process.env.NODE_ENV === 'development'
    ? join(process.cwd(), 'resources', 'tray-icon.png')
    : join(process.resourcesPath, 'tray-icon.png'));
  const image = nativeImage.createFromPath(iconPath);
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  tray.setToolTip('ContextChat');
  const menu = Menu.buildFromTemplate([
    { label: 'Open Settings', click: () => showSettings() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => showSettings());
  return tray;
};
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add contextchat-desktop/electron/tray.ts contextchat-desktop/resources
git commit -m "feat: system tray icon and menu"
```

---

## Task 12: Main process entrypoint (wires everything together)

**Files:**
- Create: `contextchat-desktop/electron/main.ts`

- [ ] **Step 1: Implement `electron/main.ts`**

```typescript
import { app, ipcMain, BrowserWindow } from 'electron';
import { IPC } from './ipc-channels';
import { createTray } from './tray';
import { showIcon, hideIcon, showPanel, hidePanel, showToast, hideToast, sendToPanel, isPanelOpen } from './windows';
import { startSelectionMonitor } from './selection-monitor';
import { startClipboardWatcher } from './clipboard-watcher';
import { listModels, streamChat } from './ollama-client';
import { getSettings, setSettings } from './store';
import { detectHardware } from './hardware-detector';
import { createConversation, appendMessage, applyRollingWindow } from './conversation';
import type { Conversation, Message } from '../src/shared/types';

let currentConversation: Conversation | null = null;
let lastSelectionPos = { x: 100, y: 100 };
let pendingScreenshot: string | null = null;

const ensureSingleInstance = (): boolean => {
  const got = app.requestSingleInstanceLock();
  if (!got) { app.quit(); return false; }
  return true;
};

const setupAutoLaunch = (): void => {
  const settings = getSettings();
  if (settings.launchAtStartup) {
    app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true });
  } else {
    app.setLoginItemSettings({ openAtLogin: false });
  }
};

const handleSelection = (e: { text: string; x: number; y: number }) => {
  if (isPanelOpen()) return;
  lastSelectionPos = { x: e.x, y: e.y };
  pendingScreenshot = null;
  // store selection text in a closure for icon click
  pendingSelectionText = e.text;
  showIcon(e.x + 8, e.y + 8);
};

let pendingSelectionText: string | null = null;

const openPanelForSelection = () => {
  hideIcon();
  if (!pendingSelectionText) return;
  const settings = getSettings();
  const hw = detectHardware();
  const model = settings.selectedModel || hw.recommendedTextModel;
  currentConversation = createConversation({ type: 'text', value: pendingSelectionText }, model);
  showPanel(lastSelectionPos.x + 16, lastSelectionPos.y + 16);
  // wait briefly for renderer to subscribe, then push context
  setTimeout(() => sendToPanel(IPC.CONTEXT_TEXT, pendingSelectionText), 250);
};

const openPanelForScreenshot = () => {
  hideToast();
  if (!pendingScreenshot) return;
  const settings = getSettings();
  const hw = detectHardware();
  const model = settings.selectedModel || hw.recommendedVisionModel;
  currentConversation = createConversation({ type: 'image', value: '[screenshot]' }, model);
  showPanel(lastSelectionPos.x, lastSelectionPos.y);
  setTimeout(() => sendToPanel(IPC.CONTEXT_IMAGE, pendingScreenshot), 250);
};

const registerIpc = (): void => {
  ipcMain.on(IPC.ICON_CLICK, () => openPanelForSelection());
  ipcMain.on(IPC.PANEL_CLOSE, () => { hidePanel(); currentConversation = null; });
  ipcMain.on(IPC.TOAST_ACCEPT, () => openPanelForScreenshot());
  ipcMain.on(IPC.TOAST_DISMISS, () => { hideToast(); pendingScreenshot = null; });

  ipcMain.handle(IPC.SETTINGS_GET, () => getSettings());
  ipcMain.handle(IPC.SETTINGS_SET, (_e, patch) => {
    const next = setSettings(patch);
    setupAutoLaunch();
    return next;
  });
  ipcMain.handle(IPC.HARDWARE_INFO, () => detectHardware());
  ipcMain.handle(IPC.MODELS_LIST, async () => {
    const settings = getSettings();
    return listModels(settings.ollamaUrl);
  });

  ipcMain.handle(IPC.CHAT_SEND, async (e, payload: { userMessage: Message; model: string }) => {
    if (!currentConversation) throw new Error('No active conversation');
    currentConversation = appendMessage(currentConversation, payload.userMessage);
    currentConversation = applyRollingWindow(currentConversation);
    currentConversation = { ...currentConversation, model: payload.model };
    const settings = getSettings();
    let assistantBuffer = '';
    const win = BrowserWindow.fromWebContents(e.sender);
    try {
      await streamChat({
        url: settings.ollamaUrl,
        model: payload.model,
        messages: currentConversation.messages,
        onToken: (delta) => {
          assistantBuffer += delta;
          win?.webContents.send(IPC.CHAT_TOKEN, { delta });
        }
      });
      currentConversation = appendMessage(currentConversation, { role: 'assistant', content: assistantBuffer });
      win?.webContents.send(IPC.CHAT_DONE, {});
    } catch (err: any) {
      win?.webContents.send(IPC.CHAT_ERROR, { message: err.message });
    }
  });
};

const main = async (): Promise<void> => {
  if (!ensureSingleInstance()) return;
  await app.whenReady();
  app.setAppUserModelId('com.contextchat.desktop');
  registerIpc();
  createTray();
  setupAutoLaunch();
  startSelectionMonitor(handleSelection);
  startClipboardWatcher((png) => {
    if (isPanelOpen()) return;
    pendingScreenshot = png;
    showToast();
  });
  app.on('window-all-closed', (e: Event) => e.preventDefault()); // keep tray alive
};

main();
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add contextchat-desktop/electron/main.ts
git commit -m "feat: main process wires hooks, ipc, ollama, and windows"
```

---

## Task 13: Floating icon renderer

**Files:**
- Create: `contextchat-desktop/src/icon/main.tsx`
- Create: `contextchat-desktop/src/icon/FloatingIcon.tsx`

- [ ] **Step 1: Create `src/icon/main.tsx`**

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../panel/styles.css';
import { FloatingIcon } from './FloatingIcon';

createRoot(document.getElementById('root')!).render(<FloatingIcon />);
```

- [ ] **Step 2: Create `src/icon/FloatingIcon.tsx`**

```tsx
import React from 'react';

export const FloatingIcon: React.FC = () => {
  const click = () => window.cc.send(window.cc.channels.ICON_CLICK);
  return (
    <button
      onClick={click}
      title="Ask ContextChat"
      className="w-7 h-7 rounded-full frosted flex items-center justify-center text-sm hover:scale-110 transition cursor-pointer no-drag"
    >
      🤖
    </button>
  );
};
```

- [ ] **Step 3: Commit**

```bash
git add contextchat-desktop/src/icon
git commit -m "feat: floating icon renderer"
```

---

## Task 14: Screenshot toast renderer

**Files:**
- Create: `contextchat-desktop/src/toast/main.tsx`
- Create: `contextchat-desktop/src/toast/ScreenshotToast.tsx`

- [ ] **Step 1: Create `src/toast/main.tsx`**

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../panel/styles.css';
import { ScreenshotToast } from './ScreenshotToast';

createRoot(document.getElementById('root')!).render(<ScreenshotToast />);
```

- [ ] **Step 2: Create `src/toast/ScreenshotToast.tsx`**

```tsx
import React from 'react';

export const ScreenshotToast: React.FC = () => {
  const accept = () => window.cc.send(window.cc.channels.TOAST_ACCEPT);
  const dismiss = () => window.cc.send(window.cc.channels.TOAST_DISMISS);
  return (
    <div className="frosted p-3 m-1 flex flex-col gap-2 no-drag">
      <div className="text-sm">📸 Screenshot ready — Ask ContextChat?</div>
      <div className="flex gap-2 justify-end">
        <button onClick={dismiss} className="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20">Dismiss</button>
        <button onClick={accept} className="px-2 py-1 text-xs rounded bg-blue-500/80 hover:bg-blue-500">Yes</button>
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Commit**

```bash
git add contextchat-desktop/src/toast
git commit -m "feat: screenshot toast renderer"
```

---

## Task 15: Panel renderer — components

**Files:**
- Create: `contextchat-desktop/src/panel/main.tsx`
- Create: `contextchat-desktop/src/panel/Panel.tsx`
- Create: `contextchat-desktop/src/panel/ContextPreview.tsx`
- Create: `contextchat-desktop/src/panel/ActionButtons.tsx`
- Create: `contextchat-desktop/src/panel/ChatHistory.tsx`
- Create: `contextchat-desktop/src/panel/ResponseStream.tsx`
- Create: `contextchat-desktop/src/panel/ModelSelector.tsx`

- [ ] **Step 1: Create `src/panel/main.tsx`**

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { Panel } from './Panel';

createRoot(document.getElementById('root')!).render(<Panel />);
```

- [ ] **Step 2: Create `src/panel/ContextPreview.tsx`**

```tsx
import React from 'react';

export const ContextPreview: React.FC<{ text?: string; image?: string }> = ({ text, image }) => {
  if (image) {
    return <img src={`data:image/png;base64,${image}`} alt="screenshot" className="max-h-24 rounded" />;
  }
  return (
    <div className="text-xs text-white/60 italic line-clamp-3">
      "{text}"
    </div>
  );
};
```

- [ ] **Step 3: Create `src/panel/ActionButtons.tsx`**

```tsx
import React from 'react';
import type { QuickAction } from '../shared/types';

const PROMPTS: Record<QuickAction, string> = {
  explain: 'Explain this in simple terms.',
  summarize: 'Summarize this in 2-3 sentences.',
  ask: ''
};

export const ActionButtons: React.FC<{ onPick: (prompt: string) => void; disabled: boolean }> = ({ onPick, disabled }) => (
  <div className="flex gap-2 no-drag">
    <button disabled={disabled} onClick={() => onPick(PROMPTS.explain)}    className="px-3 py-1 rounded-full text-xs bg-white/10 hover:bg-white/20 disabled:opacity-40">Explain</button>
    <button disabled={disabled} onClick={() => onPick(PROMPTS.summarize)} className="px-3 py-1 rounded-full text-xs bg-white/10 hover:bg-white/20 disabled:opacity-40">Summarize</button>
  </div>
);
```

- [ ] **Step 4: Create `src/panel/ResponseStream.tsx`**

```tsx
import React from 'react';

export const ResponseStream: React.FC<{ text: string; streaming: boolean }> = ({ text, streaming }) => (
  <div className="whitespace-pre-wrap text-sm text-white/95">
    {text}{streaming && <span className="opacity-60">▋</span>}
  </div>
);
```

- [ ] **Step 5: Create `src/panel/ChatHistory.tsx`**

```tsx
import React from 'react';
import type { Message } from '../shared/types';

export const ChatHistory: React.FC<{ messages: Message[] }> = ({ messages }) => (
  <div className="flex flex-col gap-2">
    {messages.filter(m => m.role !== 'system').map((m, i) => (
      <div key={i} className={m.role === 'user' ? 'self-end max-w-[85%] bg-blue-500/30 rounded-lg px-2 py-1 text-sm'
                                                : 'self-start max-w-[95%] text-sm text-white/90'}>
        {m.content}
      </div>
    ))}
  </div>
);
```

- [ ] **Step 6: Create `src/panel/ModelSelector.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import type { OllamaModel, HardwareInfo } from '../shared/types';

export const ModelSelector: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [hw, setHw] = useState<HardwareInfo | null>(null);
  useEffect(() => {
    window.cc.invoke(window.cc.channels.MODELS_LIST).then(setModels).catch(() => setModels([]));
    window.cc.invoke(window.cc.channels.HARDWARE_INFO).then(setHw);
  }, []);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-white/10 text-xs rounded px-2 py-1 no-drag"
    >
      {models.length === 0 && <option value="">no models</option>}
      {models.map(m => (
        <option key={m.name} value={m.name}>
          {m.name}{hw && m.name === hw.recommendedTextModel ? ' ★' : ''}
        </option>
      ))}
    </select>
  );
};
```

- [ ] **Step 7: Create `src/panel/Panel.tsx`**

```tsx
import React, { useEffect, useRef, useState } from 'react';
import type { Message } from '../shared/types';
import { ContextPreview } from './ContextPreview';
import { ActionButtons } from './ActionButtons';
import { ChatHistory } from './ChatHistory';
import { ResponseStream } from './ResponseStream';
import { ModelSelector } from './ModelSelector';

export const Panel: React.FC = () => {
  const [contextText, setContextText] = useState<string>('');
  const [contextImage, setContextImage] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState('');
  const [model, setModel] = useState('');
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const offText = window.cc.on(window.cc.channels.CONTEXT_TEXT, (t: string) => { setContextText(t); setContextImage(''); });
    const offImg  = window.cc.on(window.cc.channels.CONTEXT_IMAGE, (b: string) => { setContextImage(b); setContextText(''); });
    const offTok  = window.cc.on(window.cc.channels.CHAT_TOKEN, (p: { delta: string }) => setStreamBuffer((s) => s + p.delta));
    const offDone = window.cc.on(window.cc.channels.CHAT_DONE, () => {
      setStreaming(false);
      setStreamBuffer((buf) => {
        if (buf) setMessages((m) => [...m, { role: 'assistant', content: buf }]);
        return '';
      });
    });
    const offErr  = window.cc.on(window.cc.channels.CHAT_ERROR, (p: { message: string }) => {
      setStreaming(false);
      setMessages((m) => [...m, { role: 'assistant', content: `⚠ ${p.message}` }]);
      setStreamBuffer('');
    });
    window.cc.invoke(window.cc.channels.HARDWARE_INFO).then((hw) => setModel(hw.recommendedTextModel));
    return () => { offText(); offImg(); offTok(); offDone(); offErr(); };
  }, []);

  const send = (prompt: string) => {
    if (streaming || !prompt.trim() || !model) return;
    const userMsg: Message = contextImage
      ? { role: 'user', content: prompt, image: contextImage }
      : { role: 'user', content: prompt };
    setMessages((m) => [...m, userMsg]);
    setStreaming(true);
    setStreamBuffer('');
    setInput('');
    window.cc.invoke(window.cc.channels.CHAT_SEND, { userMessage: userMsg, model });
  };

  const close = () => window.cc.send(window.cc.channels.PANEL_CLOSE);

  return (
    <div className="frosted h-screen w-screen flex flex-col p-3 gap-2">
      <div className="drag-region flex justify-between items-center text-xs text-white/70 select-none">
        <span>ContextChat</span>
        <button onClick={close} className="no-drag px-2 hover:text-white">✕</button>
      </div>
      <ContextPreview text={contextText} image={contextImage} />
      <div className="border-t border-white/10" />
      <ActionButtons onPick={send} disabled={streaming || !model} />
      <div className="flex-1 overflow-y-auto no-drag">
        <ChatHistory messages={messages} />
        {streaming && <ResponseStream text={streamBuffer} streaming />}
      </div>
      <textarea
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
        placeholder="Ask a follow-up..."
        rows={2}
        className="no-drag bg-white/5 rounded p-2 text-sm resize-none focus:outline-none focus:bg-white/10"
      />
      <div className="flex justify-between items-center no-drag">
        <ModelSelector value={model} onChange={setModel} />
        <button onClick={() => send(input)} disabled={streaming || !input.trim()} className="px-3 py-1 rounded bg-blue-500/80 hover:bg-blue-500 disabled:opacity-40 text-xs">Send</button>
      </div>
    </div>
  );
};
```

- [ ] **Step 8: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add contextchat-desktop/src/panel
git commit -m "feat: transparent panel renderer with chat, streaming, model selector"
```

---

## Task 16: Settings renderer

**Files:**
- Create: `contextchat-desktop/src/settings/main.tsx`
- Create: `contextchat-desktop/src/settings/Settings.tsx`

- [ ] **Step 1: Create `src/settings/main.tsx`**

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../panel/styles.css';
import { Settings } from './Settings';

createRoot(document.getElementById('root')!).render(<Settings />);
```

- [ ] **Step 2: Create `src/settings/Settings.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import type { Settings as S, OllamaModel, HardwareInfo } from '../shared/types';

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<S | null>(null);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [hw, setHw] = useState<HardwareInfo | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    window.cc.invoke(window.cc.channels.SETTINGS_GET).then(setSettings);
    window.cc.invoke(window.cc.channels.HARDWARE_INFO).then(setHw);
    window.cc.invoke(window.cc.channels.MODELS_LIST).then(setModels).catch((e) => setError(e.message));
  }, []);

  const update = async (patch: Partial<S>) => {
    const next = await window.cc.invoke(window.cc.channels.SETTINGS_SET, patch);
    setSettings(next);
  };

  if (!settings || !hw) return <div className="p-4 text-sm">Loading…</div>;

  return (
    <div className="p-6 max-w-md mx-auto flex flex-col gap-4 text-sm">
      <h1 className="text-xl font-semibold">ContextChat Settings</h1>

      <section className="frosted p-3 rounded">
        <div className="text-xs uppercase text-white/60">Hardware</div>
        <div>Detected RAM: <strong>{hw.totalRamGb} GB</strong></div>
        <div className="text-white/80 mt-1">
          Recommended: <code>{hw.recommendedTextModel}</code> (text), <code>{hw.recommendedVisionModel}</code> (vision)
        </div>
      </section>

      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase text-white/60">Ollama URL</span>
        <input
          value={settings.ollamaUrl}
          onChange={(e) => update({ ollamaUrl: e.target.value })}
          className="bg-white/10 rounded px-2 py-1"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase text-white/60">Default Model</span>
        <select
          value={settings.selectedModel}
          onChange={(e) => update({ selectedModel: e.target.value })}
          className="bg-white/10 rounded px-2 py-1"
        >
          <option value="">(use recommendation)</option>
          {models.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
        </select>
        {error && <div className="text-red-400 text-xs">{error}</div>}
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={settings.launchAtStartup}
          onChange={(e) => update({ launchAtStartup: e.target.checked })}
        />
        <span>Launch at Windows startup</span>
      </label>
    </div>
  );
};
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add contextchat-desktop/src/settings
git commit -m "feat: settings renderer with hardware info and model picker"
```

---

## Task 17: First end-to-end manual smoke test

**Files:** none (manual verification)

- [ ] **Step 1: Build and run dev**

Run: `cd contextchat-desktop && npm run dev`
Expected: Electron window does not appear (panel/icon are hidden until selection); tray icon appears in Windows notification area.

- [ ] **Step 2: Verify Ollama is running**

Run: `curl http://localhost:11434/api/tags`
Expected: JSON with `models` array. If not, install Ollama and `ollama pull llama3.2`.

- [ ] **Step 3: Smoke test text selection flow**

In Notepad or any editor, select 5+ characters of text. Within ~200ms a small floating icon should appear near the cursor. Click it — the transparent panel should open with the text preview. Click "Explain" — tokens should stream into the response area.

- [ ] **Step 4: Smoke test screenshot flow**

Press Win+Shift+S, capture any region. Within ~500ms a toast should appear bottom-right. Click "Yes" — panel opens with the screenshot embedded. Type "What is in this image?" and Send. Tokens stream back (requires a vision model installed).

- [ ] **Step 5: Smoke test conversation memory**

After getting a response, type a follow-up like "give me an example" without re-selecting text. The model should respond contextually (it has the full history).

- [ ] **Step 6: Smoke test settings**

Right-click tray icon → Open Settings. Change the model, toggle startup, change Ollama URL. Verify changes persist after closing and reopening Settings.

- [ ] **Step 7: Commit smoke test notes**

If you discovered any bugs, fix them in their respective task files and commit. If everything works, no commit needed for this task.

---

## Task 18: Production build + Windows installer

**Files:**
- Create: `contextchat-desktop/electron-builder.config.cjs`

- [ ] **Step 1: Create `electron-builder.config.cjs`**

```javascript
module.exports = {
  appId: 'com.contextchat.desktop',
  productName: 'ContextChat',
  directories: { output: 'release' },
  files: ['out/**/*', 'resources/**/*', 'package.json'],
  extraResources: [{ from: 'resources/tray-icon.png', to: 'tray-icon.png' }],
  win: {
    target: ['nsis'],
    icon: 'resources/app-icon.png'
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true
  }
};
```

- [ ] **Step 2: Build production bundle**

Run: `npm run build`
Expected: `out/` directory populated with main, preload, renderer bundles. No errors.

- [ ] **Step 3: Build installer**

Run: `npm run package`
Expected: `release/ContextChat Setup 0.1.0.exe` written. (electron-builder may need to download Windows codesigning tooling on first run — be patient.)

- [ ] **Step 4: Install and run**

Double-click the generated installer. Confirm:
- App installs to chosen directory
- Auto-starts on next Windows login
- Tray icon appears
- Selecting text in Notepad triggers the floating icon
- Panel works end-to-end

- [ ] **Step 5: Commit installer config**

```bash
git add contextchat-desktop/electron-builder.config.cjs
git commit -m "build: windows nsis installer config"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ Text selection flow → Tasks 9, 12, 13, 15
- ✅ Screenshot flow → Tasks 10, 12, 14, 15
- ✅ Transparent frosted panel → Task 8 (window flags) + Task 2 (CSS) + Task 15 (component)
- ✅ Conversation memory + rolling window → Task 4
- ✅ Hardware-based model recommendation → Task 5 + Task 16
- ✅ System tray with auto-start → Tasks 11, 12
- ✅ Ollama streaming → Task 6
- ✅ Settings persistence → Tasks 7, 16
- ✅ Clipboard restore → Task 9
- ✅ Vision model handling (image attached to message) → Task 6 (`images` field) + Task 12 + Task 15
- ✅ Windows installer → Task 18

**Type-name consistency check:** `Conversation`, `Message`, `Settings`, `OllamaModel`, `HardwareInfo`, `QuickAction` defined once in `src/shared/types.ts` and imported consistently. IPC channel names live only in `electron/ipc-channels.ts` and accessed via `window.cc.channels.*` in renderers.

**No placeholders found.** Every step contains complete code or exact commands.
