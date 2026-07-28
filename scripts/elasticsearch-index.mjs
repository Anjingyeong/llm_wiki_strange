#!/usr/bin/env node
import { elasticHealth } from './lib/rag/elasticsearch/client.mjs';
import { recreateAndBulkIndex } from './lib/rag/elasticsearch/index.mjs';

try {
  const health = await elasticHealth();
  const result = await recreateAndBulkIndex();
  console.log(JSON.stringify({ health: health.status, ...result }, null, 2));
} catch (error) {
  console.error(error.message);
  if (error.payload) console.error(JSON.stringify(error.payload, null, 2));
  process.exitCode = 1;
}
