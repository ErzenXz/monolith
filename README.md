# Media Compression API

A high-performance media compression API built for Vercel, supporting images, videos, and audio compression with multiple quality levels, thumbnail generation, and scalable processing queue.

## Features

- **Multi-format Support**: JPEG, PNG, WebP, AVIF, GIF, MP4, WebM, MOV, MP3, AAC, Opus, WAV
- **Multiple Quality Levels**: Generate compressed versions at different quality/bitrate settings
- **Thumbnail Generation**: Automatic thumbnail generation for images and videos
- **Async Processing**: Queue-based processing with Upstash QStash
- **Cloud Storage**: Vercel Blob storage for compressed files
- **Authentication**: API key-based authentication
- **Rate Limiting**: Built-in rate limiting with Vercel KV
- **Webhook Support**: Webhook notifications for job completion

## Tech Stack

- **Runtime**: Node.js 18+ on Vercel
- **Image Compression**: Sharp
- **Video/Audio Compression**: FFmpeg (fluent-ffmpeg)
- **Queue**: Upstash QStash
- **Storage**: Vercel Blob
- **Rate Limiting**: Vercel KV

## Setup

### 1. Environment Variables

Create a `.env.local` file:

```env
API_KEYS=your_api_key_here,another_api_key
UPSTASH_QSTASH_REST_URL=https://your-qstash-rest-url
UPSTASH_QSTASH_TOKEN=your-qstash-token
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token
KV_REST_API_URL=https://your-kv-rest-url
KV_REST_API_TOKEN=your-kv-token
MAX_FILE_SIZE=524288000
TIMEOUT=300000
WEBHOOK_SECRET=your-webhook-secret
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Deploy to Vercel

```bash
vercel deploy
```

## API Endpoints

### Authentication

All endpoints require an API key in the `X-API-Key` or `Authorization` header.

```bash
curl -X POST \
  -H "X-API-Key: your_api_key" \
  https://your-domain.com/api/compress/image \
  -F "file=@image.jpg"
```

### Image Compression

**Endpoint**: `POST /api/compress/image`

**Parameters**:
- `file` (required): Image file to compress
- `qualities` (optional): Array of quality levels (default: [90, 75, 60, 45])
- `thumbnails` (optional): Array of thumbnail sizes in pixels (default: [100, 300, 500])
- `format` (optional): Output format (default: 'webp')
- `stripMetadata` (optional): Strip metadata (default: true)

**Example**:
```bash
curl -X POST \
  -H "X-API-Key: your_api_key" \
  https://your-domain.com/api/compress/image \
  -F "file=@large-image.jpg" \
  -F "qualities=[80, 60, 40]" \
  -F "thumbnails=[200, 400]" \
  -F "format=webp"
```

**Response**:
```json
{
  "success": true,
  "jobId": "job_1234567890_abc123",
  "status": "queued",
  "estimatedTime": "30-60 seconds",
  "message": "Image compression job queued successfully"
}
```

### Video Compression

**Endpoint**: `POST /api/compress/video`

**Parameters**:
- `file` (required): Video file to compress
- `qualities` (optional): Array of quality levels (default: [1080, 720, 480, 360])
- `thumbnails` (optional): Number of thumbnails to generate (default: 3)
- `format` (optional): Output format (default: 'mp4')

**Example**:
```bash
curl -X POST \
  -H "X-API-Key: your_api_key" \
  https://your-domain.com/api/compress/video \
  -F "file=@large-video.mp4" \
  -F "qualities=[1080, 720, 480]" \
  -F "thumbnails=5" \
  -F "format=mp4"
```

**Response**:
```json
{
  "success": true,
  "jobId": "job_1234567890_abc123",
  "status": "queued",
  "estimatedTime": "2-5 minutes",
  "message": "Video compression job queued successfully"
}
```

### Audio Compression

**Endpoint**: `POST /api/compress/audio`

**Parameters**:
- `file` (required): Audio file to compress
- `bitrates` (optional): Array of bitrates in kbps (default: [320, 192, 128, 64])
- `formats` (optional): Array of formats (default: ['mp3', 'aac'])
- `format` (optional): Default output format (default: 'mp3')

**Example**:
```bash
curl -X POST \
  -H "X-API-Key: your_api_key" \
  https://your-domain.com/api/compress/audio \
  -F "file=@large-audio.wav" \
  -F "bitrates=[320, 192, 128]" \
  -F "format=mp3"
