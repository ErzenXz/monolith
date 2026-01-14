import sharp from 'sharp'
import { config } from '../config.js'

export class ImageCompressor {
  async compress(buffer, options = {}) {
    const {
      qualities = config.compression.image.qualities,
      thumbnails = config.compression.image.thumbnails,
      format = config.compression.image.defaultFormat,
      stripMetadata = config.compression.image.stripMetadata
    } = options

    const image = sharp(buffer)
    const metadata = await image.metadata()

    if (stripMetadata) {
      image.withoutMetadata()
    }

    const results = []

    for (const quality of qualities) {
      const compressed = await image
        .clone()
        .toFormat(format, { quality })
        .toBuffer()

      results.push({
        quality: `${quality}%`,
        buffer: compressed,
        size: compressed.length,
        format,
        metadata: {
          width: metadata.width,
          height: metadata.height,
          originalSize: buffer.length
        }
      })
    }

    if (thumbnails && thumbnails.length > 0) {
      const thumbnailResults = []

      for (const size of thumbnails) {
        const thumbnail = await image
          .clone()
          .resize(size, size, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .toFormat(format, { quality: 80 })
          .toBuffer()

        thumbnailResults.push({
          size: `${size}px`,
          buffer: thumbnail,
          sizeBytes: thumbnail.length,
          format,
          dimensions: {
            width: Math.min(metadata.width, size),
            height: Math.min(metadata.height, size)
          }
        })
      }

      results.push({
        type: 'thumbnails',
        items: thumbnailResults
      })
    }

    return {
      success: true,
      originals: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: buffer.length
      },
      compressed: results.filter(r => r.type !== 'thumbnails'),
      thumbnails: results.find(r => r.type === 'thumbnails')?.items || []
    }
  }

  async compressSingle(buffer, quality = 75, format = 'webp') {
    const compressed = await sharp(buffer)
      .withoutMetadata()
      .toFormat(format, { quality })
      .toBuffer()

    return {
      success: true,
      buffer: compressed,
      size: compressed.length,
      format,
      quality
    }
  }

  async generateThumbnail(buffer, size = 300) {
    const metadata = await sharp(buffer).metadata()

    const thumbnail = await sharp(buffer)
      .resize(size, size, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .toFormat('webp', { quality: 80 })
      .toBuffer()

    return {
      success: true,
      buffer: thumbnail,
      sizeBytes: thumbnail.length,
      dimensions: {
        width: Math.min(metadata.width, size),
        height: Math.min(metadata.height, size)
      },
      sizeLabel: `${size}px`
    }
  }

  async getMetadata(buffer) {
    const metadata = await sharp(buffer).metadata()

    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: buffer.length,
      hasAlpha: metadata.hasAlpha,
      density: metadata.density
    }
  }

  calculateCompressionRatio(originalSize, compressedSize) {
    const ratio = ((originalSize - compressedSize) / originalSize) * 100
    return ratio.toFixed(2)
  }
}

export const imageCompressor = new ImageCompressor()
