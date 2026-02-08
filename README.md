# Media Compressor

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyour-username%2Fmedia-compressor&env=API_KEYS,UPSTASH_QSTASH_TOKEN,BLOB_READ_WRITE_TOKEN,KV_REST_API_URL,KV_REST_API_TOKEN&envDescription=Required%20environment%20variables%20for%20the%20Media%20Compression%20API&envLink=https%3A%2F%2Fgithub.com%2Fyour-username%2Fmedia-compressor%23environment-variables&project-name=media-compression-api&repository-name=media-compression-api)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)

A high-performance, production-ready media compression API built with TypeScript for Vercel. Compress images, videos, and audio files with parallel processing, multiple quality levels, automatic thumbnail generation, and a built-in web dashboard.

## Features

- **Image compression** — JPEG, PNG, WebP, AVIF, GIF with parallel multi-quality output via Sharp
- **Video compression** — MP4, WebM, MOV with resolution scaling and thumbnail extraction via FFmpeg
- **Audio compression** — MP3, AAC, Opus, WAV with bitrate control and normalization
- **Async job queue** — Upstash QStash for scalable background processing
- **Cloud storage** — Vercel Blob for compressed file hosting with public URLs
- **Web dashboard** — Built-in browser UI for uploading, monitoring, and downloading results
- **API key auth** — Header-based authentication with rate limiting (100 req/min via Vercel KV)
- **Webhook support** — HMAC-signed notifications on job completion
- **TypeScript strict mode** — Fully typed with zero `any` leaks
- **CORS enabled** — Browser-ready API with preflight support

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | Node.js 20+ on Vercel Serverless |
| Language | TypeScript 5.8+ (strict) |
| Image Processing | [Sharp](https://sharp.pixelplumbing.com/) |
| Video/Audio | [FFmpeg](https://ffmpeg.org/) via fluent-ffmpeg |
| Job Queue | [Upstash QStash](https://upstash.com/docs/qstash) |
| File Storage | [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) |
| Rate Limiting | [Vercel KV](https://vercel.com/docs/storage/vercel-kv) |
| Dashboard | Vanilla JS + Tailwind CSS (zero-build) |

---

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/your-username/media-compressor.git
cd media-compressor
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Fill in your credentials (see [Environment Variables](#environment-variables)).

### 3. Run Locally

```bash
pnpm dev
```

Open `http://localhost:3000` to access the web dashboard.

### 4. Deploy

```bash
vercel --prod
```

---

## Web Dashboard

The built-in dashboard at `/` provides:

- **Health monitoring** — Real-time service status checks
- **File upload** — Drag-and-drop with format auto-detection
- **Compression options** — Quality levels, output format, thumbnail config
- **Job tracking** — Live progress polling with status updates
- **Results viewer** — Download links and compression ratio stats

No build step required — it's a static HTML file served from `public/`.

**How to access:** Visit the root URL of your deployment (e.g. `https://your-app.vercel.app/`). The dashboard auto-detects the API base URL from the browser address bar.

---

## API Reference

### Authentication

All endpoints except `/api/health` require an API key:

```bash
curl -H "X-API-Key: YOUR_KEY" https://your-app.vercel.app/api/health
# or
curl -H "Authorization: Bearer YOUR_KEY" https://your-app.vercel.app/api/health
```

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | No | Service health & config |
| `POST` | `/api/compress/image` | Yes | Queue image compression |
| `POST` | `/api/compress/video` | Yes | Queue video compression |
| `POST` | `/api/compress/audio` | Yes | Queue audio compression |
| `GET` | `/api/jobs/status/{id}` | Yes | Get job status & results |
| `DELETE` | `/api/jobs/delete/{id}` | Yes | Delete job & associated files |
| `POST` | `/api/jobs/process` | Internal | QStash job processor |
| `POST` | `/api/jobs/webhook` | Optional | Webhook receiver |

### Image Compression

```bash
curl -X POST \
  -H "X-API-Key: YOUR_KEY" \
  -F "file=@photo.jpg" \
  -F 'qualities=[80, 60, 40]' \
  -F 'thumbnails=[200, 400]' \
  -F "format=webp" \
  https://your-app.vercel.app/api/compress/image
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `file` | File | required | Image file (JPEG/PNG/WebP/AVIF/GIF) |
| `qualities` | JSON `number[]` | `[90,75,60,45]` | Quality levels 1-100 |
| `thumbnails` | JSON `number[]` | `[100,300,500]` | Thumbnail widths in px |
| `format` | String | `webp` | Output: jpeg, png, webp, avif |
| `stripMetadata` | String | `true` | Remove EXIF data |

### Video Compression

```bash
curl -X POST \
  -H "X-API-Key: YOUR_KEY" \
  -F "file=@video.mp4" \
  -F 'qualities=[1080, 720, 480]' \
  -F "thumbnails=5" \
  -F "format=mp4" \
  https://your-app.vercel.app/api/compress/video
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `file` | File | required | Video file (MP4/WebM/MOV) |
| `qualities` | JSON `number[]` | `[1080,720,480,360]` | Resolution heights |
| `thumbnails` | Number | `3` | Thumbnail frame count |
| `format` | String | `mp4` | Output: mp4, webm, mov |

### Audio Compression

```bash
curl -X POST \
  -H "X-API-Key: YOUR_KEY" \
  -F "file=@audio.wav" \
  -F 'bitrates=[320, 192, 128]' \
  -F "format=mp3" \
  https://your-app.vercel.app/api/compress/audio
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `file` | File | required | Audio file (MP3/AAC/WAV/Opus) |
| `bitrates` | JSON `number[]` | `[320,192,128,64]` | Bitrates in kbps |
| `format` | String | `mp3` | Output: mp3, aac, opus, wav |

### Job Status

```bash
curl -H "X-API-Key: YOUR_KEY" \
  https://your-app.vercel.app/api/jobs/status/job_1705312800000_abc123
```

**Response (completed):**

```json
{
  "success": true,
  "jobId": "job_1705312800000_abc123",
  "status": "completed",
  "progress": 100,
  "results": {
    "original": { "url": "https://...", "size": 5242880 },
    "compressed": [
      { "quality": "80%", "url": "https://...", "size": 2621440 }
    ],
    "thumbnails": [
      { "size": "200px", "url": "https://...", "sizeBytes": 25000 }
    ],
    "compressionRatio": "50.00%"
  }
}
```

Job statuses: `queued` → `processing` → `completed` | `failed`

### Error Responses

```json
{ "success": false, "error": "Error message" }
```

| Code | Meaning |
|---|---|
| 400 | Bad request / invalid params |
| 401 | Invalid or missing API key |
| 404 | Job not found |
| 405 | Method not allowed |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `API_KEYS` | Yes | Comma-separated API keys |
| `UPSTASH_QSTASH_TOKEN` | Yes | QStash auth token |
| `BLOB_READ_WRITE_TOKEN` | Yes | Vercel Blob token |
| `KV_REST_API_URL` | Yes | Vercel KV REST URL |
| `KV_REST_API_TOKEN` | Yes | Vercel KV auth token |
| `MAX_FILE_SIZE` | No | Max bytes (default: 524288000 = 500MB) |
| `TIMEOUT` | No | Request timeout ms (default: 300000) |
| `WEBHOOK_SECRET` | No | HMAC secret for webhook signatures |

---

## Project Structure

```
media-compressor/
├── api/                     # Vercel serverless functions
│   ├── compress/
│   │   ├── image.ts         # POST /api/compress/image
│   │   ├── video.ts         # POST /api/compress/video
│   │   └── audio.ts         # POST /api/compress/audio
│   ├── jobs/
│   │   ├── status.ts        # GET /api/jobs/status/{id}
│   │   ├── process.ts       # QStash job processor
│   │   └── webhook.ts       # Webhook receiver
│   └── health.ts            # GET /api/health
├── lib/
│   ├── compressor/
│   │   ├── image.ts         # Sharp-based image compression
│   │   ├── video.ts         # FFmpeg video compression
│   │   ├── audio.ts         # FFmpeg audio compression
│   │   └── index.ts         # Unified compressor service
│   ├── queue.ts             # QStash queue management
│   ├── storage.ts           # Vercel Blob storage
│   └── utils.ts             # Parsing, responses, webhooks
├── middleware/
│   ├── auth.ts              # API key authentication
│   └── ratelimit.ts         # Vercel KV rate limiting
├── public/
│   └── index.html           # Web dashboard (Tailwind CSS)
├── types/
│   └── index.ts             # TypeScript type definitions
├── config.ts                # App configuration
├── client-example.ts        # TypeScript API client example
├── vercel.json              # Vercel deployment config
├── tsconfig.json            # TypeScript strict config
├── LICENSE                  # MIT License
└── CONTRIBUTING.md          # Contribution guidelines
```

---

## Architecture

```
Client (Dashboard / API)
    │
    ▼
┌─────────────────────────┐
│  Vercel Serverless Fn    │
│  (auth + rate limit)     │
│  POST /api/compress/*    │
└────────┬────────────────┘
         │ enqueue
         ▼
┌─────────────────────────┐     ┌─────────────────┐
│  Upstash QStash          │────▶│ Vercel KV        │
│  (job queue)             │     │ (job state)      │
└────────┬────────────────┘     └─────────────────┘
         │ invoke
         ▼
┌─────────────────────────┐
│  POST /api/jobs/process  │
│  (Sharp / FFmpeg)        │
└────────┬────────────────┘
         │ upload results
         ▼
┌─────────────────────────┐
│  Vercel Blob             │
│  (compressed files)      │
└─────────────────────────┘
```

---

## Performance Notes

- **Parallel image compression** — All quality levels and thumbnails are processed concurrently via `Promise.all`, not sequentially
- **Streaming uploads** — Native Web API `FormData` parsing (no intermediate disk writes for uploads)
- **Concurrent blob uploads** — All compressed variants uploaded in parallel
- **Memory budget** — 2048MB per function, supporting files up to 500MB
- **Function timeout** — 300s (requires Vercel Pro for >60s)

---

## Development

```bash
pnpm typecheck    # TypeScript strict check
pnpm lint         # ESLint
pnpm format       # Prettier
vercel dev        # Start local dev server (run directly, not via pnpm)
vercel            # Deploy to preview
vercel --prod     # Deploy to production
```

---

## AI / LLM Integration Guide

This section helps AI coding assistants (Copilot, Cursor, Claude, etc.) understand and work with this codebase effectively.

### Codebase Summary for AI

**What this project does:** A serverless media compression API deployed on Vercel. Users upload media files (images/video/audio) via multipart form POST requests. Files are queued for async processing via Upstash QStash, compressed using Sharp (images) or FFmpeg (video/audio), results stored in Vercel Blob, and job status tracked in Vercel KV.

**Key patterns:**
- All API endpoints are Vercel serverless functions in `api/` using Web API `Request`/`Response`
- File uploads parsed with native `request.formData()` (no formidable/multer)
- Authentication via `withAuth()` higher-order function wrapper
- Rate limiting via `withRateLimit()` higher-order function wrapper
- Endpoints compose as: `export default withRateLimit(withAuth(handler))`
- Job lifecycle: `queued` → `processing` (with progress %) → `completed`/`failed`
- All responses use `successResponse()` / `errorResponse()` helpers from `lib/utils.ts`
- CORS headers included on all API responses

### Type System

All types are in `types/index.ts`. Key types:
- `Job` — Full job record stored in KV
- `JobPayload` — File buffer (base64) + compression options
- `CompressionResult` — Union of Image/Video/Audio result types
- `RequestHandler` — `(request: Request, apiKey?: string) => Promise<Response>`

### Adding a New Compression Format

1. Add the format to the relevant type in `types/index.ts` (e.g., `ImageFormat`)
2. Add MIME mapping in `lib/utils.ts` (`MIME_TO_EXTENSION` and `EXTENSION_TO_CONTENT_TYPE`)
3. Update the compressor class in `lib/compressor/` to handle the new format
4. Update `config.ts` defaults if needed

### Adding a New Endpoint

1. Create a new file in `api/` following the Vercel file-based routing convention
2. Use `withAuth` and `withRateLimit` wrappers for protected endpoints
3. Handle `OPTIONS` method with `corsResponse()` for browser access
4. Parse input with `parseNativeFormData()` for file uploads or `request.json()` for JSON
5. Validate user JSON fields with `safeJsonParse()` + `validateNumberArray()`
6. Return responses using `successResponse()` / `errorResponse()`

### Common Modifications

- **Change default quality levels:** Edit `config.ts` → `compression.image.qualities`
- **Change rate limits:** Edit `config.ts` → `rateLimit.maxRequests`
- **Change max file size:** Set `MAX_FILE_SIZE` env var or edit `config.ts`
- **Add new API key:** Append to `API_KEYS` env var (comma-separated)

---

## AI / LLM Documentation Files

- **`.cursorrules`** — AI coding context for Cursor, Windsurf, and similar editors
- **`llms.txt`** — Structured project summary following the [llms.txt](https://llmstxt.org/) convention

---

## License

[MIT](LICENSE) — use it for anything.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
