-- 踩雷覆盤：衣物狀態、退貨日、每件衣物一筆覆盤、和衣物關聯。
-- 規則只存在 lesson_rules（review_records.lesson_rules 欄位保留但不再使用）。

-- 1) 衣物新狀態：不出現在衣櫃、今日搭配、統計，但照片與尺寸保留
alter type public.item_status add value if not exists 'returned';
alter type public.item_status add value if not exists 'unworn';
alter type public.item_status add value if not exists 'given_away';

-- 2) 退貨日
alter table public.review_records add column if not exists returned_on date;

-- 3) 每件衣物只留最新一筆覆盤
delete from public.review_records r
using public.review_records newer
where r.owner_id = newer.owner_id
  and r.item_id = newer.item_id
  and (r.updated_at, r.id) < (newer.updated_at, newer.id);

create unique index if not exists review_records_owner_item_key
  on public.review_records (owner_id, item_id);

-- 4) 和衣物關聯：衣物刪除時覆盤一起刪除
delete from public.review_records r
where not exists (select 1 from public.items i where i.id = r.item_id);

alter table public.review_records
  drop constraint if exists review_records_item_id_fkey;
alter table public.review_records
  add constraint review_records_item_id_fkey
  foreign key (item_id) references public.items (id) on delete cascade;

-- 5) 規則類型：品牌／類別／尺寸
alter table public.lesson_rules
  add column if not exists kind text not null default 'category'
  check (kind in ('brand', 'category', 'size'));

create index if not exists lesson_rules_owner_source_idx
  on public.lesson_rules (owner_id, source_review_id);
