// src/content/fab.ts
import { getShadowRoot } from './shadow-host';
import { InlineUIPosition } from '../shared/note-types';

let fabElement: HTMLButtonElement | null = null;
let onClickCallback: (() => void) | null = null;

/** Show the FAB near the given position */
export function showFab(position: InlineUIPosition, onClick: () => void): void {
  const root = getShadowRoot();
  onClickCallback = onClick;

  if (!fabElement) {
    fabElement = document.createElement('button');
    fabElement.className = 'cc-fab';
    fabElement.textContent = '✦';
    fabElement.addEventListener('click', (e) => {
      e.stopPropagation();
      onClickCallback?.();
    });
    root.appendChild(fabElement);
  }

  fabElement.style.top = `${position.top}px`;
  fabElement.style.left = `${position.left}px`;
  fabElement.style.transform = 'translateX(-50%)';
  fabElement.classList.remove('cc-hidden');
}

/** Hide the FAB */
export function hideFab(): void {
  if (fabElement) {
    fabElement.classList.add('cc-hidden');
  }
}

/** Remove FAB from DOM entirely */
export function destroyFab(): void {
  if (fabElement) {
    fabElement.remove();
    fabElement = null;
  }
}
