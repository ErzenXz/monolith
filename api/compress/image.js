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

    if (mediaType !== 'image') {
      return errorResponse('Invalid file type. Expected an image.')
    }

    const extension = getFileExtension(file.mimetype || file.type)
    const options = {
      qualities: formData.fields.qualities ? JSON.parse(formData.fields.qualities) : undefined,
      thumbnails: formData.fields.thumbnails ? JSON.parse(formData.fields.thumbnails) : undefined,
      format: formData.fields.format || 'webp',
      stripMetadata: formData.fields.stripMetadata !== 'false'
    }

    const jobResult = await queue.enqueue('image', {
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
      message: 'Image compression job queued successfully'
    })

  } catch (error) {
    console.error('Image compression error:', error)
    return errorResponse(error.message || 'Failed to compress image', 500)
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

    const compressionResult = await compressor.compressMedia(fileBuffer, 'image', options)

    if (!compressionResult.success) {
      throw new Error(compressionResult.error || 'Compression failed')
    }

    await queue.updateJobStatus(jobId, 'processing', 60)

    const uploadPromises = []

    const originalFilename = storage.generateFilename('original', extension)
    uploadPromises.push(
      storage.upload(fileBuffer, storage.generatePath('image', jobId, originalFilename), {
        contentType: `image/${extension}`
      })
    )

    for (const compressed of compressionResult.compressed) {
      const filename = storage.generateFilename(`compressed-${compressed.quality}`, compressed.format)
      uploadPromises.push(
        storage.upload(compressed.buffer, storage.generatePath('image', jobId, filename), {
          contentType: `image/${compressed.format}`
        })
      )
    }

    for (const thumbnail of compressionResult.thumbnails) {
      const filename = storage.generateFilename(`thumbnail-${thumbnail.size}`, thumbnail.format)
      uploadPromises.push(
        storage.upload(thumbnail.buffer, storage.generatePath('image', jobId, filename), {
          contentType: `image/${thumbnail.format}`
        })
      )
    }

    const uploadResults = await Promise.all(uploadPromises)

    await queue.updateJobStatus(jobId, 'processing', 90)

    const originalUpload = uploadResults[0]
    const compressedUploads = uploadResults.slice(1, 1 + compressionResult.compressed.length)
    const thumbnailUploads = uploadResults.slice(1 + compressionResult.compressed.length)

    const compressionRatio = ((fileBuffer.length - compressionResult.compressed[0].size) / fileBuffer.length * 100).toFixed(2)

    await queue.saveJobResult(jobId, {
      original: {
        url: originalUpload.url,
        size: fileBuffer.length
      },
      compressed: compressionResult.compressed.map((c, i) => ({
        quality: c.quality,
        url: compressedUploads[i].url,
        size: c.size
      })),
      thumbnails: compressionResult.thumbnails.map((t, i) => ({
        size: t.size,
        url: thumbnailUploads[i].url,
        sizeBytes: t.sizeBytes,
        dimensions: t.dimensions
      })),
      compressionRatio: `${compressionRatio}%`
    })

  } catch (error) {
    console.error('Image job processing error:', error)
    await queue.failJob(jobId, error.message)
  }
}

export default withRateLimit(withAuth(handler))

export { processJob }
