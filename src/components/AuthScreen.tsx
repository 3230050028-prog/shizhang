import { useState, type FormEvent } from 'react'
import { ArrowRight, CheckCircle2, Eye, EyeOff, Leaf } from 'lucide-react'
import { supabase } from '../lib/supabase'

export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return

    setLoading(true)
    setMessage('')

    let result
    try {
      result = mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })
    } catch {
      setLoading(false)
      setMessage('网络连接失败，请检查网络后重试。')
      return
    }

    setLoading(false)
    if (result.error) {
      setMessage(result.error.message)
      return
    }

    if (mode === 'register' && !result.data.session) {
      setMessage('注册成功！请前往邮箱完成验证，然后回来登录。')
    }
  }

  const requestPasswordReset = async () => {
    if (!supabase) return
    if (!email.trim()) {
      setMessage('请先填写注册时使用的邮箱。')
      return
    }
    setLoading(true)
    setMessage('')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).toString(),
      })
      setMessage(error ? error.message : '重置邮件已发送，请检查邮箱。')
    } catch {
      setMessage('网络连接失败，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = () => {
    setMode((current) => (current === 'login' ? 'register' : 'login'))
    setMessage('')
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        <a className="brand brand-on-dark" href={import.meta.env.BASE_URL} aria-label="拾账首页">
          <span className="brand-mark"><Leaf size={20} /></span>
          <span>拾账</span>
        </a>
        <div className="auth-story-copy">
          <p className="eyebrow">让每一笔，都清清楚楚</p>
          <h1>认真生活，<br />从记录开始。</h1>
          <p>一个简单、安心的个人账本。看见钱的去向，也看见生活的方向。</p>
          <ul>
            <li><CheckCircle2 size={18} /> 独立账本，保护个人隐私</li>
            <li><CheckCircle2 size={18} /> 自动统计，收支一目了然</li>
            <li><CheckCircle2 size={18} /> 多设备同步，随时随地记账</li>
          </ul>
        </div>
        <p className="auth-quote">“省下来的每一元，都是未来的一点自由。”</p>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="mobile-brand">
            <span className="brand-mark"><Leaf size={18} /></span>
            <span>拾账</span>
          </div>
          <p className="eyebrow">{mode === 'login' ? '欢迎回来' : '创建新账本'}</p>
          <h2>{mode === 'login' ? '登录你的账本' : '注册拾账账号'}</h2>
          <p className="muted">
            {mode === 'login' ? '继续记录今天的生活' : '只需邮箱和密码即可开始'}
          </p>

          <form onSubmit={submit}>
            <label>
              邮箱
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              密码
              <span className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="至少 6 位字符"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  className="icon-button password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>

            {mode === 'login' && (
              <button className="forgot-button" type="button" onClick={requestPasswordReset} disabled={loading}>忘记密码？</button>
            )}

            {message && <p className="form-message">{message}</p>}

            <button className="primary-button auth-submit" disabled={loading}>
              {loading ? '请稍候…' : mode === 'login' ? '登录' : '创建账号'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <p className="auth-switch">
            {mode === 'login' ? '还没有账号？' : '已经有账号？'}
            <button type="button" onClick={switchMode}>
              {mode === 'login' ? '免费注册' : '返回登录'}
            </button>
          </p>
        </div>
      </section>
    </main>
  )
}
