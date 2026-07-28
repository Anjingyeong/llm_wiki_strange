#!/usr/bin/env node
import { searchElastic } from './lib/rag/elasticsearch/search.mjs';

const query = process.argv.slice(2).join(' ').trim();
if (!query) {
  console.error('Usage: npm run elastic:search -- <query>');
  process.exit(1);
}
const mode = process.env.ELASTIC_RETRIEVAL_MODE || 'hybrid';
const results = await searchElastic(query, { mode, limit: 5 });
console.log(JSON.stringify({ mode, query, results }, null, 2));
