import { Client } from '@upstash/qstash'
import { kv } from '@vercel/kv'
import { config } from '../config.js'

export class QueueService {
  constructor() {
    this.qstash = new Client({
      token: process.env.UPSTASH_QSTASH_TOKEN
    })
  }

  async enqueue(jobType, payload, options = {}) {
    const jobId = this.generateJobId()
    const priority = options.priority || 'medium'

    const job = {
      id: jobId,
      type: jobType,
      payload,
      status: 'queued',
      priority,
      createdAt: new Date().toISOString(),
      attempts: 0,
      maxAttempts: config.queue.retryAttempts
    }

    await kv.set(`job:${jobId}`, JSON.stringify(job))
    await kv.lpush(`queue:${priority}`, jobId)

    try {
      const { messageId } = await this.qstash.publishJSON({
        url: `${process.env.VERCEL_URL || 'http://localhost:3000'}/api/jobs/process`,
        body: { jobId }
      })

      await kv.set(`job:${jobId}`, JSON.stringify({
        ...job,
        qstashMessageId: messageId
      }))

      return {
        success: true,
        jobId,
        status: 'queued',
        estimatedTime: this.estimateTime(jobType)
      }
    } catch (error) {
      console.error('Enqueue error:', error)
      await kv.del(`job:${jobId}`)
      await kv.lrem(`queue:${priority}`, 0, jobId)

      return {
        success: false,
        error: error.message
      }
    }
  }

  async getJobStatus(jobId) {
    const jobData = await kv.get(`job:${jobId}`)
    
    if (!jobData) {
      return {
        success: false,
        error: 'Job not found'
      }
    }

    const job = typeof jobData === 'string' ? JSON.parse(jobData) : jobData

    return {
      success: true,
      job: {
        id: job.id,
        status: job.status,
        type: job.type,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        progress: job.progress || 0,
        error: job.error
      }
    }
  }

  async updateJobStatus(jobId, status, progress = null, error = null) {
    const jobData = await kv.get(`job:${jobId}`)
    
    if (!jobData) {
      return { success: false, error: 'Job not found' }
    }

    const job = typeof jobData === 'string' ? JSON.parse(jobData) : jobData
    const updatedJob = {
      ...job,
      status,
      progress: progress !== null ? progress : job.progress,
      error,
      ...(status === 'completed' || status === 'failed' ? { completedAt: new Date().toISOString() } : {})
    }

    await kv.set(`job:${jobId}`, JSON.stringify(updatedJob))

    if (status === 'completed' || status === 'failed') {
      await kv.lrem(`queue:${job.priority}`, 0, jobId)
    }

    return { success: true, job: updatedJob }
  }

  async saveJobResult(jobId, result) {
    const jobData = await kv.get(`job:${jobId}`)
    
    if (!jobData) {
      return { success: false, error: 'Job not found' }
    }

    const job = typeof jobData === 'string' ? JSON.parse(jobData) : jobData
    const updatedJob = {
      ...job,
      status: 'completed',
      progress: 100,
      error: null,
      completedAt: new Date().toISOString(),
      results: result
    }

    await kv.set(`job:${jobId}`, JSON.stringify(updatedJob))
    await kv.lrem(`queue:${job.priority}`, 0, jobId)

    return { success: true, job: updatedJob }
  }

  async failJob(jobId, error) {
    return this.updateJobStatus(jobId, 'failed', null, error)
  }

  generateJobId() {
    return `job_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
  }

  estimateTime(jobType) {
    const estimates = {
      image: '30-60 seconds',
      video: '2-5 minutes',
      audio: '1-2 minutes'
    }
    return estimates[jobType] || '1-3 minutes'
  }
}

export const queue = new QueueService()
