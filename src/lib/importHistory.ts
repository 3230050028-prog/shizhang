export interface ImportBatch {
  ids: string[]
  fileName: string
  importedAt: string
  expenseAmount?: number
  incomeAmount?: number
}

const historyStorageKey = 'shizhang:import-history'
const legacyStorageKey = 'shizhang:last-import-batch'
const historyLimit = 10

const normalizeBatch = (value: unknown): ImportBatch | null => {
  if (!value || typeof value !== 'object') return null
  const parsed = value as Partial<ImportBatch>
  if (!Array.isArray(parsed.ids) || !parsed.ids.length || !parsed.ids.every((id) => typeof id === 'string' && id.length > 0)) return null
  if (typeof parsed.fileName !== 'string' || typeof parsed.importedAt !== 'string') return null

  return {
    ids: [...new Set(parsed.ids)],
    fileName: parsed.fileName,
    importedAt: parsed.importedAt,
    ...(typeof parsed.expenseAmount === 'number' ? { expenseAmount: parsed.expenseAmount } : {}),
    ...(typeof parsed.incomeAmount === 'number' ? { incomeAmount: parsed.incomeAmount } : {}),
  }
}

export const parseImportHistory = (value: string | null): ImportBatch[] => {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeBatch).filter((batch): batch is ImportBatch => Boolean(batch)).slice(0, historyLimit)
  } catch {
    return []
  }
}

export const parseLegacyImportBatch = (value: string | null): ImportBatch | null => {
  if (!value) return null
  try {
    return normalizeBatch(JSON.parse(value) as unknown)
  } catch {
    return null
  }
}

export const readImportHistory = () => {
  try {
    const stored = window.localStorage.getItem(historyStorageKey)
    if (stored !== null) return parseImportHistory(stored)
    const legacy = parseLegacyImportBatch(window.localStorage.getItem(legacyStorageKey))
    return legacy ? [legacy] : []
  } catch {
    return []
  }
}

const readImportHistoryForWrite = (): ImportBatch[] => {
  const stored = window.localStorage.getItem(historyStorageKey)
  if (stored !== null) {
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) throw new Error('导入历史格式错误')
    const history = parsed.map(normalizeBatch)
    if (history.some((batch) => batch === null)) throw new Error('导入历史包含损坏记录')
    return history as ImportBatch[]
  }

  const legacyStored = window.localStorage.getItem(legacyStorageKey)
  if (legacyStored === null) return []
  const legacy = normalizeBatch(JSON.parse(legacyStored) as unknown)
  if (!legacy) throw new Error('旧版导入历史格式错误')
  return [legacy]
}

const writeImportHistory = (history: ImportBatch[]) => {
  window.localStorage.setItem(historyStorageKey, JSON.stringify(history.slice(0, historyLimit)))
  try {
    window.localStorage.removeItem(legacyStorageKey)
  } catch {
    // 新历史已成功写入，旧键清理失败不影响后续读取。
  }
}

export const saveImportBatch = (batch: ImportBatch) => {
  const normalized = normalizeBatch(batch)
  if (!normalized) throw new Error('本次导入记录格式错误')
  const history = readImportHistoryForWrite().filter((item) => item.importedAt !== batch.importedAt)
  const next = [normalized, ...history].slice(0, historyLimit)
  writeImportHistory(next)
  return next
}

export const removeImportBatch = (importedAt: string) => {
  const next = readImportHistoryForWrite().filter((batch) => batch.importedAt !== importedAt)
  writeImportHistory(next)
  return next
}
