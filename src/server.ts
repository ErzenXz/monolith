import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { compress } from 'hono/compress';
import { prettyJSON } from 'hono/pretty-json';

// Routes
import healthRoutes from './routes/health.js';
import imageRoutes from './routes/compress/image.js';
import videoRoutes from './routes/compress/video.js';
import audioRoutes from './routes/compress/audio.js';
import jobRoutes from './routes/jobs/index.js';
import processRoutes from './routes/jobs/process.js';
import debugRoutes from './routes/debug.js';

// Middleware
import { authMiddleware } from './middleware/auth.js';
import { rateLimitMiddleware, rateLimitHeaders } from './middleware/rate-limit.js';

// Create Hono app
const app = new Hono();

// Global middleware
app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'X-API-Key', 'Authorization'],
}));
app.use('*', compress());
app.use('*', prettyJSON());

// Health check (no auth required)
app.route('/', healthRoutes);

// Debug endpoint (no auth required in development)
if (process.env.NODE_ENV !== 'production') {
  app.route('/debug', debugRoutes);
}

// API routes with auth and rate limiting
const api = new Hono();
api.use('*', authMiddleware);
api.use('*', rateLimitMiddleware);
api.use('*', rateLimitHeaders);

api.route('/compress/image', imageRoutes);
api.route('/compress/video', videoRoutes);
api.route('/compress/audio', audioRoutes);
api.route('/jobs', jobRoutes);
api.route('/jobs', processRoutes);

app.route('/api', api);

// Start server
const port = parseInt(process.env.PORT ?? '') || 3001;

const server = serve({
  fetch: app.fetch,
  port,
});

console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                              ║
║              Monolith - Media Compression API               ║
║                                                              ║
║              Hono Server (NOT Serverless!)                   ║
║                                                              ║
║        Server running on http://localhost:${port}               ║
║                                                              ║
║        Deployment: Traditional Node.js Process                ║
║        Queue: Upstash QStash    | Storage: Vercel Blob    ║
║        Rate Limit: Vercel KV      | Compress: Sharp/FFmpeg ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

// =============================================================================
// Graceful Shutdown Handling
// =============================================================================

let isShuttingDown = false;

function gracefulShutdown(signal: string) {
  if (isShuttingDown) {
    console.log(`[${signal}] Shutdown already in progress, forcing exit...`);
    process.exit(1);
  }

  isShuttingDown = true;
  console.log(`\n[${signal}] Received shutdown signal, starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    console.log('✅ HTTP server closed');

    // Give a moment for in-flight requests to complete
    setTimeout(() => {
      console.log('✅ Graceful shutdown complete');
      process.exit(0);
    }, 1000);
  });

  // Force exit after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('❌ Graceful shutdown timeout, forcing exit');
    process.exit(1);
  }, 10000);
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2'));

// Log unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

export default app;
