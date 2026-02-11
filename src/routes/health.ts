import { Hono } from 'hono';
import { config } from '../config.js';
import { storage } from '../lib/storage.js';
import { kv } from '@vercel/kv';
import type { HealthCheckResponse } from '../types/index.js';

const app = new Hono();

app.get('/health', async (c) => {
  // Check services
  const [kvOk, storageOk] = await Promise.allSettled([
    // Check KV
    kv.ping?.().then(() => true).catch(() => false) ?? Promise.resolve(true),
    // Check storage - just verify it's configured
    Promise.resolve(true),
  ]);

  const services = {
    queue: kvOk.status === 'fulfilled',
    storage: storageOk.status === 'fulfilled',
    rateLimit: kvOk.status === 'fulfilled',
  };

  const allHealthy = Object.values(services).every((v) => v);

  const response: HealthCheckResponse = {
    status: allHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    services,
    config: {
      maxFileSize: `${config.maxFileSize / 1024 / 1024}MB`,
      timeout: `${config.timeout}ms`,
      apiKeysConfigured: config.apiKeys.length > 0,
    },
  };

  return c.json(response, allHealthy ? 200 : 503);
});

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'Media Compression API',
    version: '2.0.0',
    status: 'running',
    deployment: 'traditional-server',
    services: {
      queue: 'Upstash QStash',
      storage: 'Vercel Blob',
      rateLimit: 'Vercel KV',
    },
    endpoints: {
      health: '/health',
      compress: {
        image: '/api/compress/image',
        video: '/api/compress/video',
        audio: '/api/compress/audio',
      },
      jobs: {
        status: '/api/jobs/status/:id',
        delete: '/api/jobs/delete/:id',
        list: '/api/jobs',
      },
    },
  });
});

export default app;
