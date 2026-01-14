import { processJob as processImageJob } from '../compress/image.js'
import { processJob as processVideoJob } from '../compress/video.js'
import { processJob as processAudioJob } from '../compress/audio.js'
import { queue } from '../lib/queue.js'

async function handler(request) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const body = await request.json()
    const { jobId } = body

    if (!jobId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Job ID is required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      })
    }

    const jobData = await queue.getJobStatus(jobId)

    if (!jobData.success) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Job not found'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      })
    }

    const jobType = jobData.job.type

    switch (jobType) {
      case 'image':
        await processImageJob(jobId)
        break
      case 'video':
        await processVideoJob(jobId)
        break
      case 'audio':
        await processAudioJob(jobId)
        break
      default:
        return new Response(JSON.stringify({
          success: false,
          error: `Unknown job type: ${jobType}`
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        })
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Job processed successfully'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    })

  } catch (error) {
    console.error('Job processing error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
}

export default handler
