-- 品牌管理（/me/brands）
-- 品牌名稱仍然存在 items.brand、wishlist_items.brand 的文字欄位；
-- 這裡另外記錄：手動新增、還沒有衣物在用的品牌，以及使用者標記「不是同一個」的相似品牌組。

create table if not exists public.brands (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  primary key (owner_id, name)
);

create table if not exists public.brand_distinct_groups (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- 依字母排序後以換行串接的品牌名稱，例：'COS\nCOSS\ncos'
  group_key text not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, group_key)
);

alter table public.brands enable row level security;
alter table public.brand_distinct_groups enable row level security;

create policy "own brands" on public.brands for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own brand distinct groups" on public.brand_distinct_groups for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create index if not exists items_owner_brand_idx on public.items (owner_id, brand) where brand is not null;
create index if not exists wishlist_items_owner_brand_idx on public.wishlist_items (owner_id, brand) where brand is not null;

-- 改名／合併／刪除：把 p_from 裡的品牌一次換成 p_to（null 代表清空品牌欄位）。
-- 以呼叫者身分執行，RLS 只會動到本人的資料；回傳被改到的衣物與選購 id，給前端「復原」用。
create or replace function public.replace_brands(p_from text[], p_to text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_to text := nullif(btrim(coalesce(p_to, '')), '');
  v_items uuid[];
  v_wishes uuid[];
begin
  if p_from is null or cardinality(p_from) = 0 then
    raise exception '沒有要處理的品牌';
  end if;

  with changed as (
    update public.items set brand = v_to
    where owner_id = auth.uid() and brand = any (p_from) and brand is distinct from v_to
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_items from changed;

  with changed as (
    update public.wishlist_items set brand = v_to
    where owner_id = auth.uid() and brand = any (p_from) and brand is distinct from v_to
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_wishes from changed;

  delete from public.brands where owner_id = auth.uid() and name = any (p_from) and name is distinct from v_to;
  if v_to is not null then
    insert into public.brands (owner_id, name) values (auth.uid(), v_to) on conflict do nothing;
  end if;
  -- 合併過的組合不用再記得「不是同一個」
  delete from public.brand_distinct_groups g
  where g.owner_id = auth.uid() and exists (select 1 from unnest(p_from) f where f = any (string_to_array(g.group_key, E'\n')));

  return jsonb_build_object('items', to_jsonb(v_items), 'wishes', to_jsonb(v_wishes));
end $$;

-- 復原刪除：把剛才清空或改掉的衣物、選購改回原本的品牌名稱。
create or replace function public.restore_brand(p_name text, p_items uuid[], p_wishes uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.items set brand = p_name where owner_id = auth.uid() and id = any (coalesce(p_items, '{}'));
  update public.wishlist_items set brand = p_name where owner_id = auth.uid() and id = any (coalesce(p_wishes, '{}'));
  insert into public.brands (owner_id, name) values (auth.uid(), p_name) on conflict do nothing;
end $$;
