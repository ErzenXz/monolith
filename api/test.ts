export const config = {
  runtime: 'edge'
};

export default function handler(request: Request): Response {
  return new Response(
    JSON.stringify({
      success: true,
      message: 'Test endpoint working',
      timestamp: new Date().toISOString()
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
