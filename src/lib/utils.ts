import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import type { ParsedFile, MediaType, ApiResponse } from '../types/index.js';

export interface NativeFormData {
  file: ParsedFile | null;
  fields: Record<string, string | undefined>;
}

export async function parseNativeFormData(request: Request): Promise<NativeFormData> {
  const formData = await request.formData();
  const fileEntry = formData.get('file');

  let file: ParsedFile | null = null;

  if (fileEntry && fileEntry instanceof Blob) {
    const arrayBuffer = await fileEntry.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const name =
      'name' in fileEntry && typeof fileEntry.name === 'string' ? fileEntry.name : 'file';
    const type =
      fileEntry.type || 'application/octet-stream';

    if (buffer.length > config.maxFileSize) {
      throw new Error(
        `File size exceeds maximum allowed size of ${config.maxFileSize / 1024 / 1024}MB`
      );
    }

    file = { buffer, name, type, size: buffer.length };
  }

  const fields: Record<string, string | undefined> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') {
      fields[key] = value;
    }
  }

  return { file, fields };
}

export function parseFileFromBuffer(
  buffer: Buffer,
  filename: string,
  mimeType: string
): ParsedFile {
  return {
    buffer,
    name: filename,
    type: mimeType,
    size: buffer.length,
  };
}

export function getMediaType(mimeType: string): MediaType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'unknown';
}

const MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/aac': 'aac',
  'audio/opus': 'opus',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
};

export function getFileExtension(mimeType: string): string {
  return MIME_TO_EXTENSION[mimeType] ?? 'bin';
}

const EXTENSION_TO_CONTENT_TYPE: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  aac: 'audio/aac',
  opus: 'audio/opus',
  wav: 'audio/wav',
};

export function getContentType(extension: string): string {
  return EXTENSION_TO_CONTENT_TYPE[extension.toLowerCase()] ?? 'application/octet-stream';
}

export function validateNumberArray(
  value: unknown,
  label: string,
  min: number,
  max: number
): number[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be a JSON array of numbers`);
  }
  for (const v of value) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) {
      throw new Error(`${label} values must be numbers between ${min} and ${max}`);
    }
  }
  if (value.length === 0) {
    throw new Error(`${label} must not be empty`);
  }
  if (value.length > 10) {
    throw new Error(`${label} must have at most 10 entries`);
  }
  return value as number[];
}

export function safeJsonParse(raw: string, label: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON for ${label}: ${raw}`);
  }
}

export function validateFileSize(size: number): boolean {
  if (size > config.maxFileSize) {
    throw new Error(
      `File size exceeds maximum allowed size of ${config.maxFileSize / 1024 / 1024}MB`
    );
  }
  return true;
}

export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}

export function calculateCompressionRatio(originalSize: number, compressedSize: number): string {
  if (originalSize === 0) return '0%';
  const ratio = ((originalSize - compressedSize) / originalSize) * 100;
  return `${ratio.toFixed(2)}%`;
}

export async function handleWebhook(
  payload: unknown,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature) {
    throw new Error('Missing signature');
  }

  const hmac = createHmac('sha256', secret);
  const digest = hmac.update(JSON.stringify(payload)).digest('hex');
  const sigBuf = Buffer.from(signature);
  const digestBuf = Buffer.from(digest);

  if (sigBuf.length !== digestBuf.length || !timingSafeEqual(sigBuf, digestBuf)) {
    throw new Error('Invalid signature');
  }

  return true;
}

export function generateWebhookSignature(payload: unknown, secret: string): string {
  const hmac = createHmac('sha256', secret);
  return hmac.update(JSON.stringify(payload)).digest('hex');
}

export async function sendWebhook(url: string, data: unknown, secret: string): Promise<unknown> {
  const signature = generateWebhookSignature(data, secret);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Webhook failed: ${response.statusText}`);
  }

  return response.json();
}
