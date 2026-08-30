import { useState, type FormEvent } from 'react'
import { Target, X } from 'lucide-react'

interface BudgetFormProps {
  monthLabel: string
  currentAmount: number
  onClose: () => void
  onSave: (amount: number) => Promise<void>
}

export function BudgetForm({ monthLabel, currentAmount, onClose, onSave }: BudgetFormProps) {
  const [amount, setAmount] = useState(currentAmount ? String(currentAmount) : '')
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const numericAmount = Number(amount)
    if (!numericAmount || numericAmount <= 0) return
    setSaving(true)
    await onSave(numericAmount)
    setSaving(false)
    onClose()
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="transaction-modal budget-modal" role="dialog" aria-modal="true" aria-labelledby="budget-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <p className="eyebrow">提前规划</p>
            <h2 id="budget-title">设置月度预算</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭"><X size={20} /></button>
        </header>
        <div className="budget-modal-intro"><Target size={20} /><span>正在设置 <b>{monthLabel}</b> 的总支出预算</span></div>
        <form onSubmit={submit}>
          <label className="amount-field">
            预算金额
            <span><b>¥</b><input autoFocus inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="例如 3000" required /></span>
          </label>
          <p className="form-hint">预算只用于提醒，不会限制你记录实际支出。</p>
          <button className="primary-button modal-submit" disabled={saving}>{saving ? '保存中…' : '保存预算'}</button>
        </form>
      </section>
    </div>
  )
}
