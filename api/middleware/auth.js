import { config } from '../config.js'

export async function authMiddleware(request) {
  const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')

  if (!apiKey) {
    return {
      success: false,
      error: 'API key is required'
    }
  }

  if (!config.apiKeys.length) {
    return {
      success: false,
      error: 'API keys not configured'
    }
  }

  const normalizedApiKey = apiKey.replace('Bearer ', '').trim()
  const isValid = config.apiKeys.includes(normalizedApiKey)

  if (!isValid) {
    return {
      success: false,
      error: 'Invalid API key'
    }
  }

  return {
    success: true,
    apiKey: normalizedApiKey
  }
}

export function withAuth(handler) {
  return async (request) => {
    const auth = await authMiddleware(request)

    if (!auth.success) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return handler(request, auth.apiKey)
  }
}
