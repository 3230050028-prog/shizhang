import { useState, type FormEvent } from 'react'
import { CheckCircle2, KeyRound, Leaf } from 'lucide-react'
import { supabase } from '../lib/supabase'

export function PasswordRecovery({ onComplete }: { onComplete: () => void }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    if (password !== confirmation) {
      setMessage('两次输入的密码不一致。')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setMessage(error.message)
        return
      }
      setMessage('密码修改成功。')
      window.setTimeout(onComplete, 700)
    } catch {
      setMessage('网络连接失败，请稍后重试。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="recovery-page">
      <section className="recovery-card">
        <div className="brand"><span className="brand-mark"><Leaf size={18} /></span><span>拾账</span></div>
        <span className="recovery-icon"><KeyRound size={24} /></span>
        <p className="eyebrow">账户安全</p>
        <h1>设置新密码</h1>
        <p className="muted">请输入至少 6 位的新密码。</p>
        <form onSubmit={submit}>
          <label>新密码<input type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <label>确认新密码<input type="password" minLength={6} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label>
          {message && <p className="form-message"><CheckCircle2 size={15} />{message}</p>}
          <button className="primary-button" disabled={saving}>{saving ? '保存中…' : '更新密码'}</button>
        </form>
      </section>
    </main>
  )
}
