import { useState } from 'react'
import { inspectAuthConnection } from '../lib/authDiagnostics'

export function AuthConnectionHelp() {
  const [checking, setChecking] = useState(false)
  const [report, setReport] = useState('')

  const check = async () => {
    if (checking) return
    setChecking(true)
    setReport('')
    try {
      setReport(await inspectAuthConnection())
    } catch {
      setReport('检测未能完成，请截图保留当前错误。')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="auth-connection-help">
      <button className="forgot-button" type="button" onClick={() => void check()} disabled={checking}>
        {checking ? '正在检测连接…' : '检测连接'}
      </button>
      {report && <div className="auth-connection-report" role="status">{report}<small>基础连接正常不代表登录成功。可将此结果截图反馈，不含密码或登录凭证。</small></div>}
    </div>
  )
}
