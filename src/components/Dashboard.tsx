import { useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Car,
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
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
  Trash2,
  TrendingUp,
  Utensils,
  WalletCards,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { categoryColors } from '../data'
import type { Transaction, TransactionInput } from '../types'
import { TransactionForm } from './TransactionForm'

interface DashboardProps {
  transactions: Transaction[]
  email?: string
  demo?: boolean
  loading?: boolean
  onAdd: (input: TransactionInput) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onSignOut?: () => Promise<void>
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

const escapeCsv = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`

export function Dashboard({
  transactions,
  email,
  demo,
  loading,
  onAdd,
  onDelete,
  onSignOut,
}: DashboardProps) {
  const [showForm, setShowForm] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))

  const monthTransactions = useMemo(
    () => transactions.filter((item) => item.occurred_on.startsWith(month)),
    [transactions, month],
  )

  const visibleTransactions = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return monthTransactions
    return monthTransactions.filter((item) =>
      `${item.category} ${item.note}`.toLowerCase().includes(normalized),
    )
  }, [monthTransactions, query])

  const income = monthTransactions
    .filter((item) => item.type === 'income')
    .reduce((sum, item) => sum + Number(item.amount), 0)
  const expense = monthTransactions
    .filter((item) => item.type === 'expense')
    .reduce((sum, item) => sum + Number(item.amount), 0)
  const balance = income - expense

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
      ['日期', '类型', '分类', '金额', '备注'],
      ...visibleTransactions.map((item) => [
        item.occurred_on,
        item.type === 'income' ? '收入' : '支出',
        item.category,
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

  const displayMonth = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
  }).format(new Date(`${month}-01T12:00:00`))

  return (
    <div className="app-shell">
      <aside className={sidebarOpen ? 'sidebar open' : 'sidebar'}>
        <div className="sidebar-top">
          <a className="brand" href="/">
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
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
            <span>{displayMonth}<ChevronDown size={16} /></span>
          </label>
          <button className="secondary-button" onClick={exportCsv}><Download size={17} />导出本月</button>
        </section>

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
              <div className="chart-layout">
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={3} isAnimationActive={false}>
                        {chartData.map((item) => <Cell key={item.name} fill={categoryColors[item.name] ?? '#8d9b92'} />)}
                      </Pie>
                      <Tooltip formatter={(value) => money.format(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="chart-center"><small>总支出</small><b>{money.format(expense)}</b></div>
                </div>
                <div className="chart-legend">
                  {chartData.slice(0, 5).map((item) => (
                    <div key={item.name}><span><i style={{ background: categoryColors[item.name] ?? '#8d9b92' }} />{item.name}</span><b>{expense ? Math.round((item.value / expense) * 100) : 0}%</b></div>
                  ))}
                </div>
              </div>
            ) : <EmptyState text="本月还没有支出记录" onAdd={() => setShowForm(true)} />}
          </article>

          <article className="panel budget-panel" id="budget">
            <header className="panel-header"><div><p className="eyebrow">控制节奏</p><h2>本月预算</h2></div><span className="status-pill">规划中</span></header>
            <div className="budget-number"><strong>¥3,000</strong><span>建议预算</span></div>
            <div className="progress-track"><span style={{ width: `${Math.min((expense / 3000) * 100, 100)}%` }} /></div>
            <div className="progress-label"><span>已使用 {money.format(expense)}</span><span>{Math.round((expense / 3000) * 100)}%</span></div>
            <p className="budget-note">预算编辑和超支提醒将在第二阶段开放。</p>
          </article>
        </section>

        <section className="panel records-panel" id="records">
          <header className="panel-header records-header">
            <div><p className="eyebrow">逐笔回顾</p><h2>本月明细</h2></div>
            <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索分类或备注" /></label>
          </header>
          {loading ? <p className="loading-text">正在读取账目…</p> : visibleTransactions.length ? (
            <div className="transaction-list">
              {visibleTransactions.map((item) => {
                const Icon = iconMap[item.category] ?? CircleEllipsis
                return (
                  <div className="transaction-row" key={item.id}>
                    <span className="category-icon" style={{ color: categoryColors[item.category] ?? '#6d7a72', background: `${categoryColors[item.category] ?? '#6d7a72'}18` }}><Icon size={19} /></span>
                    <span className="transaction-copy"><b>{item.note || item.category}</b><small>{item.category} · {formatDate(item.occurred_on)}</small></span>
                    <strong className={item.type}>{item.type === 'income' ? '+' : '-'}{money.format(Number(item.amount))}</strong>
                    <button className="icon-button delete-button" onClick={() => onDelete(item.id)} aria-label="删除记录"><Trash2 size={16} /></button>
                  </div>
                )
              })}
            </div>
          ) : <EmptyState text={query ? '没有找到相关记录' : '本月还没有账目'} onAdd={() => setShowForm(true)} />}
        </section>
      </main>

      <button className="mobile-add" onClick={() => setShowForm(true)} aria-label="记一笔"><Plus size={24} /></button>
      {showForm && <TransactionForm onClose={() => setShowForm(false)} onSave={onAdd} />}
    </div>
  )
}

function EmptyState({ text, onAdd }: { text: string; onAdd: () => void }) {
  return <div className="empty-state"><ReceiptText size={28} /><p>{text}</p><button onClick={onAdd}>记第一笔</button></div>
}
