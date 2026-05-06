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
