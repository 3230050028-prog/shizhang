-- 拾账 v0.3 支付账户升级
-- 请在 Supabase SQL Editor 中选择 Database 后完整运行。
-- 此迁移只增加字段和新表，不会删除已有账目。

alter table public.transactions
  add column if not exists account text;

update public.transactions
set account = '未分类'
where account is null or btrim(account) = '';

alter table public.transactions
  alter column account set default '未分类',
  alter column account set not null;

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.accounts enable row level security;
revoke all on table public.accounts from anon;
grant select, insert, update, delete on table public.accounts to authenticated;

drop policy if exists "users_manage_own_accounts" on public.accounts;
create policy "users_manage_own_accounts"
  on public.accounts for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

insert into public.accounts (user_id, name)
select distinct user_id, account
from public.transactions
on conflict (user_id, name) do nothing;
