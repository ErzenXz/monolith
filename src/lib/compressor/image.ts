import sharp from 'sharp';
import { config } from '../../config.js';
import type {
  ImageCompressionOptions,
  ImageCompressionResult,
  CompressedFile,
  Thumbnail,
  ImageMetadata,
  ImageFormat
} from '../../types/index.js';

export class ImageCompressor {
  async compress(
    buffer: Buffer,
    options: ImageCompressionOptions = {}
  ): Promise<ImageCompressionResult> {
    const {
      qualities = config.compression.image.qualities,
      thumbnails = config.compression.image.thumbnails,
      format = config.compression.image.defaultFormat,
      stripMetadata = config.compression.image.stripMetadata
    } = options;

    const metadata = await sharp(buffer).metadata();

    const [compressed, thumbnailResults] = await Promise.all([
      Promise.all(
        qualities.map(async (quality) => {
          const img = sharp(buffer);
          const processed = stripMetadata ? img.withMetadata({}) : img;
          const result = await processed
            .toFormat(format as keyof sharp.FormatEnum, { quality })
            .toBuffer();

          return {
            quality: `${quality}%`,
            buffer: result,
            size: result.length,
            format,
            metadata: {
              width: metadata.width ?? 0,
              height: metadata.height ?? 0,
              originalSize: buffer.length
            }
          } satisfies CompressedFile;
        })
      ),
      thumbnails && thumbnails.length > 0
        ? Promise.all(
            thumbnails.map(async (size) => {
              const img = sharp(buffer);
              const processed = stripMetadata ? img.withMetadata({}) : img;
              const result = await processed
                .resize(size, size, {
                  fit: 'inside',
                  withoutEnlargement: true
                })
                .toFormat(format as keyof sharp.FormatEnum, { quality: 80 })
                .toBuffer();

              return {
                size: `${size}px`,
                buffer: result,
                sizeBytes: result.length,
                format,
                dimensions: {
                  width: Math.min(metadata.width ?? size, size),
                  height: Math.min(metadata.height ?? size, size)
                }
              } satisfies Thumbnail;
            })
          )
        : Promise.resolve([] as Thumbnail[])
    ]);

    return {
      success: true,
      originals: {
        width: metadata.width ?? 0,
        height: metadata.height ?? 0,
        format: metadata.format ?? 'unknown',
        size: buffer.length
      },
      compressed,
      thumbnails: thumbnailResults
    };
  }

  async compressSingle(
    buffer: Buffer,
    quality = 75,
    format: ImageFormat = 'webp'
  ): Promise<{
    success: boolean;
    buffer: Buffer;
    size: number;
    format: ImageFormat;
    quality: number;
  }> {
    const compressed = await sharp(buffer)
      .withMetadata({})
      .toFormat(format as keyof sharp.FormatEnum, { quality })
      .toBuffer();

    return {
      success: true,
      buffer: compressed,
      size: compressed.length,
      format,
      quality
    };
  }

  async generateThumbnail(
    buffer: Buffer,
    size = 300
  ): Promise<{
    success: boolean;
    buffer: Buffer;
    sizeBytes: number;
    dimensions: { width: number; height: number };
    sizeLabel: string;
  }> {
    const metadata = await sharp(buffer).metadata();

    const thumbnail = await sharp(buffer)
      .resize(size, size, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .toFormat('webp', { quality: 80 })
      .toBuffer();

    return {
      success: true,
      buffer: thumbnail,
      sizeBytes: thumbnail.length,
      dimensions: {
        width: Math.min(metadata.width ?? size, size),
        height: Math.min(metadata.height ?? size, size)
      },
      sizeLabel: `${size}px`
    };
  }

  async getMetadata(buffer: Buffer): Promise<ImageMetadata> {
    const metadata = await sharp(buffer).metadata();

    return {
      width: metadata.width ?? 0,
      height: metadata.height ?? 0,
      format: metadata.format ?? 'unknown',
      size: buffer.length,
      hasAlpha: metadata.hasAlpha,
      density: metadata.density
    };
  }

  calculateCompressionRatio(originalSize: number, compressedSize: number): string {
    const ratio = ((originalSize - compressedSize) / originalSize) * 100;
    return ratio.toFixed(2);
  }
}

export const imageCompressor = new ImageCompressor();
