-- 換貨流程與手動 AI 覆盤（B17／B17.2／B17.3）

-- 1) 衣物新狀態：已換貨（舊的那件留在踩雷筆記本）
alter type public.item_status add value if not exists 'exchanged';

-- 2) 新衣物的收到日期（鑑賞期從這天算）、換貨來源
alter table public.items add column if not exists received_on date;
alter table public.items
  add column if not exists exchanged_from uuid references public.items (id) on delete set null;
create index if not exists items_exchanged_from_idx on public.items (exchanged_from) where exchanged_from is not null;

-- 3) 覆盤：處理方式加入換貨，記下換成什麼
alter table public.review_records drop constraint if exists review_records_decision_check;
alter table public.review_records
  add constraint review_records_decision_check
  check (decision in ('returned', 'exchanged', 'kept', 'not_worn', 'given_away'));

alter table public.review_records
  add column if not exists exchange_kind text check (exchange_kind in ('size', 'color', 'other')),
  add column if not exists exchange_size text,
  add column if not exists exchange_color_name text,
  add column if not exists exchange_color_hex text,
  add column if not exists exchanged_on date,
  add column if not exists exchange_extra numeric(10,2);

-- 4) AI 覆盤改為手動貼上：記下貼上時間
alter table public.review_records add column if not exists ai_pasted_at timestamptz;

-- 5) 規則：可自動檢查（auto）或只提醒（remind）
alter table public.lesson_rules
  add column if not exists check_kind text not null default 'remind'
  check (check_kind in ('auto', 'remind'));
