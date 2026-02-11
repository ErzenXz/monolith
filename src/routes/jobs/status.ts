import { Hono } from 'hono';
import type { ApiResponse } from '../../types/index.js';
import { queue } from '../../lib/queue.js';

const app = new Hono();

app.get('/:id', async (c) => {
  const jobId = c.req.param('id');

  if (!jobId) {
    return c.json<ApiResponse>({ success: false, error: 'Job ID is required' }, 400);
  }

  const result = await queue.getJobStatus(jobId);

  if (!result.success) {
    return c.json<ApiResponse>({ success: false, error: result.error }, 404);
  }

  return c.json({ success: true, job: result.job });
});

export default app;
