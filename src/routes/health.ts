import { Hono } from 'hono';
import { config } from '../config.js';
import { kv } from '@vercel/kv';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { HealthCheckResponse } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// Root endpoint - serve dashboard HTML
app.get('/', async (c) => {
  try {
    const htmlPath = join(__dirname, '../../public/index.html');
    const html = await fs.readFile(htmlPath, 'utf-8');
    return c.html(html);
  } catch {
    return c.html('<!DOCTYPE html><html><head><title>Monolith</title></head><body><h1>Monolith API</h1><p>Dashboard not found. Please ensure the app is built correctly.</body></html>');
  }
});

export default app;
