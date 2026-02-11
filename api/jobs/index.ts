import { withAuth } from '../../middleware/auth.js';
import { queue } from '../../lib/queue.js';
import { successResponse, errorResponse, corsResponse } from '../../lib/utils.js';
import type { RequestHandler } from '../../types/index.js';

const handler: RequestHandler = async request => {
  if (request.method === 'OPTIONS') return corsResponse();
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

    const result = await queue.listJobs(limit, offset);

    return successResponse({
      success: true,
      jobs: result.jobs,
      total: result.total,
      limit,
      offset
    });
  } catch (error) {
    console.error('List jobs error:', error);
    return errorResponse(error instanceof Error ? error.message : 'Failed to list jobs', 500);
  }
};

export default withAuth(handler);
