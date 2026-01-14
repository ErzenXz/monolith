import fs from 'fs'

const API_BASE_URL = 'https://your-domain.com'
const API_KEY = 'your_api_key'

async function compressImage(filePath, options = {}) {
  const formData = new FormData()
  formData.append('file', fs.createReadStream(filePath))

  if (options.qualities) {
    formData.append('qualities', JSON.stringify(options.qualities))
  }
  if (options.thumbnails) {
    formData.append('thumbnails', JSON.stringify(options.thumbnails))
  }
  if (options.format) {
    formData.append('format', options.format)
  }

  const response = await fetch(`${API_BASE_URL}/api/compress/image`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY
    },
    body: formData
  })

  return response.json()
}

async function compressVideo(filePath, options = {}) {
  const formData = new FormData()
  formData.append('file', fs.createReadStream(filePath))

  if (options.qualities) {
    formData.append('qualities', JSON.stringify(options.qualities))
  }
  if (options.thumbnails) {
    formData.append('thumbnails', options.thumbnails)
  }
  if (options.format) {
    formData.append('format', options.format)
  }

  const response = await fetch(`${API_BASE_URL}/api/compress/video`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY
    },
    body: formData
  })

  return response.json()
}

async function compressAudio(filePath, options = {}) {
  const formData = new FormData()
  formData.append('file', fs.createReadStream(filePath))

  if (options.bitrates) {
    formData.append('bitrates', JSON.stringify(options.bitrates))
  }
  if (options.format) {
    formData.append('format', options.format)
  }

  const response = await fetch(`${API_BASE_URL}/api/compress/audio`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY
    },
    body: formData
  })

  return response.json()
}

async function getJobStatus(jobId) {
  const response = await fetch(`${API_BASE_URL}/api/jobs/status/${jobId}`, {
    method: 'GET',
    headers: {
      'X-API-Key': API_KEY
    }
  })

  return response.json()
}

async function waitForJobCompletion(jobId, pollInterval = 5000) {
  let status = await getJobStatus(jobId)

  while (status.success && status.status !== 'completed' && status.status !== 'failed') {
    console.log(`Job ${jobId}: ${status.status} (${status.progress}%)`)
    await new Promise(resolve => setTimeout(resolve, pollInterval))
    status = await getJobStatus(jobId)
  }

  return status
}

async function main() {
  try {
    console.log('Starting image compression...')
    const imageJob = await compressImage('./example-image.jpg', {
      qualities: [80, 60, 40],
      thumbnails: [200, 400],
      format: 'webp'
    })

    console.log('Image job queued:', imageJob.jobId)

    const imageResult = await waitForJobCompletion(imageJob.jobId)

    if (imageResult.success && imageResult.status === 'completed') {
      console.log('Image compression completed!')
      console.log('Results:', JSON.stringify(imageResult.results, null, 2))
    } else {
      console.error('Image compression failed:', imageResult.error)
    }

  } catch (error) {
    console.error('Error:', error)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export {
  compressImage,
  compressVideo,
  compressAudio,
  getJobStatus,
  waitForJobCompletion
}
