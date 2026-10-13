import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { aiProviders, friendlyGatewayError, listAIModels } from '../src/lib/ai'

const quotedValues = (text: string) => [...text.matchAll(/'([^']+)'/g)].map((match) => match[1])

describe('AI model configuration catalog', () => {
  it('keeps provider ids unique and exposes a secure key-management link', () => {
    const ids = aiProviders.map((provider) => provider.id)

    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(expect.arrayContaining([
      'deepseek',
      'qwen',
      'moonshotai-cn',
      'openrouter',
      'openai',
      'kimi-coding',
    ]))
    for (const provider of aiProviders) {
      expect(provider.keyUrl).toMatch(/^https:\/\//)
      expect(provider.keyLabel).toContain('API Key')
    }
  })

  it('offers Alibaba Cloud Qwen as a separate provider', () => {
    expect(aiProviders).toContainEqual(expect.objectContaining({
      id: 'qwen',
      name: '通义千问 / 阿里云百炼',
    }))
  })

  it('keeps Qwen models available when the remote catalog is temporarily unavailable', async () => {
    await expect(listAIModels('qwen')).resolves.toEqual([
      expect.objectContaining({ id: 'qwen-plus', provider: 'qwen' }),
      expect.objectContaining({ id: 'qwen3.8-flash', provider: 'qwen' }),
    ])
  })

  it('turns provider authentication failures into an actionable message', () => {
    expect(friendlyGatewayError('Authentication Fails, api key is invalid')).toBe(
      'API Key 无效或与当前服务商不匹配，请重新选择服务商并填写对应密钥。',
    )
  })

  it('keeps the Qwen provider and endpoints in the Edge Function catalog', () => {
    const gateway = readFileSync(new URL('../supabase/functions/ai-gateway/index.ts', import.meta.url), 'utf8')
    const migration = readFileSync(new URL('../supabase/migrations/005_add_qwen_provider.sql', import.meta.url), 'utf8')

    expect(gateway).toContain("'qwen'")
    expect(gateway).toContain('https://dashscope.aliyuncs.com/compatible-mode/v1')
    expect(gateway).toContain('https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1')
    expect(gateway).toContain('const errorMessage = (error: unknown) =>')
    expect(migration).toContain("'qwen'")
    expect(migration).toContain('ai_provider_configs_provider_check')
  })

  it('keeps frontend, Edge Function, and database provider allowlists in sync', () => {
    const gateway = readFileSync(new URL('../supabase/functions/ai-gateway/index.ts', import.meta.url), 'utf8')
    const initialMigration = readFileSync(new URL('../supabase/migrations/004_ai_provider_configs.sql', import.meta.url), 'utf8')
    const qwenMigration = readFileSync(new URL('../supabase/migrations/005_add_qwen_provider.sql', import.meta.url), 'utf8')
    const expected = aiProviders.map((provider) => provider.id).sort()
    const edgeList = gateway.match(/const allowedProviders = \[([^\]]+)] as const/)?.[1] ?? ''
    const initialList = initialMigration.match(/check \(provider in \(([^)]+)\)\)/i)?.[1] ?? ''
    const updatedList = qwenMigration.match(/check \(provider in \(([^)]+)\)\)/i)?.[1] ?? ''

    expect(quotedValues(edgeList).sort()).toEqual(expected)
    expect(quotedValues(initialList).sort()).toEqual(expected)
    expect(quotedValues(updatedList).sort()).toEqual(expected)
  })

  it('allows only the Edge Function service role to manage encrypted AI credentials', () => {
    const migration = readFileSync(new URL('../supabase/migrations/004_ai_provider_configs.sql', import.meta.url), 'utf8')

    expect(migration).toContain('revoke all on table public.ai_provider_configs from anon, authenticated;')
    expect(migration).toContain('grant select, insert, update, delete on table public.ai_provider_configs to service_role;')
    expect(migration).toContain('revoke all on table public.ai_usage_logs from anon, authenticated;')
    expect(migration).toContain('grant insert on table public.ai_usage_logs to service_role;')
    expect(migration).toContain('grant select on table public.transactions to service_role;')
  })
})
