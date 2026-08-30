-- 拾账 v1 数据库结构
-- 在 Supabase 项目的 SQL Editor 中完整运行此文件。

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount numeric(12, 2) not null check (amount > 0),
  category text not null check (char_length(category) between 1 and 30),
  note text not null default '' check (char_length(note) <= 100),
  occurred_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, occurred_on desc);

alter table public.transactions enable row level security;

revoke all on table public.transactions from anon;
grant select, insert, update, delete on table public.transactions to authenticated;

drop policy if exists "users_read_own_transactions" on public.transactions;
create policy "users_read_own_transactions"
  on public.transactions for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "users_create_own_transactions" on public.transactions;
create policy "users_create_own_transactions"
  on public.transactions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "users_update_own_transactions" on public.transactions;
create policy "users_update_own_transactions"
  on public.transactions for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "users_delete_own_transactions" on public.transactions;
create policy "users_delete_own_transactions"
  on public.transactions for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- 为第二阶段的预算功能预留安全的数据表。
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month date not null,
  category text not null default '全部',
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (user_id, month, category)
);

alter table public.budgets enable row level security;
revoke all on table public.budgets from anon;
grant select, insert, update, delete on table public.budgets to authenticated;

drop policy if exists "users_manage_own_budgets" on public.budgets;
create policy "users_manage_own_budgets"
  on public.budgets for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

