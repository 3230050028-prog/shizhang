import { lazy, Suspense, useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Car,
  AlertTriangle,
  ChevronDown,
  CircleEllipsis,
  Clapperboard,
  Download,
  GraduationCap,
  HeartPulse,
  Home,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
  Upload,
  Utensils,
  WalletCards,
  X,
  type LucideIcon,
} from 'lucide-react'
import { categoryColors } from '../data'
import { escapeCsv } from '../lib/csv'
import { toLocalMonth } from '../lib/date'
import type { ActionResult, Budget, SavedAccount, SavedCategory, Transaction, TransactionInput, TransactionType } from '../types'
import { BudgetForm } from './BudgetForm'
import { PaymentImport } from './PaymentImport'
import { TransactionForm } from './TransactionForm'

const SpendingChart = lazy(() => import('./SpendingChart'))

interface DashboardProps {
  transactions: Transaction[]
  budgets: Budget[]
  savedCategories: SavedCategory[]
  savedAccounts: SavedAccount[]
  email?: string
  demo?: boolean
  loading?: boolean
  onAdd: (input: TransactionInput) => Promise<ActionResult>
  onUpdate: (id: string, input: TransactionInput) => Promise<ActionResult>
  onDelete: (id: string) => Promise<ActionResult>
  onSaveBudget: (month: string, amount: number) => Promise<ActionResult>
  onSignOut?: () => Promise<void>
  loadError?: string
  onRetry: () => void
}

const iconMap: Record<string, LucideIcon> = {
  餐饮: Utensils,
  交通: Car,
  购物: ShoppingBag,
  居住: Home,
  娱乐: Clapperboard,
  医疗: HeartPulse,
  教育: GraduationCap,
  工资: BriefcaseBusiness,
  理财: TrendingUp,
}

const money = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  minimumFractionDigits: 2,
})

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(
    new Date(`${date}T12:00:00`),
  )

