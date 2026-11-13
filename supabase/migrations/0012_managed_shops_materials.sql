-- 個人化購買通路與材質清單，商品仍保留可讀名稱以維持相容。
create table public.shops (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  kind text not null default 'other' check (kind in ('online', 'physical', 'other')),
  url text,
  created_at timestamptz not null default now(),
  primary key (owner_id, name)
);

create table public.materials (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 40),
  aliases text[] not null default '{}',
  sort_order integer not null default 100,
  is_default boolean not null default false,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (owner_id, name)
);

create table public.shop_distinct_groups (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  group_key text not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, group_key)
);

create table public.material_distinct_groups (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  group_key text not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, group_key)
);

alter table public.shops enable row level security;
alter table public.materials enable row level security;
alter table public.shop_distinct_groups enable row level security;
alter table public.material_distinct_groups enable row level security;

create policy "own shops" on public.shops for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own materials" on public.materials for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own shop distinct groups" on public.shop_distinct_groups for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own material distinct groups" on public.material_distinct_groups for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

alter table public.items add column material_percentages jsonb not null default '{}'::jsonb;
alter table public.wishlist_items add column material_percentages jsonb not null default '{}'::jsonb;

create or replace function public.valid_material_percentages(value jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  part record;
  percentage numeric;
begin
  if value is null or jsonb_typeof(value) <> 'object' then return false; end if;
  for part in select * from jsonb_each_text(value) loop
    if part.key = '' or part.value !~ '^[0-9]+([.][0-9]+)?$' then return false; end if;
    percentage := part.value::numeric;
    if percentage < 0 or percentage > 100 then return false; end if;
  end loop;
  return true;
end
$$;
alter table public.items add constraint items_material_percentages_valid check (public.valid_material_percentages(material_percentages));
alter table public.wishlist_items add constraint wishlist_material_percentages_valid check (public.valid_material_percentages(material_percentages));

create index items_owner_store_idx on public.items (owner_id, store) where store is not null;
create index wishlist_items_owner_shop_idx on public.wishlist_items (owner_id, shop);

-- 將舊購買通路名稱納入個人清單，不改動衣物或選購紀錄本身。
insert into public.shops (owner_id, name)
select owner_id, name
from (
  select owner_id, nullif(btrim(store), '') as name from public.items where store is not null
  union
  select owner_id, nullif(btrim(shop), '') as name from public.wishlist_items where shop is not null and shop <> '尚未決定'
) as existing
where name is not null
on conflict (owner_id, name) do nothing;

-- 舊衣物材質是「、」分隔清單；只回填確定為獨立選項的衣物材質名稱。
insert into public.materials (owner_id, name, sort_order)
select distinct owner_id, btrim(part), 100
from public.items cross join lateral unnest(string_to_array(coalesce(material, ''), '、')) as part
where btrim(part) <> '' and length(btrim(part)) <= 40
on conflict (owner_id, name) do nothing;

create or replace function public.replace_shop_tokens(value text, old_name text, new_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select (
    select string_agg(token, '、' order by first_order)
    from (
      select case when btrim(part) = old_name then new_name else btrim(part) end as token, min(position) as first_order
      from unnest(string_to_array(coalesce(value, ''), '、')) with ordinality as source(part, position)
      where btrim(part) <> '' and (btrim(part) <> old_name or new_name is not null)
      group by case when btrim(part) = old_name then new_name else btrim(part) end
    ) as tokens
  )
$$;

create or replace function public.replace_shops(p_from text[], p_to text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_name text;
  v_to text := nullif(btrim(coalesce(p_to, '')), '');
  v_items uuid[] := '{}';
  v_wishes uuid[] := '{}';
  v_rows uuid[];
  v_item_values jsonb := '{}'::jsonb;
  v_wish_values jsonb := '{}'::jsonb;
  v_entry jsonb;
  v_shop_metadata jsonb;
begin
  if p_from is null or cardinality(p_from) = 0 then raise exception '沒有要處理的通路'; end if;
  foreach v_name in array p_from loop
    select jsonb_build_object('kind', kind, 'url', url) into v_shop_metadata from public.shops where owner_id = auth.uid() and name = v_name;
    select coalesce(jsonb_object_agg(id::text, jsonb_build_object('store', store)), '{}'::jsonb) into v_entry from public.items where owner_id = auth.uid() and store = v_name;
    v_item_values := v_item_values || jsonb_build_object(v_name, v_entry);
    select coalesce(jsonb_object_agg(id::text, jsonb_build_object('shop', shop)), '{}'::jsonb) into v_entry from public.wishlist_items where owner_id = auth.uid() and shop = v_name;
    v_wish_values := v_wish_values || jsonb_build_object(v_name, v_entry);
    with changed as (
      update public.items set store = v_to
      where owner_id = auth.uid() and store = v_name and store is distinct from v_to
      returning id
    ) select coalesce(array_agg(id), '{}') into v_rows from changed;
    v_items := v_items || v_rows;

    with changed as (
      update public.wishlist_items set shop = coalesce(v_to, '尚未決定')
      where owner_id = auth.uid() and shop = v_name and shop is distinct from coalesce(v_to, '尚未決定')
      returning id
    ) select coalesce(array_agg(id), '{}') into v_rows from changed;
    v_wishes := v_wishes || v_rows;
  end loop;
  delete from public.shops where owner_id = auth.uid() and name = any(p_from) and name is distinct from v_to;
  if v_to is not null then insert into public.shops (owner_id, name) values (auth.uid(), v_to) on conflict do nothing; end if;
  delete from public.shop_distinct_groups g where g.owner_id = auth.uid() and exists (
    select 1 from unnest(p_from) f where f = any(string_to_array(g.group_key, E'\n'))
  );
  return jsonb_build_object('items', to_jsonb(v_items), 'wishes', to_jsonb(v_wishes), 'item_values', v_item_values, 'wish_values', v_wish_values, 'entry', coalesce(v_shop_metadata, '{}'::jsonb));
end
$$;

create or replace function public.restore_shop(p_name text, p_items jsonb, p_wishes jsonb, p_entry jsonb default '{}'::jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_value text;
  v_kind text := coalesce(p_entry ->> 'kind', 'other');
  v_url text := p_entry ->> 'url';
begin
  for v_id, v_value in select key::uuid, value #>> '{}' from jsonb_each(coalesce(p_items, '{}'::jsonb)) loop
    update public.items set store = v_value where owner_id = auth.uid() and id = v_id;
  end loop;
  for v_id, v_value in select key::uuid, value #>> '{}' from jsonb_each(coalesce(p_wishes, '{}'::jsonb)) loop
    update public.wishlist_items set shop = v_value where owner_id = auth.uid() and id = v_id;
  end loop;
  insert into public.shops (owner_id, name, kind, url) values (auth.uid(), p_name, v_kind, v_url)
  on conflict (owner_id, name) do update set kind = excluded.kind, url = excluded.url;
end
$$;

create or replace function public.replace_materials(p_from text[], p_to text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_name text;
  v_to text := nullif(btrim(coalesce(p_to, '')), '');
  v_items uuid[] := '{}';
  v_wishes uuid[] := '{}';
  v_rows uuid[];
  v_item_values jsonb := '{}'::jsonb;
  v_wish_values jsonb := '{}'::jsonb;
  v_material_metadata jsonb;
  v_entry jsonb;
begin
  if p_from is null or cardinality(p_from) = 0 then raise exception '沒有要處理的材質'; end if;
  foreach v_name in array p_from loop
    select jsonb_build_object('aliases', aliases, 'sort_order', sort_order, 'is_default', is_default, 'is_hidden', is_hidden)
      into v_material_metadata from public.materials where owner_id = auth.uid() and name = v_name;
    select coalesce(jsonb_object_agg(id::text, jsonb_build_object('material', material, 'percentages', material_percentages)), '{}'::jsonb)
      into v_entry from public.items where owner_id = auth.uid() and (
        v_name = any(string_to_array(coalesce(material, ''), '、')) or material_percentages ? v_name
      );
    v_item_values := v_item_values || jsonb_build_object(v_name, v_entry);
    select coalesce(jsonb_object_agg(id::text, jsonb_build_object('material', material, 'percentages', material_percentages)), '{}'::jsonb)
      into v_entry from public.wishlist_items where owner_id = auth.uid() and (
        v_name = any(string_to_array(coalesce(material, ''), '、')) or material_percentages ? v_name
      );
    v_wish_values := v_wish_values || jsonb_build_object(v_name, v_entry);
    with changed as (
      update public.items set
        material = public.replace_shop_tokens(material, v_name, v_to),
        material_percentages = case
          when v_to is null then coalesce(material_percentages, '{}'::jsonb) - v_name
          when material_percentages ? v_name then jsonb_set(
            coalesce(material_percentages, '{}'::jsonb) - v_name,
            array[v_to],
            to_jsonb(least(100, coalesce((material_percentages ->> v_to)::numeric, 0) + (material_percentages ->> v_name)::numeric)), true
          )
          else coalesce(material_percentages, '{}'::jsonb)
        end
      where owner_id = auth.uid() and (
        v_name = any(string_to_array(coalesce(material, ''), '、')) or material_percentages ? v_name
      )
      returning id
    ) select coalesce(array_agg(id), '{}') into v_rows from changed;
    v_items := v_items || v_rows;

    with changed as (
      update public.wishlist_items set
        material = public.replace_shop_tokens(material, v_name, v_to),
        material_percentages = case
          when v_to is null then coalesce(material_percentages, '{}'::jsonb) - v_name
          when material_percentages ? v_name then jsonb_set(
            coalesce(material_percentages, '{}'::jsonb) - v_name,
            array[v_to],
            to_jsonb(least(100, coalesce((material_percentages ->> v_to)::numeric, 0) + (material_percentages ->> v_name)::numeric)), true
          )
          else coalesce(material_percentages, '{}'::jsonb)
        end
      where owner_id = auth.uid() and (
        v_name = any(string_to_array(coalesce(material, ''), '、')) or material_percentages ? v_name
      )
      returning id
    ) select coalesce(array_agg(id), '{}') into v_rows from changed;
    v_wishes := v_wishes || v_rows;
  end loop;

  update public.materials set is_hidden = true where owner_id = auth.uid() and name = any(p_from) and is_default;
  delete from public.materials where owner_id = auth.uid() and name = any(p_from) and not is_default;
  if v_to is not null then insert into public.materials (owner_id, name) values (auth.uid(), v_to) on conflict do nothing; end if;
  delete from public.material_distinct_groups g where g.owner_id = auth.uid() and exists (
    select 1 from unnest(p_from) f where f = any(string_to_array(g.group_key, E'\n'))
  );
  return jsonb_build_object('items', to_jsonb(v_items), 'wishes', to_jsonb(v_wishes), 'item_values', v_item_values, 'wish_values', v_wish_values, 'entry', coalesce(v_material_metadata, '{}'::jsonb));
end
$$;

create or replace function public.restore_material(p_name text, p_items jsonb, p_wishes jsonb, p_entry jsonb default '{}'::jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_value jsonb;
begin
  for v_id, v_value in select key::uuid, value from jsonb_each(coalesce(p_items, '{}'::jsonb)) loop
    update public.items set material = v_value ->> 'material', material_percentages = coalesce(v_value -> 'percentages', '{}'::jsonb)
    where owner_id = auth.uid() and id = v_id;
  end loop;
  for v_id, v_value in select key::uuid, value from jsonb_each(coalesce(p_wishes, '{}'::jsonb)) loop
    update public.wishlist_items set material = v_value ->> 'material', material_percentages = coalesce(v_value -> 'percentages', '{}'::jsonb)
    where owner_id = auth.uid() and id = v_id;
  end loop;
  insert into public.materials (owner_id, name, aliases, sort_order, is_default, is_hidden)
  values (auth.uid(), p_name, coalesce(array(select jsonb_array_elements_text(p_entry -> 'aliases')), '{}'), coalesce((p_entry ->> 'sort_order')::integer, 100), coalesce((p_entry ->> 'is_default')::boolean, false), coalesce((p_entry ->> 'is_hidden')::boolean, false))
  on conflict (owner_id, name) do update set aliases = excluded.aliases, sort_order = excluded.sort_order, is_default = excluded.is_default, is_hidden = excluded.is_hidden;
end
$$;
