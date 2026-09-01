type OcrProgress = (percent: number, status: string) => void

const statusLabels: Record<string, string> = {
  'loading tesseract core': '正在启动本地识别引擎',
  'initializing tesseract': '正在初始化识别引擎',
  'loading language traineddata': '正在加载中文识别模型',
  'initializing api': '正在准备截图识别',
  'recognizing text': '正在读取截图文字',
}

const statusRanges: Record<string, [number, number]> = {
  'loading tesseract core': [2, 20],
  'initializing tesseract': [20, 30],
  'loading language traineddata': [30, 52],
  'initializing api': [52, 62],
  'recognizing text': [62, 98],
}

const loadImage = (file: File) => new Promise<HTMLImageElement>((resolve, reject) => {
  const url = URL.createObjectURL(file)
  const image = new Image()
  image.onload = () => {
    URL.revokeObjectURL(url)
    resolve(image)
  }
  image.onerror = () => {
    URL.revokeObjectURL(url)
    reject(new Error('无法读取这张图片，请重新选择截图。'))
  }
  image.src = url
})

const prepareImage = async (file: File) => {
  const image = await loadImage(file)
  const maxWidth = 1800
  const scale = Math.min(1, maxWidth / image.naturalWidth)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('当前浏览器无法处理截图。')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas
}

export async function recognizePaymentImage(file: File, onProgress: OcrProgress) {
  const [{ createWorker, OEM }, image] = await Promise.all([
    import('tesseract.js'),
    prepareImage(file),
  ])
  const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin)
  const ocrPath = new URL('ocr/', baseUrl).href
  const worker = await createWorker('chi_sim', OEM.LSTM_ONLY, {
    workerPath: `${ocrPath}worker.min.js`,
    corePath: `${ocrPath}core/`,
    langPath: ocrPath,
    logger: ({ status, progress }) => {
      const [start, end] = statusRanges[status] ?? [0, 98]
      onProgress(Math.round(start + (end - start) * progress), statusLabels[status] ?? '正在本地识别')
    },
  })

  try {
    const { data } = await worker.recognize(image, { rotateAuto: true })
    const text = data.text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    if (!text) throw new Error('没有从截图中读到文字，请换一张更清晰的截图。')
    onProgress(100, '截图文字识别完成')
    return text
  } finally {
    await worker.terminate()
  }
}
