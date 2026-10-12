import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { aiProviders } from '../src/lib/ai'

describe('AI model configuration catalog', () => {
  it('keeps provider ids unique and exposes a secure key-management link', () => {
    const ids = aiProviders.map((provider) => provider.id)

    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(expect.arrayContaining([
      'deepseek',
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

  it('allows only the Edge Function service role to manage encrypted AI credentials', () => {
    const migration = readFileSync(new URL('../supabase/migrations/004_ai_provider_configs.sql', import.meta.url), 'utf8')

    expect(migration).toContain('revoke all on table public.ai_provider_configs from anon, authenticated;')
    expect(migration).toContain('grant select, insert, update, delete on table public.ai_provider_configs to service_role;')
    expect(migration).toContain('revoke all on table public.ai_usage_logs from anon, authenticated;')
    expect(migration).toContain('grant insert on table public.ai_usage_logs to service_role;')
  })
})
