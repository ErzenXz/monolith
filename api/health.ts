// Monolith Health Check Endpoint
export const config = {
  runtime: 'edge'
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

  const maxFileSize = parseInt(process.env.MAX_FILE_SIZE ?? '') || 500 * 1024 * 1024;
  const timeout = parseInt(process.env.TIMEOUT ?? '') || 300000;
  const apiKeys = process.env.API_KEYS ? process.env.API_KEYS.split(',') : [];

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
