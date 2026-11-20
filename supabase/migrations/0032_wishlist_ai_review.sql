-- 選購商品完整頁面（B7.3）「AI 看過的提醒」：使用者把外部 AI 的回覆貼回來保存。平台不呼叫 AI。
alter table public.wishlist_items
  add column ai_review text,
  add column ai_reviewed_at timestamptz;

comment on column public.wishlist_items.ai_review is '使用者從外部 AI 貼回的提醒（純文字，「- 」開頭為清單）；null 表示沒有';
comment on column public.wishlist_items.ai_reviewed_at is 'ai_review 最後一次貼上的時間';
