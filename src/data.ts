import type { Transaction } from './types'
import { toLocalDate } from './lib/date'

export const expenseCategories = [
  '餐饮',
  '交通',
  '购物',
  '居住',
  '娱乐',
  '医疗',
  '教育',
  '其他',
]

export const incomeCategories = ['工资', '奖金', '理财', '兼职', '红包', '其他']

const today = new Date()
const dateInCurrentMonth = (day: number) => {
  const date = new Date(today.getFullYear(), today.getMonth(), day)
  return toLocalDate(date)
}

export const demoTransactions: Transaction[] = [
  {
    id: 'demo-1',
    type: 'income',
    amount: 12800,
    category: '工资',
    note: '本月工资',
    occurred_on: dateInCurrentMonth(2),
  },
  {
    id: 'demo-2',
    type: 'expense',
    amount: 168,
    category: '餐饮',
    note: '周末聚餐',
    occurred_on: dateInCurrentMonth(6),
  },
  {
    id: 'demo-3',
    type: 'expense',
    amount: 32.5,
    category: '交通',
    note: '打车',
    occurred_on: dateInCurrentMonth(8),
  },
  {
    id: 'demo-4',
    type: 'expense',
    amount: 459,
    category: '购物',
    note: '生活用品',
    occurred_on: dateInCurrentMonth(11),
  },
  {
    id: 'demo-5',
    type: 'expense',
    amount: 88,
    category: '娱乐',
    note: '电影',
    occurred_on: dateInCurrentMonth(14),
  },
]

export const categoryColors: Record<string, string> = {
  餐饮: '#fb8c6b',
  交通: '#5b8def',
  购物: '#aa7be8',
  居住: '#e2b654',
  娱乐: '#ed6e9d',
  医疗: '#55b8a0',
  教育: '#7489cf',
  工资: '#35a875',
  奖金: '#49b88a',
  理财: '#3a9a8a',
  兼职: '#78a96a',
  红包: '#e36a68',
  其他: '#9aa3ad',
}
