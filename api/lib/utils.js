import formidable from 'formidable'
import { config } from '../config.js'

export async function parseFormData(request) {
  const form = formidable({
    maxFileSize: config.maxFileSize,
    maxTotalFileSize: config.maxFileSize,
    keepExtensions: true,
    allowEmptyFiles: false
  })

  return new Promise((resolve, reject) => {
    form.parse(request, (err, fields, files) => {
      if (err) {
        reject(err)
      } else {
        resolve({ fields, files })
      }
    })
  })
}

export function parseFileFromBuffer(buffer, filename, mimeType) {
  return {
    buffer,
    name: filename,
    type: mimeType,
    size: buffer.length
  }
}

export function getMediaType(mimeType) {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'unknown'
}

export function getFileExtension(mimeType) {
  const extensions = {
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
    'audio/x-wav': 'wav'
  }
  return extensions[mimeType] || 'bin'
}

export function getContentType(extension) {
  const contentTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
    'avif': 'image/avif',
    'gif': 'image/gif',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mov': 'video/quicktime',
    'mp3': 'audio/mpeg',
    'aac': 'audio/aac',
    'opus': 'audio/opus',
    'wav': 'audio/wav'
  }
  return contentTypes[extension.toLowerCase()] || 'application/octet-stream'
}

export function validateFileSize(size) {
  if (size > config.maxFileSize) {
    throw new Error(`File size exceeds maximum allowed size of ${config.maxFileSize / 1024 / 1024}MB`)
  }
  return true
}

export function formatSize(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

export function calculateCompressionRatio(originalSize, compressedSize) {
  if (originalSize === 0) return '0%'
  const ratio = ((originalSize - compressedSize) / originalSize) * 100
  return ratio.toFixed(2) + '%'
}

export function successResponse(data, status = 200) {
  return new Response(JSON.stringify({
    success: true,
    ...data
  }), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  })
}

export function errorResponse(message, status = 400) {
  return new Response(JSON.stringify({
    success: false,
    error: message
  }), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  })
}

export function fileNotFoundResponse(message = 'File not found') {
  return new Response(JSON.stringify({
    success: false,
    error: message
  }), {
    status: 404,
    headers: {
      'Content-Type': 'application/json'
    }
  })
}

export function unauthorizedResponse(message = 'Unauthorized') {
  return new Response(JSON.stringify({
    success: false,
    error: message
  }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json'
    }
  })
}

export function tooManyRequestsResponse(message = 'Too many requests') {
  return new Response(JSON.stringify({
    success: false,
    error: message
  }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json'
    }
  })
}

export function serverErrorResponse(message = 'Internal server error') {
  return new Response(JSON.stringify({
    success: false,
    error: message
  }), {
    status: 500,
    headers: {
      'Content-Type': 'application/json'
    }
  })
}

export async function handleWebhook(payload, signature, secret) {
  if (!signature) {
    throw new Error('Missing signature')
  }

  const crypto = require('crypto')
  const hmac = crypto.createHmac('sha256', secret)
  const digest = hmac.update(JSON.stringify(payload)).digest('hex')

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
    throw new Error('Invalid signature')
  }

  return true
}

export function generateWebhookSignature(payload, secret) {
  const crypto = require('crypto')
  const hmac = crypto.createHmac('sha256', secret)
  return hmac.update(JSON.stringify(payload)).digest('hex')
}

export async function sendWebhook(url, data, secret) {
  const signature = generateWebhookSignature(data, secret)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error(`Webhook failed: ${response.statusText}`)
  }

  return await response.json()
}
