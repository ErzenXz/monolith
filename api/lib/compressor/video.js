import ffmpeg from 'fluent-ffmpeg'
import { promisify } from 'util'
import { config } from '../config.js'

const exec = promisify(require('child_process').exec)

export class VideoCompressor {
  constructor() {
    this.tempDir = '/tmp'
  }

  async compress(buffer, options = {}) {
    const {
      qualities = config.compression.video.qualities,
      thumbnails = config.compression.video.thumbnails,
      format = config.compression.video.defaultFormat,
      codec = config.compression.video.codec,
      audioCodec = config.compression.video.audioCodec,
      crf = config.compression.video.crf,
      preset = config.compression.video.preset
    } = options

    const tempPath = `${this.tempDir}/${Date.now()}-input.${format}`
    await this.writeFile(tempPath, buffer)

    const results = []
    const metadata = await this.getMetadata(tempPath)

    for (const quality of qualities) {
      const outputPath = `${this.tempPath}-${quality}.mp4`

      const width = this.calculateWidth(metadata.width, quality)
      const height = this.calculateHeight(metadata.height, quality)

      await this.compressVideo(tempPath, outputPath, {
        width,
        height,
        codec,
        audioCodec,
        crf,
        preset,
        format
      })

      const compressedBuffer = await this.readFile(outputPath)
      await this.cleanup(outputPath)

      results.push({
        quality: `${quality}p`,
        buffer: compressedBuffer,
        size: compressedBuffer.length,
        format: 'mp4',
        dimensions: { width, height },
        metadata: {
          originalSize: buffer.length,
          duration: metadata.duration,
          bitrate: metadata.bitrate
        }
      })
    }

    const thumbnailResults = await this.generateThumbnails(tempPath, thumbnails)
    await this.cleanup(tempPath)

    return {
      success: true,
      originals: {
        width: metadata.width,
        height: metadata.height,
        duration: metadata.duration,
        format: metadata.format,
        size: buffer.length,
        bitrate: metadata.bitrate
      },
      compressed: results,
      thumbnails: thumbnailResults
    }
  }

  async compressVideo(input, output, options) {
    return new Promise((resolve, reject) => {
      ffmpeg(input)
        .videoCodec(options.codec)
        .audioCodec(options.audioCodec)
        .size(`${options.width}x${options.height}`)
        .outputOptions([
          '-crf', options.crf.toString(),
          '-preset', options.preset,
          '-movflags', 'faststart'
        ])
        .output(output)
        .on('end', resolve)
        .on('error', reject)
        .run()
    })
  }

  async generateThumbnails(inputPath, count) {
    const metadata = await this.getMetadata(inputPath)
    const thumbnails = []
    const interval = Math.floor(metadata.duration / (count + 1))

    for (let i = 1; i <= count; i++) {
      const timestamp = i * interval
      const outputPath = `${inputPath}-thumb-${i}.jpg`

      await this.extractThumbnail(inputPath, outputPath, timestamp)
      const buffer = await this.readFile(outputPath)

      thumbnails.push({
        timestamp: `${timestamp.toFixed(2)}s`,
        buffer,
        sizeBytes: buffer.length,
        format: 'jpg'
      })

      await this.cleanup(outputPath)
    }

    return thumbnails
  }

  async extractThumbnail(inputPath, outputPath, timestamp) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .seekInput(timestamp)
        .frames(1)
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run()
    })
  }

  async getMetadata(inputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) return reject(err)

        const videoStream = metadata.streams.find(s => s.codec_type === 'video')
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio')

        resolve({
          width: videoStream?.width || 0,
          height: videoStream?.height || 0,
          duration: metadata.format?.duration || 0,
          format: metadata.format?.format_name || 'unknown',
          bitrate: metadata.format?.bit_rate || 0,
          hasAudio: !!audioStream,
          videoCodec: videoStream?.codec_name || 'unknown',
          audioCodec: audioStream?.codec_name || 'unknown'
        })
      })
    })
  }

  calculateWidth(originalWidth, quality) {
    const maxWidths = {
      1080: 1920,
      720: 1280,
      480: 854,
      360: 640
    }
    return Math.min(originalWidth, maxWidths[quality] || 1280)
  }

  calculateHeight(originalHeight, quality) {
    const maxHeights = {
      1080: 1080,
      720: 720,
      480: 480,
      360: 360
    }
    return Math.min(originalHeight, maxHeights[quality] || 720)
  }

  writeFile(path, buffer) {
    return new Promise((resolve, reject) => {
      require('fs').writeFile(path, buffer, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  readFile(path) {
    return new Promise((resolve, reject) => {
      require('fs').readFile(path, (err, data) => {
        if (err) reject(err)
        else resolve(data)
      })
    })
  }

  cleanup(path) {
    return new Promise((resolve) => {
      require('fs').unlink(path, () => resolve())
    })
  }

  calculateCompressionRatio(originalSize, compressedSize) {
    const ratio = ((originalSize - compressedSize) / originalSize) * 100
    return ratio.toFixed(2)
  }
}

export const videoCompressor = new VideoCompressor()
