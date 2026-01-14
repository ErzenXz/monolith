import ffmpeg from 'fluent-ffmpeg'
import { config } from '../config.js'

export class AudioCompressor {
  constructor() {
    this.tempDir = '/tmp'
  }

  async compress(buffer, options = {}) {
    const {
      bitrates = config.compression.audio.bitrates,
      formats = config.compression.audio.formats,
      sampleRates = config.compression.audio.sampleRates,
      defaultFormat = config.compression.audio.defaultFormat
    } = options

    const tempPath = `${this.tempDir}/${Date.now()}-input.mp3`
    await this.writeFile(tempPath, buffer)

    const results = []
    const metadata = await this.getMetadata(tempPath)

    for (const bitrate of bitrates) {
      const outputPath = `${tempPath}-${bitrate}kbps.${defaultFormat}`

      await this.compressAudio(tempPath, outputPath, {
        bitrate: `${bitrate}k`,
        sampleRate: sampleRates[0],
        format: defaultFormat
      })

      const compressedBuffer = await this.readFile(outputPath)
      await this.cleanup(outputPath)

      results.push({
        bitrate: `${bitrate}kbps`,
        buffer: compressedBuffer,
        size: compressedBuffer.length,
        format: defaultFormat,
        sampleRate: sampleRates[0],
        metadata: {
          originalSize: buffer.length,
          duration: metadata.duration,
          originalBitrate: metadata.bitrate
        }
      })
    }

    await this.cleanup(tempPath)

    return {
      success: true,
      originals: {
        duration: metadata.duration,
        format: metadata.format,
        size: buffer.length,
        bitrate: metadata.bitrate,
        sampleRate: metadata.sampleRate,
        channels: metadata.channels
      },
      compressed: results
    }
  }

  async compressAudio(input, output, options) {
    return new Promise((resolve, reject) => {
      ffmpeg(input)
        .audioBitrate(options.bitrate)
        .audioFrequency(options.sampleRate)
        .toFormat(options.format)
        .outputOptions([
          '-q:a', '2'
        ])
        .output(output)
        .on('end', resolve)
        .on('error', reject)
        .run()
    })
  }

  async convertFormat(buffer, fromFormat, toFormat, options = {}) {
    const tempInput = `${this.tempDir}/${Date.now()}-input.${fromFormat}`
    const tempOutput = `${this.tempDir}/${Date.now()}-output.${toFormat}`

    await this.writeFile(tempInput, buffer)

    await new Promise((resolve, reject) => {
      const command = ffmpeg(tempInput)

      if (options.bitrate) {
        command.audioBitrate(options.bitrate)
      }

      if (options.sampleRate) {
        command.audioFrequency(options.sampleRate)
      }

      command
        .toFormat(toFormat)
        .output(tempOutput)
        .on('end', resolve)
        .on('error', reject)
        .run()
    })

    const outputBuffer = await this.readFile(tempOutput)

    await this.cleanup(tempInput)
    await this.cleanup(tempOutput)

    return {
      success: true,
      buffer: outputBuffer,
      format: toFormat,
      size: outputBuffer.length
    }
  }

  async getMetadata(inputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) return reject(err)

        const audioStream = metadata.streams.find(s => s.codec_type === 'audio')

        resolve({
          duration: metadata.format?.duration || 0,
          format: metadata.format?.format_name || 'unknown',
          bitrate: parseInt(metadata.format?.bit_rate || 0) / 1000,
          sampleRate: audioStream?.sample_rate || 44100,
          channels: audioStream?.channels || 2,
          codec: audioStream?.codec_name || 'unknown'
        })
      })
    })
  }

  async normalizeAudio(buffer) {
    const tempInput = `${this.tempDir}/${Date.now()}-input.mp3`
    const tempOutput = `${this.tempDir}/${Date.now()}-normalized.mp3`

    await this.writeFile(tempInput, buffer)

    await new Promise((resolve, reject) => {
      ffmpeg(tempInput)
        .audioFilters([
          {
            filter: 'loudnorm',
            options: {
              I: '-16',
              TP: '-1.5',
              LRA: '11'
            }
          }
        ])
        .output(tempOutput)
        .on('end', resolve)
        .on('error', reject)
        .run()
    })

    const outputBuffer = await this.readFile(tempOutput)

    await this.cleanup(tempInput)
    await this.cleanup(tempOutput)

    return {
      success: true,
      buffer: outputBuffer,
      size: outputBuffer.length
    }
  }

  async trimAudio(buffer, startTime, endTime) {
    const tempInput = `${this.tempDir}/${Date.now()}-input.mp3`
    const tempOutput = `${this.tempDir}/${Date.now()}-trimmed.mp3`
    const duration = endTime - startTime

    await this.writeFile(tempInput, buffer)

    await new Promise((resolve, reject) => {
      ffmpeg(tempInput)
        .setStartTime(startTime)
        .setDuration(duration)
        .output(tempOutput)
        .on('end', resolve)
        .on('error', reject)
        .run()
    })

    const outputBuffer = await this.readFile(tempOutput)

    await this.cleanup(tempInput)
    await this.cleanup(tempOutput)

    return {
      success: true,
      buffer: outputBuffer,
      size: outputBuffer.length,
      duration
    }
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

export const audioCompressor = new AudioCompressor()
