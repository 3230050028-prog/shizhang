export async function completeQwen(apiKey: string, model: string, prompt: string, systemPrompt: string) {
  const baseUrl = apiKey.startsWith('sk-sp-')
    ? 'https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1'
    : 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  let payload: {
    choices?: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    message?: string
    error?: { message?: string }
  }
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(100_000),
      body: JSON.stringify({
        model,
        enable_thinking: false,
        max_tokens: 2048,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
      }),
    })
    payload = await response.json()
    if (!response.ok) throw new Error(payload.error?.message || payload.message || `千问请求失败（${response.status}）。`)
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new Error('AI 响应超时，请稍后重试，或切换其他模型。')
    }
    throw error
  }
  const text = payload.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('千问没有返回文字内容。')
  return {
    text,
    usage: payload.usage ? {
      input: payload.usage.prompt_tokens ?? 0,
      output: payload.usage.completion_tokens ?? 0,
      total: payload.usage.total_tokens ?? 0,
      cost: undefined,
    } : undefined,
  }
}
