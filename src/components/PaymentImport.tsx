import { useMemo, useState, type ChangeEvent } from 'react'
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  FileArchive,
  FileCheck2,
  FileSpreadsheet,
  KeyRound,
  Mail,
  Trash2,
  Search,
  Smartphone,
  CalendarClock,
  History,
  Upload,
  X,
} from 'lucide-react'
import { findDuplicateTransactionCopies, findPaymentDateCorrections, readPaymentStatement, splitPaymentRows, transactionFingerprint, ZipPasswordRequiredError, type ParsedPaymentRow, type PaymentDateCorrection } from '../lib/paymentImport'
import { readImportHistory, removeImportBatch, saveImportBatch, type ImportBatch } from '../lib/importHistory'
import { buildImportReconciliation, totalAmounts } from '../lib/importReconciliation'
import { applyRememberedCategory, buildMerchantCategoryMemory } from '../lib/merchantCategory'
import type { ActionResult, Transaction, TransactionInput } from '../types'

interface PaymentImportProps {
  transactions: Transaction[]
  onClose: () => void
  onImport: (rows: TransactionInput[], onProgress?: (completed: number) => void) => Promise<ActionResult>
  onCorrectDates: (rows: Transaction[], onProgress?: (completed: number) => void) => Promise<ActionResult>
  onDeleteDuplicates: (ids: string[], onProgress?: (completed: number) => void) => Promise<ActionResult>
}

const money = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' })

