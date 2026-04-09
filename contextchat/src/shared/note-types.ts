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
