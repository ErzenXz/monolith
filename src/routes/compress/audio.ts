import { Hono } from 'hono';
import type { ApiResponse, CompressionJobResponse, AudioCompressionOptions } from '../../types/index.js';
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

    if (mediaType !== 'audio') {
      return c.json<ApiResponse>({ success: false, error: 'Invalid file type. Expected an audio file.' }, 400);
    }

    const extension = getFileExtension(file.type);

    const options: AudioCompressionOptions = {
      bitrates: formData.fields.bitrates
        ? validateNumberArray(safeJsonParse(formData.fields.bitrates, 'bitrates'), 'bitrates', 32, 320)
        : undefined,
      formats: formData.fields.formats
        ? (safeJsonParse(formData.fields.formats, 'formats') as AudioCompressionOptions['formats'])
        : undefined,
      sampleRates: formData.fields.sampleRates
        ? validateNumberArray(safeJsonParse(formData.fields.sampleRates, 'sampleRates'), 'sampleRates', 8000, 96000)
        : undefined,
      defaultFormat: (formData.fields.defaultFormat as AudioCompressionOptions['defaultFormat']) ?? 'mp3',
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
      return c.json<ApiResponse>({ success: false, error: 'Failed to queue job' }, 500);
    }

    const response: CompressionJobResponse = {
      jobId: jobResult.jobId!,
      status: 'queued',
      estimatedTime: jobResult.estimatedTime!,
      message: 'Audio compression job queued successfully',
    };

    return c.json({ success: true, ...response }, 202);
  } catch (error) {
    console.error('Audio compression error:', error);
    return c.json<ApiResponse>(
      { success: false, error: error instanceof Error ? error.message : 'Failed to compress audio' },
      500
    );
  }
});

export default app;
