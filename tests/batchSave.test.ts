import { describe, expect, it, vi } from 'vitest'
import { BatchSaveError, saveInBatches } from '../src/lib/batchSave'

describe('批量账单保存', () => {
  it('把大量账单拆成手机网络更容易完成的小批次', async () => {
    const batchSizes: number[] = []
    const progress: number[] = []

    const saved = await saveInBatches(
      Array.from({ length: 77 }, (_, index) => index),
      async (batch) => {
        batchSizes.push(batch.length)
        return batch
      },
      { batchSize: 20, onProgress: (completed) => progress.push(completed) },
    )

    expect(saved).toHaveLength(77)
    expect(batchSizes).toEqual([20, 20, 20, 17])
    expect(progress).toEqual([20, 40, 60, 77])
  })

  it('网络瞬断时自动重试同一批数据', async () => {
    const saveBatch = vi.fn()
      .mockRejectedValueOnce(new TypeError('Load failed'))
      .mockImplementation(async (batch: { id: string }[]) => batch)
    const rows = [{ id: 'stable-id' }]

    const saved = await saveInBatches(rows, saveBatch, { wait: async () => undefined })

    expect(saved).toEqual(rows)
    expect(saveBatch).toHaveBeenCalledTimes(2)
    expect(saveBatch.mock.calls[0][0]).toBe(saveBatch.mock.calls[1][0])
  })

  it('数据库校验错误不会进行无效重试', async () => {
    const databaseError = { code: '23514', message: 'violates check constraint' }
    const saveBatch = vi.fn().mockRejectedValue(databaseError)

    await expect(saveInBatches([1, 2], saveBatch, { wait: async () => undefined }))
      .rejects.toMatchObject<Partial<BatchSaveError>>({
        savedCount: 0,
        failedCount: 2,
        retryable: false,
        originalError: databaseError,
      })
    expect(saveBatch).toHaveBeenCalledTimes(1)
  })
})
