-- 穿搭日記：場合可複選、穿起來的感受、天氣與氣溫、鏡子自拍照片；
-- 並由 trigger 維護衣物的穿過次數與最近穿著日。

alter table public.outfits
  add column if not exists occasions text[] not null default '{}',
  add column if not exists feel text check (feel is null or feel in ('comfy', 'ok', 'uncomfy')),
  add column if not exists weather text check (weather is null or weather in ('sunny', 'cloudy', 'overcast', 'rain')),
  add column if not exists temperature_c smallint check (temperature_c is null or temperature_c between -30 and 50),
  add column if not exists photo_path text;

-- 舊欄位搬到新欄位（舊欄位保留，不刪除）
update public.outfits set occasions = array[occasion] where occasion is not null and occasion <> '' and occasions = '{}';
update public.outfits set feel = case when comfortable then 'comfy' else 'uncomfy' end where comfortable is not null and feel is null;

create index if not exists outfits_owner_diary_idx on public.outfits (owner_id, worn_on desc) where not is_hypothetical;

-- ---------- 穿過次數 ----------
-- 只計入有日期、不是「如果買了」試搭的穿搭。
-- 刪除紀錄時次數減 1（不低於 0）；最近穿著日只會往後更新，刪除時不回推。

create or replace function public.outfit_counts_as_worn(p_outfit_id uuid)
returns date
language sql
stable
as $$
  select worn_on from public.outfits
  where id = p_outfit_id and worn_on is not null and not is_hypothetical
$$;

create or replace function public.outfit_items_wear_insert()
returns trigger
language plpgsql
as $$
declare
  d date;
begin
  if new.item_id is null then return new; end if;
  d := public.outfit_counts_as_worn(new.outfit_id);
  if d is null then return new; end if;
  update public.items
    set wear_count = wear_count + 1,
        last_worn_at = greatest(coalesce(last_worn_at, d), d)
    where id = new.item_id;
  return new;
end;
$$;

-- 編輯紀錄時刪除單品：父層穿搭仍存在才扣次數（整筆刪除由 outfits 的 trigger 處理）
create or replace function public.outfit_items_wear_delete()
returns trigger
language plpgsql
as $$
begin
  if old.item_id is null then return old; end if;
  if public.outfit_counts_as_worn(old.outfit_id) is null then return old; end if;
  update public.items set wear_count = greatest(wear_count - 1, 0) where id = old.item_id;
  return old;
end;
$$;

create or replace function public.outfits_wear_before_delete()
returns trigger
language plpgsql
as $$
begin
  if old.worn_on is null or old.is_hypothetical then return old; end if;
  update public.items i
    set wear_count = greatest(i.wear_count - 1, 0)
    from public.outfit_items oi
    where oi.outfit_id = old.id and oi.item_id = i.id;
  return old;
end;
$$;

drop trigger if exists outfit_items_wear_insert on public.outfit_items;
create trigger outfit_items_wear_insert after insert on public.outfit_items
  for each row execute function public.outfit_items_wear_insert();

drop trigger if exists outfit_items_wear_delete on public.outfit_items;
create trigger outfit_items_wear_delete after delete on public.outfit_items
  for each row execute function public.outfit_items_wear_delete();

drop trigger if exists outfits_wear_before_delete on public.outfits;
create trigger outfits_wear_before_delete before delete on public.outfits
  for each row execute function public.outfits_wear_before_delete();
