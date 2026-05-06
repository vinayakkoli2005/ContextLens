// src/background/ai-client.ts
import { AIConfig, QuickAction } from '../shared/note-types';

interface AIRequest {
  selectedText: string;
  context: string;
  action: QuickAction;
  query?: string;
  config: AIConfig;
}

interface AIResponse {
  content: string; // markdown response
}

/** Build the system + user prompt based on the action */
function buildPrompt(req: AIRequest): { system: string; user: string } {
  const system = 'You are a helpful assistant embedded in a browser extension. Be concise and clear. Respond in markdown.';

  let user: string;
  switch (req.action) {
    case 'summarize':
      user = `Summarize the following text in 2-3 concise sentences:\n\n"${req.selectedText}"`;
      break;
    case 'define':
      user = `Define and explain the following term or phrase. Keep it brief:\n\n"${req.selectedText}"`;
      break;
    case 'ask':
      user = `Context: "${req.context}"\n\nSelected text: "${req.selectedText}"\n\nQuestion: ${req.query}`;
      break;
    default:
      user = `Help me understand: "${req.selectedText}"`;
  }

  return { system, user };
}

/** Call the AI API based on provider config */
export async function callAI(req: AIRequest): Promise<AIResponse> {
  const { system, user } = buildPrompt(req);
  const { provider, apiKey, model, ollamaUrl } = req.config;

  if (provider === 'openai') {
    return callOpenAI(apiKey, model, system, user);
  } else if (provider === 'anthropic') {
    return callAnthropic(apiKey, model, system, user);
  } else if (provider === 'ollama') {
    return callOllama(ollamaUrl, model, system, user);
  }

  throw new Error(`Unknown AI provider: ${provider}`);
}

async function callOpenAI(apiKey: string, model: string, system: string, user: string): Promise<AIResponse> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI API error: ${res.status}`);
  }

  const data = await res.json();
  return { content: data.choices[0].message.content };
}

async function callAnthropic(apiKey: string, model: string, system: string, user: string): Promise<AIResponse> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: model || 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Anthropic API error: ${res.status}`);
  }

  const data = await res.json();
  return { content: data.content[0].text };
}

async function callOllama(baseUrl: string, model: string, system: string, user: string): Promise<AIResponse> {
  const url = `${baseUrl || 'http://localhost:11434'}/api/chat`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || 'llama3.2',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      stream: false,
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama error: ${res.status}`);
  }

  const data = await res.json();
  return { content: data.message.content };
}
