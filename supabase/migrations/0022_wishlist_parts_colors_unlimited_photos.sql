-- 選購候選支援主要／可替代部位、多色購買及無上限圖片排序。
alter table public.wishlist_items
  add column primary_part public.slot,
  add column also_parts public.slot[] not null default '{}',
  add column colors jsonb not null default '[]'::jsonb,
  add column bought_item_ids uuid[] not null default '{}';

update public.wishlist_items
set primary_part = slot
where primary_part is null;

update public.wishlist_items
set colors = jsonb_build_array(jsonb_build_object(
  'family', coalesce(nullif(color_name, ''), '其他'),
  'hex', color_hex
))
where colors = '[]'::jsonb;

update public.wishlist_items
set bought_item_ids = array[bought_item_id]
where bought_item_id is not null and cardinality(bought_item_ids) = 0;

alter table public.wishlist_items
  alter column primary_part set not null,
  alter column primary_part set default 'top',
  add constraint wishlist_colors_is_array check (jsonb_typeof(colors) = 'array');

-- 圖片不限制張數；sort_order 改成整數，只限制不可為負值。
alter table public.item_photos
  add column color_family text,
  alter column sort_order type integer;

alter table public.item_photos
  drop constraint if exists item_photos_sort_order_check,
  add constraint item_photos_sort_order_nonnegative check (sort_order >= 0);
