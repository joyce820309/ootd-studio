-- 記錄選購候選的平放尺寸表實際量測尺碼，供比較時判斷尺碼是否對應。
alter table public.wishlist_items
  add column flat_measurements_size text;

comment on column public.wishlist_items.flat_measurements_size is 'flat_measurements／flat_stretch 這組尺寸實際量測的尺碼；null 表示未標記';
