import { Hono } from 'hono';
import type { ApiResponse } from '../../types/index.js';
import { queue } from '../../lib/queue.js';

const app = new Hono();

app.get('/', async (c) => {
  const limit = parseInt(c.req.query('limit') ?? '50', 10);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);

  const result = await queue.listJobs(limit, offset);

  return c.json({
    success: true,
    jobs: result.jobs,
    total: result.total,
    limit,
    offset,
  });
});

export default app;
