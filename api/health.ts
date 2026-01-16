export const config = {
  runtime: 'edge',
};

export default function handler(_request: Request): Response {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
  };

  return new Response(JSON.stringify(health), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
