# Monolith - Media Compression API

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Hono](https://img.shields.io/badge/Hono-4.x-orange.svg)](https://hono.dev/)

> **Monolith** - A high-performance, production-ready media compression API built with **Hono**, **TypeScript**, and **Node.js**.

## ✨ Why Monolith?

- **🚀 No Cold Starts** - Traditional server, always warm and ready
- **🔓 Deploy Anywhere** - Railway, Render, Fly.io, AWS, VPS, your metal
- **💾 Vercel Services** - Still uses Blob, KV, and QStash (they're great!)
- **📈 Horizontal Scale** - Run multiple instances behind a load balancer
- **🔪 Full Control** - You control timeouts, memory, everything

## 🚀 Features

| Feature | Description |
|---|---|
| **Image Compression** | JPEG, PNG, WebP, AVIF, GIF via Sharp - parallel multi-quality output |
| **Video Compression** | MP4, WebM, MOV with FFmpeg - resolution scaling + thumbnails |
| **Audio Compression** | MP3, AAC, Opus, WAV with bitrate control & normalization |
| **Job Queue** | Upstash QStash for scalable background processing |
| **Cloud Storage** | Vercel Blob for compressed file hosting with public URLs |
| **Web Dashboard** | Built-in browser UI for uploading, monitoring, downloads |
| **API Key Auth** | Header-based authentication |
| **Rate Limiting** | 100 req/min via Vercel KV |
| **Webhooks** | HMAC-signed notifications on job completion |
| **CORS Enabled** | Browser-ready with preflight support |
| **Graceful Shutdown** | Handles SIGTERM/SIGINT for zero-downtime deployments |

## 🛠 Tech Stack

| Component | Technology |
|---|---|
| **Runtime** | Node.js 20+ (traditional server) |
| **Framework** | [Hono](https://hono.dev/) - Ultra-fast, 13x faster than Express |
| **Language** | TypeScript 5.9+ (strict mode) |
| **Image Processing** | [Sharp](https://sharp.pixelplumbing.com/) |
| **Video/Audio** | [FFmpeg](https://ffmpeg.org/) via fluent-ffmpeg |
| **Job Queue** | [Upstash QStash](https://upstash.com/docs/qstash) |
| **File Storage** | [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) |
| **Rate Limiting** | [Vercel KV](https://vercel.com/docs/storage/vercel-kv) |

---

## 🏃 Quick Start

### Prerequisites

- Node.js 20+
- FFmpeg installed system-wide
- Vercel account (for Blob, KV, QStash)

### 1. Clone & Install

```bash
git clone https://github.com/ErzenXz/monolith.git
cd monolith
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

**Required Environment Variables:**

```bash
# Your deployed URL (so QStash knows where to call back)
BASE_URL=https://your-domain.com

# API Keys (comma-separated)
API_KEYS=your-api-key-1,your-api-key-2

# Vercel Services
UPSTASH_QSTASH_TOKEN=your-qstash-token
BLOB_READ_WRITE_TOKEN=your-blob-token
KV_REST_API_URL=https://your-kv-url
KV_REST_API_TOKEN=your-kv-token
```

### 3. Run Locally

```bash
pnpm dev
```

Server runs on `http://localhost:3001`

### 4. Deploy

Deploy to **any** Node.js hosting:

```bash
pnpm build
# Deploy dist/ to your server
```

**Deployment Options:**
- **Railway**: `railway up` (auto-detects from package.json)
- **Render**: Connect GitHub repo, auto-deploy on push
- **Fly.io**: `fly launch`
- **DigitalOcean App Platform**: Connect GitHub repo
- **AWS ECS/Fargate**: Docker deployment
- **VPS with PM2**: `pm2 start dist/server.js -i max`

---

## 🏗 Architecture

```
                           ┌───────────────────────────────────┐
                           │   Load Balancer (Optional)     │
                           └───────────────┬───────────────────┘
                                          │
                     ┌────────────────────┴────────────────────┐
                     │                                     │
         ┌─────────▼─────────┐                   ┌─────────▼─────────┐
         │  Hono Instance 1  │                   │  Hono Instance 2  │  ← Horizontal Scaling
         │  Port 3001        │                   │  Port 3001        │
         └─────────┬──────────┘                   └─────────┬──────────┘
                     │                                     │
                     │    Same API, Same State (KV)          │
                     │                                     │
┌────────────────────▼──────────────────────────────────────────────▼────────────┐
│                      Hono Server (Node.js)                            │
│  - No cold starts, always warm                                      │
│  - Long-running process                                              │
│  - Graceful shutdown support                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  POST /api/compress/* → Enqueue job via QStash                │
│  POST /api/jobs/process ← QStash webhook callback (HTTP)        │
└───────────────────────┬─────────────────────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                             │
  ┌─────▼────────┐          ┌─────────▼─────────┐
  │  Upstash QStash│          │   Vercel KV        │
  │  (job queue)   │          │  (job state)       │
  └─────────────────┘          └─────────────────────┘
                      │
                      ▼
        ┌─────────────────────┐
        │   Vercel Blob      │
        │  (file storage)     │
        └─────────────────────┘
```

### Why This Architecture?

| ✅ | Benefit |
|---|---|
| 🚀 | **No Vercel lock-in** - Deploy to any hosting that supports Node.js |
| ⚡ | **No cold starts** - Traditional server is always warm and ready |
| 📈 | **Horizontal scaling** - Run multiple instances behind a load balancer |
| 💾 | **Great services** - Still use Vercel Blob, KV, and QStash (they're excellent!) |
| 🔧 | **Full control** - You control server, timeouts, memory, everything |
| 💰 | **Cost efficient** - Pay for your server, not per-invocation |

---

## 📡 API Reference

### Base URL

```
http://localhost:3001
# or your deployed URL:
https://your-domain.com
```

### Authentication

All endpoints except `/health` require an API key:

```bash
curl -H "X-API-Key: YOUR_KEY" http://localhost:3001/api/compress/image
# or with Bearer token
curl -H "Authorization: Bearer YOUR_KEY" http://localhost:3001/api/compress/image
```

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | No | Service health & config |
| `GET` | `/` | No | API info & endpoints |
| `POST` | `/api/compress/image` | Yes | Queue image compression job |
| `POST` | `/api/compress/video` | Yes | Queue video compression job |
| `POST` | `/api/compress/audio` | Yes | Queue audio compression job |
| `GET` | `/api/jobs/status/:id` | Yes | Get job status & results |
| `DELETE` | `/api/jobs/delete/:id` | Yes | Delete job & associated files |
| `GET` | `/api/jobs` | Yes | List all jobs (paginated) |
| `POST` | `/api/jobs/process` | Internal | QStash webhook (processes jobs) |
| `GET` | `/debug` | No | Debug info (dev only) |

### Image Compression

```bash
curl -X POST http://localhost:3001/api/compress/image \
  -H "X-API-Key: YOUR_KEY" \
  -F "file=@photo.jpg" \
  -F 'qualities=[80, 60, 40]' \
  -F 'thumbnails=[200, 400]' \
  -F "format=webp"
```

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `file` | File | required | Image file (JPEG/PNG/WebP/AVIF/GIF) |
| `qualities` | JSON array | `[90,75,60,45]` | Quality levels (1-100) |
| `thumbnails` | JSON array | `[100,300,500]` | Thumbnail sizes in pixels |
| `format` | String | `webp` | Output format: jpeg, png, webp, avif |
| `stripMetadata` | String | `true` | Remove EXIF data (true/false) |

**Response (202 Accepted):**

```json
{
  "success": true,
  "jobId": "job_1705312800000_abc123",
  "status": "queued",
  "estimatedTime": "30-60 seconds",
  "message": "Image compression job queued successfully"
}
```

### Video Compression

```bash
curl -X POST http://localhost:3001/api/compress/video \
  -H "X-API-Key: YOUR_KEY" \
  -F "file=@video.mp4" \
  -F 'qualities=[1080, 720, 480]' \
  -F "thumbnails=5" \
  -F "format=mp4"
```

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `file` | File | required | Video file (MP4/WebM/MOV) |
| `qualities` | JSON array | `[1080,720,480,360]` | Resolution heights |
| `thumbnails` | Number | `3` | Number of thumbnail frames |
| `format` | String | `mp4` | Output: mp4, webm, mov |

### Audio Compression

```bash
curl -X POST http://localhost:3001/api/compress/audio \
  -H "X-API-Key: YOUR_KEY" \
  -F "file=@audio.wav" \
  -F 'bitrates=[320, 192, 128]' \
  -F "format=mp3"
```

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `file` | File | required | Audio file (MP3/AAC/WAV/Opus) |
| `bitrates` | JSON array | `[320,192,128,64]` | Bitrates in kbps |
| `format` | String | `mp3` | Output: mp3, aac, opus, wav |

### Job Status

```bash
curl http://localhost:3001/api/jobs/status/job_1705312800000_abc123 \
  -H "X-API-Key: YOUR_KEY"
```

**Response (completed):**

```json
{
  "success": true,
  "job": {
    "id": "job_1705312800000_abc123",
    "status": "completed",
    "progress": 100,
    "type": "image",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "completedAt": "2024-01-15T10:30:45.123Z",
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
}
```

**Job Status Flow:** `queued` → `processing` → `completed` | `failed`

### List Jobs

```bash
curl "http://localhost:3001/api/jobs?limit=10&offset=0" \
  -H "X-API-Key: YOUR_KEY"
```

---

## ⚙️ Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default: 3001) |
| `NODE_ENV` | No | Environment: `development` or `production` |
| `BASE_URL` | Yes* | Your server URL for QStash callbacks |
| `API_KEYS` | Yes | Comma-separated API keys |
| `UPSTASH_QSTASH_TOKEN` | Yes | QStash auth token |
| `UPSTASH_QSTASH_CURRENT_SIGNING_KEY` | No | Current signing key for webhook verification |
| `UPSTASH_QSTASH_NEXT_SIGNING_KEY` | No | Next signing key for rotation |
| `BLOB_READ_WRITE_TOKEN` | Yes | Vercel Blob token |
| `KV_REST_API_URL` | Yes | Vercel KV REST URL |
| `KV_REST_API_TOKEN` | Yes | Vercel KV auth token |
| `KV_URL` | No | Alternative KV URL |
| `MAX_FILE_SIZE` | No | Max file size in bytes (default: 500MB) |
| `TIMEOUT` | No | Request timeout in ms (default: 300000) |
| `WEBHOOK_SECRET` | No | HMAC secret for webhook signatures |

\* Either `BASE_URL` or `VERCEL_URL` must be set for QStash callbacks.

---

## 📁 Project Structure

```
monolith/
├── src/                          # Server source code
│   ├── server.ts                 # 🚀 Hono server entry point
│   ├── config.ts                 # ⚙️ App configuration
│   ├── routes/                   # 🛣️ API routes
│   │   ├── health.ts            # Health check endpoint
│   │   ├── debug.ts             # Debug endpoint (dev only)
│   │   ├── compress/            # Compression endpoints
│   │   │   ├── image.ts
│   │   │   ├── video.ts
│   │   │   └── audio.ts
│   │   └── jobs/               # Job management
│   │       ├── index.ts
│   │       ├── status.ts
│   │       ├── delete.ts
│   │       ├── list.ts
│   │       └── process.ts      # QStash webhook handler
│   ├── lib/                     # 📚 Core libraries
│   │   ├── compressor/          # Compression logic
│   │   │   ├── image.ts       # Sharp-based
│   │   │   ├── video.ts       # FFmpeg-based
│   │   │   ├── audio.ts       # FFmpeg-based
│   │   │   └── index.ts
│   │   ├── queue.ts             # QStash queue service
│   │   ├── storage.ts           # Vercel Blob wrapper
│   │   └── utils.ts            # Helper functions
│   ├── middleware/              # 🛡️ Hono middleware
│   │   ├── auth.ts             # API key authentication
│   │   └── rate-limit.ts       # KV-based rate limiting
│   └── types/                  # 📐 TypeScript types
│       └── index.ts             # All type definitions
├── public/                       # 🌐 Static dashboard
│   └── index.html
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## 🐳 Deployment

### Docker

**Dockerfile:**

```dockerfile
FROM node:20-alpine AS base

# Install FFmpeg
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist
COPY --from=base /app/package.json ./package.json

ENV PORT=3001
EXPOSE 3001

CMD ["node", "dist/server.js"]
```

**Docker Compose:**

```yaml
services:
  monolith:
    build: .
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - NODE_ENV=production
      - BASE_URL=${BASE_URL}
      - API_KEYS=${API_KEYS}
      - UPSTASH_QSTASH_TOKEN=${UPSTASH_QSTASH_TOKEN}
      - BLOB_READ_WRITE_TOKEN=${BLOB_READ_WRITE_TOKEN}
      - KV_REST_API_URL=${KV_REST_API_URL}
      - KV_REST_API_TOKEN=${KV_REST_API_TOKEN}
    restart: unless-stopped
```

### PM2 (ecosystem.config.js)

```javascript
module.exports = {
  apps: [{
    name: 'monolith-api',
    script: './dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
  }]
}
```

---

## 💻 Development

```bash
# Install dependencies
pnpm install

# Run dev server with hot reload
pnpm dev

# Type checking
pnpm typecheck

# Linting
pnpm lint
pnpm lint:fix

# Build for production
pnpm build

# Clean build artifacts
pnpm clean
```

---

## ⚡ Performance Notes

- **Parallel processing** — All quality levels and thumbnails processed concurrently
- **Streaming uploads** — Native Web API FormData parsing (no disk writes)
- **Concurrent uploads** — All compressed variants uploaded in parallel
- **No cold starts** — Traditional server stays warm
- **Graceful shutdown** — Properly handles SIGTERM/SIGINT for zero-downtime deployments

---

## 📄 License

[MIT](LICENSE) — Use it for anything.

---

## 🔗 Repository

**GitHub:** https://github.com/ErzenXz/monolith
