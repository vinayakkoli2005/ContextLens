// src/content/selection-detector.ts
import { MIN_SELECTION_LENGTH, MAX_SELECTION_LENGTH, SELECTION_DEBOUNCE_MS, MAX_CONTEXT_CHARS } from '../shared/constants';
import { InlineUIPosition } from '../shared/note-types';

export interface SelectionData {
  text: string;
  context: string;
  position: InlineUIPosition;
  range: Range;
}

type SelectionCallback = (data: SelectionData | null) => void;

let debounceTimer: number | null = null;

/**
 * Starts listening for text selections on the page.
 * Calls `onSelect` with selection data when a valid selection is detected,
 * or with `null` when the selection is cleared.
 */
export function startSelectionListener(onSelect: SelectionCallback): () => void {
  function handleMouseUp(): void {
    if (debounceTimer !== null) clearTimeout(debounceTimer);

    debounceTimer = window.setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) {
        onSelect(null);
        return;
      }

      const text = selection.toString().trim();
      if (text.length < MIN_SELECTION_LENGTH || text.length > MAX_SELECTION_LENGTH) {
        onSelect(null);
        return;
      }

      // Ignore selections inside our own Shadow DOM host
      const anchorNode = selection.anchorNode;
      if (anchorNode && isInsideShadowHost(anchorNode)) {
        return; // don't clear or trigger — user is interacting with our UI
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const context = extractSurroundingContext(range);

      onSelect({
        text: text.slice(0, MAX_SELECTION_LENGTH),
        context,
        position: {
          top: rect.bottom + window.scrollY + 8,
          left: rect.left + window.scrollX + (rect.width / 2),
        },
        range: range.cloneRange(),
      });
    }, SELECTION_DEBOUNCE_MS);
  }

  document.addEventListener('mouseup', handleMouseUp);

  return () => {
    document.removeEventListener('mouseup', handleMouseUp);
    if (debounceTimer !== null) clearTimeout(debounceTimer);
  };
}

/** Extract surrounding text for AI context */
function extractSurroundingContext(range: Range): string {
  const container = range.commonAncestorContainer;
  const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container as HTMLElement;
  if (!element) return '';

  // Walk up to find a reasonable block-level parent
  let block = element;
  const blockTags = ['P', 'DIV', 'ARTICLE', 'SECTION', 'LI', 'TD', 'BLOCKQUOTE'];
  while (block.parentElement && !blockTags.includes(block.tagName)) {
    block = block.parentElement;
  }

  const fullText = block.textContent || '';
  if (fullText.length <= MAX_CONTEXT_CHARS) return fullText;

  // Center the context window around the selection
  const selectedText = range.toString();
  const selIndex = fullText.indexOf(selectedText);
  if (selIndex === -1) return fullText.slice(0, MAX_CONTEXT_CHARS);

  const half = Math.floor((MAX_CONTEXT_CHARS - selectedText.length) / 2);
  const start = Math.max(0, selIndex - half);
  const end = Math.min(fullText.length, selIndex + selectedText.length + half);
  return fullText.slice(start, end);
}

/** Check if a node is inside our Shadow DOM host */
function isInsideShadowHost(node: Node): boolean {
  let current: Node | null = node;
  while (current) {
    if (current instanceof HTMLElement && current.id === 'contextchat-root') return true;
    current = current.parentNode || (current as any).host || null;
  }
  return false;
}
