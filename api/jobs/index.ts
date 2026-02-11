export const config = {
  runtime: 'edge'
};

export default function handler(request: Request): Response {
  // Simple CORS handling
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

  // Check API key
  const apiKey = request.headers.get('X-API-Key');
  const validKeys = process.env.API_KEYS ? process.env.API_KEYS.split(',') : [];

  if (!apiKey || !validKeys.includes(apiKey)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      jobs: [],
      total: 0,
      message: 'Jobs API is working!'
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    }
  );
}
