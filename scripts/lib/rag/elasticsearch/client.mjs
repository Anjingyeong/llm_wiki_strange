const DEFAULT_URL = 'http://localhost:9200';

export function elasticConfig(env = process.env) {
  return {
    url: (env.ELASTICSEARCH_URL || DEFAULT_URL).replace(/\/$/, ''),
    index: env.ELASTICSEARCH_INDEX || 'llm-wiki-chunks-v1',
    username: env.ELASTICSEARCH_USERNAME || '',
    password: env.ELASTICSEARCH_PASSWORD || '',
  };
}

export async function elasticRequest(path, { method = 'GET', body, env = process.env } = {}) {
  const config = elasticConfig(env);
  const headers = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (config.username) {
    headers.authorization = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
  }
  const response = await fetch(`${config.url}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(`Elasticsearch ${method} ${path} failed: ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export async function elasticHealth(env = process.env) {
  return elasticRequest('/_cluster/health?wait_for_status=yellow&timeout=5s', { env });
}
