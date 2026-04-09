// ======================================
// ContextChat — Application Constants
// ======================================

/** IndexedDB database name */
export const DB_NAME = 'contextchat-db';

/** IndexedDB schema version (increment on schema changes) */
export const DB_VERSION = 1;

/** Available highlight colors for threads */
export const HIGHLIGHT_COLORS = [
  '#FFE066', // Yellow
  '#A8E6CF', // Mint
  '#FFB3BA', // Pink
  '#B5B8FF', // Lavender
  '#FFDAC1', // Peach
  '#C9F0FF', // Sky blue
  '#E8D5F5', // Purple tint
  '#F0E68C', // Khaki
];

/** Max characters of surrounding context to extract */
export const MAX_CONTEXT_CHARS = 1000;

/** Max active (non-archived) threads per document */
export const MAX_THREADS_PER_DOC = 100;

/** How often to persist streaming AI responses to IndexedDB (ms) */
export const STREAM_PERSIST_INTERVAL = 500;

/** Minimum characters to count as a valid selection */
export const MIN_SELECTION_LENGTH = 3;

/** Max characters of selected text to store */
export const MAX_SELECTION_LENGTH = 5000;

/** Debounce delay for selection detection (ms) */
export const SELECTION_DEBOUNCE_MS = 200;

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
