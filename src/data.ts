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

export const defaultAccounts = ['微信', '支付宝', '现金', '银行卡', '其他']

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
    account: '银行卡',
    note: '本月工资',
    occurred_on: dateInCurrentMonth(2),
  },
  {
    id: 'demo-2',
    type: 'expense',
    amount: 168,
    category: '餐饮',
    account: '微信',
    note: '周末聚餐',
    occurred_on: dateInCurrentMonth(6),
  },
  {
    id: 'demo-3',
    type: 'expense',
    amount: 32.5,
    category: '交通',
    account: '支付宝',
    note: '打车',
    occurred_on: dateInCurrentMonth(8),
  },
  {
    id: 'demo-4',
    type: 'expense',
    amount: 459,
    category: '购物',
    account: '银行卡',
    note: '生活用品',
    occurred_on: dateInCurrentMonth(11),
  },
  {
    id: 'demo-5',
    type: 'expense',
    amount: 88,
    category: '娱乐',
    account: '微信',
    note: '电影',
    occurred_on: dateInCurrentMonth(14),
  },
]

export const categoryColors: Record<string, string> = {
  餐饮: '#c96f4b',
  交通: '#477a78',
  购物: '#a47755',
  居住: '#b89a4f',
  娱乐: '#8d6c8d',
  医疗: '#5f8a6d',
  教育: '#637a99',
  工资: '#3f7959',
  奖金: '#568b66',
  理财: '#447b73',
  兼职: '#7d8d59',
  红包: '#b96457',
  其他: '#92978f',
}
