// src/background/db.ts
import { openDB, IDBPDatabase } from 'idb';
import { DB_NAME, DB_VERSION } from '../shared/constants';
import { Note } from '../shared/note-types';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Notes store with URL index for per-page lookups
        if (!db.objectStoreNames.contains('notes')) {
          const noteStore = db.createObjectStore('notes', { keyPath: 'id' });
          noteStore.createIndex('by-url', 'url');
          noteStore.createIndex('by-createdAt', 'createdAt');
        }
      },
    });
  }
  return dbPromise;
}

/** Save a note */
export async function saveNote(note: Note): Promise<void> {
  const db = await getDB();
  await db.put('notes', note);
}

/** Get all notes, newest first */
export async function getAllNotes(): Promise<Note[]> {
  const db = await getDB();
  const notes = await db.getAll('notes');
  return notes.sort((a, b) => b.createdAt - a.createdAt);
}

/** Get notes for a specific URL */
export async function getNotesForUrl(url: string): Promise<Note[]> {
  const db = await getDB();
  const notes = await db.getAllFromIndex('notes', 'by-url', url);
  return notes.sort((a, b) => b.createdAt - a.createdAt);
}

/** Delete a note by ID */
export async function deleteNote(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('notes', id);
}
