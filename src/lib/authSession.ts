import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js'
import { withTimeout } from './timeout'

export function watchAuthSession(
  auth: SupabaseClient['auth'],
  onSession: (session: Session | null, event?: AuthChangeEvent) => void,
  onError: (error: unknown) => void,
) {
  let active = true
  let revision = 0

  const { data: { subscription } } = auth.onAuthStateChange((event, session) => {
    // INITIAL_SESSION can be null when a refresh failed temporarily. The
    // getSession result below carries the error needed to distinguish this.
    if (!active || event === 'INITIAL_SESSION') return
    if (!session && event !== 'SIGNED_OUT') return
    revision += 1
    onSession(session, event)
  })

  const initialRevision = revision
  void withTimeout(auth.getSession(), 20_000, '连接账号服务超时，请检查网络后重试。')
    .then(({ data, error }) => {
      if (!active || revision !== initialRevision) return
      if (error) throw error
      onSession(data.session)
    })
    .catch((error: unknown) => {
      if (active && revision === initialRevision) onError(error)
    })

  return () => {
    active = false
    subscription.unsubscribe()
  }
}

export function authErrorMessage(error: unknown): string {
  const value = typeof error === 'object' && error !== null ? error as { message?: unknown; status?: number } : {}
  const message = typeof value.message === 'string' ? value.message : ''
  const normalized = message.toLowerCase()
  if (/timeout|timed out|abort|超时/.test(normalized)) return '连接账号服务超时，请检查网络后重试。'
  if (/fetch|network|load failed|offline/.test(normalized)) return '暂时无法连接账号服务，请检查网络后重试。登录信息不会因此被主动清除。'
  if (value.status && value.status >= 500) return '账号服务暂时不可用，请稍后重试。'
  if (/refresh.token|session.*(expired|missing|not found)|invalid.*jwt/.test(normalized)) return '登录状态已失效，请重新登录。其他设备退出或修改密码也可能使登录状态失效。'
  return message || '暂时无法连接账号服务，请稍后重试。'
}
