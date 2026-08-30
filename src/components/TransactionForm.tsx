import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { expenseCategories, incomeCategories } from '../data'
import type { TransactionInput, TransactionType } from '../types'

interface TransactionFormProps {
  onClose: () => void
  onSave: (input: TransactionInput) => Promise<void>
}

export function TransactionForm({ onClose, onSave }: TransactionFormProps) {
  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(expenseCategories[0])
  const [customCategory, setCustomCategory] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const categories = type === 'expense' ? expenseCategories : incomeCategories

  const changeType = (nextType: TransactionType) => {
    setType(nextType)
    setCategory(nextType === 'expense' ? expenseCategories[0] : incomeCategories[0])
    setCustomCategory('')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const numericAmount = Number(amount)
    if (!numericAmount || numericAmount <= 0) return

    setSaving(true)
    await onSave({
      type,
      amount: numericAmount,
      category: category === '自定义' ? customCategory.trim() || '其他' : category,
      note: note.trim(),
      occurred_on: date,
    })
    setSaving(false)
    onClose()
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
            <h2 id="transaction-title">记一笔</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭">
            <X size={20} />
          </button>
        </header>

        <form onSubmit={submit}>
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
            备注
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="这笔钱花在了哪里？（选填）" maxLength={100} />
          </label>

          <button className="primary-button modal-submit" disabled={saving}>
            {saving ? '保存中…' : '保存记录'}
          </button>
        </form>
      </section>
    </div>
  )
}
