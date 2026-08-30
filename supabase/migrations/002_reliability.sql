-- 拾账 v0.2.1 安全与可靠性升级
-- 可在已经运行过 schema.sql 的项目中安全执行，不会删除账目或预算。

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  name text not null check (char_length(name) between 1 and 30),
  created_at timestamptz not null default now(),
  unique (user_id, type, name)
);

alter table public.categories enable row level security;
revoke all on table public.categories from anon;
grant select, insert, update, delete on table public.categories to authenticated;

drop policy if exists "users_manage_own_categories" on public.categories;
create policy "users_manage_own_categories"
  on public.categories for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

insert into public.categories (user_id, type, name)
select distinct user_id, type, category
from public.transactions
on conflict (user_id, type, name) do nothing;
