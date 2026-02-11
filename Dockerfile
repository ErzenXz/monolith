FROM node:20-alpine AS base

# Install FFmpeg for video/audio processing
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
NODE_ENV=production

EXPOSE 3001

CMD ["node", "dist/server.js"]
