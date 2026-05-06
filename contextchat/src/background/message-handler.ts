// src/background/message-handler.ts
import { onMessage } from '../shared/messaging';
import { saveNote, getAllNotes, getNotesForUrl, deleteNote } from './db';
import { callAI } from './ai-client';
import { AIConfig, Note } from '../shared/note-types';

const DEFAULT_CONFIG: AIConfig = {
  provider: 'openai',
  apiKey: '',
  model: '',
  ollamaUrl: 'http://localhost:11434',
};

/** Load AI config from chrome.storage.local */
async function getConfig(): Promise<AIConfig> {
  const result = await chrome.storage.local.get('aiConfig');
  return result.aiConfig || DEFAULT_CONFIG;
}

/** Register all message handlers */
export function registerHandlers(): void {
  onMessage('AI_REQUEST', async (payload) => {
    const config = await getConfig();
    if (!config.apiKey && config.provider !== 'ollama') {
      return { error: 'No API key configured. Open the ContextChat side panel to add your key.' };
    }

    try {
      const result = await callAI({
        selectedText: payload.selectedText,
        context: payload.context,
        action: payload.action,
        query: payload.query,
        config,
      });
      return { content: result.content };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  onMessage('SAVE_NOTE', async (payload) => {
    await saveNote(payload as Note);
    return { success: true };
  });

  onMessage('GET_NOTES', async () => {
    return await getAllNotes();
  });

  onMessage('GET_NOTES_FOR_URL', async (payload) => {
    return await getNotesForUrl(payload.url);
  });

  onMessage('DELETE_NOTE', async (payload) => {
    await deleteNote(payload.id);
    return { success: true };
  });

  onMessage('GET_SETTINGS', async () => {
    return await getConfig();
  });

  onMessage('SAVE_SETTINGS', async (payload) => {
    await chrome.storage.local.set({ aiConfig: payload });
    return { success: true };
  });
}