export function Dashboard({
  transactions,
  budgets,
  savedCategories,
  savedAccounts,
  email,
  demo,
  loading,
  onAdd,
  onUpdate,
  onDelete,
  onSaveBudget,
  onSignOut,
  loadError,
  onRetry,
}: DashboardProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [showBudgetForm, setShowBudgetForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [month, setMonth] = useState(toLocalMonth())
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [accountFilter, setAccountFilter] = useState('all')
  const [operationError, setOperationError] = useState('')

  const monthTransactions = useMemo(
    () => transactions.filter((item) => item.occurred_on.startsWith(month)),
    [transactions, month],
  )

  const visibleTransactions = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return monthTransactions.filter((item) => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false
      if (accountFilter !== 'all' && item.account !== accountFilter) return false
      return !normalized || `${item.category} ${item.account} ${item.note}`.toLowerCase().includes(normalized)
    })
  }, [accountFilter, categoryFilter, monthTransactions, query, typeFilter])

  const availableCategories = useMemo(
    () => [...new Set(monthTransactions.map((item) => item.category))].sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [monthTransactions],
  )

  const availableAccounts = useMemo(
    () => [...new Set(monthTransactions.map((item) => item.account || '未分类'))].sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [monthTransactions],
  )

  const income = monthTransactions
    .filter((item) => item.type === 'income')
    .reduce((sum, item) => sum + Number(item.amount), 0)
  const expense = monthTransactions
    .filter((item) => item.type === 'expense')
    .reduce((sum, item) => sum + Number(item.amount), 0)
  const balance = income - expense
  const currentBudget = budgets.find((item) => item.month.startsWith(month) && item.category === '全部')
  const budgetAmount = Number(currentBudget?.amount ?? 0)
  const budgetPercent = budgetAmount ? Math.round((expense / budgetAmount) * 100) : 0
  const isOverBudget = budgetAmount > 0 && expense > budgetAmount

  const knownCategories = useMemo(() => ({
    income: [...new Set([
      ...savedCategories.filter((item) => item.type === 'income').map((item) => item.name),
      ...transactions.filter((item) => item.type === 'income').map((item) => item.category),
    ])],
    expense: [...new Set([
      ...savedCategories.filter((item) => item.type === 'expense').map((item) => item.name),
      ...transactions.filter((item) => item.type === 'expense').map((item) => item.category),
    ])],
  }), [savedCategories, transactions])

  const knownAccounts = useMemo(() => [...new Set([
    ...savedAccounts.map((item) => item.name),
    ...transactions.map((item) => item.account || '未分类'),
  ])], [savedAccounts, transactions])

  const chartData = useMemo(() => {
    const totals = new Map<string, number>()
    monthTransactions
      .filter((item) => item.type === 'expense')
      .forEach((item) => {
        totals.set(item.category, (totals.get(item.category) ?? 0) + Number(item.amount))
      })
    return [...totals.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [monthTransactions])

  const exportCsv = () => {
    const rows = [
      ['日期', '类型', '分类', '支付账户', '金额', '备注'],
      ...visibleTransactions.map((item) => [
        item.occurred_on,
        item.type === 'income' ? '收入' : '支出',
        item.category,
        item.account || '未分类',
        item.amount,
        item.note,
      ]),
    ]
    const csv = `\ufeff${rows.map((row) => row.map(escapeCsv).join(',')).join('\n')}`
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `拾账-${month}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const deleteItem = async (id: string) => {
    const result = await onDelete(id)
    if (!result.ok) setOperationError(result.error ?? '删除失败，请稍后重试。')
  }

  const resetFilters = () => {
    setQuery('')
    setTypeFilter('all')
    setCategoryFilter('all')
    setAccountFilter('all')
  }

  const changeMonth = (nextMonth: string) => {
    setMonth(nextMonth)
    setCategoryFilter('all')
    setAccountFilter('all')
  }

  const hasFilters = Boolean(query.trim()) || typeFilter !== 'all' || categoryFilter !== 'all' || accountFilter !== 'all'

  const displayMonth = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
  }).format(new Date(`${month}-01T12:00:00`))

  return (
    <div className="app-shell">
      <aside className={sidebarOpen ? 'sidebar open' : 'sidebar'}>
        <div className="sidebar-top">
          <a className="brand" href={import.meta.env.BASE_URL}>
            <span className="brand-mark"><Leaf size={20} /></span>
            <span>拾账</span>
          </a>
          <button className="icon-button mobile-close" onClick={() => setSidebarOpen(false)} aria-label="关闭菜单"><X size={20} /></button>
        </div>
        <nav>
          <a className="active" href="#overview"><LayoutDashboard size={19} />总览</a>
          <a href="#records"><ReceiptText size={19} />收支明细</a>
          <a href="#budget"><WalletCards size={19} />预算</a>
          <a href="#insight"><BookOpen size={19} />消费洞察</a>
        </nav>
        <div className="sidebar-tip">
          <span>本月小贴士</span>
          <p>先记录，再优化。坚持记账比追求完美更重要。</p>
        </div>
        <div className="user-row">
          <span className="avatar">{(email?.[0] || '拾').toUpperCase()}</span>
          <span><b>{demo ? '体验用户' : '我的账本'}</b><small>{demo ? '演示模式' : email}</small></span>
          {onSignOut && <button className="icon-button" onClick={onSignOut} aria-label="退出登录"><LogOut size={17} /></button>}
        </div>
      </aside>

      {sidebarOpen && <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)} />}

      <main className="dashboard" id="overview">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setSidebarOpen(true)} aria-label="打开菜单"><Menu size={21} /></button>
          <div>
            <p className="eyebrow">我的账本</p>
            <h1>今天也要认真生活</h1>
          </div>
          <div className="topbar-actions">
            {demo && <span className="demo-badge">演示模式</span>}
            <button className="icon-button" aria-label="通知"><Bell size={20} /></button>
            <button className="primary-button" onClick={() => setShowForm(true)}><Plus size={18} />记一笔</button>
          </div>
        </header>

        <section className="dashboard-toolbar">
          <label className="month-picker">
            <input type="month" value={month} onChange={(event) => changeMonth(event.target.value)} />
            <span>{displayMonth}<ChevronDown size={16} /></span>
          </label>
          <div className="toolbar-actions">
            <button className="secondary-button" onClick={() => setShowImport(true)}><Upload size={17} />导入账单</button>
            <button className="secondary-button" onClick={exportCsv}><Download size={17} />导出本月</button>
          </div>
        </section>

        {(loadError || operationError) && (
          <div className="error-banner">
            <AlertTriangle size={17} />
            <span>{loadError ? `账本加载失败：${loadError}` : operationError}</span>
            {loadError && <button onClick={onRetry}>重新加载</button>}
            {operationError && <button className="banner-close" onClick={() => setOperationError('')} aria-label="关闭提示"><X size={15} /></button>}
          </div>
        )}

        <section className="summary-grid">
          <article className="summary-card balance-card">
            <span className="summary-icon"><WalletCards size={21} /></span>
            <div><p>本月结余</p><strong>{money.format(balance)}</strong><small>收入减去支出</small></div>
          </article>
          <article className="summary-card">
            <span className="summary-icon income-icon"><ArrowDownLeft size={21} /></span>
            <div><p>本月收入</p><strong>{money.format(income)}</strong><small>{monthTransactions.filter((item) => item.type === 'income').length} 笔收入</small></div>
          </article>
          <article className="summary-card">
            <span className="summary-icon expense-icon"><ArrowUpRight size={21} /></span>
            <div><p>本月支出</p><strong>{money.format(expense)}</strong><small>{monthTransactions.filter((item) => item.type === 'expense').length} 笔支出</small></div>
          </article>
        </section>

        <section className="content-grid">
          <article className="panel chart-panel" id="insight">
            <header className="panel-header"><div><p className="eyebrow">支出去向</p><h2>分类统计</h2></div></header>
            {chartData.length ? (
              <Suspense fallback={<div className="chart-loading">正在绘制图表…</div>}>
                <SpendingChart data={chartData} expense={expense} formatMoney={(value) => money.format(value)} />
              </Suspense>
            ) : <EmptyState text="本月还没有支出记录" onAdd={() => setShowForm(true)} />}
          </article>

          <article className={isOverBudget ? 'panel budget-panel over-budget' : 'panel budget-panel'} id="budget">
            <header className="panel-header">
              <div><p className="eyebrow">控制节奏</p><h2>本月预算</h2></div>
              <button className="text-button" onClick={() => setShowBudgetForm(true)}><Pencil size={14} />{budgetAmount ? '修改' : '设置'}</button>
            </header>
            {isOverBudget && <div className="budget-alert"><AlertTriangle size={15} />已超过本月预算</div>}
            <div className="budget-number"><strong>{budgetAmount ? money.format(budgetAmount) : '尚未设置'}</strong><span>{budgetAmount ? '总支出预算' : '设置预算后可获得进度提醒'}</span></div>
            <div className="progress-track"><span style={{ width: `${Math.min(budgetPercent, 100)}%` }} /></div>
            <div className="progress-label"><span>已使用 {money.format(expense)}</span><span>{budgetAmount ? `${budgetPercent}%` : '--'}</span></div>
            <p className="budget-note">{isOverBudget ? `已超出 ${money.format(expense - budgetAmount)}，可以回顾本月支出分类。` : budgetAmount ? `还可支出 ${money.format(Math.max(budgetAmount - expense, 0))}。` : '设一个轻松可执行的目标，比追求完美更重要。'}</p>
          </article>
        </section>

        <section className="panel records-panel" id="records">
          <header className="panel-header records-header">
            <div><p className="eyebrow">逐笔回顾</p><h2>本月明细</h2></div>
            <label className="search-box"><Search size={17} /><input aria-label="搜索账目" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索分类、账户或备注" /></label>
          </header>
          <div className="records-filterbar">
            <span className="filter-label"><SlidersHorizontal size={15} />筛选</span>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'all' | TransactionType)} aria-label="按收支类型筛选">
              <option value="all">全部收支</option>
              <option value="expense">只看支出</option>
              <option value="income">只看收入</option>
            </select>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="按分类筛选">
              <option value="all">全部分类</option>
              {availableCategories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)} aria-label="按支付账户筛选">
              <option value="all">全部账户</option>
              {availableAccounts.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <span className="filter-result">显示 {visibleTransactions.length} / {monthTransactions.length} 笔</span>
            {hasFilters && <button className="clear-filters" type="button" onClick={resetFilters}>清除筛选</button>}
          </div>
          {loading ? <p className="loading-text">正在读取账目…</p> : visibleTransactions.length ? (
            <div className="transaction-list">
              {visibleTransactions.map((item) => {
                const Icon = iconMap[item.category] ?? CircleEllipsis
                return (
                  <div className="transaction-row" key={item.id}>
                    <span className="category-icon" style={{ color: categoryColors[item.category] ?? '#6d7a72', background: `${categoryColors[item.category] ?? '#6d7a72'}18` }}><Icon size={19} /></span>
                    <span className="transaction-copy"><b>{item.note || item.category}</b><small>{item.category} · {item.account || '未分类'} · {formatDate(item.occurred_on)}</small></span>
                    <strong className={item.type}>{item.type === 'income' ? '+' : '-'}{money.format(Number(item.amount))}</strong>
                    <span className="transaction-actions">
                      <button className="icon-button edit-button" onClick={() => setEditingTransaction(item)} aria-label="编辑记录"><Pencil size={15} /></button>
                      <button className="icon-button delete-button" onClick={() => { if (window.confirm('确定删除这笔记录吗？')) void deleteItem(item.id) }} aria-label="删除记录"><Trash2 size={16} /></button>
                    </span>
                  </div>
                )
              })}
            </div>
          ) : <EmptyState text={hasFilters ? '没有找到符合筛选条件的记录' : '本月还没有账目'} onAdd={() => setShowForm(true)} />}
        </section>
      </main>

      <button className="mobile-add" onClick={() => setShowForm(true)} aria-label="记一笔"><Plus size={24} /></button>
      {(showForm || editingTransaction) && (
        <TransactionForm
          initial={editingTransaction ?? undefined}
          knownCategories={knownCategories}
          knownAccounts={knownAccounts}
          onClose={() => { setShowForm(false); setEditingTransaction(null) }}
          onSave={(input) => editingTransaction ? onUpdate(editingTransaction.id, input) : onAdd(input)}
        />
      )}
      {showBudgetForm && (
        <BudgetForm
          monthLabel={displayMonth}
          currentAmount={budgetAmount}
          onClose={() => setShowBudgetForm(false)}
          onSave={(amount) => onSaveBudget(month, amount)}
        />
      )}
      {showImport && (
        <PaymentImport
          transactions={transactions}
          onClose={() => setShowImport(false)}
          onImport={onAdd}
        />
      )}
    </div>
  )
}

function EmptyState({ text, onAdd }: { text: string; onAdd: () => void }) {
  return <div className="empty-state"><ReceiptText size={28} /><p>{text}</p><button onClick={onAdd}>记第一笔</button></div>
}
