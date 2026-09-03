export type TransactionType = 'income' | 'expense'

export interface Transaction {
  id: string
  user_id?: string
  type: TransactionType
  amount: number
  category: string
  account: string
  note: string
  occurred_on: string
  created_at?: string
  updated_at?: string
}

export interface TransactionInput {
  type: TransactionType
  amount: number
  category: string
  account: string
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

export interface SavedCategory {
  id: string
  user_id?: string
  type: TransactionType
  name: string
  created_at?: string
}

export interface SavedAccount {
  id: string
  user_id?: string
  name: string
  created_at?: string
}

export interface ActionResult {
  ok: boolean
  error?: string
  saved?: number
  failed?: number
}
