-- 選購比較挑選器需要依下身長度篩選；長度為選填，未填表示未知／未分類。
alter table public.wishlist_items
  add column garment_length text
  check (garment_length in ('short', 'mid', 'long'));

comment on column public.wishlist_items.garment_length is '下身長度代碼：short 短、mid 中、long 長；僅適用 pants／jeans／skirt／leggings，其他類型保持 null';
