-- 上衣及選購候選可記錄領口尺寸（cm）。
alter table public.items
  add column if not exists neckline_size numeric check (neckline_size is null or neckline_size >= 0);

alter table public.wishlist_items
  add column if not exists neckline_size numeric check (neckline_size is null or neckline_size >= 0);
