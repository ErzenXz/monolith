import { Hono } from 'hono';
import type { ApiResponse, CompressionJobResponse, VideoCompressionOptions } from '../../types/index.js';
import {
  parseNativeFormData,
  getMediaType,
  getFileExtension,
  safeJsonParse,
  validateNumberArray,
} from '../../lib/utils.js';
import { queue } from '../../lib/queue.js';

const app = new Hono();

app.post('/', async (c) => {
  const apiKey = c.get('apiKey');

  try {
    const formData = await parseNativeFormData(c.req.raw);
    const file = formData.file;

    if (!file) {
      return c.json<ApiResponse>({ success: false, error: 'No file provided' }, 400);
    }

    const buffer = file.buffer;
    const mediaType = getMediaType(file.type);

    if (mediaType !== 'video') {
      return c.json<ApiResponse>({ success: false, error: 'Invalid file type. Expected a video.' }, 400);
    }

    const extension = getFileExtension(file.type);

    const options: VideoCompressionOptions = {
      qualities: formData.fields.qualities
        ? validateNumberArray(safeJsonParse(formData.fields.qualities, 'qualities'), 'qualities', 144, 2160)
        : undefined,
      thumbnails: formData.fields.thumbnails
        ? parseInt(safeJsonParse(formData.fields.thumbnails, 'thumbnails') as string, 10)
        : undefined,
      format: (formData.fields.format as VideoCompressionOptions['format']) ?? 'mp4',
      codec: formData.fields.codec as VideoCompressionOptions['codec'],
      audioCodec: formData.fields.audioCodec as VideoCompressionOptions['audioCodec'],
      crf: formData.fields.crf ? parseInt(formData.fields.crf, 10) : undefined,
      preset: formData.fields.preset as VideoCompressionOptions['preset'],
    };

    const jobResult = await queue.enqueue('video', {
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
      return c.json<ApiResponse>({ success: false, error: 'Failed to queue job' }, 500);
    }

    const response: CompressionJobResponse = {
      jobId: jobResult.jobId!,
      status: 'queued',
      estimatedTime: jobResult.estimatedTime!,
      message: 'Video compression job queued successfully',
    };

    return c.json({ success: true, ...response }, 202);
  } catch (error) {
    console.error('Video compression error:', error);
    return c.json<ApiResponse>(
      { success: false, error: error instanceof Error ? error.message : 'Failed to compress video' },
      500
    );
  }
});

export default app;
