// ======================================
// ContextChat — Core Type Definitions
// ======================================

/** Represents a web page or PDF that the user has annotated */
export interface Document {
  id: string;              // SHA-256 hash of the URL
  url: string;             // Full URL of the page
  title: string;           // Page title (document.title)
  createdAt: number;       // Unix timestamp (Date.now())
  lastAccessedAt: number;  // Updated each time user opens threads for this doc
}

/** A chat thread bound to a specific text selection */
export interface Thread {
  id: string;              // UUID v4
  documentId: string;      // Foreign key → Document.id
  selectedText: string;    // The exact text the user highlighted
  surroundingContext: string; // Text around the selection for AI context
  highlightDescriptor: HighlightDescriptor; // For restoring the highlight on page reload
  createdAt: number;       // Unix timestamp
  updatedAt: number;       // Updated on each new message
  archived: boolean;       // Hidden from main list after archiving
  color: string;           // Hex color for the highlight (e.g., '#FFE066')
}

/** A single message in a chat thread */
export interface Message {
  id: string;              // UUID v4
  threadId: string;        // Foreign key → Thread.id
  role: 'user' | 'assistant' | 'system';
  content: string;         // Message text (markdown for assistant)
  createdAt: number;       // Unix timestamp
  tokenCount?: number;     // Estimated token count (optional)
  isComplete: boolean;     // false while AI is still streaming
}

/** Serializable description of a DOM range for restoring highlights */
export interface HighlightDescriptor {
  startXPath: string;      // XPath to the start text node
  startOffset: number;     // Character offset in start node
  endXPath: string;        // XPath to the end text node
  endOffset: number;       // Character offset in end node
  textFingerprint: string; // First 100 chars of selected text (for validation)
}

/** Configuration for an AI provider */
export interface AIProvider {
  name: string;
  model: string;
  apiKey: string;
  baseUrl: string;
}

/** User-configurable settings, stored in chrome.storage.local */
export interface AppSettings {
  provider: 'openai' | 'anthropic' | 'ollama';
  apiKey: string;
  model: string;
  ollamaUrl: string;       // Default: http://localhost:11434
  temperature: number;     // 0.0 to 1.0, default 0.3
  theme: 'light' | 'dark' | 'system';
}

/** All possible message types for chrome.runtime messaging */
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
  | 'AI_REQUEST'
  | 'AI_RESPONSE'
  | 'AI_ERROR'
  | 'SAVE_NOTE'
  | 'GET_NOTES'
  | 'DELETE_NOTE'
  | 'GET_NOTES_FOR_URL'
  | 'GET_SETTINGS'
  | 'SAVE_SETTINGS';

/** Envelope for all messages passed between extension contexts */
export interface ExtensionMessage {
  type: MessageType;
  payload: any;
}
