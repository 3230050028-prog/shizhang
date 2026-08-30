import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AuthScreen } from './components/AuthScreen'
import { Dashboard } from './components/Dashboard'
import { demoTransactions } from './data'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { Budget, Transaction, TransactionInput } from './types'

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
    month: `${new Date().toISOString().slice(0, 7)}-01`,
    category: '全部',
    amount: 3000,
  }]
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured)
  const [dataLoading, setDataLoading] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    isSupabaseConfigured ? [] : loadDemoTransactions(),
  )
  const [budgets, setBudgets] = useState<Budget[]>(() =>
    isSupabaseConfigured ? [] : loadDemoBudgets(),
  )

  useEffect(() => {
    if (!supabase) return

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
      setDataLoading(Boolean(data.session))
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthLoading(false)
      setDataLoading(Boolean(nextSession))
      if (!nextSession) {
        setTransactions([])
        setBudgets([])
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
    Promise.all([
      supabase.from('transactions').select('*').order('occurred_on', { ascending: false }),
      supabase.from('budgets').select('*').order('month', { ascending: false }),
    ]).then(([transactionResult, budgetResult]) => {
        if (!active) return
        if (transactionResult.error) window.alert(`读取账目失败：${transactionResult.error.message}`)
        if (budgetResult.error) window.alert(`读取预算失败：${budgetResult.error.message}`)
        setTransactions((transactionResult.data as Transaction[] | null) ?? [])
        setBudgets((budgetResult.data as Budget[] | null) ?? [])
        setDataLoading(false)
      })

    return () => {
      active = false
    }
  }, [session])

  const addTransaction = async (input: TransactionInput) => {
    if (!supabase || !session) {
      setTransactions((current) => [
        {
          ...input,
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
        },
        ...current,
      ])
      return
    }

    const { data, error } = await supabase
      .from('transactions')
      .insert({ ...input, user_id: session.user.id })
      .select()
      .single()

    if (error) {
      window.alert(`保存失败：${error.message}`)
      return
    }
    setTransactions((current) => [data as Transaction, ...current])
  }

  const updateTransaction = async (id: string, input: TransactionInput) => {
    if (!supabase || !session) {
      setTransactions((current) => current.map((item) => item.id === id ? { ...item, ...input } : item))
      return
    }

    const { data, error } = await supabase
      .from('transactions')
      .update(input)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      window.alert(`更新失败：${error.message}`)
      return
    }
    setTransactions((current) => current.map((item) => item.id === id ? data as Transaction : item))
  }

  const deleteTransaction = async (id: string) => {
    if (!supabase || !session) {
      setTransactions((current) => current.filter((item) => item.id !== id))
      return
    }

    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) {
      window.alert(`删除失败：${error.message}`)
      return
    }
    setTransactions((current) => current.filter((item) => item.id !== id))
  }

  const saveBudget = async (month: string, amount: number) => {
    const monthDate = `${month}-01`
    if (!supabase || !session) {
      setBudgets((current) => {
        const existing = current.find((item) => item.month.startsWith(month) && item.category === '全部')
        return existing
          ? current.map((item) => item.id === existing.id ? { ...item, amount } : item)
          : [{ id: crypto.randomUUID(), month: monthDate, category: '全部', amount }, ...current]
      })
      return
    }

    const { data, error } = await supabase
      .from('budgets')
      .upsert(
        { user_id: session.user.id, month: monthDate, category: '全部', amount },
        { onConflict: 'user_id,month,category' },
      )
      .select()
      .single()

    if (error) {
      window.alert(`预算保存失败：${error.message}`)
      return
    }
    setBudgets((current) => [
      data as Budget,
      ...current.filter((item) => !(item.month.startsWith(month) && item.category === '全部')),
    ])
  }

  if (authLoading) {
    return <div className="app-loading"><span className="brand-mark">拾</span><p>正在打开账本…</p></div>
  }

  if (isSupabaseConfigured && !session) return <AuthScreen />

  return (
    <Dashboard
      transactions={transactions}
      budgets={budgets}
      email={session?.user.email}
      demo={!isSupabaseConfigured}
      loading={dataLoading}
      onAdd={addTransaction}
      onUpdate={updateTransaction}
      onDelete={deleteTransaction}
      onSaveBudget={saveBudget}
      onSignOut={session && supabase ? async () => { await supabase!.auth.signOut() } : undefined}
    />
  )
}

export default App
