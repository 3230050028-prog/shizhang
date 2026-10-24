interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface LedgerRow {
  type: string
  amount: number | string
  category: string
  account: string
  note: string
  occurred_on: string
}

export function ledgerPeriod(messages: Message[], selectedMonth: unknown, now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
  const currentMonth = today.slice(0, 7)
  let month = typeof selectedMonth === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(selectedMonth)
    ? selectedMonth : currentMonth
  let broad = false
  for (const message of [...messages].reverse()) {
    if (message.role !== 'user') continue
    const explicit = message.content.match(/(?<!\d)(\d{4}|\d{2})\s*(?:年|[-/])\s*(1[0-2]|0?[1-9])\s*(?:月|(?=[-/\s]|$))/)
    if (explicit) {
      month = `${explicit[1].length === 2 ? '20' : ''}${explicit[1]}-${explicit[2].padStart(2, '0')}`
      break
    }
    if (/上个?月/.test(message.content)) {
      const previous = new Date(`${month}-01T00:00:00Z`)
      previous.setUTCMonth(previous.getUTCMonth() - 1)
      month = previous.toISOString().slice(0, 7)
      break
    }
    if (/这个月|本月|当月/.test(message.content)) break
    if (/最近|近\s*[\d一二三四五六七八九十]+\s*个?月|今年|去年|对比|比较|季度|全年|半年/.test(message.content)) {
      broad = true
      break
    }
  }
  const start = new Date(`${broad ? currentMonth : month}-01T00:00:00Z`)
  if (broad) start.setUTCMonth(start.getUTCMonth() - 11)
  const end = new Date(`${month}-01T00:00:00Z`)
  end.setUTCMonth(end.getUTCMonth() + 1, 0)
  return {
    today,
    month: broad ? undefined : month,
    from: start.toISOString().slice(0, 10),
    to: broad ? today : [end.toISOString().slice(0, 10), today].sort()[0],
  }
}

export function ledgerSummary(rows: LedgerRow[]) {
  let income = 0
  let expense = 0
  const categories = new Map<string, number>()
  for (const row of rows) {
    const cents = Math.round(Number(row.amount) * 100)
    if (row.type === 'income') income += cents
    else {
      expense += cents
      categories.set(row.category, (categories.get(row.category) ?? 0) + cents)
    }
  }
  return {
    笔数: rows.length,
    收入: income / 100,
    支出: expense / 100,
    支出分类: [...categories].sort((a, b) => b[1] - a[1]).map(([分类, cents]) => ({ 分类, 金额: cents / 100 })),
  }
}
