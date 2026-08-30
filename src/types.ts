export type TransactionType = 'income' | 'expense'

export interface Transaction {
  id: string
  user_id?: string
  type: TransactionType
  amount: number
  category: string
  note: string
  occurred_on: string
  created_at?: string
}

export interface TransactionInput {
  type: TransactionType
  amount: number
  category: string
  note: string
  occurred_on: string
}

export interface Budget {
  id: string
  user_id?: string
  month: string
  category: string
  amount: number
  created_at?: string
}
