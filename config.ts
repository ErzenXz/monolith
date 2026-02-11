import type { AppConfig, JobStatus as JobStatusType } from './types/index.js';

// Parse env vars without helper calls to avoid static analysis issues
const maxFileSizeEnv = process.env.MAX_FILE_SIZE;
const maxFileSizeParsed = maxFileSizeEnv ? parseInt(maxFileSizeEnv, 10) : NaN;
const maxFileSize = Number.isNaN(maxFileSizeParsed) ? 524288000 : maxFileSizeParsed;

const timeoutEnv = process.env.TIMEOUT;
const timeoutParsed = timeoutEnv ? parseInt(timeoutEnv, 10) : NaN;
const timeout = Number.isNaN(timeoutParsed) ? 300000 : timeoutParsed;

const apiKeysEnv = process.env.API_KEYS;
const apiKeys = apiKeysEnv ? apiKeysEnv.split(',') : [];

export const config: AppConfig = {
  maxFileSize,
  timeout,
  apiKeys,
  webhookSecret: process.env.WEBHOOK_SECRET,

  compression: {
    image: {
      qualities: [90, 75, 60, 45],
      thumbnails: [100, 300, 500],
      formats: ['jpeg', 'png', 'webp', 'avif'],
      defaultFormat: 'webp',
      stripMetadata: true
    },

    video: {
      qualities: [1080, 720, 480, 360],
      thumbnails: 3,
      thumbnailInterval: 10,
      formats: ['mp4', 'webm', 'mov'],
      defaultFormat: 'mp4',
      codec: 'libx264',
      audioCodec: 'aac',
      crf: 23,
      preset: 'medium'
    },

    audio: {
      bitrates: [320, 192, 128, 64],
      formats: ['mp3', 'aac', 'opus', 'wav'],
      defaultFormat: 'mp3',
      sampleRates: [44100, 48000],
      defaultSampleRate: 44100
    }
  },

  rateLimit: {
    windowMs: 60000,
    maxRequests: 100
  },

  queue: {
    retryAttempts: 3,
    retryDelay: 5000,
    priorityLevels: ['high', 'medium', 'low']
  }
};

export const jobStatus: Record<string, JobStatusType> = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
} as const;

export type { AppConfig, JobStatusType };
