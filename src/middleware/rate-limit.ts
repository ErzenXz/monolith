import { kv } from '@vercel/kv';
import { config } from '../config.js';
import type { Context, Next } from 'hono';

export async function rateLimitMiddleware(c: Context, next: Next) {
  const apiKey = c.get('apiKey');
  const ip = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown';
  const key = `ratelimit:${apiKey ?? ip}`;

  const current = await kv.get<number>(key);

  if (current !== null && current >= config.rateLimit.maxRequests) {
    return c.json(
      {
        error: 'Rate limit exceeded',
        resetAfter: config.rateLimit.windowMs,
      },
      429
    );
  }

  const newValue = (current ?? 0) + 1;
  await kv.set(key, newValue, { ex: Math.floor(config.rateLimit.windowMs / 1000) });

  c.set('rateLimitRemaining', config.rateLimit.maxRequests - newValue);

  await next();
}

export async function rateLimitHeaders(c: Context, next: Next) {
  await next();

  const remaining = c.get('rateLimitRemaining') ?? config.rateLimit.maxRequests;
  const reset = Math.floor(Date.now() / 1000) + Math.floor(config.rateLimit.windowMs / 1000);

  c.header('X-RateLimit-Limit', config.rateLimit.maxRequests.toString());
  c.header('X-RateLimit-Remaining', remaining.toString());
  c.header('X-RateLimit-Reset', reset.toString());
}
