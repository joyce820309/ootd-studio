-- 衣櫃與選購清單共用特徵標籤：名稱與維度以 JSONB 快照保存，管理清單提供別名與適用類型。
create table public.garment_features (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 40),
  dimension text not null check (dimension in ('waist', 'silhouette', 'shoulder', 'texture', 'detail', 'occasion')),
  aliases text[] not null default '{}',
  applicable_types text[] not null default '{}',
  sort_order integer not null default 100,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (owner_id, name)
);

alter table public.items
  add column feature_tags jsonb not null default '[]'::jsonb,
  add column feature_suggestions_dismissed text[] not null default '{}',
  add constraint items_feature_tags_is_array check (jsonb_typeof(feature_tags) = 'array');

alter table public.wishlist_items
  add column feature_tags jsonb not null default '[]'::jsonb,
  add column feature_suggestions_dismissed text[] not null default '{}',
  add constraint wishlist_items_feature_tags_is_array check (jsonb_typeof(feature_tags) = 'array');

alter table public.garment_features enable row level security;
create policy "own garment features" on public.garment_features
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

comment on table public.garment_features is '衣櫃與選購清單共用的特徵字典；維度固定，名稱、別名及適用類型由使用者管理。';
comment on column public.garment_features.applicable_types is '適用衣物類型鍵，例如 bottom:pants；空陣列表示全部類型。';
comment on column public.items.feature_tags is '已確認的特徵快照：[{name, dimension}]；虛線的名稱建議不會存入。';
comment on column public.wishlist_items.feature_tags is '已確認的特徵快照：[{name, dimension}]；虛線的名稱建議不會存入。';
comment on column public.items.feature_suggestions_dismissed is '使用者曾取消的名稱特徵建議，避免同一件衣物重複提示。';
comment on column public.wishlist_items.feature_suggestions_dismissed is '使用者曾取消的名稱特徵建議，避免同一商品重複提示。';

create index items_owner_feature_tags_gin on public.items using gin (feature_tags);
create index wishlist_owner_feature_tags_gin on public.wishlist_items using gin (feature_tags);

-- 改名、合併或刪除特徵時，同步更新本人衣物與選購候選的快照。
create or replace function public.replace_garment_feature_tags(
  p_from text[],
  p_to text default null,
  p_to_dimension text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_to text := nullif(btrim(coalesce(p_to, '')), '');
  v_dimension text := nullif(btrim(coalesce(p_to_dimension, '')), '');
  v_items uuid[] := '{}';
  v_wishes uuid[] := '{}';
  v_rows uuid[];
begin
  if p_from is null or cardinality(p_from) = 0 then raise exception '沒有要處理的特徵'; end if;
  if v_to is not null then
    if v_dimension is null or v_dimension not in ('waist', 'silhouette', 'shoulder', 'texture', 'detail', 'occasion') then
      raise exception '特徵維度不正確';
    end if;
    if exists (select 1 from public.garment_features where owner_id = auth.uid() and name = v_to and dimension <> v_dimension) then
      raise exception '只能合併到相同維度的特徵';
    end if;
    if exists (select 1 from public.garment_features where owner_id = auth.uid() and name = any(p_from) and dimension <> v_dimension) then
      raise exception '只能合併相同維度的特徵';
    end if;
  end if;

  with changed as (
    update public.items as item
    set feature_tags = coalesce((
      select jsonb_agg(distinct transformed.value order by transformed.value)
      from (
        select case
          when tag.value ->> 'name' = any(p_from) then
            case when v_to is null then null else jsonb_build_object('name', v_to, 'dimension', v_dimension) end
          else tag.value
        end as value
        from jsonb_array_elements(item.feature_tags) as tag(value)
      ) as transformed
      where transformed.value is not null
    ), '[]'::jsonb)
    where item.owner_id = auth.uid()
      and exists (select 1 from jsonb_array_elements(item.feature_tags) tag(value) where tag.value ->> 'name' = any(p_from))
    returning item.id
  ) select coalesce(array_agg(id), '{}') into v_items from changed;

  with changed as (
    update public.wishlist_items as item
    set feature_tags = coalesce((
      select jsonb_agg(distinct transformed.value order by transformed.value)
      from (
        select case
          when tag.value ->> 'name' = any(p_from) then
            case when v_to is null then null else jsonb_build_object('name', v_to, 'dimension', v_dimension) end
          else tag.value
        end as value
        from jsonb_array_elements(item.feature_tags) as tag(value)
      ) as transformed
      where transformed.value is not null
    ), '[]'::jsonb)
    where item.owner_id = auth.uid()
      and exists (select 1 from jsonb_array_elements(item.feature_tags) tag(value) where tag.value ->> 'name' = any(p_from))
    returning item.id
  ) select coalesce(array_agg(id), '{}') into v_wishes from changed;

  return jsonb_build_object('items', to_jsonb(v_items), 'wishes', to_jsonb(v_wishes));
end
$$;
