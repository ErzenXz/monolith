export const config = {
  runtime: 'nodejs'
};

export default function handler(): Response {
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