export function PaymentImport({ transactions, onClose, onImport, onCorrectDates, onDeleteDuplicates }: PaymentImportProps) {
  const [fileName, setFileName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [zipPassword, setZipPassword] = useState('')
  const [needsPassword, setNeedsPassword] = useState(false)
  const [rows, setRows] = useState<ParsedPaymentRow[]>([])
  const [sourceRows, setSourceRows] = useState<ParsedPaymentRow[]>([])
  const [duplicateRows, setDuplicateRows] = useState<ParsedPaymentRow[]>([])
  const [dateCorrections, setDateCorrections] = useState<PaymentDateCorrection<ParsedPaymentRow>[]>([])
  const [skipped, setSkipped] = useState(0)
  const [duplicates, setDuplicates] = useState(0)
  const [remembered, setRemembered] = useState(0)
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [imported, setImported] = useState<number | null>(null)
  const [correctingDates, setCorrectingDates] = useState(false)
  const [correctionProgress, setCorrectionProgress] = useState(0)
  const [correctedDates, setCorrectedDates] = useState<number | null>(null)
  const [deletingDuplicates, setDeletingDuplicates] = useState(false)
  const [deleteProgress, setDeleteProgress] = useState(0)
  const [deletedDuplicates, setDeletedDuplicates] = useState<number | null>(null)
  const [importHistory, setImportHistory] = useState<ImportBatch[]>(() => readImportHistory())
  const [undoingBatch, setUndoingBatch] = useState('')
  const [undoProgress, setUndoProgress] = useState(0)
  const [undoneImport, setUndoneImport] = useState<number | null>(null)
  const [showGuide, setShowGuide] = useState(true)
  const [showDuplicatePreview, setShowDuplicatePreview] = useState(false)
  const existing = useMemo(
    () => new Set(transactions.map(transactionFingerprint)),
    [transactions],
  )
  const merchantCategoryMemory = useMemo(() => buildMerchantCategoryMemory(transactions), [transactions])
  const duplicateCopies = useMemo(() => findDuplicateTransactionCopies(transactions), [transactions])
  const activeImportHistory = useMemo(() => {
    const existingIds = new Set(transactions.map((item) => item.id))
    return importHistory
      .map((batch) => ({ batch, ids: batch.ids.filter((id) => existingIds.has(id)) }))
      .filter(({ ids }) => ids.length > 0)
  }, [importHistory, transactions])
  const reconciliation = useMemo(
    () => buildImportReconciliation(
      sourceRows,
      rows,
      duplicateRows,
      dateCorrections.map(({ incoming }) => incoming),
    ),
    [dateCorrections, duplicateRows, rows, sourceRows],
  )

  const loadFile = async (file: File, password?: string) => {
    setError('')
    setImported(null)
    try {
      const result = await readPaymentStatement(file, password)
      setSourceRows(result.rows)
      const rememberedRows = result.rows.map((row) => applyRememberedCategory(row, merchantCategoryMemory))
      setRemembered(rememberedRows.filter((row, index) => row.category !== result.rows[index].category).length)
      const corrections = findPaymentDateCorrections(rememberedRows, transactions)
      const correctionLines = new Set(corrections.map(({ incoming }) => incoming.sourceLine))
      const { uniqueRows, duplicateRows: foundDuplicates } = splitPaymentRows(
        rememberedRows.filter((row) => !correctionLines.has(row.sourceLine)),
        existing,
      )
      setRows(uniqueRows.slice(0, 500))
      setDuplicateRows(foundDuplicates.slice(0, 500))
      setDateCorrections(corrections.slice(0, 500))
      setCorrectedDates(null)
      setSkipped(result.skipped + Math.max(0, uniqueRows.length - 500))
      setDuplicates(foundDuplicates.length)
      setShowDuplicatePreview(!uniqueRows.length && foundDuplicates.length > 0)
      setNeedsPassword(false)
      if (!uniqueRows.length && !foundDuplicates.length) setError('没有发现可导入的新记录。')
    } catch (reason) {
      setSourceRows([])
      setRows([])
      setDuplicateRows([])
      setDateCorrections([])
      setSkipped(0)
      setDuplicates(0)
      setRemembered(0)
      setShowDuplicatePreview(false)
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
    setShowGuide(false)
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
    const savedIds = result.ids ?? []
    if (savedIds.length) {
      const totals = totalAmounts(inputs)
      const batch = {
        ids: savedIds,
        fileName: fileName || '支付账单',
        importedAt: new Date().toISOString(),
        expenseAmount: totals.expense,
        incomeAmount: totals.income,
      }
      setImportHistory(saveImportBatch(batch))
      setUndoneImport(null)
    }
    setImported(result.saved ?? inputs.length)
    setImporting(false)
  }

  const undoImportBatch = async (batch: ImportBatch, ids: string[]) => {
    if (!ids.length || undoingBatch) return
    if (!window.confirm(`确定撤销 ${new Date(batch.importedAt).toLocaleString('zh-CN')} 导入的 ${ids.length} 笔记录吗？只会删除这个批次保存的账目。`)) return
    setUndoingBatch(batch.importedAt)
    setUndoProgress(0)
    setError('')
    const result = await onDeleteDuplicates(ids, setUndoProgress)
    if (!result.ok) {
      setError(result.error ?? '撤销这次导入失败，请稍后重试。')
      setUndoingBatch('')
      return
    }
    setImportHistory(removeImportBatch(batch.importedAt))
    setUndoneImport(ids.length)
    setImported(null)
    setUndoingBatch('')
  }

  const correctDates = async () => {
    setCorrectingDates(true)
    setCorrectionProgress(0)
    setError('')
    const updates = dateCorrections.map(({ existing, incoming }) => ({ ...existing, occurred_on: incoming.occurred_on }))
    const result = await onCorrectDates(updates, setCorrectionProgress)
    if (!result.ok) {
      setError(result.error ?? '日期修正失败，请稍后重试。')
      setCorrectingDates(false)
      return
    }
    setCorrectedDates(updates.length)
    setDateCorrections([])
    setRows([])
    setDuplicateRows([])
    setDuplicates(0)
    setShowDuplicatePreview(false)
    setCorrectingDates(false)
  }

  const deleteDuplicates = async () => {
    setDeletingDuplicates(true)
    setDeleteProgress(0)
    setError('')
    const ids = duplicateCopies.map((item) => item.id)
    const result = await onDeleteDuplicates(ids, setDeleteProgress)
    if (!result.ok) {
      setError(result.error ?? '重复账目删除失败，请稍后重试。')
      setDeletingDuplicates(false)
      return
    }
    setDeletedDuplicates(ids.length)
    setDeletingDuplicates(false)
  }

  const duplicateCleanupPanel = duplicateCopies.length > 0 ? (
    <div className="duplicate-cleanup-panel">
      <div className="duplicate-cleanup-heading">
        <span><Trash2 size={18} /></span>
        <div><b>发现 {duplicateCopies.length} 笔完全重复的副本</b><small>每组保留创建时间最早的一笔，下面这些后来新增的副本将被删除。</small></div>
      </div>
      <div className="duplicate-cleanup-list">
        {duplicateCopies.slice(0, 5).map((item) => (
          <div key={`cleanup-${item.id}`}>
            <span><b>{item.note || item.category}</b><small>{item.occurred_on} · {item.category}</small></span>
            <strong>{item.type === 'income' ? '+' : '-'}{money.format(item.amount)}</strong>
          </div>
        ))}
      </div>
      <button type="button" disabled={deletingDuplicates} onClick={() => void deleteDuplicates()}>
        {deletingDuplicates ? `正在删除 ${deleteProgress} / ${duplicateCopies.length}` : `删除 ${duplicateCopies.length} 笔重复副本`}
      </button>
    </div>
  ) : deletedDuplicates !== null ? (
    <p className="import-memory-note">已删除 {deletedDuplicates} 笔重复副本，每组均保留了最早的原记录。</p>
  ) : (
    <div className="duplicate-cleanup-empty">
      <Trash2 size={18} />
      <div><b>暂未发现完全相同的重复账目</b><small>你仍可在下方重新选择原账单，系统会核对并跳过已经存在的记录。</small></div>
    </div>
  )

  const importHistoryPanel = activeImportHistory.length > 0 ? (
    <section className="import-history-panel">
      <header><History size={18} /><div><b>最近导入历史</b><small>仅保存在本设备，最多显示10次；撤销只删除所选批次。</small></div></header>
      <div className="import-history-list">
        {activeImportHistory.map(({ batch, ids }) => (
          <article key={batch.importedAt}>
            <div>
              <b>{batch.fileName}</b>
              <small>
                {new Date(batch.importedAt).toLocaleString('zh-CN')} · {ids.length} 笔
                {typeof batch.expenseAmount === 'number' ? ` · 支出 ${money.format(batch.expenseAmount)}` : ''}
                {typeof batch.incomeAmount === 'number' && batch.incomeAmount > 0 ? ` · 收入 ${money.format(batch.incomeAmount)}` : ''}
              </small>
            </div>
            <button type="button" disabled={Boolean(undoingBatch)} onClick={() => void undoImportBatch(batch, ids)}>
              {undoingBatch === batch.importedAt ? `撤销中 ${undoProgress}/${ids.length}` : '撤销这次'}
            </button>
          </article>
        ))}
      </div>
    </section>
  ) : undoneImport !== null ? (
    <p className="import-memory-note">已撤销所选导入批次，共删除 {undoneImport} 笔记录。</p>
  ) : null

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="transaction-modal import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><p className="eyebrow">减少手动录入</p><h2 id="import-title">导入支付账单</h2></div>
          <div className="import-header-actions">
            <button className="import-guide-toggle" type="button" onClick={() => setShowGuide((visible) => !visible)} aria-expanded={showGuide}>
              <BookOpen size={15} />{showGuide ? '收起教程' : '导入教程'}
            </button>
            <button className="icon-button" type="button" onClick={onClose} aria-label="关闭"><X size={20} /></button>
          </div>
        </header>

        {importHistoryPanel}
        {imported === null && correctedDates === null && duplicateCleanupPanel}

        {imported !== null || correctedDates !== null ? (
          <div className="import-success">
            <CheckCircle2 size={42} />
            <h3>{imported !== null ? `成功导入 ${imported} 笔` : `已修正 ${correctedDates} 笔日期`}</h3>
            <p>{imported !== null ? '重复记录已自动跳过，账本统计已经更新。' : '日期修正已经完成，不会再显示“确认导入”。'}</p>
            {duplicateCleanupPanel}
            {error && <p className="inline-error">{error}</p>}
            <button className="primary-button" onClick={onClose}>完成并返回账本</button>
          </div>
        ) : (
          <>
            {showGuide && (
              <section className="import-guide" aria-label="账单导入教程">
                <div className="import-guide-intro">
                  <span><BookOpen size={20} /></span>
                  <div><b>第一次导入？跟着下面 4 步操作</b><small>菜单名称可能因支付软件版本略有不同，找不到时可在应用内搜索“下载账单”或“交易流水”。</small></div>
                </div>

                <div className="import-source-guide">
                  <div>
                    <strong className="wechat-dot">微信支付</strong>
                    <p>微信 → 我 → 服务 → 钱包 → 账单 → 常见问题 → 下载账单 → 用于个人对账</p>
                  </div>
                  <div>
                    <strong className="alipay-dot">支付宝</strong>
                    <p>支付宝 → 我的 → 账单 → 右上角更多 → 开具交易流水证明 → 用于个人对账</p>
                  </div>
                </div>

                <div className="import-guide-steps">
                  <article>
                    <span className="guide-step-number">1</span>
                    <div className="guide-illustration"><Smartphone size={25} /><Search size={13} /></div>
                    <b>申请账单</b>
                    <small>选择时间范围并填写自己的邮箱，提交导出申请。</small>
                  </article>
                  <ChevronRight className="guide-arrow" size={17} />
                  <article>
                    <span className="guide-step-number">2</span>
                    <div className="guide-illustration"><Mail size={25} /><FileArchive size={13} /></div>
                    <b>下载附件</b>
                    <small>到账后保存邮件里的 ZIP、CSV 或 Excel 文件；先不用手动解压。</small>
                  </article>
                  <ChevronRight className="guide-arrow" size={17} />
                  <article>
                    <span className="guide-step-number">3</span>
                    <div className="guide-illustration"><Upload size={25} /><FileSpreadsheet size={13} /></div>
                    <b>选择文件</b>
                    <small>点击下方上传区域，从“文件”或“下载”文件夹中选择账单。</small>
                  </article>
                  <ChevronRight className="guide-arrow" size={17} />
                  <article>
                    <span className="guide-step-number">4</span>
                    <div className="guide-illustration"><FileCheck2 size={25} /><CheckCircle2 size={13} /></div>
                    <b>预览并确认</b>
                    <small>核对识别数量和前几笔记录，再点击“确认导入”。</small>
                  </article>
                </div>

                <div className="import-guide-tip">
                  <b>只需要记录一笔？</b>
                  <span>请使用“记一笔”里的支付截图识别；这里适合一次导入多笔历史账单。</span>
                </div>
                <button className="import-guide-start" type="button" onClick={() => setShowGuide(false)}>我知道了，开始选择账单</button>
              </section>
            )}

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
                <button type="button" disabled={!duplicates} onClick={() => setShowDuplicatePreview((visible) => !visible)} aria-expanded={showDuplicatePreview}>
                  <b>{duplicates}</b> 笔重复<small>{duplicates ? (showDuplicatePreview ? '收起' : '查看') : ''}</small>
                </button>
                <span><b>{skipped}</b> 行已忽略</span>
              </div>
            )}
            {sourceRows.length > 0 && (
              <section className={`amount-reconciliation ${reconciliation.balanced ? 'is-balanced' : 'has-difference'}`}>
                <header>
                  <span><FileCheck2 size={18} /></span>
                  <div>
                    <b>金额核对{reconciliation.balanced ? '一致' : '有差异'}</b>
                    <small>收入和支出分别计算，避免净额互相抵消。</small>
                  </div>
                </header>
                <div className="amount-reconciliation-grid">
                  <span><b>账单有效金额</b><small>支出 {money.format(reconciliation.source.expense)} · 收入 {money.format(reconciliation.source.income)}</small></span>
                  <span><b>本次待导入</b><small>支出 {money.format(reconciliation.pending.expense)} · 收入 {money.format(reconciliation.pending.income)}</small></span>
                  <span><b>已存在或修正</b><small>支出 {money.format(reconciliation.duplicate.expense + reconciliation.corrected.expense)} · 收入 {money.format(reconciliation.duplicate.income + reconciliation.corrected.income)}</small></span>
                  <span><b>本批未覆盖</b><small>支出 {money.format(reconciliation.difference.expense)} · 收入 {money.format(reconciliation.difference.income)}</small></span>
                </div>
                {!reconciliation.balanced && <p>文件记录超过单批上限或仍有记录未归入本次处理；完成当前批次后重新选择原文件继续核对。</p>}
              </section>
            )}
            {remembered > 0 && <p className="import-memory-note">已根据你的历史账目自动归类 {remembered} 笔，导入前仍可查看预览。</p>}

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

            {showDuplicatePreview && duplicateRows.length > 0 && (
              <div className="import-preview duplicate-preview">
                <p>重复记录预览前 {Math.min(duplicateRows.length, 5)} 笔（不会再次导入）</p>
                {duplicateRows.slice(0, 5).map((row) => (
                  <div key={`duplicate-${row.sourceLine}-${transactionFingerprint(row)}`}>
                    <span><b>{row.note || row.category}</b><small>{row.occurred_on} · {row.category} · {row.account}</small></span>
                    <strong className={row.type}>{row.type === 'income' ? '+' : '-'}{money.format(row.amount)}</strong>
                  </div>
                ))}
              </div>
            )}

            {dateCorrections.length > 0 && (
              <div className="date-correction-panel">
                <div className="date-correction-heading">
                  <span><CalendarClock size={18} /></span>
                  <div><b>发现 {dateCorrections.length} 笔日期不一致</b><small>金额和商户一一对应，只会修正已有记录的日期。</small></div>
                </div>
                <div className="date-correction-list">
                  {dateCorrections.slice(0, 5).map(({ existing, incoming }) => (
                    <div key={`correction-${existing.id}`}>
                      <span><b>{existing.note || existing.category}</b><small>{existing.occurred_on} → {incoming.occurred_on}</small></span>
                      <strong>{money.format(existing.amount)}</strong>
                    </div>
                  ))}
                </div>
                <button type="button" disabled={correctingDates} onClick={() => void correctDates()}>
                  {correctingDates ? `正在修正 ${correctionProgress} / ${dateCorrections.length}` : `确认修正 ${dateCorrections.length} 笔日期`}
                </button>
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
