import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { AlertTriangle, ClipboardPaste, ImagePlus, ListChecks, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react'
import { defaultAccounts, expenseCategories, incomeCategories } from '../data'
import { toLocalDate } from '../lib/date'
import { applyRememberedCategory, buildMerchantCategoryMemory } from '../lib/merchantCategory'
import { transactionFingerprint } from '../lib/paymentImport'
import { parseQuickEntries, parseQuickEntry } from '../lib/quickEntry'
import { recognizePaymentImage } from '../lib/imageOcr'
import type { ActionResult, Transaction, TransactionInput, TransactionType } from '../types'

interface TransactionFormProps {
  initial?: TransactionInput
  transactions: Transaction[]
  knownCategories?: Record<TransactionType, string[]>
  knownAccounts?: string[]
  onClose: () => void
  onSave: (input: TransactionInput) => Promise<ActionResult>
  onSaveBatch: (inputs: TransactionInput[], onProgress?: (completed: number) => void) => Promise<ActionResult>
  onSaved?: (input: TransactionInput) => void
}

export function TransactionForm({ initial, transactions, knownCategories, knownAccounts, onClose, onSave, onSaveBatch, onSaved }: TransactionFormProps) {
  const [type, setType] = useState<TransactionType>(initial?.type ?? 'expense')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [category, setCategory] = useState(initial?.category ?? expenseCategories[0])
  const [customCategory, setCustomCategory] = useState('')
  const [account, setAccount] = useState(initial?.account ?? defaultAccounts[0])
  const [customAccount, setCustomAccount] = useState('')
  const [note, setNote] = useState(initial?.note ?? '')
  const [date, setDate] = useState(() => initial?.occurred_on ?? toLocalDate(new Date()))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [smartText, setSmartText] = useState('')
  const [smartMessage, setSmartMessage] = useState('')
  const [smartError, setSmartError] = useState('')
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrStatus, setOcrStatus] = useState('')
  const [ocrFileName, setOcrFileName] = useState('')
  const [ocrCandidates, setOcrCandidates] = useState<TransactionInput[]>([])
  const [ocrWarnings, setOcrWarnings] = useState<string[][]>([])
  const [ocrReviewed, setOcrReviewed] = useState(false)
  const [includeCandidates, setIncludeCandidates] = useState<boolean[]>([])
  const [keepDuplicates, setKeepDuplicates] = useState<boolean[]>([])
  const [batchResult, setBatchResult] = useState<{ saved: number; skipped: number; failed: number } | null>(null)
  const [batchSaving, setBatchSaving] = useState(false)
  const merchantCategoryMemory = useMemo(() => buildMerchantCategoryMemory(transactions), [transactions])
  const reviewIssueCount = ocrWarnings.filter((warnings) => warnings.length > 0).length
  const duplicateFlags = useMemo(() => {
    const seen = new Set(transactions.map(transactionFingerprint))
    return ocrCandidates.map((item) => {
      const fingerprint = transactionFingerprint(item)
      const duplicate = seen.has(fingerprint)
      seen.add(fingerprint)
      return duplicate
    })
  }, [ocrCandidates, transactions])
  const duplicateCount = duplicateFlags.filter(Boolean).length
  const isCandidateSelected = (index: number) => includeCandidates[index] !== false && (!duplicateFlags[index] || keepDuplicates[index])
  const selectedCandidateCount = ocrCandidates.filter((_, index) => isCandidateSelected(index)).length
  const selectedReviewIssueCount = ocrWarnings.filter((warnings, index) => isCandidateSelected(index) && warnings.length > 0).length
  const trustedCandidateCount = ocrCandidates.filter((_, index) => !duplicateFlags[index] && !(ocrWarnings[index]?.length)).length
  const defaultCategories = type === 'expense' ? expenseCategories : incomeCategories
  const categories = [...new Set([
    ...defaultCategories,
    ...(knownCategories?.[type] ?? []),
    ...(initial?.type === type ? [initial.category] : []),
  ])]
  const accounts = [...new Set([
    ...defaultAccounts,
    ...(knownAccounts ?? []),
    ...(initial?.account ? [initial.account] : []),
  ])]
  const categoriesForType = (nextType: TransactionType, currentCategory: string) => [...new Set([
    ...(nextType === 'expense' ? expenseCategories : incomeCategories),
    ...(knownCategories?.[nextType] ?? []),
    currentCategory,
  ])]

  const changeType = (nextType: TransactionType) => {
    setType(nextType)
    setCategory(nextType === 'expense' ? expenseCategories[0] : incomeCategories[0])
    setCustomCategory('')
  }

  const applySmartText = (text = smartText) => {
    setSmartError('')
    setSmartMessage('')
    setOcrCandidates([])
    setOcrWarnings([])
    setOcrReviewed(false)
    setIncludeCandidates([])
    setKeepDuplicates([])
    setBatchResult(null)
    try {
      const result = parseQuickEntry(text, account, new Date())
      const input = applyRememberedCategory(result.input, merchantCategoryMemory)
      const remembered = input.category !== result.input.category
      setType(input.type)
      setAmount(String(input.amount))
      setCategory(input.category)
      setAccount(input.account)
      setNote(input.note)
      setDate(input.occurred_on)
      setSmartMessage(`已识别：${result.recognized.join(' · ')}。${remembered ? `已按历史记录归类为“${input.category}”。` : '请检查后保存。'}`)
    } catch (reason) {
      setSmartError(reason instanceof Error ? reason.message : '识别失败，请调整文字后重试。')
    }
  }

  const pasteFromClipboard = async () => {
    setSmartError('')
    try {
      const text = await navigator.clipboard.readText()
      if (!text.trim()) throw new Error('剪贴板中没有文字。')
      setSmartText(text)
      applySmartText(text)
    } catch (reason) {
      setSmartError(reason instanceof Error && reason.message === '剪贴板中没有文字。'
        ? reason.message
        : '浏览器不允许自动读取剪贴板，请长按输入框后选择“粘贴”。')
    }
  }

  const scanScreenshot = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setSmartError('请选择 PNG、JPG 或 HEIC 等图片文件。')
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      setSmartError('图片超过 15MB，请先裁剪或压缩后再识别。')
      return
    }

    setOcrLoading(true)
    setOcrProgress(1)
    setOcrStatus('正在读取截图')
    setOcrFileName(file.name)
    setSmartError('')
    setSmartMessage('')
    setOcrCandidates([])
    setOcrWarnings([])
    setOcrReviewed(false)
    setIncludeCandidates([])
    setKeepDuplicates([])
    setBatchResult(null)
    try {
      const text = await recognizePaymentImage(file, (progress, status) => {
        setOcrProgress(progress)
        setOcrStatus(status)
      })
      setSmartText(text)
      const parsedResults = parseQuickEntries(text, account, new Date())
      const rememberedCount = parsedResults.filter((result) => applyRememberedCategory(result.input, merchantCategoryMemory).category !== result.input.category).length
      const results = parsedResults.map((result) => ({
        ...result,
        input: applyRememberedCategory(result.input, merchantCategoryMemory),
      }))
      if (results.length > 1) {
        setOcrCandidates(results.map((result) => result.input))
        setOcrWarnings(results.map((result) => result.warnings))
        setOcrReviewed(false)
        setIncludeCandidates(results.map(() => true))
        setKeepDuplicates(results.map(() => false))
        setSmartMessage(`从截图中识别到 ${results.length} 笔账目${rememberedCount ? `，${rememberedCount} 笔已使用历史分类` : ''}，请逐笔检查后批量保存。`)
      } else if (results.length === 1) {
        const result = results[0]
        const duplicate = transactions.some((item) => transactionFingerprint(item) === transactionFingerprint(result.input))
        if (duplicate || result.warnings.length > 0) {
          setOcrCandidates([result.input])
          setOcrWarnings([result.warnings])
          setIncludeCandidates([true])
          setKeepDuplicates([false])
          setOcrReviewed(false)
          setSmartMessage(duplicate
            ? '这笔账目疑似已经存在，默认不会重复保存。'
            : '这笔账目有需要核对的内容，请确认后再保存。')
        } else {
          setOcrCandidates([])
          setOcrWarnings([])
          setType(result.input.type)
          setAmount(String(result.input.amount))
          setCategory(result.input.category)
          setAccount(result.input.account)
          setNote(result.input.note)
          setDate(result.input.occurred_on)
          setSmartMessage(`已识别：${result.recognized.join(' · ')}。${result.warnings.length ? `请注意：${result.warnings.join('；')}。` : '请检查后保存。'}`)
        }
      } else {
        setSmartError('没有识别到可保存的明细，请避免只截取收入、支出合计区域。')
      }
    } catch (reason) {
      setSmartError(reason instanceof Error ? reason.message : '截图识别失败，请换一张清晰截图重试。')
    } finally {
      setOcrLoading(false)
    }
  }

  const updateOcrCandidate = (index: number, patch: Partial<TransactionInput>) => {
    setOcrCandidates((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))
    setOcrWarnings((current) => current.map((warnings, itemIndex) => itemIndex === index
      ? warnings.filter((warning) => {
        if (patch.occurred_on && warning.includes('日期')) return false
        if (patch.note?.trim() && warning.includes('商户')) return false
        if (patch.amount !== undefined && patch.amount < 5000 && warning.includes('金额较大')) return false
        return true
      })
      : warnings))
    setOcrReviewed(false)
    setKeepDuplicates((current) => current.map((keep, itemIndex) => itemIndex === index ? false : keep))
    setBatchResult(null)
  }

  const removeOcrCandidate = (index: number) => {
    setOcrCandidates((current) => current.filter((_, itemIndex) => itemIndex !== index))
    setOcrWarnings((current) => current.filter((_, itemIndex) => itemIndex !== index))
    setIncludeCandidates((current) => current.filter((_, itemIndex) => itemIndex !== index))
    setKeepDuplicates((current) => current.filter((_, itemIndex) => itemIndex !== index))
    setOcrReviewed(false)
    setBatchResult(null)
  }

  const saveOcrCandidates = async () => {
    const selected = ocrCandidates.filter((_, index) => isCandidateSelected(index))
    if (!ocrCandidates.length || selected.some((item) => !item.amount || !item.occurred_on)) {
      setSmartError('请检查每笔账目的金额和日期。')
      return
    }
    if (selectedReviewIssueCount > 0 && !ocrReviewed) {
      setSmartError('请先检查标记的账目，并勾选“我已核对”。')
      return
    }
    const skipped = ocrCandidates.length - selected.length
    if (!selected.length) {
      setSmartError('这些账目都已经存在。如确实需要再次保存，请勾选“仍然保存”。')
      return
    }
    setBatchSaving(true)
    setSmartError('')
    try {
      const result = await onSaveBatch(selected)
      const saved = result.saved ?? (result.ok ? selected.length : 0)
      const failed = result.failed ?? (result.ok ? 0 : selected.length - saved)
      setBatchResult({ saved, skipped, failed })
      if (!result.ok) {
        setSmartError(result.error ?? '批量保存失败，请稍后重试。')
        return
      }
      setSmartMessage(`处理完成：成功 ${saved} 笔，跳过重复 ${skipped} 笔。`)
    } catch (reason) {
      setSmartError(reason instanceof Error ? `批量保存失败：${reason.message}` : '批量保存失败，请稍后重试。')
    } finally {
      setBatchSaving(false)
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const numericAmount = Number(amount)
    if (!numericAmount || numericAmount <= 0) return

    setSaving(true)
    setError('')
    const input: TransactionInput = {
      type,
      amount: numericAmount,
      category: category === '自定义' ? customCategory.trim() || '其他' : category,
      account: account === '自定义账户' ? customAccount.trim() || '其他' : account,
      note: note.trim(),
      occurred_on: date,
    }
    try {
      const result = await onSave(input)
      if (!result.ok) {
        setError(result.error ?? '保存失败，请稍后重试。')
        return
      }
      onSaved?.(input)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? `保存失败：${reason.message}` : '保存失败，请稍后重试。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="transaction-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="eyebrow">快速记录</p>
            <h2 id="transaction-title">{initial ? '编辑账目' : '记一笔'}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭">
            <X size={20} />
          </button>
        </header>

        <form onSubmit={submit}>
          {!initial && (
            <section className="smart-entry">
              <div className="smart-entry-title">
                <span><Sparkles size={17} /></span>
                <div><b>半自动记账</b><small>粘贴支付通知或输入一句话，自动填好下面的表单</small></div>
              </div>
              <label className={ocrLoading ? 'ocr-upload disabled' : 'ocr-upload'}>
                <ImagePlus size={18} />
                <span><b>{ocrFileName || '选择支付截图'}</b><small>支付宝或微信付款详情截图</small></span>
                <em>{ocrLoading ? `${ocrProgress}%` : '本地识别'}</em>
                <input type="file" accept="image/*" disabled={ocrLoading} onChange={(event) => void scanScreenshot(event)} />
              </label>
              {ocrLoading && (
                <div className="ocr-progress" role="status">
                  <span><i style={{ width: `${ocrProgress}%` }} /></span>
                  <small>{ocrStatus}，请保持页面打开</small>
                </div>
              )}
              <textarea
                value={smartText}
                onChange={(event) => setSmartText(event.target.value)}
                placeholder="例如：今天午饭35元，微信支付"
                rows={3}
              />
              <div className="smart-entry-actions">
                <button className="secondary-button" type="button" onClick={() => void pasteFromClipboard()}><ClipboardPaste size={15} />粘贴通知</button>
                <button className="smart-apply" type="button" onClick={() => applySmartText()}><Sparkles size={15} />识别并填入</button>
              </div>
              {ocrCandidates.length > 0 && (
                <div className="ocr-batch-preview">
                  <div className="ocr-batch-title">
                    <span><ListChecks size={17} /></span>
                    <div><b>识别到 {ocrCandidates.length} 笔账目</b><small>金额、商户和日期都可以在保存前修改</small></div>
                  </div>
                  {reviewIssueCount > 0 && (
                    <p className="ocr-review-summary"><AlertTriangle size={14} />有 {reviewIssueCount} 笔需要重点检查，确认后再保存</p>
                  )}
                  {duplicateCount > 0 && (
                    <p className="ocr-duplicate-summary"><ShieldCheck size={14} />发现 {duplicateCount} 笔疑似重复，默认不会再次保存</p>
                  )}
                  <div className="ocr-selection-bar">
                    <span>已选 {selectedCandidateCount} / {ocrCandidates.length} 笔</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIncludeCandidates(ocrCandidates.map((_, index) => !duplicateFlags[index] && !(ocrWarnings[index]?.length)))
                        setKeepDuplicates(ocrCandidates.map(() => false))
                        setOcrReviewed(false)
                        setBatchResult(null)
                      }}
                    >只选可信 {trustedCandidateCount} 笔</button>
                    <button type="button" onClick={() => { setIncludeCandidates(ocrCandidates.map(() => true)); setBatchResult(null) }}>全选</button>
                  </div>
                  <div className="ocr-batch-list">
                    {ocrCandidates.map((item, index) => (
                      <article
                        className={[duplicateFlags[index] ? 'is-duplicate' : '', includeCandidates[index] === false ? 'is-excluded' : ''].filter(Boolean).join(' ')}
                        key={`${index}-${item.amount}-${item.occurred_on}`}
                      >
                        <div className="ocr-batch-row-title">
                          <span className={item.type}>{item.type === 'income' ? '收入' : '支出'} · {item.category} · {item.account}</span>
                          <button type="button" onClick={() => removeOcrCandidate(index)} aria-label={`删除第 ${index + 1} 笔`}><Trash2 size={14} /></button>
                        </div>
                        <label className="ocr-candidate-choice">
                          <input
                            type="checkbox"
                            checked={includeCandidates[index] !== false}
                            onChange={(event) => {
                              setIncludeCandidates((current) => current.map((included, itemIndex) => itemIndex === index ? event.target.checked : included))
                              setOcrReviewed(false)
                              setBatchResult(null)
                            }}
                          />
                          本次保存
                        </label>
                        {duplicateFlags[index] && <p className="ocr-duplicate-badge">疑似已存在</p>}
                        {ocrWarnings[index]?.map((warning) => <p className="ocr-item-warning" key={warning}><AlertTriangle size={11} />{warning}</p>)}
                        <div className="ocr-batch-fields">
                          <label>金额<input type="number" min="0.01" step="0.01" value={item.amount} onChange={(event) => updateOcrCandidate(index, { amount: Number(event.target.value) })} /></label>
                          <label>日期<input type="date" value={item.occurred_on} onChange={(event) => updateOcrCandidate(index, { occurred_on: event.target.value })} /></label>
                        </div>
                        <label>分类
                          <select value={item.category} onChange={(event) => updateOcrCandidate(index, { category: event.target.value })}>
                            {categoriesForType(item.type, item.category).map((itemCategory) => <option key={itemCategory}>{itemCategory}</option>)}
                          </select>
                        </label>
                        <label>商户或事项<input value={item.note} maxLength={100} onChange={(event) => updateOcrCandidate(index, { note: event.target.value })} /></label>
                        {duplicateFlags[index] && (
                          <label className="ocr-duplicate-choice">
                            <input
                              type="checkbox"
                              checked={Boolean(keepDuplicates[index])}
                              onChange={(event) => {
                                setKeepDuplicates((current) => current.map((keep, itemIndex) => itemIndex === index ? event.target.checked : keep))
                                setBatchResult(null)
                              }}
                            />
                            仍然保存这笔
                          </label>
                        )}
                      </article>
                    ))}
                  </div>
                  {selectedReviewIssueCount > 0 && (
                    <label className="ocr-review-confirm"><input type="checkbox" checked={ocrReviewed} onChange={(event) => setOcrReviewed(event.target.checked)} />我已核对标记的金额、日期和商户</label>
                  )}
                  {batchResult && (
                    <div className={batchResult.failed > 0 ? 'ocr-save-report has-error' : 'ocr-save-report'}>
                      <b>处理结果</b>
                      <span>成功 {batchResult.saved} 笔</span>
                      <span>跳过重复 {batchResult.skipped} 笔</span>
                      <span>失败 {batchResult.failed} 笔</span>
                    </div>
                  )}
                  <button
                    className="ocr-batch-save"
                    type="button"
                    disabled={batchSaving || (!batchResult && (selectedCandidateCount === 0 || (selectedReviewIssueCount > 0 && !ocrReviewed)))}
                    onClick={() => batchResult && batchResult.failed === 0 ? onClose() : void saveOcrCandidates()}
                  >
                    {batchSaving
                      ? '批量保存中…'
                      : batchResult && batchResult.failed === 0
                        ? '完成，查看账本'
                        : selectedCandidateCount > 0
                          ? `确认保存 ${selectedCandidateCount} 笔`
                          : '没有新账目可保存'}
                  </button>
                </div>
              )}
              {smartMessage && <p className="smart-success">{smartMessage}</p>}
              {smartError && <p className="inline-error">{smartError}</p>}
              <p className="smart-privacy"><ShieldCheck size={13} />文字和截图只在当前设备处理，不会上传；首次截图识别需要加载本地模型。</p>
            </section>
          )}

          {ocrCandidates.length === 0 && <>
          <div className="type-switch">
            <button
              type="button"
              className={type === 'expense' ? 'active expense' : ''}
              onClick={() => changeType('expense')}
            >
              支出
            </button>
            <button
              type="button"
              className={type === 'income' ? 'active income' : ''}
              onClick={() => changeType('income')}
            >
              收入
            </button>
          </div>

          <label className="amount-field">
            金额
            <span><b>¥</b><input autoFocus inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" required /></span>
          </label>

          <div className="form-grid">
            <label>
              分类
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                {categories.map((item) => <option key={item}>{item}</option>)}
                <option>自定义</option>
              </select>
            </label>
            <label>
              日期
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
            </label>
          </div>

          {category === '自定义' && (
            <label>
              自定义分类
              <input value={customCategory} onChange={(event) => setCustomCategory(event.target.value)} placeholder="例如：宠物" maxLength={12} required />
            </label>
          )}

          <label>
            支付账户
            <select value={account} onChange={(event) => setAccount(event.target.value)}>
              {accounts.map((item) => <option key={item}>{item}</option>)}
              <option>自定义账户</option>
            </select>
          </label>

          {account === '自定义账户' && (
            <label>
              自定义账户
              <input value={customAccount} onChange={(event) => setCustomAccount(event.target.value)} placeholder="例如：招商银行卡" maxLength={30} required />
            </label>
          )}

          <label>
            备注
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="这笔钱花在了哪里？（选填）" maxLength={100} />
          </label>

          {error && <p className="inline-error">{error}</p>}

          <button className="primary-button modal-submit" disabled={saving}>
            {saving ? '保存中…' : initial ? '保存修改' : '保存记录'}
          </button>
          </>}
        </form>
      </section>
    </div>
  )
}
