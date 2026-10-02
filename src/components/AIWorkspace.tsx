import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bot,
  Check,
  ChevronRight,
  CircleDollarSign,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  MessageCircleMore,
  PlugZap,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import {
  aiProviders,
  askLedgerAI,
  listAIConfigs,
  listAIModels,
  removeAIConfig,
  saveAIConfig,
  testAIConfig,
} from '../lib/ai'
import type { AIChatMessage, AIModelOption, AIProviderConfig, AIProviderId, AIUsage } from '../types'

interface AIWorkspaceProps {
  demo?: boolean
  onClose: () => void
}

const starterQuestions = [
  '这个月我主要把钱花在哪里？',
  '帮我找出本月可以减少的支出',
  '最近有哪些金额明显偏高的消费？',
]

const providerName = (id: AIProviderId) =>
  aiProviders.find((item) => item.id === id)?.name ?? id

export function AIWorkspace({ demo, onClose }: AIWorkspaceProps) {
  const [tab, setTab] = useState<'assistant' | 'settings'>('assistant')
  const [configs, setConfigs] = useState<AIProviderConfig[]>([])
  const [loadingConfigs, setLoadingConfigs] = useState(!demo)
  const [provider, setProvider] = useState<AIProviderId>('deepseek')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [isDefault, setIsDefault] = useState(true)
  const [models, setModels] = useState<AIModelOption[]>([])
  const [loadingModels, setLoadingModels] = useState(!demo)
  const [saving, setSaving] = useState(false)
  const [testingProvider, setTestingProvider] = useState<AIProviderId | null>(null)
  const [settingsMessage, setSettingsMessage] = useState('')
  const [settingsError, setSettingsError] = useState('')
  const [messages, setMessages] = useState<AIChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [answering, setAnswering] = useState(false)
  const [chatError, setChatError] = useState('')
  const [lastUsage, setLastUsage] = useState<AIUsage | null>(null)
  const messageEndRef = useRef<HTMLDivElement>(null)

  const selectedProvider = useMemo(
    () => aiProviders.find((item) => item.id === provider) ?? aiProviders[0],
    [provider],
  )
  const existingConfig = useMemo(
    () => configs.find((item) => item.provider === provider),
    [configs, provider],
  )
  const defaultConfig = configs.find((item) => item.isDefault) ?? configs[0]

  const reloadConfigs = async () => {
    if (demo) return
    setLoadingConfigs(true)
    try {
      setConfigs(await listAIConfigs())
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : '模型配置读取失败。')
    } finally {
      setLoadingConfigs(false)
    }
  }

  useEffect(() => {
    if (demo) return
    let active = true
    void listAIConfigs()
      .then((items) => {
        if (!active) return
        setConfigs(items)
        const preferred = items.find((item) => item.isDefault) ?? items[0]
        if (preferred) {
          setProvider(preferred.provider)
          setModel(preferred.model)
          setIsDefault(preferred.isDefault)
        }
      })
      .catch((error) => {
        if (active) setSettingsError(error instanceof Error ? error.message : '模型配置读取失败。')
      })
      .finally(() => {
        if (active) setLoadingConfigs(false)
      })
    return () => { active = false }
  }, [demo])

  useEffect(() => {
    if (demo) return
    let active = true
    void listAIModels(provider)
      .then((items) => {
        if (!active) return
        setModels(items)
        setModel((current) => current || items[0]?.id || '')
      })
      .catch((error) => {
        if (active) setSettingsError(error instanceof Error ? error.message : '模型列表读取失败。')
      })
      .finally(() => {
        if (active) setLoadingModels(false)
      })
    return () => { active = false }
  }, [demo, provider])

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [answering, messages])

  const submitConfig = async (event: React.FormEvent) => {
    event.preventDefault()
    setSettingsError('')
    setSettingsMessage('')
    if (!model.trim()) {
      setSettingsError('请先选择或填写模型名称。')
      return
    }
    if (!existingConfig && !apiKey.trim()) {
      setSettingsError('首次连接需要填写 API Key。')
      return
    }
    setSaving(true)
    try {
      const saved = await saveAIConfig({
        provider,
        model: model.trim(),
        apiKey: apiKey.trim() || undefined,
        isDefault,
      })
      await reloadConfigs()
      setApiKey('')
      setSettingsMessage(`${providerName(saved.provider)} 已安全保存。建议继续测试连接。`)
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : '模型配置保存失败。')
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async (providerId: AIProviderId) => {
    setTestingProvider(providerId)
    setSettingsError('')
    setSettingsMessage('')
    try {
      const result = await testAIConfig(providerId)
      await reloadConfigs()
      setSettingsMessage(result.message)
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : '连接测试失败。')
    } finally {
      setTestingProvider(null)
    }
  }

  const deleteConnection = async (providerId: AIProviderId) => {
    if (!window.confirm(`确定断开 ${providerName(providerId)} 吗？保存的密钥会被删除。`)) return
    setSettingsError('')
    try {
      await removeAIConfig(providerId)
      await reloadConfigs()
      setSettingsMessage(`${providerName(providerId)} 已断开。`)
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : '断开连接失败。')
    }
  }

  const sendQuestion = async (text = question) => {
    const nextQuestion = text.trim()
    if (!nextQuestion || answering) return
    const nextMessages: AIChatMessage[] = [...messages, { role: 'user', content: nextQuestion }]
    setMessages(nextMessages)
    setQuestion('')
    setChatError('')
    setAnswering(true)
    try {
      const result = await askLedgerAI(nextMessages.slice(-10))
      setMessages((current) => [...current, { role: 'assistant', content: result.answer }])
      setLastUsage(result.usage ?? null)
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'AI 暂时无法回答，请稍后重试。')
    } finally {
      setAnswering(false)
    }
  }

  return (
    <div className="modal-backdrop ai-backdrop" role="dialog" aria-modal="true" aria-label="拾账 AI 助手">
      <section className="ai-workspace">
        <header className="ai-workspace-header">
          <div className="ai-title">
            <span className="ai-orb"><Sparkles size={21} /></span>
            <div><p>拾账智能分析</p><h2>让账目给你答案</h2></div>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭 AI 助手"><X size={20} /></button>
        </header>

        <div className="ai-tabs" role="tablist">
          <button type="button" className={tab === 'assistant' ? 'active' : ''} onClick={() => setTab('assistant')}><MessageCircleMore size={17} />AI 助手</button>
          <button type="button" className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}><Settings2 size={17} />模型配置</button>
        </div>

        {tab === 'assistant' ? (
          <div className="ai-assistant-pane">
            <div className="ai-model-strip">
              <span className={defaultConfig ? 'connected' : ''}><PlugZap size={15} /></span>
              {loadingConfigs ? '正在读取模型配置…' : defaultConfig
                ? <><b>{providerName(defaultConfig.provider)}</b><small>{defaultConfig.model}</small></>
                : <><b>尚未连接模型</b><small>先完成模型配置后再开始对话</small></>}
              <button type="button" onClick={() => setTab('settings')}>{defaultConfig ? '切换' : '去配置'}<ChevronRight size={14} /></button>
            </div>

            <div className="ai-conversation" aria-live="polite">
              {!messages.length && (
                <div className="ai-welcome">
                  <span><Bot size={28} /></span>
                  <h3>想了解哪一笔花销？</h3>
                  <p>最近 12 个月的账目会发送给你选择的模型服务商用于本次回答；AI 不会替你修改或删除记录。</p>
                  <div className="ai-starters">
                    {starterQuestions.map((item) => (
                      <button key={item} type="button" disabled={!defaultConfig || answering} onClick={() => void sendQuestion(item)}>{item}<ChevronRight size={14} /></button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((message, index) => (
                <div className={`ai-message ${message.role}`} key={`${message.role}-${index}`}>
                  {message.role === 'assistant' && <span className="ai-message-avatar"><Sparkles size={15} /></span>}
                  <div>{message.content}</div>
                </div>
              ))}
              {answering && <div className="ai-message assistant"><span className="ai-message-avatar"><LoaderCircle className="spin" size={15} /></span><div className="ai-thinking">正在分析你的账目…</div></div>}
              <div ref={messageEndRef} />
            </div>

            {chatError && <p className="ai-inline-error">{chatError}</p>}
            <form className="ai-composer" onSubmit={(event) => { event.preventDefault(); void sendQuestion() }}>
              <textarea
                aria-label="向拾账 AI 提问"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void sendQuestion()
                  }
                }}
                placeholder={defaultConfig ? '例如：这个月餐饮支出为什么变多了？' : '请先配置模型'}
                disabled={!defaultConfig || answering}
                rows={2}
              />
              <button type="submit" disabled={!defaultConfig || !question.trim() || answering} aria-label="发送"><Send size={18} /></button>
            </form>
            <div className="ai-composer-meta">
              <span>AI 建议仅供参考，请以原始账目为准</span>
              {lastUsage && <span>{lastUsage.total.toLocaleString('zh-CN')} tokens{typeof lastUsage.cost === 'number' ? ` · 约 $${lastUsage.cost.toFixed(4)}` : ''}</span>}
            </div>
          </div>
        ) : (
          <div className="ai-settings-pane">
            {demo ? (
              <div className="ai-settings-empty"><ShieldCheck size={30} /><h3>登录后才能保存模型配置</h3><p>体验模式不会保存 API Key，也不会调用外部模型。</p></div>
            ) : (
              <>
                <section className="ai-config-summary">
                  <div><p className="eyebrow">已连接</p><h3>我的模型</h3></div>
                  {loadingConfigs ? <p className="ai-muted"><LoaderCircle className="spin" size={16} />正在读取…</p> : configs.length ? (
                    <div className="ai-config-list">
                      {configs.map((item) => (
                        <article key={item.id} className={item.isDefault ? 'default' : ''}>
                          <span className="ai-provider-mark">{providerName(item.provider).slice(0, 1)}</span>
                          <div><b>{providerName(item.provider)}{item.isDefault && <em>默认</em>}</b><small>{item.model} · 密钥 …{item.keyHint}</small></div>
                          <button type="button" onClick={() => void testConnection(item.provider)} disabled={testingProvider === item.provider}>{testingProvider === item.provider ? <LoaderCircle className="spin" size={15} /> : <PlugZap size={15} />}测试</button>
                          <button className="danger" type="button" onClick={() => void deleteConnection(item.provider)} aria-label={`断开 ${providerName(item.provider)}`}><Trash2 size={15} /></button>
                        </article>
                      ))}
                    </div>
                  ) : <p className="ai-muted">还没有连接任何模型。完成下方配置后即可使用 AI 助手。</p>}
                </section>

                <form className="ai-config-form" onSubmit={(event) => void submitConfig(event)}>
                  <div className="ai-config-heading"><span><KeyRound size={20} /></span><div><p className="eyebrow">安全连接</p><h3>{existingConfig ? '更新模型配置' : '连接新模型'}</h3></div></div>
                  <label>模型服务商
                    <select value={provider} onChange={(event) => {
                      const nextProvider = event.target.value as AIProviderId
                      const nextConfig = configs.find((item) => item.provider === nextProvider)
                      setProvider(nextProvider)
                      setModel(nextConfig?.model ?? '')
                      setApiKey('')
                      setIsDefault(nextConfig?.isDefault ?? configs.length === 0)
                      setModels([])
                      setLoadingModels(true)
                    }}>
                      {aiProviders.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                    <small>{selectedProvider.description}</small>
                  </label>
                  <label>模型
                    <select value={model} onChange={(event) => setModel(event.target.value)} disabled={loadingModels || !models.length}>
                      {loadingModels && <option value="">正在读取模型…</option>}
                      {!loadingModels && !models.length && <option value="">暂时没有可用模型</option>}
                      {existingConfig && !models.some((item) => item.id === existingConfig.model) && <option value={existingConfig.model}>{existingConfig.model}</option>}
                      {models.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}
                    </select>
                    <small>{models.length ? `已从统一模型目录读取 ${models.length} 个可用模型。` : '请先确认 AI 云端功能已经部署。'}</small>
                  </label>
                  <label>{selectedProvider.keyLabel}
                    <input type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={existingConfig ? `已保存密钥 …${existingConfig.keyHint}；留空则不修改` : '仅发送到拾账云端加密保存'} />
                    <small><a href={selectedProvider.keyUrl} target="_blank" rel="noreferrer">前往服务商获取密钥 <ExternalLink size={12} /></a></small>
                  </label>
                  <label className="ai-default-check"><input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} /><span><b>设为默认模型</b><small>AI 助手会优先使用这个模型</small></span></label>
                  <div className="ai-security-note"><ShieldCheck size={17} /><span>密钥经云端加密后保存，网页不会读取或显示完整密钥。提问时，相关账目会发送给所选模型服务商；调用费用和数据规则以该服务商说明为准。</span></div>
                  {settingsError && <p className="ai-inline-error">{settingsError}</p>}
                  {settingsMessage && <p className="ai-inline-success"><Check size={15} />{settingsMessage}</p>}
                  <button className="primary-button ai-save-button" type="submit" disabled={saving}>{saving ? <><LoaderCircle className="spin" size={17} />保存中…</> : <><CircleDollarSign size={17} />保存模型配置</>}</button>
                </form>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

export default AIWorkspace
