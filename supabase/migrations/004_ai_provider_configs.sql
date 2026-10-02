

-- AI 模型连接仅由认证后的 Edge Function 读取。
-- 不向浏览器开放表权限，避免加密后的凭据被下载或篡改。
create table if not exists public.ai_provider_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('openai', 'deepseek', 'moonshotai-cn', 'openrouter', 'kimi-coding')),
  model text not null check (char_length(model) between 1 and 160),
  api_key_ciphertext text not null,
  api_key_iv text not null,
  key_hint text not null check (char_length(key_hint) <= 8),
  is_default boolean not null default false,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create unique index if not exists ai_provider_configs_one_default_per_user
  on public.ai_provider_configs (user_id)
  where is_default;

create index if not exists ai_provider_configs_user_idx
  on public.ai_provider_configs (user_id, updated_at desc);

drop trigger if exists ai_provider_configs_set_updated_at on public.ai_provider_configs;
create trigger ai_provider_configs_set_updated_at
  before update on public.ai_provider_configs
  for each row execute function public.set_updated_at();

alter table public.ai_provider_configs enable row level security;
revoke all on table public.ai_provider_configs from anon, authenticated;

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  model text not null,
  feature text not null default 'ledger-chat',
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  estimated_cost numeric(14, 8),
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_logs_user_date_idx
  on public.ai_usage_logs (user_id, created_at desc);

alter table public.ai_usage_logs enable row level security;
revoke all on table public.ai_usage_logs from anon, authenticated;

