export const config = {
  runtime: 'nodejs',
};

export default async function handler(request: Request): Promise<Response> {
  const results: Record<string, string> = {};

  // Test sharp
  try {
    const sharp = await import('sharp');
    results.sharp = `OK (version: ${typeof sharp.default?.versions === 'object' ? JSON.stringify(sharp.default.versions) : 'loaded'})`;
  } catch (e: unknown) {
    results.sharp = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Test @vercel/kv
  try {
    await import('@vercel/kv');
    results.kv = 'OK';
  } catch (e: unknown) {
    results.kv = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Test @vercel/blob
  try {
    await import('@vercel/blob');
    results.blob = 'OK';
  } catch (e: unknown) {
    results.blob = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Test @upstash/qstash
  try {
    await import('@upstash/qstash');
    results.qstash = 'OK';
  } catch (e: unknown) {
    results.qstash = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Test fluent-ffmpeg
  try {
    await import('fluent-ffmpeg');
    results.ffmpeg = 'OK';
  } catch (e: unknown) {
    results.ffmpeg = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Test compressor import
  try {
    await import('../lib/compressor/index.js');
    results.compressor = 'OK';
  } catch (e: unknown) {
    results.compressor = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Test the full handler chain import
  try {
    await import('./compress/image.js');
    results.imageHandler = 'OK';
  } catch (e: unknown) {
    results.imageHandler = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
  }

  return new Response(JSON.stringify({ results, node: process.version }, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
