// src/content/index.ts
import { initInlineUI } from './inline-ui';

console.log('[ContextChat] Content script loaded on:', window.location.href);

// Boot the inline AI assistant
initInlineUI();