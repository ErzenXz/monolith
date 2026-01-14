import { kv } from '@vercel/kv'
import { config } from '../config.js'

export async function rateLimitMiddleware(apiKey, ip) {
  const key = `ratelimit:${apiKey || ip}`
  const current = await kv.get(key)

  if (current && current >= config.rateLimit.maxRequests) {
    return {
      success: false,
      error: 'Rate limit exceeded',
      resetAfter: config.rateLimit.windowMs
    }
  }

  const newValue = (current || 0) + 1
  await kv.set(key, newValue, { ex: config.rateLimit.windowMs / 1000 })

  return {
    success: true,
    remaining: config.rateLimit.maxRequests - newValue
  }
}

export function withRateLimit(handler) {
  return async function(request, apiKey) {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const rateLimit = await rateLimitMiddleware(apiKey, ip)

    if (!rateLimit.success) {
      return new Response(JSON.stringify({ 
        error: rateLimit.error,
        resetAfter: rateLimit.resetAfter
      }), {
        status: 429,
        headers: { 
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil(rateLimit.resetAfter / 1000).toString()
        }
      })
    }

    const response = await handler(request, apiKey)
    
    if (response.headers) {
      response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString())
      response.headers.set('X-RateLimit-Limit', config.rateLimit.maxRequests.toString())
    }

    return response
  }
}
