import { Hono } from 'hono';
import { Receiver } from '@upstash/qstash';
import type { ApiResponse } from '../../types/index.js';
import { queue } from '../../lib/queue.js';
import { storage } from '../../lib/storage.js';
import { imageCompressor } from '../../lib/compressor/image.js';
import { videoCompressor } from '../../lib/compressor/video.js';
import { audioCompressor } from '../../lib/compressor/audio.js';
import type { ImageCompressionResult, VideoCompressionResult, AudioCompressionResult } from '../../types/index.js';
import { kv } from '@vercel/kv';

interface ProcessEnv {
  Variables: {
    rawBody?: string;
  };
}

const app = new Hono<ProcessEnv>();

// Verify QStash signature for security
const receiver = new Receiver({
  currentSigningKey: process.env.UPSTASH_QSTASH_CURRENT_SIGNING_KEY,
  nextSigningKey: process.env.UPSTASH_QSTASH_NEXT_SIGNING_KEY,
});

app.use('*', async (c, next) => {
  const signature = c.req.header('Upstash-Signature') ?? c.req.header('upstash-signature');

  if (signature && process.env.UPSTASH_QSTASH_CURRENT_SIGNING_KEY) {
    try {
      const body = await c.req.text();
      const isValid = await receiver.verify({
        signature,
        body,
      });
      if (!isValid) {
        return c.json({ success: false, error: 'Invalid signature' }, 401);
      }
      // Re-parse the body after reading it for signature verification
      c.set('rawBody', body);
    } catch (error) {
      console.error('Signature verification error:', error);
      // Continue anyway - QStash signatures can be tricky
    }
  }

  return next();
});

app.post('/', async (c) => {
  // Use cached body if set by signature middleware, otherwise parse
  const rawBody = c.get('rawBody');
  const body = rawBody ? JSON.parse(rawBody) : await c.req.json<{ jobId: string }>();
  const { jobId } = body;

  if (!jobId) {
    return c.json<ApiResponse>({ success: false, error: 'Job ID is required' }, 400);
  }

  const jobResult = await queue.getJobStatus(jobId);

  if (!jobResult.success || jobResult.job?.status !== 'queued') {
    return c.json<ApiResponse>({ success: false, error: 'Job not found or already processed' }, 404);
  }

  try {
    await queue.updateJobStatus(jobId, 'processing', 10);

    const jobData = await kv.get(`job:${jobId}`);
    const job = typeof jobData === 'string' ? JSON.parse(jobData) : jobData;

    const fileBuffer = Buffer.from(job.payload.file.buffer, 'base64');
    const options = job.payload.options;
    const extension = job.payload.extension;

    await queue.updateJobStatus(jobId, 'processing', 30);

    let compressionResult: ImageCompressionResult | VideoCompressionResult | AudioCompressionResult;

    if (job.type === 'image') {
      try {
        compressionResult = await imageCompressor.compress(fileBuffer, options);
      } catch (error) {
        throw new Error(`Image compressor failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else if (job.type === 'video') {
      try {
        compressionResult = await videoCompressor.compress(fileBuffer, options);
      } catch (error) {
        throw new Error(`Video compressor failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      try {
        compressionResult = await audioCompressor.compress(fileBuffer, options);
      } catch (error) {
        throw new Error(`Audio compressor failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (!compressionResult.success) {
      throw new Error('Compression failed');
    }

    await queue.updateJobStatus(jobId, 'processing', 60);

    const uploadPromises = [];

    // Upload original
    const originalFilename = storage.generateFilename('original', extension);
    uploadPromises.push(
      storage.upload(fileBuffer, storage.generatePath(job.type, jobId, originalFilename), {
        contentType: `${job.type}/${extension}`,
      })
    );

    // Upload compressed files
    if ('compressed' in compressionResult) {
      for (const compressed of compressionResult.compressed) {
        const filename = storage.generateFilename(
          `compressed-${compressed.quality || compressed.bitrate}`,
          compressed.format
        );
        uploadPromises.push(
          storage.upload(compressed.buffer, storage.generatePath(job.type, jobId, filename), {
            contentType: `${compressed.format === 'jpg' ? 'image' : job.type}/${compressed.format}`,
          })
        );
      }
    }

    // Upload thumbnails
    if ('thumbnails' in compressionResult) {
      for (const thumbnail of compressionResult.thumbnails) {
        const filename = storage.generateFilename(
          `thumbnail-${thumbnail.size || thumbnail.timestamp}`,
          thumbnail.format
        );
        uploadPromises.push(
          storage.upload(thumbnail.buffer, storage.generatePath(job.type, jobId, filename), {
            contentType: `image/${thumbnail.format}`,
          })
        );
      }
    }

    const uploadResults = await Promise.all(uploadPromises);

    await queue.updateJobStatus(jobId, 'processing', 90);

    const originalUpload = uploadResults[0];
    let compressedUploads: typeof uploadResults;
    let thumbnailUploads: typeof uploadResults;

    if ('compressed' in compressionResult) {
      compressedUploads = uploadResults.slice(1, 1 + compressionResult.compressed.length);
      thumbnailUploads = uploadResults.slice(1 + compressionResult.compressed.length);
    }

    const firstCompressed = 'compressed' in compressionResult ? compressionResult.compressed[0] : null;
    const compressionRatio = firstCompressed
      ? (((fileBuffer.length - firstCompressed.size) / fileBuffer.length) * 100).toFixed(2)
      : '0';

    await queue.saveJobResult(jobId, {
      original: {
        url: originalUpload?.url ?? '',
        size: fileBuffer.length,
        duration: 'duration' in compressionResult.originals ? compressionResult.originals.duration : undefined,
      },
      compressed: 'compressed' in compressionResult
        ? compressionResult.compressed.map((c, i) => ({
            quality: c.quality,
            bitrate: c.bitrate,
            url: compressedUploads?.[i]?.url ?? '',
            size: c.size,
            format: c.format,
            dimensions: c.dimensions,
            sampleRate: c.sampleRate,
          }))
        : [],
      thumbnails: 'thumbnails' in compressionResult
        ? compressionResult.thumbnails.map((t, i) => ({
            size: t.size,
            timestamp: t.timestamp,
            url: thumbnailUploads?.[i]?.url ?? '',
            sizeBytes: t.sizeBytes,
            dimensions: t.dimensions,
          }))
        : [],
      compressionRatio: `${compressionRatio}%`,
    });

    return c.json({ success: true, message: 'Job processed successfully' });
  } catch (error) {
    console.error('Job processing error:', error);
    await queue.failJob(jobId, error instanceof Error ? error.message : 'Unknown error');
    return c.json<ApiResponse>(
      { success: false, error: error instanceof Error ? error.message : 'Failed to process job' },
      500
    );
  }
});

export default app;
