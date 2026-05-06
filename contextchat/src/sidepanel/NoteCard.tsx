// src/sidepanel/NoteCard.tsx
import React, { useState } from 'react';
import { Note } from '../shared/note-types';

interface NoteCardProps {
  note: Note;
  onDelete: (id: string) => void;
}

export default function NoteCard({ note, onDelete }: NoteCardProps) {
  const [expanded, setExpanded] = useState(false);

  const date = new Date(note.createdAt).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const actionLabel = note.action === 'ask' ? `Asked: ${note.query}` :
                      note.action === 'summarize' ? 'Summary' : 'Definition';

  return (
    <div className="border rounded-lg p-3 mb-2 bg-white">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-400 mb-1">{date}</div>
          <div className="text-xs font-medium text-blue-600 mb-1">{actionLabel}</div>
          <div className="text-sm text-gray-700 truncate">
            "{note.selectedText.slice(0, 60)}{note.selectedText.length > 60 ? '...' : ''}"
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-2 text-xs text-gray-400 hover:text-gray-700"
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t">
          <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
            {note.response}
          </div>
          <div className="mt-2 flex justify-between items-center">
            <a
              href={note.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:underline truncate max-w-[200px]"
            >
              {note.title || note.url}
            </a>
            <button
              onClick={() => onDelete(note.id)}
              className="text-xs text-red-400 hover:text-red-600"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
