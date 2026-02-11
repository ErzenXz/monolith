import { Hono } from 'hono';
import { imageCompressor } from '../lib/compressor/image.js';
import { config } from '../config.js';

const app = new Hono();

app.get('/', async (c) => {
  const info = {
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    config: {
      maxFileSize: `${config.maxFileSize / 1024 / 1024}MB`,
      timeout: `${config.timeout}ms`,
      apiKeysConfigured: config.apiKeys.length,
      rateLimit: {
        windowMs: config.rateLimit.windowMs,
        maxRequests: config.rateLimit.maxRequests,
      },
    },
    dependencies: {
      sharp: 'loaded',
      ffmpeg: 'loaded',
    },
    timestamp: new Date().toISOString(),
  };

  return c.json(info);
});

// Test sharp directly
app.get('/sharp', async (c) => {
  try {
    // Test basic sharp functionality
    const testBuffer = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    );

    const metadata = await imageCompressor.getMetadata(testBuffer);

    return c.json({
      success: true,
      message: 'Sharp is working',
      testImage: metadata,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Sharp test failed',
      },
      500
    );
  }
});

export default app;
