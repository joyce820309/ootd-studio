-- 比較封面：每個比較可各自指定欄頂要顯示哪張商品圖（存 item_photos.storage_path，舊資料的封面路徑也適用）。
-- null＝沿用商品本身的封面；不影響選購清單的封面。
alter table public.compare_group_items
  add column cover_photo_path text;

comment on column public.compare_group_items.cover_photo_path is '這個比較的欄頂封面圖（商品圖的 storage_path）；null 時用商品封面。';
