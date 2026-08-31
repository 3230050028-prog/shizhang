import { useState, type FormEvent } from 'react'
import { ClipboardPaste, ShieldCheck, Sparkles, X } from 'lucide-react'
import { defaultAccounts, expenseCategories, incomeCategories } from '../data'
import { toLocalDate } from '../lib/date'
import { parseQuickEntry } from '../lib/quickEntry'
import type { ActionResult, TransactionInput, TransactionType } from '../types'

interface TransactionFormProps {
  initial?: TransactionInput
  knownCategories?: Record<TransactionType, string[]>
  knownAccounts?: string[]
  onClose: () => void
  onSave: (input: TransactionInput) => Promise<ActionResult>
  onSaved?: (input: TransactionInput) => void
}

export function TransactionForm({ initial, knownCategories, knownAccounts, onClose, onSave, onSaved }: TransactionFormProps) {
  const [type, setType] = useState<TransactionType>(initial?.type ?? 'expense')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [category, setCategory] = useState(initial?.category ?? expenseCategories[0])
  const [customCategory, setCustomCategory] = useState('')
  const [account, setAccount] = useState(initial?.account ?? defaultAccounts[0])
  const [customAccount, setCustomAccount] = useState('')
  const [note, setNote] = useState(initial?.note ?? '')
  const [date, setDate] = useState(() => initial?.occurred_on ?? toLocalDate(new Date()))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [smartText, setSmartText] = useState('')
  const [smartMessage, setSmartMessage] = useState('')
  const [smartError, setSmartError] = useState('')
  const defaultCategories = type === 'expense' ? expenseCategories : incomeCategories
  const categories = [...new Set([
    ...defaultCategories,
    ...(knownCategories?.[type] ?? []),
    ...(initial?.type === type ? [initial.category] : []),
  ])]
  const accounts = [...new Set([
    ...defaultAccounts,
    ...(knownAccounts ?? []),
    ...(initial?.account ? [initial.account] : []),
  ])]

  const changeType = (nextType: TransactionType) => {
    setType(nextType)
    setCategory(nextType === 'expense' ? expenseCategories[0] : incomeCategories[0])
    setCustomCategory('')
  }

  const applySmartText = (text = smartText) => {
    setSmartError('')
    setSmartMessage('')
    try {
      const result = parseQuickEntry(text, account, new Date())
      setType(result.input.type)
      setAmount(String(result.input.amount))
      setCategory(result.input.category)
      setAccount(result.input.account)
      setNote(result.input.note)
      setDate(result.input.occurred_on)
      setSmartMessage(`已识别：${result.recognized.join(' · ')}。请检查后保存。`)
    } catch (reason) {
      setSmartError(reason instanceof Error ? reason.message : '识别失败，请调整文字后重试。')
    }
  }

  const pasteFromClipboard = async () => {
    setSmartError('')
    try {
      const text = await navigator.clipboard.readText()
      if (!text.trim()) throw new Error('剪贴板中没有文字。')
      setSmartText(text)
      applySmartText(text)
    } catch (reason) {
      setSmartError(reason instanceof Error && reason.message === '剪贴板中没有文字。'
        ? reason.message
        : '浏览器不允许自动读取剪贴板，请长按输入框后选择“粘贴”。')
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const numericAmount = Number(amount)
    if (!numericAmount || numericAmount <= 0) return

    setSaving(true)
    setError('')
    const input: TransactionInput = {
      type,
      amount: numericAmount,
      category: category === '自定义' ? customCategory.trim() || '其他' : category,
      account: account === '自定义账户' ? customAccount.trim() || '其他' : account,
      note: note.trim(),
      occurred_on: date,
    }
    try {
      const result = await onSave(input)
      if (!result.ok) {
        setError(result.error ?? '保存失败，请稍后重试。')
        return
      }
      onSaved?.(input)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? `保存失败：${reason.message}` : '保存失败，请稍后重试。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="transaction-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="eyebrow">快速记录</p>
            <h2 id="transaction-title">{initial ? '编辑账目' : '记一笔'}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭">
            <X size={20} />
          </button>
        </header>

        <form onSubmit={submit}>
          {!initial && (
            <section className="smart-entry">
              <div className="smart-entry-title">
                <span><Sparkles size={17} /></span>
                <div><b>半自动记账</b><small>粘贴支付通知或输入一句话，自动填好下面的表单</small></div>
              </div>
              <textarea
                value={smartText}
                onChange={(event) => setSmartText(event.target.value)}
                placeholder="例如：今天午饭35元，微信支付"
                rows={3}
              />
              <div className="smart-entry-actions">
                <button className="secondary-button" type="button" onClick={() => void pasteFromClipboard()}><ClipboardPaste size={15} />粘贴通知</button>
                <button className="smart-apply" type="button" onClick={() => applySmartText()}><Sparkles size={15} />识别并填入</button>
              </div>
              {smartMessage && <p className="smart-success">{smartMessage}</p>}
              {smartError && <p className="inline-error">{smartError}</p>}
              <p className="smart-privacy"><ShieldCheck size={13} />文字只在当前设备处理，不会发送给AI或第三方。</p>
            </section>
          )}

          <div className="type-switch">
            <button
              type="button"
              className={type === 'expense' ? 'active expense' : ''}
              onClick={() => changeType('expense')}
            >
              支出
            </button>
            <button
              type="button"
              className={type === 'income' ? 'active income' : ''}
              onClick={() => changeType('income')}
            >
              收入
            </button>
          </div>

          <label className="amount-field">
            金额
            <span><b>¥</b><input autoFocus inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" required /></span>
          </label>

          <div className="form-grid">
            <label>
              分类
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                {categories.map((item) => <option key={item}>{item}</option>)}
                <option>自定义</option>
              </select>
            </label>
            <label>
              日期
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
            </label>
          </div>

          {category === '自定义' && (
            <label>
              自定义分类
              <input value={customCategory} onChange={(event) => setCustomCategory(event.target.value)} placeholder="例如：宠物" maxLength={12} required />
            </label>
          )}

          <label>
            支付账户
            <select value={account} onChange={(event) => setAccount(event.target.value)}>
              {accounts.map((item) => <option key={item}>{item}</option>)}
              <option>自定义账户</option>
            </select>
          </label>

          {account === '自定义账户' && (
            <label>
              自定义账户
              <input value={customAccount} onChange={(event) => setCustomAccount(event.target.value)} placeholder="例如：招商银行卡" maxLength={30} required />
            </label>
          )}

          <label>
            备注
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="这笔钱花在了哪里？（选填）" maxLength={100} />
          </label>

          {error && <p className="inline-error">{error}</p>}

          <button className="primary-button modal-submit" disabled={saving}>
            {saving ? '保存中…' : initial ? '保存修改' : '保存记录'}
          </button>
        </form>
      </section>
    </div>
  )
}
