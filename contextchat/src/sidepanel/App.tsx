// src/sidepanel/App.tsx
import React, { useState } from 'react';
import NotesView from './NotesView';
import SettingsView from './SettingsView';

type Tab = 'notes' | 'settings';

export default function App() {
  const [tab, setTab] = useState<Tab>('notes');

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b">
        <h1 className="text-sm font-bold text-gray-800">ContextChat</h1>
        <span className="text-xs text-gray-400">v0.1.0</span>
      </div>

      {/* Tab bar */}
      <div className="flex border-b bg-white">
        <button
          onClick={() => setTab('notes')}
          className={`flex-1 py-2 text-xs font-medium ${
            tab === 'notes'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Notes
        </button>
        <button
          onClick={() => setTab('settings')}
          className={`flex-1 py-2 text-xs font-medium ${
            tab === 'settings'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Settings
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'notes' ? <NotesView /> : <SettingsView />}
      </div>
    </div>
  );
}