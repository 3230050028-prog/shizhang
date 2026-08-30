import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AuthScreen } from './components/AuthScreen'
import { Dashboard } from './components/Dashboard'
import { demoTransactions } from './data'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { Transaction, TransactionInput } from './types'

const demoStorageKey = 'shizhang-demo-transactions'

function loadDemoTransactions() {
  try {
    const stored = localStorage.getItem(demoStorageKey)
    return stored ? (JSON.parse(stored) as Transaction[]) : demoTransactions
  } catch {
    return demoTransactions
  }
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured)
  const [dataLoading, setDataLoading] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    isSupabaseConfigured ? [] : loadDemoTransactions(),
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
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) localStorage.setItem(demoStorageKey, JSON.stringify(transactions))
  }, [transactions])

  useEffect(() => {
    if (!session || !supabase) return

    let active = true
    supabase
      .from('transactions')
      .select('*')
      .order('occurred_on', { ascending: false })
      .then(({ data, error }) => {
        if (!active) return
        if (error) window.alert(`读取账目失败：${error.message}`)
        setTransactions((data as Transaction[] | null) ?? [])
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

  if (authLoading) {
    return <div className="app-loading"><span className="brand-mark">拾</span><p>正在打开账本…</p></div>
  }

  if (isSupabaseConfigured && !session) return <AuthScreen />

  return (
    <Dashboard
      transactions={transactions}
      email={session?.user.email}
      demo={!isSupabaseConfigured}
      loading={dataLoading}
      onAdd={addTransaction}
      onDelete={deleteTransaction}
      onSignOut={session && supabase ? async () => { await supabase!.auth.signOut() } : undefined}
    />
  )
}

export default App
