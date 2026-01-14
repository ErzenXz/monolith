import { withAuth } from '../middleware/auth.js'
import { queue } from '../lib/queue.js'
import { successResponse, errorResponse, fileNotFoundResponse } from '../lib/utils.js'

async function handler(request, apiKey) {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const url = new URL(request.url)
    const jobId = url.pathname.split('/').pop()

    if (!jobId) {
      return errorResponse('Job ID is required')
    }

    const jobData = await queue.getJobStatus(jobId)

    if (!jobData.success) {
      return fileNotFoundResponse('Job not found')
    }

    const job = await require('@vercel/kv').kv.get(`job:${jobId}`)
    const parsedJob = typeof job === 'string' ? JSON.parse(job) : job

    return successResponse({
      jobId,
      status: jobData.job.status,
      type: jobData.job.type,
      createdAt: jobData.job.createdAt,
      completedAt: jobData.job.completedAt,
      progress: jobData.job.progress || 0,
      error: jobData.job.error,
      results: parsedJob.results || null
    })

  } catch (error) {
    console.error('Job status error:', error)
    return errorResponse(error.message || 'Failed to get job status', 500)
  }
}

export default withAuth(handler)
