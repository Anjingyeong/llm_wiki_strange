import { readEnv } from '../env.mjs';

export async function generateCloudflareAnswer({ query, contexts, model, maxOutputTokens, accountId, apiToken, env = {} }) {
  const finalAccountId = accountId || readEnv(env, 'CLOUDFLARE_ACCOUNT_ID', '');
  const finalApiToken = apiToken || readEnv(env, 'CLOUDFLARE_API_TOKEN', '');
  if (!finalAccountId || !finalApiToken) {
    throw new Error('Missing Cloudflare accountId or apiToken credentials');
  }
  const finalModel = model || '@cf/meta/llama-3.1-8b-instruct';
  const url = `https://api.cloudflare.com/client/v4/accounts/${finalAccountId}/ai/run/${finalModel}`;

  const prompt = [
    'You are an AI assistant helping a team based strictly on local engineering wiki contexts.',
    'Follow these guidelines:',
    '1. Answer ONLY based on the provided contexts below. Do NOT assume, extrapolate, or invent facts.',
    '2. If the contexts do not contain enough information to answer the question, state clearly that you do not have enough context.',
    '3. Incorporate source titles and section paths as references/citations where applicable.',
    '',
    'Contexts:',
    contexts.map((c, i) => `[Context #${i+1}] Title: ${c.title} | Section: ${c.sectionTitle} | Path: ${c.sourcePath}\n${c.text}`).join('\n\n---\n\n'),
    '',
    `Question: ${query}`,
  ].join('\n');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${finalApiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxOutputTokens || 800,
    }),
  });

  if (!response.ok) {
    throw new Error(`Cloudflare AI API failed with status ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const answerText = data.result?.response;
  if (!answerText) {
    throw new Error('Empty response returned from Cloudflare AI API');
  }
  return answerText;
}
