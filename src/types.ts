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
  ids?: string[]
}

export type AIProviderId =
  | 'openai'
  | 'deepseek'
  | 'moonshotai-cn'
  | 'openrouter'
  | 'kimi-coding'

export interface AIModelOption {
  id: string
  name: string
  provider: AIProviderId
  contextWindow?: number
  supportsImages?: boolean
}

export interface AIProviderConfig {
  id: string
  provider: AIProviderId
  model: string
  keyHint: string
  isDefault: boolean
  lastCheckedAt?: string
  createdAt: string
  updatedAt: string
}

export interface AIChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AIUsage {
  input: number
  output: number
  total: number
  cost?: number
}
