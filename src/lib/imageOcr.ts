import type { Worker } from 'tesseract.js'

type OcrProgress = (percent: number, status: string) => void

let workerPromise: Promise<Worker> | null = null
let recognitionQueue: Promise<void> = Promise.resolve()
let activeProgress: OcrProgress | null = null
let recognitionRound = 1

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
  const preferredScale = image.naturalWidth < 1600
    ? Math.min(1.75, 1600 / image.naturalWidth)
    : Math.min(1, 1800 / image.naturalWidth)
  const pixelScale = Math.sqrt(6_000_000 / (image.naturalWidth * image.naturalHeight))
  const scale = Math.min(preferredScale, pixelScale)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('当前浏览器无法处理截图。')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.filter = 'grayscale(1) contrast(1.3)'
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas
}

const convertToHighContrast = (canvas: HTMLCanvasElement) => {
  const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true })
  if (!context) return
  const image = context.getImageData(0, 0, canvas.width, canvas.height)
  const histogram = new Uint32Array(256)
  let weightedTotal = 0
  for (let index = 0; index < image.data.length; index += 4) {
    const brightness = Math.round(
      image.data[index] * 0.299 + image.data[index + 1] * 0.587 + image.data[index + 2] * 0.114,
    )
    histogram[brightness] += 1
    weightedTotal += brightness
  }

  const pixels = canvas.width * canvas.height
  let backgroundWeight = 0
  let backgroundTotal = 0
  let bestVariance = -1
  let threshold = 180
  for (let value = 0; value < 256; value += 1) {
    backgroundWeight += histogram[value]
    if (!backgroundWeight) continue
    const foregroundWeight = pixels - backgroundWeight
    if (!foregroundWeight) break
    backgroundTotal += value * histogram[value]
    const backgroundMean = backgroundTotal / backgroundWeight
    const foregroundMean = (weightedTotal - backgroundTotal) / foregroundWeight
    const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2
    if (variance > bestVariance) {
      bestVariance = variance
      threshold = value
    }
  }

  threshold = Math.min(210, Math.max(125, threshold + 8))
  for (let index = 0; index < image.data.length; index += 4) {
    const brightness = image.data[index]
    const value = brightness < threshold ? 0 : 255
    image.data[index] = value
    image.data[index + 1] = value
    image.data[index + 2] = value
    image.data[index + 3] = 255
  }
  context.putImageData(image, 0, 0)
}

const normalizeOcrText = (text: string) => {
  const lines = text
    .replace(/(?<=[\u3400-\u9fff])[ \t]+(?=[\u3400-\u9fff])/g, '')
    .replace(/(?:文付|支村)(?=方式|时间|金额|账单)/g, '支付')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      const latinLetters = line.match(/[a-z]/gi)?.length ?? 0
      const meaningfulCharacters = line.match(/[\p{L}\p{N}\u3400-\u9fff]/gu)?.length ?? 0
      if (latinLetters <= 2 && meaningfulCharacters <= 2 && !/\d/.test(line)) return false
      return meaningfulCharacters > 0
    })
  const looksLikePayment = lines.some((line) => /(?:¥|￥)\s*\d|20\d{2}[-/.年]\d{1,2}/.test(line))
  return lines
    .filter((line, index) => !(looksLikePayment && index < 3 && /^[A-Z]{2,6}$/.test(line)))
    .join('\n')
    .trim()
}

const recognitionScore = (text: string, confidence: number) => {
  const keywords = text.match(/微信|支付宝|支付|付款|商户|订单|金额|时间|交易|收款/g)?.length ?? 0
  const hasAmount = /(?:¥|￥|\d)[\s\d,.]*\d/.test(text)
  const hasDate = /20\d{2}[-/.年]\d{1,2}/.test(text)
  return confidence + Math.min(keywords, 6) * 4 + (hasAmount ? 4 : 0) + (hasDate ? 4 : 0)
}

const getWorker = () => {
  if (workerPromise) return workerPromise
  const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin)
  const ocrPath = new URL('ocr/', baseUrl).href
  workerPromise = import('tesseract.js').then(async ({ createWorker, OEM, PSM }) => {
    const worker = await createWorker(['chi_sim', 'eng'], OEM.LSTM_ONLY, {
      workerPath: `${ocrPath}worker.min.js`,
      corePath: `${ocrPath}core/`,
      langPath: ocrPath,
      logger: ({ status, progress }) => {
        if (!activeProgress) return
        if (status === 'recognizing text') {
          if (recognitionRound === 1) {
            activeProgress(Math.round(55 + 38 * progress), '正在读取并分析截图文字')
          } else {
            activeProgress(Math.round(84 + 14 * progress), '正在增强并复核模糊文字')
          }
          return
        }
        const [start, end] = statusRanges[status] ?? [0, 54]
        activeProgress(Math.min(54, Math.round(start + (end - start) * progress)), statusLabels[status] ?? '正在本地识别')
      },
    })
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      preserve_interword_spaces: '1',
      user_defined_dpi: '300',
    })
    return worker
  }).catch((error) => {
    workerPromise = null
    throw error
  })
  return workerPromise
}

const recognizePaymentImageNow = async (file: File, onProgress: OcrProgress) => {
  const reusingWorker = workerPromise !== null
  activeProgress = onProgress
  recognitionRound = 1
  if (reusingWorker) onProgress(8, '正在复用已加载的识别引擎')
  const [worker, image] = await Promise.all([getWorker(), prepareImage(file)])

  try {
    let { data } = await worker.recognize(image, { rotateAuto: true })
    const firstText = normalizeOcrText(data.text)
    const foundAmount = /(?:¥|￥|关|羊|Y)\s*[0-9OoIl|SB,]+|[-−]\s*\d+[.。]\d{2}|\d+[.。]\d{1,2}\s*元/.test(firstText)
    if (data.confidence < 60 || !foundAmount) {
      recognitionRound = 2
      convertToHighContrast(image)
      const retry = await worker.recognize(image)
      if (recognitionScore(retry.data.text, retry.data.confidence) > recognitionScore(data.text, data.confidence)) {
        data = retry.data
      }
    }
    const text = normalizeOcrText(data.text)
    if (!text) throw new Error('没有从截图中读到文字，请换一张更清晰的截图。')
    onProgress(100, '截图文字识别完成')
    return text
  } finally {
    activeProgress = null
  }
}

export function recognizePaymentImage(file: File, onProgress: OcrProgress) {
  const task = recognitionQueue.then(() => recognizePaymentImageNow(file, onProgress))
  recognitionQueue = task.then(() => undefined, () => undefined)
  return task
}
