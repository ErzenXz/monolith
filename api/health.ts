// Monolith Health Check Endpoint
export const config = {
  runtime: 'nodejs'
};

export default function handler(request: Request): Response {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization'
      }
    });
  }

  const maxFileSizeEnv = process.env.MAX_FILE_SIZE;
  const maxFileSize = maxFileSizeEnv ? parseInt(maxFileSizeEnv, 10) || 524288000 : 524288000;
  const timeoutEnv = process.env.TIMEOUT;
  const timeout = timeoutEnv ? parseInt(timeoutEnv, 10) || 300000 : 300000;
  const apiKeysEnv = process.env.API_KEYS;
  const apiKeys = apiKeysEnv ? apiKeysEnv.split(',') : [];

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    services: {
      queue: Boolean(process.env.UPSTASH_QSTASH_TOKEN),
      storage: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      rateLimit: Boolean(process.env.KV_REST_API_TOKEN)
    },
    config: {
      maxFileSize: `${maxFileSize / 1024 / 1024}MB`,
      timeout: `${timeout / 1000}s`,
      apiKeysConfigured: apiKeys.length > 0
    }
  };

  return new Response(JSON.stringify(health), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
