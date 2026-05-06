// src/shared/messaging.ts
import { ExtensionMessage, MessageType } from './types';

type MessageHandler = (payload: any, sender: chrome.runtime.MessageSender) => Promise<any> | any;

const handlers = new Map<MessageType, MessageHandler>();

/**
 * Send a message to the service worker and wait for a response.
 * Use from content scripts and side panel.
 */
export async function sendMessage<T = any>(
  type: MessageType,
  payload: any = {}
): Promise<T> {
  const response = await chrome.runtime.sendMessage({ type, payload } as ExtensionMessage);
  if (response?.error) throw new Error(response.error);
  return response;
}

/**
 * Register a handler for a specific message type.
 * Use in the service worker to handle incoming messages.
 */
export function onMessage(
  type: MessageType,
  handler: MessageHandler
): void {
  handlers.set(type, handler);
}

/**
 * Initialize the message listener — call once in the service worker.
 * Routes incoming messages to registered handlers.
 */
export function initMessageListener(): void {
  chrome.runtime.onMessage.addListener(
    (message: ExtensionMessage, sender, sendResponse) => {
      const handler = handlers.get(message.type);
      if (!handler) {
        sendResponse({ error: `No handler for message type: ${message.type}` });
        return false;
      }

      // Handle async responses
      const result = handler(message.payload, sender);
      if (result instanceof Promise) {
        result
          .then((data) => sendResponse(data))
          .catch((err) => sendResponse({ error: err.message }));
        return true; // keep the message channel open for async
      }

      sendResponse(result);
      return false;
    }
  );
}