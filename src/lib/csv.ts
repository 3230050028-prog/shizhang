const formulaPrefix = /^[=+\-@\t\r]/

export const escapeCsv = (value: string | number) => {
  const raw = String(value)
  const safe = typeof value === 'string' && formulaPrefix.test(raw) ? `'${raw}` : raw
  return `"${safe.replaceAll('"', '""')}"`
}
