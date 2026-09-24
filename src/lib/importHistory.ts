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
    const history = parseImportHistory(window.localStorage.getItem(historyStorageKey))
    if (history.length) return history
    const legacy = parseLegacyImportBatch(window.localStorage.getItem(legacyStorageKey))
    return legacy ? [legacy] : []
  } catch {
    return []
  }
}

const writeImportHistory = (history: ImportBatch[]) => {
  window.localStorage.setItem(historyStorageKey, JSON.stringify(history.slice(0, historyLimit)))
  window.localStorage.removeItem(legacyStorageKey)
}

export const saveImportBatch = (batch: ImportBatch) => {
  try {
    const history = readImportHistory().filter((item) => item.importedAt !== batch.importedAt)
    const next = [normalizeBatch(batch), ...history].filter((item): item is ImportBatch => Boolean(item))
    writeImportHistory(next)
    return next.slice(0, historyLimit)
  } catch {
    return [batch]
  }
}

export const removeImportBatch = (importedAt: string) => {
  try {
    const next = readImportHistory().filter((batch) => batch.importedAt !== importedAt)
    writeImportHistory(next)
    return next
  } catch {
    return []
  }
}
