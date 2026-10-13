alter table public.ai_provider_configs
  drop constraint if exists ai_provider_configs_provider_check;

alter table public.ai_provider_configs
  add constraint ai_provider_configs_provider_check
  check (provider in ('openai', 'deepseek', 'qwen', 'moonshotai-cn', 'openrouter', 'kimi-coding'));
