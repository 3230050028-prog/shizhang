import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js'
import { authErrorMessage, watchAuthSession } from '../src/lib/authSession'

const session = { user: { id: 'user-a' }, access_token: 'test-only' } as Session

function fixture() {
  let emit: (event: AuthChangeEvent, value: Session | null) => void = () => undefined
  let resolve!: (value: { data: { session: Session | null }; error: unknown }) => void
  const pending = new Promise<{ data: { session: Session | null }; error: unknown }>((done) => { resolve = done })
  const unsubscribe = vi.fn()
  const auth = {
    getSession: vi.fn(() => pending),
    onAuthStateChange: vi.fn((callback: typeof emit) => {
      emit = callback
      return { data: { subscription: { unsubscribe } } }
    }),
  } as unknown as SupabaseClient['auth']
  const onSession = vi.fn()
  const onError = vi.fn()
  const stop = watchAuthSession(auth, onSession, onError)
  return { emit: (event: AuthChangeEvent, value: Session | null) => emit(event, value), resolve, onSession, onError, stop, unsubscribe }
}

afterEach(() => vi.useRealTimers())

describe('登录会话恢复', () => {
  it('刷新失败时显示连接错误，不把 INITIAL_SESSION null 当成退出', async () => {
    const f = fixture()
    const error = { message: 'Failed to fetch', status: 0 }
    f.emit('INITIAL_SESSION', null)
    f.resolve({ data: { session: null }, error })
    await vi.waitFor(() => expect(f.onError).toHaveBeenCalledWith(error))
    expect(f.onSession).not.toHaveBeenCalled()
    f.stop()
  })

  it('恢复有效会话或正常无会话时返回真实结果', async () => {
    for (const value of [session, null]) {
      const f = fixture()
      f.resolve({ data: { session: value }, error: null })
      await vi.waitFor(() => expect(f.onSession).toHaveBeenCalledWith(value))
      expect(f.onError).not.toHaveBeenCalled()
      f.stop()
    }
  })

  it('较早的初始化结果不能覆盖后来成功登录的会话', async () => {
    const f = fixture()
    f.emit('SIGNED_IN', session)
    f.resolve({ data: { session: null }, error: { message: 'old failure' } })
    await new Promise((done) => setTimeout(done, 0))
    expect(f.onSession).toHaveBeenCalledExactlyOnceWith(session, 'SIGNED_IN')
    expect(f.onError).not.toHaveBeenCalled()
    f.stop()
  })

  it('主动退出后，较早读取到的会话不能恢复已退出的账号', async () => {
    const f = fixture()
    f.emit('SIGNED_OUT', null)
    f.resolve({ data: { session }, error: null })
    await new Promise((done) => setTimeout(done, 0))
    expect(f.onSession).toHaveBeenCalledExactlyOnceWith(null, 'SIGNED_OUT')
    f.stop()
  })

  it('初始化超时可重试，恢复后 TOKEN_REFRESHED 会话正常生效', async () => {
    vi.useFakeTimers()
    const f = fixture()
    await vi.advanceTimersByTimeAsync(20_000)
    expect(f.onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('超时') }))
    expect(f.onSession).not.toHaveBeenCalled()
    f.emit('TOKEN_REFRESHED', session)
    expect(f.onSession).toHaveBeenCalledWith(session, 'TOKEN_REFRESHED')
    f.stop()
  })

  it('卸载后取消订阅且忽略迟到的初始化结果', async () => {
    const f = fixture()
    f.stop()
    f.resolve({ data: { session }, error: null })
    await new Promise((done) => setTimeout(done, 0))
    expect(f.unsubscribe).toHaveBeenCalledOnce()
    expect(f.onSession).not.toHaveBeenCalled()
    expect(f.onError).not.toHaveBeenCalled()
  })

  it('网络异常和失效凭证分别给出可操作的中文说明', () => {
    expect(authErrorMessage({ message: 'Failed to fetch' })).toContain('检查网络')
    expect(authErrorMessage(new Error('连接超时'))).toContain('超时')
    expect(authErrorMessage({ message: 'Invalid Refresh Token: Refresh Token Not Found' })).toContain('重新登录')
    expect(authErrorMessage({ message: 'Service Unavailable', status: 503 })).toContain('暂时不可用')
  })
})
