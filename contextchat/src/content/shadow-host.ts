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
