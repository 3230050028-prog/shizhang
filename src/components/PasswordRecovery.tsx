import { useState, type FormEvent } from 'react'
import { AlertTriangle, CheckCircle2, KeyRound, Leaf } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface PasswordRecoveryProps {
  initialError?: string
  onComplete: () => void
  onCancel: () => void | Promise<void>
}

const passwordErrorMessage = (message: string) => {
  const normalized = message.toLowerCase()
  if (normalized.includes('expired') || normalized.includes('invalid') || normalized.includes('email link')) {
    return '重置链接已经过期、无效或已被使用，请返回登录页重新申请。'
  }
  if (message.includes('重置链接') || message.includes('验证重置')) return message
  if (normalized.includes('same password')) return '新密码不能与旧密码相同。'
  if (normalized.includes('session') || normalized.includes('jwt')) return '重置链接无效或已经过期，请返回登录页重新申请。'
  if (normalized.includes('password should be at least')) return '密码至少需要 6 位字符。'
  return `密码更新失败：${message}`
}

export function PasswordRecovery({ initialError, onComplete, onCancel }: PasswordRecoveryProps) {
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
        setMessage(passwordErrorMessage(error.message))
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
        {initialError ? (
          <div className="recovery-link-error" role="alert">
            <AlertTriangle size={19} />
            <div><b>无法使用这个重置链接</b><p>{passwordErrorMessage(initialError)}</p></div>
          </div>
        ) : (
          <>
            <p className="muted">请输入至少 6 位的新密码。更新成功后会自动打开你的账本。</p>
            <form onSubmit={submit}>
              <label>新密码<input type="password" minLength={6} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
              <label>确认新密码<input type="password" minLength={6} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label>
              {message && <p className="form-message" role="status"><CheckCircle2 size={15} />{message}</p>}
              <button className="primary-button" disabled={saving}>{saving ? '保存中…' : '更新密码'}</button>
            </form>
          </>
        )}
        <button type="button" className="recovery-back" onClick={() => void onCancel()}>{initialError ? '返回登录并重新申请' : '返回登录'}</button>
      </section>
    </main>
  )
}
