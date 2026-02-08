import { kv } from '@vercel/kv';
import { withAuth } from '../../middleware/auth.js';
import { withRateLimit } from '../../middleware/ratelimit.js';
import { storage } from '../../lib/storage.js';
import { queue } from '../../lib/queue.js';
import {
  parseNativeFormData,
  getMediaType,
  getFileExtension,
  successResponse,
  errorResponse,
  corsResponse,
  safeJsonParse,
  validateNumberArray,
} from '../../lib/utils.js';
import type {
  Job,
  ImageCompressionOptions,
  ImageCompressionResult,
  RequestHandler,
} from '../../types/index.js';

const handler: RequestHandler = async (request, apiKey) => {
  if (request.method === 'OPTIONS') return corsResponse();
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const formData = await parseNativeFormData(request);
    const file = formData.file;

    if (!file) {
      return errorResponse('No file provided');
    }

    const buffer = file.buffer;
    const mediaType = getMediaType(file.type);

    if (mediaType !== 'image') {
      return errorResponse('Invalid file type. Expected an image.');
    }

    const extension = getFileExtension(file.type);

    const options: ImageCompressionOptions = {
      qualities: formData.fields.qualities
        ? validateNumberArray(safeJsonParse(formData.fields.qualities, 'qualities'), 'qualities', 1, 100)
        : undefined,
      thumbnails: formData.fields.thumbnails
        ? validateNumberArray(safeJsonParse(formData.fields.thumbnails, 'thumbnails'), 'thumbnails', 16, 4096)
        : undefined,
      format: (formData.fields.format as ImageCompressionOptions['format']) ?? 'webp',
      stripMetadata: formData.fields.stripMetadata !== 'false',
    };

    const jobResult = await queue.enqueue('image', {
      file: {
        buffer: buffer.toString('base64'),
        name: file.name,
        type: file.type,
        size: buffer.length,
      },
      options,
      apiKey: apiKey ?? '',
      extension,
    });

    if (!jobResult.success) {
      return errorResponse('Failed to queue job');
    }

    return successResponse({
      jobId: jobResult.jobId,
      status: 'queued',
      estimatedTime: jobResult.estimatedTime,
      message: 'Image compression job queued successfully',
    });
  } catch (error) {
    console.error('Image compression error:', error);
    return errorResponse(error instanceof Error ? error.message : 'Failed to compress image', 500);
  }
};

export async function processJob(jobId: string): Promise<void> {
  const jobData = await queue.getJobStatus(jobId);

  if (!jobData.success || jobData.job?.status !== 'queued') {
    return;
  }

  await queue.updateJobStatus(jobId, 'processing', 10);

  try {
    const job = await kv.get<string | Job>(`job:${jobId}`);
    const parsedJob: Job = typeof job === 'string' ? JSON.parse(job) : (job as Job);

    const fileBuffer = Buffer.from(parsedJob.payload.file.buffer, 'base64');
    const options = parsedJob.payload.options as ImageCompressionOptions;
    const extension = parsedJob.payload.extension;

    await queue.updateJobStatus(jobId, 'processing', 30);

    let compressionResult: ImageCompressionResult;
    try {
      const { imageCompressor } = await import('../../lib/compressor/image.js');
      compressionResult = (await imageCompressor.compress(
        fileBuffer,
        options
      )) as ImageCompressionResult;
    } catch (error) {
      throw new Error(`Image compressor failed to load: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (!compressionResult.success) {
      throw new Error('Compression failed');
    }

    await queue.updateJobStatus(jobId, 'processing', 60);

    const uploadPromises = [];

    const originalFilename = storage.generateFilename('original', extension);
    uploadPromises.push(
      storage.upload(fileBuffer, storage.generatePath('image', jobId, originalFilename), {
        contentType: `image/${extension}`,
      })
    );

    for (const compressed of compressionResult.compressed) {
      const filename = storage.generateFilename(
        `compressed-${compressed.quality}`,
        compressed.format
      );
      uploadPromises.push(
        storage.upload(compressed.buffer, storage.generatePath('image', jobId, filename), {
          contentType: `image/${compressed.format}`,
        })
      );
    }

    for (const thumbnail of compressionResult.thumbnails) {
      const filename = storage.generateFilename(`thumbnail-${thumbnail.size}`, thumbnail.format);
      uploadPromises.push(
        storage.upload(thumbnail.buffer, storage.generatePath('image', jobId, filename), {
          contentType: `image/${thumbnail.format}`,
        })
      );
    }

    const uploadResults = await Promise.all(uploadPromises);

    await queue.updateJobStatus(jobId, 'processing', 90);

    const originalUpload = uploadResults[0];
    const compressedUploads = uploadResults.slice(1, 1 + compressionResult.compressed.length);
    const thumbnailUploads = uploadResults.slice(1 + compressionResult.compressed.length);

    const firstCompressed = compressionResult.compressed[0];
    const compressionRatio = firstCompressed
      ? (((fileBuffer.length - firstCompressed.size) / fileBuffer.length) * 100).toFixed(2)
      : '0';

    await queue.saveJobResult(jobId, {
      original: {
        url: originalUpload?.url ?? '',
        size: fileBuffer.length,
      },
      compressed: compressionResult.compressed.map((c, i) => ({
        quality: c.quality,
        url: compressedUploads[i]?.url ?? '',
        size: c.size,
      })),
      thumbnails: compressionResult.thumbnails.map((t, i) => ({
        size: t.size,
        url: thumbnailUploads[i]?.url ?? '',
        sizeBytes: t.sizeBytes,
        dimensions: t.dimensions,
      })),
      compressionRatio: `${compressionRatio}%`,
    });
  } catch (error) {
    console.error('Image job processing error:', error);
    await queue.failJob(jobId, error instanceof Error ? error.message : 'Unknown error');
  }
}

export default withRateLimit(withAuth(handler));
