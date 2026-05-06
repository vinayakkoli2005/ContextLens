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