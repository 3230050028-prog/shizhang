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

const friendlyGatewayError = (message: string) => {
  if (/Failed to send a request|FunctionsFetchError|Load failed|Failed to fetch/i.test(message)) {
    return '暂时无法连接 AI 服务，请检查网络或稍后重试。'
  }
  if (/404|not found/i.test(message)) {
    return 'AI 云端功能尚未部署，请先完成 Supabase 云函数配置。'
  }
  return message
}

async function invokeGateway<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('当前是体验模式，登录后才能配置 AI 模型。')
  const { data, error } = await supabase.functions.invoke<GatewayResponse<T>>('ai-gateway', { body })
  if (error) throw new Error(friendlyGatewayError(error.message))
  if (!data?.ok || data.data === undefined) {
    throw new Error(friendlyGatewayError(data?.error || 'AI 服务返回了无效结果。'))
  }
  return data.data
}

export const listAIConfigs = () =>
  invokeGateway<AIProviderConfig[]>({ action: 'list-configs' })

export const listAIModels = (provider: AIProviderId) =>
  invokeGateway<AIModelOption[]>({ action: 'list-models', provider })

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

export const askLedgerAI = (messages: AIChatMessage[]) =>
  invokeGateway<{ answer: string; provider: AIProviderId; model: string; usage?: AIUsage }>({
    action: 'chat',
    messages,
  })
