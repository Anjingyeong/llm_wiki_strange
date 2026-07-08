import { readEnv } from '../env.mjs';

export async function generateOpenaiAnswer({ query, contexts, model, maxOutputTokens, apiKey, env = {} }) {
  const finalApiKey = apiKey || readEnv(env, 'OPENAI_API_KEY', '');
  if (!finalApiKey) {
    throw new Error('Missing OpenAI API Key');
  }
  const finalModel = model || 'gpt-4o-mini';
  const url = 'https://api.openai.com/v1/chat/completions';

  const prompt = [
    'You are an AI assistant helping a team based strictly on local engineering wiki contexts.',
    'Follow these guidelines:',
    '1. Answer ONLY based on the provided contexts below. Do NOT assume, extrapolate, or invent facts.',
    '2. If the contexts do not contain enough information to answer the question, state clearly that you do not have enough context.',
    '3. Incorporate source titles and section paths as references/citations where applicable.',
    '',
    'Contexts:',
    contexts.map((c, i) => `[Context #${i+1}] DisplayTitle: ${c.displayTitle ?? c.title} | Title: ${c.title} | Section: ${c.sectionTitle} | Path: ${c.sourcePath}\n${c.text}`).join('\n\n---\n\n'),
  ].join('\n');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${finalApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: finalModel,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `Question: ${query}` },
      ],
      max_tokens: maxOutputTokens || 800,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API failed with status ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const answerText = data.choices?.[0]?.message?.content;
  if (!answerText) {
    throw new Error('Empty response content returned from OpenAI API');
  }
  return answerText;
}
