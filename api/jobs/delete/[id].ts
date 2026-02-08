import { kv } from '@vercel/kv';
import { withAuth } from '../../../middleware/auth.js';
import { storage } from '../../../lib/storage.js';
import { successResponse, errorResponse, fileNotFoundResponse, corsResponse } from '../../../lib/utils.js';
import type { Job, RequestHandler } from '../../../types/index.js';

const handler: RequestHandler = async (request) => {
  if (request.method === 'OPTIONS') return corsResponse();
  if (request.method !== 'DELETE') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const jobId = pathParts[pathParts.length - 1];

    if (!jobId || jobId === 'delete') {
      return errorResponse('Job ID is required');
    }

    const jobData = await kv.get<string | Job>(`job:${jobId}`);
    if (!jobData) {
      return fileNotFoundResponse('Job not found');
    }

    const job: Job = typeof jobData === 'string' ? JSON.parse(jobData) : jobData;

    // Delete associated blob files if job is completed
    if (job.results) {
      const urls: string[] = [];
      if (job.results.original?.url) urls.push(job.results.original.url);
      for (const c of job.results.compressed ?? []) {
        if (c.url) urls.push(c.url);
      }
      for (const t of job.results.thumbnails ?? []) {
        if (t.url) urls.push(t.url);
      }
      if (urls.length > 0) {
        await storage.deleteMultiple(urls);
      }
    }

    // Remove from KV
    await kv.del(`job:${jobId}`);
    if (job.priority) {
      await kv.lrem(`queue:${job.priority}`, 0, jobId);
    }

    return successResponse({
      jobId,
      message: 'Job and associated files deleted',
    });
  } catch (error) {
    console.error('Job delete error:', error);
    return errorResponse(error instanceof Error ? error.message : 'Failed to delete job', 500);
  }
};

export default withAuth(handler);
