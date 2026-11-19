-- 選購候選增加賣場商品編號，供整理商品資料與外部 AI 初篩時辨識。
alter table public.wishlist_items
  add column product_code text;

comment on column public.wishlist_items.product_code is '賣場商品編號或使用者自訂識別碼';
