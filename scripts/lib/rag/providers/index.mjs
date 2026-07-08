import { generateMockAnswer } from './mock.mjs';
import { generateGeminiAnswer } from './gemini.mjs';
import { generateCloudflareAnswer } from './cloudflare.mjs';
import { generateOpenaiAnswer } from './openai.mjs';
import { readEnv } from '../env.mjs';

export async function generateAnswer({
  query,
  contexts,
  provider,
  model,
  maxOutputTokens,
  timeoutMs = 10000,
  credentials = {},
  env = {},
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
          apiKey: credentials.geminiApiKey || readEnv(env, 'GEMINI_API_KEY', ''),
          env,
        });
      case 'cloudflare':
        return generateCloudflareAnswer({
          query,
          contexts,
          model,
          maxOutputTokens,
          accountId: credentials.cloudflareAccountId || readEnv(env, 'CLOUDFLARE_ACCOUNT_ID', ''),
          apiToken: credentials.cloudflareApiToken || readEnv(env, 'CLOUDFLARE_API_TOKEN', ''),
          env,
        });
      case 'openai':
        return generateOpenaiAnswer({
          query,
          contexts,
          model,
          maxOutputTokens,
          apiKey: credentials.openaiApiKey || readEnv(env, 'OPENAI_API_KEY', ''),
          env,
        });
      default:
        throw new Error(`Unsupported LLM Provider: ${provider}`);
    }
  };

  return Promise.race([runPromise(), timeoutPromise]);
}
