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
