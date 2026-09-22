export interface BatchSaveOptions {
  batchSize?: number
  maxAttempts?: number
  retryDelayMs?: number
  onProgress?: (completed: number) => void
  wait?: (milliseconds: number) => Promise<void>
}

export class BatchSaveError extends Error {
  readonly savedCount: number
  readonly failedCount: number
  readonly originalError: unknown
  readonly retryable: boolean

  constructor(savedCount: number, failedCount: number, originalError: unknown, retryable: boolean) {
    super('Batch save failed')
    this.name = 'BatchSaveError'
    this.savedCount = savedCount
    this.failedCount = failedCount
    this.originalError = originalError
    this.retryable = retryable
  }
}

const readErrorField = (error: unknown, field: string) => {
  if (typeof error !== 'object' || !error || !(field in error)) return undefined
  const value = error[field as keyof typeof error]
  return typeof value === 'string' || typeof value === 'number' ? value : undefined
}

export const isRetryableSaveError = (error: unknown) => {
  if (error instanceof TypeError) return true

  const status = Number(readErrorField(error, 'status'))
  if (status === 0 || status === 408 || status === 425 || status === 429 || status >= 500) return true

  const code = String(readErrorField(error, 'code') ?? '')
  if (/^(08|PGRST00)/.test(code)) return true

  const message = String(readErrorField(error, 'message') ?? (error instanceof Error ? error.message : error)).toLowerCase()
  return /load failed|failed to fetch|network|timeout|timed out|connection|离线|网络/.test(message)
}

const defaultWait = (milliseconds: number) => new Promise<void>((resolve) => {
  window.setTimeout(resolve, milliseconds)
})

export async function saveInBatches<TInput, TSaved>(
  items: TInput[],
  saveBatch: (batch: TInput[]) => Promise<TSaved[]>,
  options: BatchSaveOptions = {},
) {
  const batchSize = options.batchSize ?? 20
  const maxAttempts = options.maxAttempts ?? 3
  const retryDelayMs = options.retryDelayMs ?? 600
  const wait = options.wait ?? defaultWait
  const savedItems: TSaved[] = []

  for (let start = 0; start < items.length; start += batchSize) {
    const batch = items.slice(start, start + batchSize)
    let lastError: unknown

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const saved = await saveBatch(batch)
        savedItems.push(...saved)
        options.onProgress?.(savedItems.length)
        lastError = undefined
        break
      } catch (error) {
        lastError = error
        if (!isRetryableSaveError(error) || attempt === maxAttempts) break
        await wait(retryDelayMs * attempt)
      }
    }

    if (lastError !== undefined) {
      throw new BatchSaveError(savedItems.length, items.length - savedItems.length, lastError, isRetryableSaveError(lastError))
    }
  }

  return savedItems
}
