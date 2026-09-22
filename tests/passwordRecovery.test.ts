import { describe, expect, it } from 'vitest'
import {
  buildPasswordRecoveryRedirect,
  clearPasswordRecoveryRequest,
  readPasswordRecoveryRequest,
} from '../src/lib/passwordRecovery'

describe('密码找回链接', () => {
  it('生成带恢复标记的 GitHub Pages 回调地址', () => {
    expect(buildPasswordRecoveryRedirect('https://example.github.io', '/shizhang/'))
      .toBe('https://example.github.io/shizhang/?recovery=1')
  })

  it('即使 Supabase 已清理令牌，也能通过回调标记进入重置页', () => {
    expect(readPasswordRecoveryRequest('https://example.github.io/shizhang/?recovery=1').requested).toBe(true)
  })

  it('兼容旧邮件链接中的 recovery 类型', () => {
    const request = readPasswordRecoveryRequest('https://example.github.io/shizhang/#access_token=token&type=recovery')
    expect(request.requested).toBe(true)
  })

  it('读取过期提示，并在完成后清除敏感回调参数', () => {
    const href = 'https://example.github.io/shizhang/?recovery=1#error=access_denied&error_description=Email+link+is+invalid+or+has+expired&type=recovery'
    expect(readPasswordRecoveryRequest(href).error).toBe('Email link is invalid or has expired')
    expect(clearPasswordRecoveryRequest(href)).toBe('/shizhang/')
  })
})
