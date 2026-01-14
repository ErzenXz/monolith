import { put, del } from '@vercel/blob'

export class StorageService {
  constructor() {
    this.enabled = process.env.BLOB_READ_WRITE_TOKEN ? true : false
  }

  async upload(file, filename, options = {}) {
    if (!this.enabled) {
      throw new Error('Blob storage not configured')
    }

    const buffer = Buffer.isBuffer(file) ? file : Buffer.from(await file.arrayBuffer())

    try {
      const blob = await put(filename, buffer, {
        access: 'public',
        contentType: options.contentType || 'application/octet-stream',
        addRandomSuffix: options.addRandomSuffix !== false
      })

      return {
        success: true,
        url: blob.url,
        size: buffer.length,
        contentType: blob.contentType
      }
    } catch (error) {
      console.error('Upload error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  async uploadMultiple(files, prefix = '') {
    const uploads = files.map((file, index) => {
      const filename = prefix ? `${prefix}/${file.name || `file-${index}`}` : file.name
      return this.upload(file.buffer || file, filename, {
        contentType: file.contentType
      })
    })

    const results = await Promise.all(uploads)
    
    return {
      success: results.every(r => r.success),
      files: results,
      successful: results.filter(r => r.success),
      failed: results.filter(r => !r.success)
    }
  }

  async delete(url) {
    if (!this.enabled) return { success: false, error: 'Blob storage not configured' }

    try {
      await del(url)
      return { success: true }
    } catch (error) {
      console.error('Delete error:', error)
      return { success: false, error: error.message }
    }
  }

  async deleteMultiple(urls) {
    const deletions = urls.map(url => this.delete(url))
    const results = await Promise.all(deletions)

    return {
      success: results.every(r => r.success),
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.failed).length
    }
  }

  generateFilename(prefix, extension, randomSuffix = true) {
    const timestamp = Date.now()
    const random = randomSuffix ? `-${Math.random().toString(36).substring(2, 15)}` : ''
    return `${prefix}-${timestamp}${random}.${extension}`
  }

  generatePath(type, jobId, filename) {
    return `${type}/${jobId}/${filename}`
  }
}

export const storage = new StorageService()
