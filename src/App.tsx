import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AuthScreen } from './components/AuthScreen'
import { Dashboard } from './components/Dashboard'
import { PasswordRecovery } from './components/PasswordRecovery'
import { SplashScreen } from './components/SplashScreen'
import { demoTransactions } from './data'
import { BatchSaveError, saveInBatches } from './lib/batchSave'
import { toLocalMonth } from './lib/date'
import { clearPasswordRecoveryRequest, readPasswordRecoveryRequest } from './lib/passwordRecovery'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { withTimeout } from './lib/timeout'
import type { ActionResult, Budget, SavedAccount, SavedCategory, Transaction, TransactionInput } from './types'

const demoStorageKey = 'shizhang-demo-transactions'
const demoBudgetStorageKey = 'shizhang-demo-budgets'
const demoAccountStorageKey = 'shizhang-demo-accounts'
const initialRecoveryRequest = readPasswordRecoveryRequest(window.location.href)

const normalizeTransaction = (transaction: Transaction): Transaction => ({
  ...transaction,
  account: transaction.account || '未分类',
})

function loadDemoTransactions() {
  try {
    const stored = localStorage.getItem(demoStorageKey)
    return stored
      ? (JSON.parse(stored) as Transaction[]).map(normalizeTransaction)
      : demoTransactions
  } catch {
    return demoTransactions
  }
}

