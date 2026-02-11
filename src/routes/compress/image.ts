import { Hono } from 'hono';
import type { ApiResponse, CompressionJobResponse, ImageCompressionOptions } from '../../types/index.js';
import type { AuthEnv } from '../../middleware/auth.js';
import {
  parseNativeFormData,
  getMediaType,
  getFileExtension,
  safeJsonParse,
  validateNumberArray,
} from '../../lib/utils.js';
import { queue } from '../../lib/queue.js';

const app = new Hono<AuthEnv>();

app.post('/', async (c) => {
  const apiKey = c.get('apiKey') ?? '';

  try {
    const formData = await parseNativeFormData(c.req.raw);
    const file = formData.file;

    if (!file) {
      return c.json<ApiResponse>({ success: false, error: 'No file provided' }, 400);
    }

    const buffer = file.buffer;
    const mediaType = getMediaType(file.type);

    if (mediaType !== 'image') {
      return c.json<ApiResponse>({ success: false, error: 'Invalid file type. Expected an image.' }, 400);
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
      return c.json<ApiResponse>({ success: false, error: 'Failed to queue job' }, 500);
    }

    const response: CompressionJobResponse = {
      jobId: jobResult.jobId!,
      status: 'queued',
      estimatedTime: jobResult.estimatedTime!,
      message: 'Image compression job queued successfully',
    };

    return c.json({ success: true, ...response }, 202);
  } catch (error) {
    console.error('Image compression error:', error);
    return c.json<ApiResponse>(
      { success: false, error: error instanceof Error ? error.message : 'Failed to compress image' },
      500
    );
  }
});

export default app;
