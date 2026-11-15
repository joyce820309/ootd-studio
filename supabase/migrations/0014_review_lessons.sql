-- 踩雷覆盤與提醒規則：保存單品評價、我的體感、AI 覆盤，以及可重複觸發的規則。
create table public.review_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null,
  item_name text not null check (length(btrim(item_name)) between 1 and 200),
  brand text,
  size text,
  material text,
  price numeric(10,2),
  purchase_date date,
  decision text not null default 'returned' check (decision in ('returned', 'kept', 'not_worn', 'given_away')),
  reasons text[] not null default '{}',
  personal_note text[] not null default '{}',
  ai_summary text[] not null default '{}',
  lesson_rules jsonb not null default '[]'::jsonb check (jsonb_typeof(lesson_rules) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lesson_rules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  scope text not null check (length(btrim(scope)) between 1 and 80),
  text text not null check (length(btrim(text)) between 1 and 220),
  why text not null check (length(btrim(why)) between 1 and 500),
  active boolean not null default true,
  accent text not null default 'oat' check (accent in ('oat', 'mist', 'sage', 'rose')),
  source_review_id uuid references public.review_records (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.review_records enable row level security;
alter table public.lesson_rules enable row level security;

create policy "own review records" on public.review_records
for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "own lesson rules" on public.lesson_rules
for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create index review_records_owner_item_idx on public.review_records (owner_id, item_id);
create index review_records_owner_created_idx on public.review_records (owner_id, created_at desc);
create index lesson_rules_owner_active_idx on public.lesson_rules (owner_id, active, created_at desc);

create or replace function public.set_review_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger review_records_updated_at
before update on public.review_records
for each row
execute function public.set_review_updated_at();

-- 讓既有設計中的 review record 可由 app 直接使用，不要求額外資料表關聯。
create index review_records_owner_decision_idx on public.review_records (owner_id, decision);
