import React from 'react';

export default function App() {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-white p-6">
      <div className="text-center">
        <div className="text-4xl mb-4">💬</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">ContextChat</h1>
        <p className="text-sm text-gray-500">
          Side Panel Ready — Select text on any page to start chatting
        </p>
        <div className="mt-4 px-3 py-1.5 bg-blue-50 rounded-lg text-xs text-blue-600">
          v0.1.0 — MVP Scaffold
        </div>
      </div>
    </div>
  );
}