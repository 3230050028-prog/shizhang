export interface LastImportBatch {
  ids: string[]
  fileName: string
  importedAt: string
}

const storageKey = 'shizhang:last-import-batch'

export const parseLastImportBatch = (value: string | null): LastImportBatch | null => {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<LastImportBatch>
    if (!Array.isArray(parsed.ids) || !parsed.ids.length || !parsed.ids.every((id) => typeof id === 'string' && id.length > 0)) return null
    if (typeof parsed.fileName !== 'string' || typeof parsed.importedAt !== 'string') return null
    return { ids: [...new Set(parsed.ids)], fileName: parsed.fileName, importedAt: parsed.importedAt }
  } catch {
    return null
  }
}

export const readLastImportBatch = () => {
  try {
    return parseLastImportBatch(window.localStorage.getItem(storageKey))
  } catch {
    return null
  }
}

export const saveLastImportBatch = (batch: LastImportBatch) => {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(batch))
  } catch {
    // The import remains valid when private browsing blocks local storage.
  }
}

export const clearLastImportBatch = () => {
  try {
    window.localStorage.removeItem(storageKey)
  } catch {
    // Nothing else is required when storage is unavailable.
  }
}
