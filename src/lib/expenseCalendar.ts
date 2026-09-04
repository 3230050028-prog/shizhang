import type { Transaction } from '../types'

export interface ExpenseCalendarDay {
  day: number
  date: string
  expense: number
  count: number
}

export interface ExpenseCalendarData {
  leadingEmptyDays: number
  days: ExpenseCalendarDay[]
  spendingDays: number
  averagePerSpendingDay: number
  highestDay: ExpenseCalendarDay | null
}

export const buildExpenseCalendar = (month: string, transactions: Transaction[]): ExpenseCalendarData => {
  const [year, monthNumber] = month.split('-').map(Number)
  const daysInMonth = new Date(year, monthNumber, 0).getDate()
  const leadingEmptyDays = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7
  const totals = new Map<string, { expense: number; count: number }>()

  transactions.forEach((transaction) => {
    if (transaction.type !== 'expense' || !transaction.occurred_on.startsWith(month)) return
    const current = totals.get(transaction.occurred_on) ?? { expense: 0, count: 0 }
    current.expense += Number(transaction.amount)
    current.count += 1
    totals.set(transaction.occurred_on, current)
  })

  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1
    const date = `${month}-${String(day).padStart(2, '0')}`
    const total = totals.get(date)
    return { day, date, expense: total?.expense ?? 0, count: total?.count ?? 0 }
  })
  const expenseDays = days.filter((day) => day.expense > 0)
  const totalExpense = expenseDays.reduce((sum, day) => sum + day.expense, 0)
  const highestDay = expenseDays.reduce<ExpenseCalendarDay | null>(
    (highest, day) => !highest || day.expense > highest.expense ? day : highest,
    null,
  )

  return {
    leadingEmptyDays,
    days,
    spendingDays: expenseDays.length,
    averagePerSpendingDay: expenseDays.length ? totalExpense / expenseDays.length : 0,
    highestDay,
  }
}
