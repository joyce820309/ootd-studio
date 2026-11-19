-- 選購清單：部位底下增加「類型」（例：上衣 › 背心・小可愛），並移除「等待降價」狀態。
alter table public.wishlist_items
  add column garment_type text;

comment on column public.wishlist_items.garment_type is '部位底下的類型代碼，例如 top 的 tee／knit／vest／shirt；沒填時前端依名稱推測';

-- 目標價已移除，「等待降價」不再使用；既有資料改為「考慮中」。
-- enum 值 waiting 保留在資料庫內（Postgres 不能直接刪 enum 值），前端不再顯示或寫入。
update public.wishlist_items set status = 'considering' where status = 'waiting';
