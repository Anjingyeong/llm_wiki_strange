export async function generateGeminiAnswer({ query, contexts, model, maxOutputTokens, apiKey }) {
  const finalApiKey = apiKey || process.env.GEMINI_API_KEY;
  if (!finalApiKey) {
    throw new Error('Missing Gemini API Key');
  }
  const finalModel = model || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${finalModel}:generateContent?key=${finalApiKey}`;

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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxOutputTokens || 800 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API failed with status ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const answerText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!answerText) {
    throw new Error('Empty response candidate returned from Gemini API');
  }
  return answerText;
}
