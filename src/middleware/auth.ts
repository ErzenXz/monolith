import { type Context, type Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { config } from '../config.js';

export interface AuthEnv {
  Variables: {
    apiKey?: string;
  };
}

export async function authMiddleware(c: Context, next: Next) {
  const apiKey = c.req.header('x-api-key') ?? c.req.header('authorization');

  if (!apiKey) {
    throw new HTTPException(401, { message: 'API key is required' });
  }

  if (config.apiKeys.length === 0) {
    throw new HTTPException(500, { message: 'API keys not configured' });
  }

  const normalizedApiKey = apiKey.replace(/^bearer\s+/i, '').trim();
  const isValid = config.apiKeys.includes(normalizedApiKey);

  if (!isValid) {
    throw new HTTPException(401, { message: 'Invalid API key' });
  }

  // Store API key in context for downstream handlers
  c.set('apiKey', normalizedApiKey);

  await next();
}

// Bypass auth in development if no API keys are configured
export async function devAuthMiddleware(c: Context, next: Next) {
  if (config.apiKeys.length === 0 && process.env.NODE_ENV !== 'production') {
    await next();
    return;
  }
  await authMiddleware(c, next);
}