```

**Response**:
```json
{
  "success": true,
  "jobId": "job_1234567890_abc123",
  "status": "queued",
  "estimatedTime": "1-2 minutes",
  "message": "Audio compression job queued successfully"
}
```

### Job Status

**Endpoint**: `GET /api/jobs/status/{jobId}`

**Example**:
```bash
curl -H "X-API-Key: your_api_key" \
  https://your-domain.com/api/jobs/status/job_1234567890_abc123
```

**Response (Completed)**:
```json
{
  "success": true,
  "jobId": "job_1234567890_abc123",
  "status": "completed",
  "type": "image",
  "createdAt": "2024-01-09T10:00:00.000Z",
  "completedAt": "2024-01-09T10:00:45.000Z",
  "progress": 100,
  "results": {
    "original": {
      "url": "https://blob-url.com/.../original.jpg",
      "size": 5242880
    },
    "compressed": [
      {
        "quality": "90%",
        "url": "https://blob-url.com/.../compressed-90%.webp",
        "size": 2621440
      },
      {
        "quality": "75%",
        "url": "https://blob-url.com/.../compressed-75%.webp",
        "size": 1310720
      }
    ],
    "thumbnails": [
      {
        "size": "100px",
        "url": "https://blob-url.com/.../thumbnail-100px.webp",
        "sizeBytes": 50000,
        "dimensions": { "width": 100, "height": 100 }
      }
    ],
    "compressionRatio": "50.00%"
  }
}
```

### Webhook

**Endpoint**: `POST /api/jobs/webhook`

The API will send webhook notifications to your configured endpoint when jobs complete.

**Webhook Payload**:
```json
{
  "jobId": "job_1234567890_abc123",
  "status": "completed",
  "results": { ... }
}
```

### Health Check

**Endpoint**: `GET /api/health`

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-09T10:00:00.000Z",
  "version": "1.0.0",
  "services": {
    "queue": true,
    "storage": true,
    "rateLimit": true
  },
  "config": {
    "maxFileSize": "500MB",
    "timeout": "300s",
    "apiKeysConfigured": true
  }
}
```

## Configuration

Edit `config.js` to customize:

```javascript
export const config = {
  maxFileSize: 500 * 1024 * 1024, // 500MB
  timeout: 300000, // 5 minutes
  apiKeys: process.env.API_KEYS ? process.env.API_KEYS.split(',') : [],
  
  compression: {
    image: {
      qualities: [90, 75, 60, 45],
      thumbnails: [100, 300, 500],
      formats: ['jpeg', 'png', 'webp', 'avif'],
      defaultFormat: 'webp'
    },
    video: {
      qualities: [1080, 720, 480, 360],
      thumbnails: 3,
      formats: ['mp4', 'webm', 'mov'],
      defaultFormat: 'mp4'
    },
    audio: {
      bitrates: [320, 192, 128, 64],
      formats: ['mp3', 'aac', 'opus', 'wav'],
      defaultFormat: 'mp3'
    }
  },
  
  rateLimit: {
    windowMs: 60000,
    maxRequests: 100
  }
}
```

## Error Handling

All errors return a consistent format:

```json
{
  "success": false,
  "error": "Error message"
}
```

Common HTTP status codes:
- `400`: Bad Request (invalid parameters)
- `401`: Unauthorized (invalid API key)
- `404`: Not Found (job not found)
- `429`: Too Many Requests (rate limit exceeded)
- `500`: Internal Server Error

## Rate Limiting

Default rate limit: 100 requests per minute per API key.

Headers included in responses:
- `X-RateLimit-Limit`: Maximum requests
- `X-RateLimit-Remaining`: Remaining requests
- `Retry-After`: Seconds until reset (when rate limited)

## File Size Limits

- Maximum file size: 500MB (configurable)
- Timeout: 5 minutes (configurable)

## Development

```bash
npm run dev
```

Run with Vercel CLI for local development.

## Deployment

```bash
vercel --prod
```

## License

MIT