function loadDemoAccounts(): SavedAccount[] {
  try {
    const stored = localStorage.getItem(demoAccountStorageKey)
    return stored ? JSON.parse(stored) as SavedAccount[] : []
  } catch {
    return []
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
  const cloudEnabled = isSupabaseConfigured && !(import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo'))
  const [showSplash, setShowSplash] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(cloudEnabled)
  const [authError, setAuthError] = useState('')
  const [authAttempt, setAuthAttempt] = useState(0)
  const [dataLoading, setDataLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [recoveryMode, setRecoveryMode] = useState(initialRecoveryRequest.requested)
  const [recoveryError, setRecoveryError] = useState(initialRecoveryRequest.error)
  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    cloudEnabled ? [] : loadDemoTransactions(),
  )
  const [budgets, setBudgets] = useState<Budget[]>(() =>
    cloudEnabled ? [] : loadDemoBudgets(),
  )
  const [savedCategories, setSavedCategories] = useState<SavedCategory[]>([])
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>(() =>
    cloudEnabled ? [] : loadDemoAccounts(),
  )

  useEffect(() => {
    const timer = window.setTimeout(() => setShowSplash(false), 1100)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!cloudEnabled || !supabase) return

    void withTimeout(
      supabase.auth.getSession(),
      12_000,
      '连接账号服务超时，请检查网络后重试。',
    ).then(({ data, error }) => {
      setSession(data.session)
      setAuthLoading(false)
      setAuthError('')
      setDataLoading(Boolean(data.session))
      if (initialRecoveryRequest.requested && !data.session) {
        setRecoveryError(initialRecoveryRequest.error || error?.message || '这个重置链接无效或已经过期，请重新申请。')
      }
    }).catch((error) => {
      setAuthLoading(false)
      setAuthError(errorMessage(error))
      if (initialRecoveryRequest.requested) setRecoveryError('无法验证重置链接，请检查网络后重新打开邮件链接。')
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true)
        setRecoveryError('')
      }
      setSession(nextSession)
      setAuthLoading(false)
      setAuthError('')
      setDataLoading(Boolean(nextSession))
      if (!nextSession) {
        setTransactions([])
        setBudgets([])
        setSavedCategories([])
        setSavedAccounts([])
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [authAttempt, cloudEnabled])

  const clearPasswordRecoveryLocation = () => {
    window.history.replaceState(null, '', clearPasswordRecoveryRequest(window.location.href))
    setRecoveryError('')
    setRecoveryMode(false)
  }

  const cancelPasswordRecovery = async () => {
    try {
      if (supabase) await supabase.auth.signOut()
    } finally {
      clearPasswordRecoveryLocation()
    }
  }

  useEffect(() => {
    if (!cloudEnabled) localStorage.setItem(demoStorageKey, JSON.stringify(transactions))
  }, [cloudEnabled, transactions])

  useEffect(() => {
    if (!cloudEnabled) localStorage.setItem(demoBudgetStorageKey, JSON.stringify(budgets))
  }, [budgets, cloudEnabled])

  useEffect(() => {
    if (!cloudEnabled) localStorage.setItem(demoAccountStorageKey, JSON.stringify(savedAccounts))
  }, [cloudEnabled, savedAccounts])

  useEffect(() => {
    if (!session || !supabase) return

    let active = true
    void (async () => {
      try {
        const [transactionResult, budgetResult, categoryResult, accountResult] = await withTimeout(
          Promise.all([
            supabase.from('transactions').select('*').order('occurred_on', { ascending: false }),
            supabase.from('budgets').select('*').order('month', { ascending: false }),
            supabase.from('categories').select('*').order('name'),
            supabase.from('accounts').select('*').order('name'),
          ]),
          15_000,
          '读取账本超时，请检查网络后重新加载。',
        )
        if (!active) return
        if (transactionResult.error) throw transactionResult.error
        if (budgetResult.error) throw budgetResult.error
        setTransactions(((transactionResult.data as Transaction[] | null) ?? []).map(normalizeTransaction))
        setBudgets((budgetResult.data as Budget[] | null) ?? [])
        setSavedCategories(categoryResult.error ? [] : (categoryResult.data as SavedCategory[] | null) ?? [])
        setSavedAccounts(accountResult.error ? [] : (accountResult.data as SavedAccount[] | null) ?? [])
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

  const persistAccount = async (input: TransactionInput) => {
    const existing = savedAccounts.find((item) => item.name === input.account)
    if (existing) return
    if (!supabase || !session) {
      setSavedAccounts((current) => [{ id: crypto.randomUUID(), name: input.account }, ...current])
      return
    }
    try {
      const { data, error } = await supabase
        .from('accounts')
        .upsert(
          { user_id: session.user.id, name: input.account },
          { onConflict: 'user_id,name' },
        )
        .select()
        .single()
      if (!error && data) {
        setSavedAccounts((current) => [
          data as SavedAccount,
          ...current.filter((item) => item.name !== input.account),
        ])
      }
    } catch {
      // Account persistence is an enhancement; the transaction itself remains valid.
    }
  }

  const persistImportMetadata = async (inputs: TransactionInput[]) => {
    const categories = [...new Map(inputs.map((input) => [`${input.type}:${input.category}`, {
      id: crypto.randomUUID(),
      type: input.type,
      name: input.category,
    }])).values()]
    const accounts = [...new Map(inputs.map((input) => [input.account, {
      id: crypto.randomUUID(),
      name: input.account,
    }])).values()]

    if (!supabase || !session) {
      setSavedCategories((current) => [
        ...categories.filter((item) => !current.some((saved) => saved.type === item.type && saved.name === item.name)),
        ...current,
      ])
      setSavedAccounts((current) => [
        ...accounts.filter((item) => !current.some((saved) => saved.name === item.name)),
        ...current,
      ])
      return
    }

    try {
      const [categoryResult, accountResult] = await Promise.all([
        supabase.from('categories').upsert(
          categories.map(({ type, name }) => ({ user_id: session.user.id, type, name })),
          { onConflict: 'user_id,type,name' },
        ).select(),
        supabase.from('accounts').upsert(
          accounts.map(({ name }) => ({ user_id: session.user.id, name })),
          { onConflict: 'user_id,name' },
        ).select(),
      ])
      if (categoryResult.data) {
        const saved = categoryResult.data as SavedCategory[]
        setSavedCategories((current) => [...saved, ...current.filter((item) => !saved.some((next) => next.type === item.type && next.name === item.name))])
      }
      if (accountResult.data) {
        const saved = accountResult.data as SavedAccount[]
        setSavedAccounts((current) => [...saved, ...current.filter((item) => !saved.some((next) => next.name === item.name))])
      }
    } catch {
      // Metadata is optional; imported transactions have already been saved.
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
      void Promise.all([persistCategory(input), persistAccount(input)])
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
      void Promise.all([persistCategory(input), persistAccount(input)])
      return { ok: true }
    } catch (error) {
      return failure('保存失败', error)
    }
  }

  const addTransactions = async (
    inputs: TransactionInput[],
    onProgress?: (completed: number) => void,
  ): Promise<ActionResult> => {
    if (!inputs.length) return { ok: true, saved: 0, failed: 0 }

    if (!supabase || !session) {
      const now = new Date().toISOString()
      const created = inputs.map((input) => ({ ...input, id: crypto.randomUUID(), created_at: now }))
      setTransactions((current) => [...created, ...current])
      void persistImportMetadata(inputs)
      onProgress?.(inputs.length)
      return { ok: true, saved: inputs.length, failed: 0, ids: created.map((item) => item.id) }
    }

    const cloudClient = supabase
    const rows = inputs.map((input) => ({
      ...input,
      id: crypto.randomUUID(),
      user_id: session.user.id,
    }))

    try {
      const saved = await saveInBatches(rows, async (batch) => {
        const { data, error } = await cloudClient
          .from('transactions')
          .upsert(batch, { onConflict: 'id' })
          .select()
        if (error) throw error
        const savedBatch = (data as Transaction[] | null) ?? []
        setTransactions((current) => [...savedBatch, ...current])
        return savedBatch
      }, { batchSize: 20, maxAttempts: 3, onProgress })

      void persistImportMetadata(inputs)
      return { ok: true, saved: saved.length, failed: 0, ids: saved.map((item) => item.id) }
    } catch (error) {
      if (error instanceof BatchSaveError) {
        const prefix = error.retryable
          ? `网络连接不稳定，已自动重试；已确认导入 ${error.savedCount} 笔，剩余 ${error.failedCount} 笔未能确认。请恢复网络后刷新账本，再重新选择原文件，已保存记录会自动跳过`
          : `已导入 ${error.savedCount} 笔，后续保存失败`
        return {
          ...failure(prefix, error.originalError),
          saved: error.savedCount,
          failed: error.failedCount,
        }
      }
      return { ...failure('账单保存失败', error), saved: 0, failed: inputs.length }
    }
  }

  const updateTransaction = async (id: string, input: TransactionInput): Promise<ActionResult> => {
    if (!supabase || !session) {
      setTransactions((current) => current.map((item) => item.id === id ? { ...item, ...input, updated_at: new Date().toISOString() } : item))
      await persistCategory(input)
      await persistAccount(input)
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
      await persistAccount(input)
      return { ok: true }
    } catch (error) {
      return failure('更新失败', error)
    }
  }

  const correctTransactionDates = async (
    updates: Transaction[],
    onProgress?: (completed: number) => void,
  ): Promise<ActionResult> => {
    if (!updates.length) return { ok: true, saved: 0, failed: 0 }

    if (!supabase || !session) {
      const byId = new Map(updates.map((item) => [item.id, item]))
      setTransactions((current) => current.map((item) => byId.get(item.id) ?? item))
      onProgress?.(updates.length)
      return { ok: true, saved: updates.length, failed: 0 }
    }

    const cloudClient = supabase
    const rows = updates.map((item) => ({ ...item, user_id: session.user.id }))
    try {
      const saved = await saveInBatches(rows, async (batch) => {
        const { data, error } = await cloudClient
          .from('transactions')
          .upsert(batch, { onConflict: 'id' })
          .select()
        if (error) throw error
        const savedBatch = (data as Transaction[] | null) ?? []
        const savedById = new Map(savedBatch.map((item) => [item.id, item]))
        setTransactions((current) => current.map((item) => savedById.get(item.id) ?? item))
        return savedBatch
      }, { batchSize: 20, maxAttempts: 3, onProgress })
      return { ok: true, saved: saved.length, failed: 0 }
    } catch (error) {
      if (error instanceof BatchSaveError) {
        return {
          ...failure(`已修正 ${error.savedCount} 笔日期，剩余 ${error.failedCount} 笔失败`, error.originalError),
          saved: error.savedCount,
          failed: error.failedCount,
        }
      }
      return { ...failure('日期修正失败', error), saved: 0, failed: updates.length }
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

  const deleteDuplicateTransactions = async (
    ids: string[],
    onProgress?: (completed: number) => void,
  ): Promise<ActionResult> => {
    if (!ids.length) return { ok: true, saved: 0, failed: 0 }

    if (!supabase || !session) {
      const deleted = new Set(ids)
      setTransactions((current) => current.filter((item) => !deleted.has(item.id)))
      onProgress?.(ids.length)
      return { ok: true, saved: ids.length, failed: 0 }
    }

    const cloudClient = supabase
    try {
      const deletedIds = await saveInBatches(ids, async (batch) => {
        const { data, error } = await cloudClient
          .from('transactions')
          .delete()
          .in('id', batch)
          .select('id')
        if (error) throw error
        const savedBatch = ((data as Array<{ id: string }> | null) ?? []).map((item) => item.id)
        const deleted = new Set(savedBatch)
        setTransactions((current) => current.filter((item) => !deleted.has(item.id)))
        return savedBatch
      }, { batchSize: 50, maxAttempts: 3, onProgress })
      return { ok: true, saved: deletedIds.length, failed: 0 }
    } catch (error) {
      if (error instanceof BatchSaveError) {
        return {
          ...failure(`已删除 ${error.savedCount} 笔重复副本，剩余 ${error.failedCount} 笔失败`, error.originalError),
          saved: error.savedCount,
          failed: error.failedCount,
        }
      }
      return { ...failure('重复账目删除失败', error), saved: 0, failed: ids.length }
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

  if (showSplash) return <SplashScreen />

  if (authLoading) {
    return <div className="app-loading"><span className="brand-mark">拾</span><p>正在打开账本…</p></div>
  }

  if (cloudEnabled && !session && authError) {
    return (
      <main className="connection-error-page">
        <section className="connection-error-card" role="alert">
          <span className="brand-mark">拾</span>
          <h1>暂时无法连接拾账</h1>
          <p>{authError}</p>
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              setAuthError('')
              setAuthLoading(true)
              setAuthAttempt((value) => value + 1)
            }}
          >
            重新连接
          </button>
        </section>
      </main>
    )
  }

  if (recoveryMode) {
    return <PasswordRecovery initialError={recoveryError} onComplete={clearPasswordRecoveryLocation} onCancel={cancelPasswordRecovery} />
  }

  if (cloudEnabled && !session) return <AuthScreen />

  return (
    <Dashboard
      transactions={transactions}
      budgets={budgets}
      savedCategories={savedCategories}
      savedAccounts={savedAccounts}
      email={session?.user.email}
      demo={!cloudEnabled}
      loading={dataLoading}
      onAdd={addTransaction}
      onAddBatch={addTransactions}
      onCorrectDates={correctTransactionDates}
      onDeleteDuplicates={deleteDuplicateTransactions}
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
