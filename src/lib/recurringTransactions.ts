import type { Transaction, TransactionInput } from '../types'

export interface RecurringSuggestion {
  key: string
  expectedDay: number
  occurrences: number
  input: TransactionInput
}

const recurringKeywords = /房租|工资|会员|话费|宽带|水费|电费|燃气|物业|保险|贷款|订阅|月卡|停车|学费|社保|公积金/

const monthIndex = (month: string) => {
  const [year, monthNumber] = month.split('-').map(Number)
  return year * 12 + monthNumber - 1
}

const daysInMonth = (month: string) => {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(year, monthNumber, 0).getDate()
}

const normalizedNote = (note: string) => note.trim().replace(/\s+/g, '').toLocaleLowerCase('zh-CN')

export const buildRecurringSuggestions = (
  transactions: Transaction[],
  targetMonth: string,
  limit = 3,
): RecurringSuggestion[] => {
  const targetIndex = monthIndex(targetMonth)
  const currentKeys = new Set(
    transactions
      .filter((item) => item.occurred_on.startsWith(targetMonth))
      .map((item) => `${item.type}|${normalizedNote(item.note)}`),
  )
  const groups = new Map<string, Map<string, Transaction[]>>()

  transactions.forEach((transaction) => {
    const note = normalizedNote(transaction.note)
    if (!note) return
    const transactionMonth = transaction.occurred_on.slice(0, 7)
    const distance = targetIndex - monthIndex(transactionMonth)
    if (distance < 1 || distance > 4) return
    const key = `${transaction.type}|${note}`
    const monthly = groups.get(key) ?? new Map<string, Transaction[]>()
    monthly.set(transactionMonth, [...(monthly.get(transactionMonth) ?? []), transaction])
    groups.set(key, monthly)
  })

  return [...groups.entries()]
    .flatMap(([key, monthly]) => {
      if (currentKeys.has(key) || monthly.size < 2) return []
      const records = [...monthly.values()]
      if (records.some((items) => items.length !== 1)) return []
      const transactionsByMonth = records.map(([item]) => item)
      const occurrenceMonths = transactionsByMonth
        .map((item) => monthIndex(item.occurred_on.slice(0, 7)))
        .sort((a, b) => a - b)
      const latestDistance = targetIndex - occurrenceMonths[occurrenceMonths.length - 1]
      const hasLargeGap = occurrenceMonths.some((item, index) => index > 0 && item - occurrenceMonths[index - 1] > 2)
      if (latestDistance > 2 || hasLargeGap) return []
      const days = transactionsByMonth.map((item) => Number(item.occurred_on.slice(8, 10))).sort((a, b) => a - b)
      const amounts = transactionsByMonth.map((item) => Number(item.amount))
      const note = transactionsByMonth[0].note
      const datesAreStable = days[days.length - 1] - days[0] <= 7
      const amountsAreStable = Math.max(...amounts) - Math.min(...amounts) <= Math.max(5, Math.min(...amounts) * 0.2)
      if (!datesAreStable || (!amountsAreStable && !recurringKeywords.test(note))) return []

      const latest = transactionsByMonth.sort((left, right) => right.occurred_on.localeCompare(left.occurred_on))[0]
      const expectedDay = Math.min(days[Math.floor(days.length / 2)], daysInMonth(targetMonth))
      return [{
        key,
        expectedDay,
        occurrences: transactionsByMonth.length,
        input: {
          type: latest.type,
          amount: Number(latest.amount),
          category: latest.category,
          account: latest.account,
          note: latest.note,
          occurred_on: `${targetMonth}-${String(expectedDay).padStart(2, '0')}`,
        },
      }]
    })
    .sort((left, right) => left.expectedDay - right.expectedDay || right.occurrences - left.occurrences)
    .slice(0, limit)
}
