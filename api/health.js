import { config } from '../config.js'

async function handler() {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      queue: !!process.env.UPSTASH_QSTASH_TOKEN,
      storage: !!process.env.BLOB_READ_WRITE_TOKEN,
      rateLimit: !!process.env.KV_REST_API_TOKEN
    },
    config: {
      maxFileSize: `${config.maxFileSize / 1024 / 1024}MB`,
      timeout: `${config.timeout / 1000}s`,
      apiKeysConfigured: config.apiKeys.length > 0
    }
  }

  return new Response(JSON.stringify(health), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  })
}

export default handler
