// ======================================
// ContextChat — Message Passing System
// Will be fully implemented in Step 3
// ======================================

import { ExtensionMessage, MessageType } from './types';

/**
 * Send a message to the service worker and wait for a response.
 * Placeholder — full implementation in Step 3.
 */
export async function sendMessage<T = any>(
  type: MessageType,
  payload: any
): Promise<T> {
  const response = await chrome.runtime.sendMessage({ type, payload });
  if (response?.error) throw new Error(response.error);
  return response;
}

/**
 * Initialize the message listener.
 * Placeholder — full implementation in Step 3.
 */
export function initMessageListener(): void {
  // Will be implemented in Step 3
  console.log('[ContextChat] Message listener placeholder initialized');
}

/**
 * Register a handler for a specific message type.
 * Placeholder — full implementation in Step 3.
 */
export function onMessage(
  type: MessageType,
  handler: (payload: any, sender: chrome.runtime.MessageSender) => Promise<any> | any
): void {
  // Will be implemented in Step 3
}