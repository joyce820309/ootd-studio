-- 彈性尺寸（B20／BM17）：平放尺寸可另記「拉開後」的平放量，例如胸寬 40 可拉到 60 → { "chest": 60 }。
-- 結構同 flat_measurements；只有平放值存在且拉伸值較大時才寫入（由前端整理）。
alter table public.items
  add column if not exists flat_stretch jsonb not null default '{}'::jsonb;

alter table public.items
  add constraint items_flat_stretch_is_object
  check (jsonb_typeof(flat_stretch) = 'object');

alter table public.wishlist_items
  add column if not exists flat_stretch jsonb not null default '{}'::jsonb;

alter table public.wishlist_items
  add constraint wishlist_items_flat_stretch_is_object
  check (jsonb_typeof(flat_stretch) = 'object');
