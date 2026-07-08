import { generateMockAnswer } from './mock.mjs';
import { generateGeminiAnswer } from './gemini.mjs';
import { generateCloudflareAnswer } from './cloudflare.mjs';
import { generateOpenaiAnswer } from './openai.mjs';

export async function generateAnswer({
  query,
  contexts,
  provider,
  model,
  maxOutputTokens,
  timeoutMs = 10000,
  credentials = {},
}) {
  const selectedProvider = (provider || 'none').toLowerCase();
  if (selectedProvider === 'none') {
    return null;
  }

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`LLM Generation Timeout exceeded (${timeoutMs}ms)`));
    }, timeoutMs);
  });

  const runPromise = async () => {
    switch (selectedProvider) {
      case 'mock':
        return generateMockAnswer({ query, contexts });
      case 'gemini':
        return generateGeminiAnswer({
          query,
          contexts,
          model,
          maxOutputTokens,
          apiKey: credentials.geminiApiKey || process.env.GEMINI_API_KEY,
        });
      case 'cloudflare':
        return generateCloudflareAnswer({
          query,
          contexts,
          model,
          maxOutputTokens,
          accountId: credentials.cloudflareAccountId || process.env.CLOUDFLARE_ACCOUNT_ID,
          apiToken: credentials.cloudflareApiToken || process.env.CLOUDFLARE_API_TOKEN,
        });
      case 'openai':
        return generateOpenaiAnswer({
          query,
          contexts,
          model,
          maxOutputTokens,
          apiKey: credentials.openaiApiKey || process.env.OPENAI_API_KEY,
        });
      default:
        throw new Error(`Unsupported LLM Provider: ${provider}`);
    }
  };

  return Promise.race([runPromise(), timeoutPromise]);
}
