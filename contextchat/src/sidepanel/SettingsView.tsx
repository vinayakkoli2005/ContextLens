// src/sidepanel/SettingsView.tsx
import React, { useState, useEffect } from 'react';
import { AIConfig } from '../shared/note-types';

const DEFAULT_CONFIG: AIConfig = {
  provider: 'openai',
  apiKey: '',
  model: '',
  ollamaUrl: 'http://localhost:11434',
};

export default function SettingsView() {
  const [config, setConfig] = useState<AIConfig>(DEFAULT_CONFIG);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS', payload: {} })
      .then((result) => {
        if (result && !result.error) setConfig(result);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    await chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', payload: config });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return <div className="p-4 text-gray-500">Loading...</div>;

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold text-gray-800">Settings</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">AI Provider</label>
        <select
          value={config.provider}
          onChange={(e) => setConfig({ ...config, provider: e.target.value as AIConfig['provider'] })}
          className="w-full p-2 border rounded-lg text-sm"
        >
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="ollama">Ollama (Local)</option>
        </select>
      </div>

      {config.provider !== 'ollama' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
          <input
            type="password"
            value={config.apiKey}
            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
            placeholder={config.provider === 'openai' ? 'sk-...' : 'sk-ant-...'}
            className="w-full p-2 border rounded-lg text-sm"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Model (optional)</label>
        <input
          type="text"
          value={config.model}
          onChange={(e) => setConfig({ ...config, model: e.target.value })}
          placeholder={
            config.provider === 'openai' ? 'gpt-4o-mini' :
            config.provider === 'anthropic' ? 'claude-sonnet-4-20250514' :
            'llama3.2'
          }
          className="w-full p-2 border rounded-lg text-sm"
        />
      </div>

      {config.provider === 'ollama' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ollama URL</label>
          <input
            type="text"
            value={config.ollamaUrl}
            onChange={(e) => setConfig({ ...config, ollamaUrl: e.target.value })}
            placeholder="http://localhost:11434"
            className="w-full p-2 border rounded-lg text-sm"
          />
        </div>
      )}

      <button
        onClick={handleSave}
        className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
      >
        {saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  );
}
