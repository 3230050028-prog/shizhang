import { useMemo, useState, type ChangeEvent } from 'react'
import { CheckCircle2, FileArchive, FileSpreadsheet, KeyRound, Upload, X } from 'lucide-react'
import { readPaymentStatement, transactionFingerprint, ZipPasswordRequiredError, type ParsedPaymentRow } from '../lib/paymentImport'
import type { ActionResult, Transaction, TransactionInput } from '../types'

interface PaymentImportProps {
  transactions: Transaction[]
  onClose: () => void
  onImport: (rows: TransactionInput[], onProgress?: (completed: number) => void) => Promise<ActionResult>
}

const money = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' })

export function PaymentImport({ transactions, onClose, onImport }: PaymentImportProps) {
  const [fileName, setFileName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [zipPassword, setZipPassword] = useState('')
  const [needsPassword, setNeedsPassword] = useState(false)
  const [rows, setRows] = useState<ParsedPaymentRow[]>([])
  const [skipped, setSkipped] = useState(0)
  const [duplicates, setDuplicates] = useState(0)
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [imported, setImported] = useState<number | null>(null)
  const existing = useMemo(
    () => new Set(transactions.map(transactionFingerprint)),
    [transactions],
  )

  const loadFile = async (file: File, password?: string) => {
    setError('')
    setImported(null)
    try {
      const result = await readPaymentStatement(file, password)
      const seen = new Set(existing)
      let duplicateCount = 0
      const uniqueRows = result.rows.filter((row) => {
        const fingerprint = transactionFingerprint(row)
        if (seen.has(fingerprint)) {
          duplicateCount += 1
          return false
        }
        seen.add(fingerprint)
        return true
      })
      setRows(uniqueRows.slice(0, 500))
      setSkipped(result.skipped + Math.max(0, uniqueRows.length - 500))
      setDuplicates(duplicateCount)
      setNeedsPassword(false)
      if (!uniqueRows.length) setError('没有发现可导入的新记录，可能都已经导入过了。')
    } catch (reason) {
      setRows([])
      setSkipped(0)
      setDuplicates(0)
      if (reason instanceof ZipPasswordRequiredError) {
        setNeedsPassword(true)
      } else {
        setError(reason instanceof Error ? reason.message : '账单读取失败，请重新选择文件。')
      }
    }
  }

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setSelectedFile(file)
    setZipPassword('')
    setNeedsPassword(false)
    void loadFile(file)
  }

  const unlockZip = () => {
    if (!selectedFile || !zipPassword.trim()) {
      setError('请输入压缩包密码。')
      return
    }
    void loadFile(selectedFile, zipPassword)
  }

  const importRows = async () => {
    setImporting(true)
    setImportProgress(0)
    setError('')
    const inputs = rows.map(({ sourceLine: _sourceLine, ...input }) => input)
    const result = await onImport(inputs, setImportProgress)
    if (!result.ok) {
      setError(result.error ?? '保存失败，请稍后重试。')
      setImporting(false)
      return
    }
    setImported(inputs.length)
    setImporting(false)
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="transaction-modal import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><p className="eyebrow">减少手动录入</p><h2 id="import-title">导入支付账单</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭"><X size={20} /></button>
        </header>

        {imported !== null ? (
          <div className="import-success">
            <CheckCircle2 size={42} />
            <h3>成功导入 {imported} 笔</h3>
            <p>重复记录已自动跳过，账本统计已经更新。</p>
            <button className="primary-button" onClick={onClose}>查看账本</button>
          </div>
        ) : (
          <>
            <label className="file-drop">
              {fileName.toLowerCase().endsWith('.zip') ? <FileArchive size={30} /> : <FileSpreadsheet size={30} />}
              <strong>{fileName || '选择支付宝或微信账单'}</strong>
              <span>支持 CSV、TXT、Excel（XLSX）或 ZIP，最多一次导入 500 笔</span>
              <input type="file" accept=".csv,.txt,.xlsx,.zip,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip" onChange={chooseFile} />
            </label>

            {needsPassword && (
              <div className="zip-password">
                <span><KeyRound size={18} /></span>
                <div>
                  <b>压缩包需要密码</b>
                  <small>输入支付软件在邮件中提供的解压密码，只用于本机读取。</small>
                  <div>
                    <input type="password" value={zipPassword} onChange={(event) => setZipPassword(event.target.value)} placeholder="输入解压密码" />
                    <button type="button" onClick={unlockZip}>解压并读取</button>
                  </div>
                </div>
              </div>
            )}

            {(rows.length > 0 || skipped > 0 || duplicates > 0) && (
              <div className="import-summary">
                <span><b>{rows.length}</b> 笔待导入</span>
                <span><b>{duplicates}</b> 笔重复</span>
                <span><b>{skipped}</b> 行已忽略</span>
              </div>
            )}

            {rows.length > 0 && (
              <div className="import-preview">
                <p>预览前 {Math.min(rows.length, 5)} 笔</p>
                {rows.slice(0, 5).map((row) => (
                  <div key={`${row.sourceLine}-${transactionFingerprint(row)}`}>
                    <span><b>{row.note || row.category}</b><small>{row.occurred_on} · {row.category} · {row.account}</small></span>
                    <strong className={row.type}>{row.type === 'income' ? '+' : '-'}{money.format(row.amount)}</strong>
                  </div>
                ))}
              </div>
            )}

            {error && <p className="inline-error">{error}</p>}
            <p className="import-note">文件会在当前设备中读取，原文件和压缩包密码不会上传。确认导入前不会修改任何数据。</p>
            {importing && (
              <div className="import-progress" role="status">
                <span><i style={{ width: `${rows.length ? (importProgress / rows.length) * 100 : 0}%` }} /></span>
                <small>正在保存 {importProgress} / {rows.length} 笔，请不要关闭页面</small>
              </div>
            )}
            <button className="primary-button modal-submit" disabled={!rows.length || importing} onClick={() => void importRows()}>
              <Upload size={18} />{importing ? `正在导入 ${importProgress} / ${rows.length}` : `确认导入 ${rows.length} 笔`}
            </button>
          </>
        )}
      </section>
    </div>
  )
}
