import { describe, expect, it } from 'vitest'
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
})
