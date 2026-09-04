import type { CSSProperties } from 'react'
import { CalendarDays } from 'lucide-react'
import { buildExpenseCalendar } from '../lib/expenseCalendar'
import type { Transaction } from '../types'

interface ExpenseCalendarProps {
  month: string
  transactions: Transaction[]
  selectedDate: string | null
  formatMoney: (value: number) => string
  onSelectDate: (date: string) => void
}

const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const compactMoney = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function ExpenseCalendar({ month, transactions, selectedDate, formatMoney, onSelectDate }: ExpenseCalendarProps) {
  const calendar = buildExpenseCalendar(month, transactions)
  const maxExpense = calendar.highestDay?.expense ?? 0
  const today = new Date()
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  return (
    <section className="panel expense-calendar-panel" id="calendar">
      <header className="panel-header calendar-header">
        <div><p className="eyebrow">每日足迹</p><h2>支出日历</h2></div>
        <span><CalendarDays size={16} />点击有金额的日期查看明细</span>
      </header>
      <div className="expense-calendar" role="grid" aria-label={`${month}月度支出日历`}>
        {weekdays.map((weekday, index) => <span className={index > 4 ? 'weekend' : ''} role="columnheader" key={weekday}>周{weekday}</span>)}
        {Array.from({ length: calendar.leadingEmptyDays }, (_, index) => <i aria-hidden="true" key={`empty-${index}`} />)}
        {calendar.days.map((day) => {
          const intensity = maxExpense ? day.expense / maxExpense : 0
          const className = [day.expense ? 'has-expense' : '', day.date === selectedDate ? 'selected' : '', day.date === todayString ? 'today' : ''].filter(Boolean).join(' ')
          return (
            <button
              className={className}
              type="button"
              role="gridcell"
              aria-selected={day.date === selectedDate}
              disabled={!day.expense}
              style={day.expense ? { '--expense-intensity': String(0.08 + intensity * 0.2) } as CSSProperties : undefined}
              onClick={() => onSelectDate(day.date)}
              aria-label={`${day.date}，支出${formatMoney(day.expense)}，${day.count}笔`}
              key={day.date}
            >
              <time dateTime={day.date}>{day.day}</time>
              {day.expense > 0 && <><strong>{compactMoney.format(day.expense)}</strong><small>{day.count}笔</small></>}
            </button>
          )
        })}
      </div>
      <footer className="calendar-summary">
        <span><small>有支出的天数</small><b>{calendar.spendingDays} 天</b></span>
        <span><small>消费日平均</small><b>{formatMoney(calendar.averagePerSpendingDay)}</b></span>
        <span><small>单日最高</small><b>{calendar.highestDay ? `${calendar.highestDay.day}日 · ${formatMoney(calendar.highestDay.expense)}` : '暂无'}</b></span>
      </footer>
    </section>
  )
}
