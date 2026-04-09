// ======================================
// ContextChat — Service Worker (Background Script)
// Will be fully implemented in Steps 7-9
// ======================================

console.log('[ContextChat] Service worker started');

// Set side panel to open on action click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('[ContextChat] Side panel setup error:', error));

// Placeholder — full message handling implemented in Step 7
// AI integration implemented in Steps 8-9