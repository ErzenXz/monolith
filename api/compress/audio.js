import { withAuth } from '../middleware/auth.js'
import { withRateLimit } from '../middleware/ratelimit.js'
import { storage } from '../lib/storage.js'
import { queue } from '../lib/queue.js'
import { compressor } from '../lib/compressor/index.js'
import { parseFormData, getMediaType, getFileExtension, successResponse, errorResponse } from '../lib/utils.js'

async function handler(request, apiKey) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const formData = await parseFormData(request)
    const file = formData.files.file

    if (!file) {
      return errorResponse('No file provided')
    }

    const buffer = require('fs').readFileSync(file.filepath)
    const mediaType = getMediaType(file.mimetype || file.type)

    if (mediaType !== 'audio') {
      return errorResponse('Invalid file type. Expected an audio file.')
    }

    const extension = getFileExtension(file.mimetype || file.type)
    const options = {
      bitrates: formData.fields.bitrates ? JSON.parse(formData.fields.bitrates) : undefined,
      formats: formData.fields.formats ? JSON.parse(formData.fields.formats) : undefined,
      sampleRates: formData.fields.sampleRates ? JSON.parse(formData.fields.sampleRates) : undefined,
      defaultFormat: formData.fields.format || 'mp3'
    }

    const jobResult = await queue.enqueue('audio', {
      file: {
        buffer: buffer.toString('base64'),
        name: file.originalFilename || file.name,
        type: file.mimetype || file.type,
        size: buffer.length
      },
      options,
      apiKey,
      extension
    })

    if (!jobResult.success) {
      return errorResponse('Failed to queue job')
    }

    return successResponse({
      jobId: jobResult.jobId,
      status: 'queued',
      estimatedTime: jobResult.estimatedTime,
      message: 'Audio compression job queued successfully'
    })

  } catch (error) {
    console.error('Audio compression error:', error)
    return errorResponse(error.message || 'Failed to compress audio', 500)
  }
}

async function processJob(jobId) {
  const jobData = await queue.getJobStatus(jobId)

  if (!jobData.success || jobData.job.status !== 'queued') {
    return
  }

  await queue.updateJobStatus(jobId, 'processing', 10)

  try {
    const job = await require('@vercel/kv').kv.get(`job:${jobId}`)
    const parsedJob = typeof job === 'string' ? JSON.parse(job) : job

    const fileBuffer = Buffer.from(parsedJob.payload.file.buffer, 'base64')
    const options = parsedJob.payload.options
    const extension = parsedJob.payload.extension

    await queue.updateJobStatus(jobId, 'processing', 30)

    const compressionResult = await compressor.compressMedia(fileBuffer, 'audio', options)

    if (!compressionResult.success) {
      throw new Error(compressionResult.error || 'Compression failed')
    }

    await queue.updateJobStatus(jobId, 'processing', 70)

    const uploadPromises = []

    const originalFilename = storage.generateFilename('original', extension)
    uploadPromises.push(
      storage.upload(fileBuffer, storage.generatePath('audio', jobId, originalFilename), {
        contentType: `audio/${extension}`
      })
    )

    for (const compressed of compressionResult.compressed) {
      const filename = storage.generateFilename(`compressed-${compressed.bitrate}`, compressed.format)
      uploadPromises.push(
        storage.upload(compressed.buffer, storage.generatePath('audio', jobId, filename), {
          contentType: `audio/${compressed.format}`
        })
      )
    }

    const uploadResults = await Promise.all(uploadPromises)

    await queue.updateJobStatus(jobId, 'processing', 90)

    const originalUpload = uploadResults[0]
    const compressedUploads = uploadResults.slice(1)

    const compressionRatio = ((fileBuffer.length - compressionResult.compressed[0].size) / fileBuffer.length * 100).toFixed(2)

    await queue.saveJobResult(jobId, {
      original: {
        url: originalUpload.url,
        size: fileBuffer.length,
        duration: compressionResult.originals.duration
      },
      compressed: compressionResult.compressed.map((c, i) => ({
        bitrate: c.bitrate,
        url: compressedUploads[i].url,
        size: c.size,
        format: c.format,
        sampleRate: c.sampleRate
      })),
      compressionRatio: `${compressionRatio}%`
    })

  } catch (error) {
    console.error('Audio job processing error:', error)
    await queue.failJob(jobId, error.message)
  }
}

export default withRateLimit(withAuth(handler))

export { processJob }
