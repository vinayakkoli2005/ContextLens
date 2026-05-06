// src/sidepanel/NotesView.tsx
import React, { useState, useEffect } from 'react';
import { Note } from '../shared/note-types';
import NoteCard from './NoteCard';

export default function NotesView() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadNotes() {
    try {
      const result = await chrome.runtime.sendMessage({ type: 'GET_NOTES', payload: {} });
      if (Array.isArray(result)) setNotes(result);
    } catch (err) {
      console.error('[ContextChat] Failed to load notes:', err);
    }
    setLoading(false);
  }

  useEffect(() => { loadNotes(); }, []);

  async function handleDelete(id: string) {
    await chrome.runtime.sendMessage({ type: 'DELETE_NOTE', payload: { id } });
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  if (loading) return <div className="p-4 text-gray-500">Loading notes...</div>;

  if (notes.length === 0) {
    return (
      <div className="p-4 text-center text-gray-400">
        <div className="text-3xl mb-2">📝</div>
        <div className="text-sm">No saved notes yet</div>
        <div className="text-xs mt-1">Select text on any page and save AI responses as notes</div>
      </div>
    );
  }

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-700">Saved Notes ({notes.length})</h2>
        <button onClick={loadNotes} className="text-xs text-blue-500 hover:underline">Refresh</button>
      </div>
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} onDelete={handleDelete} />
      ))}
    </div>
  );
}
