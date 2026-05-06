// src/content/response-card.ts
import { getShadowRoot } from './shadow-host';
import { InlineUIPosition } from '../shared/note-types';
import { RESPONSE_CARD_WIDTH } from '../shared/constants';

let cardElement: HTMLDivElement | null = null;

export interface ResponseCardCallbacks {
  onSave: () => void;
  onClose: () => void;
}

/** Show a loading state while waiting for AI response */
export function showResponseLoading(position: InlineUIPosition): void {
  const root = getShadowRoot();
  if (cardElement) cardElement.remove();

  cardElement = document.createElement('div');
  cardElement.className = 'cc-response';

  const left = Math.min(
    position.left - RESPONSE_CARD_WIDTH / 2,
    window.innerWidth - RESPONSE_CARD_WIDTH - 16
  );
  const clampedLeft = Math.max(16, left);

  cardElement.style.top = `${position.top}px`;
  cardElement.style.left = `${clampedLeft}px`;
  cardElement.innerHTML = `
    <div class="cc-panel-header">
      <span class="cc-panel-header-title">Response</span>
    </div>
    <div class="cc-loading">Thinking<span class="cc-loading-dots"></span></div>
  `;

  root.appendChild(cardElement);
}

/** Show the AI response with save/close buttons */
export function showResponse(
  position: InlineUIPosition,
  responseHtml: string,
  callbacks: ResponseCardCallbacks
): void {
  const root = getShadowRoot();
  if (cardElement) cardElement.remove();

  cardElement = document.createElement('div');
  cardElement.className = 'cc-response';

  const left = Math.min(
    position.left - RESPONSE_CARD_WIDTH / 2,
    window.innerWidth - RESPONSE_CARD_WIDTH - 16
  );
  const clampedLeft = Math.max(16, left);

  cardElement.style.top = `${position.top}px`;
  cardElement.style.left = `${clampedLeft}px`;

  cardElement.innerHTML = `
    <div class="cc-panel-header">
      <span class="cc-panel-header-title">Response</span>
      <button class="cc-close-btn" data-action="close">&times;</button>
    </div>
    <div class="cc-response-body">${responseHtml}</div>
    <div class="cc-response-footer">
      <button class="cc-save-btn" data-action="save">Save as Note</button>
      <button class="cc-close-btn" data-action="close" style="margin-left:auto;">Close</button>
    </div>
  `;

  cardElement.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const action = target.dataset.action;
    if (action === 'save') callbacks.onSave();
    else if (action === 'close') callbacks.onClose();
    e.stopPropagation();
  });

  root.appendChild(cardElement);
}

/** Show an error in the response card */
export function showResponseError(position: InlineUIPosition, message: string, onClose: () => void): void {
  const root = getShadowRoot();
  if (cardElement) cardElement.remove();

  cardElement = document.createElement('div');
  cardElement.className = 'cc-response';

  const left = Math.min(
    position.left - RESPONSE_CARD_WIDTH / 2,
    window.innerWidth - RESPONSE_CARD_WIDTH - 16
  );
  const clampedLeft = Math.max(16, left);

  cardElement.style.top = `${position.top}px`;
  cardElement.style.left = `${clampedLeft}px`;

  cardElement.innerHTML = `
    <div class="cc-panel-header">
      <span class="cc-panel-header-title">Error</span>
      <button class="cc-close-btn" data-action="close">&times;</button>
    </div>
    <div class="cc-error">${escapeHtml(message)}</div>
  `;

  cardElement.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).dataset.action === 'close') onClose();
    e.stopPropagation();
  });

  root.appendChild(cardElement);
}

/** Hide and remove the response card */
export function hideResponseCard(): void {
  if (cardElement) {
    cardElement.remove();
    cardElement = null;
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
