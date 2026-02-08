import { kv } from '@vercel/kv';
import { withAuth } from '../../middleware/auth.js';
import { withRateLimit } from '../../middleware/ratelimit.js';
import { storage } from '../../lib/storage.js';
import { queue } from '../../lib/queue.js';
import { compressor } from '../../lib/compressor/index.js';
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
  AudioCompressionOptions,
  AudioCompressionResult,
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

    if (mediaType !== 'audio') {
      return errorResponse('Invalid file type. Expected an audio file.');
    }

    const extension = getFileExtension(file.type);

    const options: AudioCompressionOptions = {
      bitrates: formData.fields.bitrates
        ? validateNumberArray(safeJsonParse(formData.fields.bitrates, 'bitrates'), 'bitrates', 8, 512)
        : undefined,
      formats: formData.fields.formats
        ? (safeJsonParse(formData.fields.formats, 'formats') as AudioCompressionOptions['formats'])
        : undefined,
      sampleRates: formData.fields.sampleRates
        ? validateNumberArray(safeJsonParse(formData.fields.sampleRates, 'sampleRates'), 'sampleRates', 8000, 192000)
        : undefined,
      defaultFormat:
        (formData.fields.format as AudioCompressionOptions['defaultFormat']) ?? 'mp3',
    };

    const jobResult = await queue.enqueue('audio', {
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
      message: 'Audio compression job queued successfully',
    });
  } catch (error) {
    console.error('Audio compression error:', error);
    return errorResponse(error instanceof Error ? error.message : 'Failed to compress audio', 500);
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
    const options = parsedJob.payload.options;
    const extension = parsedJob.payload.extension;

    await queue.updateJobStatus(jobId, 'processing', 30);

    const compressionResult = (await compressor.compressMedia(
      fileBuffer,
      'audio',
      options
    )) as AudioCompressionResult;

    if (!compressionResult.success) {
      throw new Error('Compression failed');
    }

    await queue.updateJobStatus(jobId, 'processing', 70);

    const uploadPromises = [];

    const originalFilename = storage.generateFilename('original', extension);
    uploadPromises.push(
      storage.upload(fileBuffer, storage.generatePath('audio', jobId, originalFilename), {
        contentType: `audio/${extension}`,
      })
    );

    for (const compressed of compressionResult.compressed) {
      const filename = storage.generateFilename(
        `compressed-${compressed.bitrate}`,
        compressed.format
      );
      uploadPromises.push(
        storage.upload(compressed.buffer, storage.generatePath('audio', jobId, filename), {
          contentType: `audio/${compressed.format}`,
        })
      );
    }

    const uploadResults = await Promise.all(uploadPromises);

    await queue.updateJobStatus(jobId, 'processing', 90);

    const originalUpload = uploadResults[0];
    const compressedUploads = uploadResults.slice(1);

    const firstCompressed = compressionResult.compressed[0];
    const compressionRatio = firstCompressed
      ? (((fileBuffer.length - firstCompressed.size) / fileBuffer.length) * 100).toFixed(2)
      : '0';

    await queue.saveJobResult(jobId, {
      original: {
        url: originalUpload?.url ?? '',
        size: fileBuffer.length,
        duration: compressionResult.originals.duration,
      },
      compressed: compressionResult.compressed.map((c, i) => ({
        bitrate: c.bitrate,
        url: compressedUploads[i]?.url ?? '',
        size: c.size,
        format: c.format,
        sampleRate: c.sampleRate,
      })),
      compressionRatio: `${compressionRatio}%`,
    });
  } catch (error) {
    console.error('Audio job processing error:', error);
    await queue.failJob(jobId, error instanceof Error ? error.message : 'Unknown error');
  }
}

export default withRateLimit(withAuth(handler));
