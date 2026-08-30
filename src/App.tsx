import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AuthScreen } from './components/AuthScreen'
import { Dashboard } from './components/Dashboard'
import { PasswordRecovery } from './components/PasswordRecovery'
import { demoTransactions } from './data'
import { toLocalMonth } from './lib/date'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { ActionResult, Budget, SavedCategory, Transaction, TransactionInput } from './types'

const demoStorageKey = 'shizhang-demo-transactions'
const demoBudgetStorageKey = 'shizhang-demo-budgets'

function loadDemoTransactions() {
  try {
    const stored = localStorage.getItem(demoStorageKey)
    return stored ? (JSON.parse(stored) as Transaction[]) : demoTransactions
  } catch {
    return demoTransactions
  }
}

function loadDemoBudgets(): Budget[] {
  try {
    const stored = localStorage.getItem(demoBudgetStorageKey)
    if (stored) return JSON.parse(stored) as Budget[]
  } catch {
    // Fall back to a starter budget when local demo data is invalid.
  }
  return [{
    id: 'demo-budget',
    month: `${toLocalMonth()}-01`,
    category: '全部',
    amount: 3000,
  }]
}

const errorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error && typeof error.message === 'string') return error.message
  return '网络连接失败，请稍后重试。'
}

const failure = (prefix: string, error: unknown): ActionResult => ({
  ok: false,
  error: `${prefix}：${errorMessage(error)}`,
})

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured)
  const [dataLoading, setDataLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    isSupabaseConfigured ? [] : loadDemoTransactions(),
  )
  const [budgets, setBudgets] = useState<Budget[]>(() =>
    isSupabaseConfigured ? [] : loadDemoBudgets(),
  )
  const [savedCategories, setSavedCategories] = useState<SavedCategory[]>([])

  useEffect(() => {
    if (!supabase) return

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
      setDataLoading(Boolean(data.session))
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
      setSession(nextSession)
      setAuthLoading(false)
      setDataLoading(Boolean(nextSession))
      if (!nextSession) {
        setTransactions([])
        setBudgets([])
        setSavedCategories([])
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) localStorage.setItem(demoStorageKey, JSON.stringify(transactions))
  }, [transactions])

  useEffect(() => {
    if (!isSupabaseConfigured) localStorage.setItem(demoBudgetStorageKey, JSON.stringify(budgets))
  }, [budgets])

  useEffect(() => {
    if (!session || !supabase) return

    let active = true
    void (async () => {
      try {
        const [transactionResult, budgetResult, categoryResult] = await Promise.all([
          supabase.from('transactions').select('*').order('occurred_on', { ascending: false }),
          supabase.from('budgets').select('*').order('month', { ascending: false }),
          supabase.from('categories').select('*').order('name'),
        ])
        if (!active) return
        if (transactionResult.error) throw transactionResult.error
        if (budgetResult.error) throw budgetResult.error
        setTransactions((transactionResult.data as Transaction[] | null) ?? [])
        setBudgets((budgetResult.data as Budget[] | null) ?? [])
        setSavedCategories(categoryResult.error ? [] : (categoryResult.data as SavedCategory[] | null) ?? [])
        setLoadError('')
      } catch (error) {
        if (active) setLoadError(errorMessage(error))
      } finally {
        if (active) setDataLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [session, loadAttempt])

  const persistCategory = async (input: TransactionInput) => {
    const existing = savedCategories.find((item) => item.type === input.type && item.name === input.category)
    if (existing) return
    if (!supabase || !session) {
      setSavedCategories((current) => [{ id: crypto.randomUUID(), type: input.type, name: input.category }, ...current])
      return
    }
    try {
      const { data, error } = await supabase
        .from('categories')
        .upsert(
          { user_id: session.user.id, type: input.type, name: input.category },
          { onConflict: 'user_id,type,name' },
        )
        .select()
        .single()
      if (!error && data) setSavedCategories((current) => [data as SavedCategory, ...current])
    } catch {
      // Category persistence is an enhancement; the transaction itself remains valid.
    }
  }

  const addTransaction = async (input: TransactionInput): Promise<ActionResult> => {
    if (!supabase || !session) {
      setTransactions((current) => [
        {
          ...input,
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
        },
        ...current,
      ])
      await persistCategory(input)
      return { ok: true }
    }

    try {
      const { data, error } = await supabase
        .from('transactions')
        .insert({ ...input, user_id: session.user.id })
        .select()
        .single()
      if (error) return failure('保存失败', error)
      setTransactions((current) => [data as Transaction, ...current])
      await persistCategory(input)
      return { ok: true }
    } catch (error) {
      return failure('保存失败', error)
    }
  }

  const updateTransaction = async (id: string, input: TransactionInput): Promise<ActionResult> => {
    if (!supabase || !session) {
      setTransactions((current) => current.map((item) => item.id === id ? { ...item, ...input } : item))
      await persistCategory(input)
      return { ok: true }
    }

    try {
      const { data, error } = await supabase
        .from('transactions')
        .update(input)
        .eq('id', id)
        .select()
        .single()
      if (error) return failure('更新失败', error)
      setTransactions((current) => current.map((item) => item.id === id ? data as Transaction : item))
      await persistCategory(input)
      return { ok: true }
    } catch (error) {
      return failure('更新失败', error)
    }
  }

  const deleteTransaction = async (id: string): Promise<ActionResult> => {
    if (!supabase || !session) {
      setTransactions((current) => current.filter((item) => item.id !== id))
      return { ok: true }
    }

    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) return failure('删除失败', error)
      setTransactions((current) => current.filter((item) => item.id !== id))
      return { ok: true }
    } catch (error) {
      return failure('删除失败', error)
    }
  }

  const saveBudget = async (month: string, amount: number): Promise<ActionResult> => {
    const monthDate = `${month}-01`
    if (!supabase || !session) {
      setBudgets((current) => {
        const existing = current.find((item) => item.month.startsWith(month) && item.category === '全部')
        return existing
          ? current.map((item) => item.id === existing.id ? { ...item, amount } : item)
          : [{ id: crypto.randomUUID(), month: monthDate, category: '全部', amount }, ...current]
      })
      return { ok: true }
    }

    try {
      const { data, error } = await supabase
        .from('budgets')
        .upsert(
          { user_id: session.user.id, month: monthDate, category: '全部', amount },
          { onConflict: 'user_id,month,category' },
        )
        .select()
        .single()
      if (error) return failure('预算保存失败', error)
      setBudgets((current) => [
        data as Budget,
        ...current.filter((item) => !(item.month.startsWith(month) && item.category === '全部')),
      ])
      return { ok: true }
    } catch (error) {
      return failure('预算保存失败', error)
    }
  }

  if (authLoading) {
    return <div className="app-loading"><span className="brand-mark">拾</span><p>正在打开账本…</p></div>
  }

  if (recoveryMode) return <PasswordRecovery onComplete={() => setRecoveryMode(false)} />

  if (isSupabaseConfigured && !session) return <AuthScreen />

  return (
    <Dashboard
      transactions={transactions}
      budgets={budgets}
      savedCategories={savedCategories}
      email={session?.user.email}
      demo={!isSupabaseConfigured}
      loading={dataLoading}
      onAdd={addTransaction}
      onUpdate={updateTransaction}
      onDelete={deleteTransaction}
      onSaveBudget={saveBudget}
      loadError={loadError}
      onRetry={() => { setDataLoading(true); setLoadAttempt((value) => value + 1) }}
      onSignOut={session && supabase ? async () => { await supabase!.auth.signOut() } : undefined}
    />
  )
}

export default App
