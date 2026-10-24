import { supabase } from './supabase'
import type {
  AIChatMessage,
  AIModelOption,
  AIProviderConfig,
  AIProviderId,
  AIUsage,
} from '../types'

export const aiProviders: Array<{
  id: AIProviderId
  name: string
  description: string
  keyLabel: string
  keyUrl: string
}> = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: '国内访问方便，适合日常账本分析',
    keyLabel: 'DeepSeek API Key',
    keyUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    id: 'qwen',
    name: '通义千问 / 阿里云百炼',
    description: '使用阿里云百炼 API Key，适合中文账本分析',
    keyLabel: '百炼 API Key',
    keyUrl: 'https://help.aliyun.com/zh/model-studio/get-api-key/',
  },
  {
    id: 'moonshotai-cn',
    name: 'Kimi / 月之暗面',
    description: '使用月之暗面开放平台额度',
    keyLabel: 'Moonshot API Key',
    keyUrl: 'https://platform.moonshot.cn/console/api-keys',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: '用一个账号选择多个厂商模型',
    keyLabel: 'OpenRouter API Key',
    keyUrl: 'https://openrouter.ai/settings/keys',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: '使用 OpenAI API 账户余额，不等同于 ChatGPT 会员',
    keyLabel: 'OpenAI API Key',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'kimi-coding',
    name: 'Kimi For Coding',
    description: '使用 Kimi For Coding 订阅提供的 API Key',
    keyLabel: 'Kimi Coding API Key',
    keyUrl: 'https://www.kimi.com/code/console',
  },
]

interface GatewayResponse<T> {
  ok: boolean
  data?: T
  error?: string
}

const qwenModels: AIModelOption[] = [
  { id: 'qwen-plus', name: '千问 Plus', provider: 'qwen', contextWindow: 1_000_000, supportsImages: false },
  { id: 'qwen3.8-flash', name: '千问 3.8 Flash', provider: 'qwen', contextWindow: 1_000_000, supportsImages: false },
]

export const friendlyGatewayError = (message: string) => {
  if (/authentication fails|api key[^\n]*(invalid|incorrect)|invalid[_ ]api[_ ]key/i.test(message)) {
    return 'API Key 无效或与当前服务商不匹配，请重新选择服务商并填写对应密钥。'
  }
  if (/insufficient (balance|quota)|quota exceeded|余额不足/i.test(message)) {
    return '模型账户额度不足，请在服务商后台充值或检查可用额度。'
  }
  if (/Failed to send a request|FunctionsFetchError|Load failed|Failed to fetch/i.test(message)) {
    return '暂时无法连接 AI 服务，请检查网络或稍后重试。'
  }
  if (/404|not found/i.test(message)) {
    return 'AI 云端功能尚未部署，请先完成 Supabase 云函数配置。'
  }
  return message
}

const gatewayErrorMessage = async (error: unknown) => {
  let message = error instanceof Error ? error.message : 'AI 服务发生未知错误。'
  if (typeof error === 'object' && error && 'context' in error && error.context instanceof Response) {
    const { status } = error.context
    let code = ''
    message = `AI 服务暂时不可用（HTTP ${status}），请稍后重试。`
    try {
      const payload = await error.context.clone().json() as { error?: unknown; message?: unknown; code?: unknown }
      if (typeof payload.error === 'string' && payload.error.trim()) message = payload.error
      else if (typeof payload.message === 'string' && payload.message.trim()) message = payload.message
      if (typeof payload.code === 'string') code = payload.code
    } catch {
      // Non-JSON gateway responses still need an actionable status.
    }
    if (status === 504 || code === 'GATEWAY_TIMEOUT') return 'AI 响应超时，请稍后重试，或切换其他模型。'
    if (status === 546 || code === 'WORKER_LIMIT') return 'AI 云端触及资源限制，请稍后重试；持续出现时需要检查云端日志。'
    if (code === 'BOOT_ERROR') return 'AI 云端启动失败，需要检查云函数部署。'
    if (status === 401) return 'AI 服务未能验证登录状态，请重新登录后再试。'
  }
  return friendlyGatewayError(message)
}

async function invokeGateway<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('当前是体验模式，登录后才能配置 AI 模型。')
  const { data, error } = await supabase.functions.invoke<GatewayResponse<T>>('ai-gateway', { body })
  if (error) throw new Error(await gatewayErrorMessage(error))
  if (!data?.ok || data.data === undefined) {
    throw new Error(friendlyGatewayError(data?.error || 'AI 服务返回了无效结果。'))
  }
  return data.data
}

export const listAIConfigs = () =>
  invokeGateway<AIProviderConfig[]>({ action: 'list-configs' })

export const listAIModels = (provider: AIProviderId) =>
  provider === 'qwen'
    ? Promise.resolve(qwenModels)
    : invokeGateway<AIModelOption[]>({ action: 'list-models', provider })

export const saveAIConfig = (input: {
  provider: AIProviderId
  model: string
  apiKey?: string
  isDefault: boolean
}) => invokeGateway<AIProviderConfig>({ action: 'save-config', ...input })

export const removeAIConfig = (provider: AIProviderId) =>
  invokeGateway<{ provider: AIProviderId }>({ action: 'delete-config', provider })

export const testAIConfig = (provider: AIProviderId) =>
  invokeGateway<{ message: string; checkedAt: string }>({ action: 'test-config', provider })

export const askLedgerAI = (messages: AIChatMessage[], selectedMonth: string) =>
  invokeGateway<{ answer: string; provider: AIProviderId; model: string; usage?: AIUsage }>({
    action: 'chat',
    messages,
    selectedMonth,
  })
