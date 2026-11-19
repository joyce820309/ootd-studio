-- 比較改版：比較可與多筆選購商品建立多對多關係。
-- 舊的 wishlist_items.compare_group_id 先搬入關聯表，再移除舊欄位。

-- 將舊比較標題欄位改為新名稱；保留既有預算資料，避免此 migration 遺失使用者資料。
alter table public.compare_groups rename column title to name;
alter table public.compare_groups add column archived_at timestamptz;
alter table public.compare_groups add column updated_at timestamptz;

-- 既有比較的更新時間，以建立時間、已關聯候選與衣櫃比較品的最近時間回填。
update public.compare_groups as cg
set updated_at = greatest(
  cg.created_at,
  coalesce((select max(wishlist.updated_at)
            from public.wishlist_items as wishlist
            where wishlist.compare_group_id = cg.id), cg.created_at),
  coalesce((select max(closet_link.created_at)
            from public.compare_group_closet_items as closet_link
            where closet_link.compare_group_id = cg.id), cg.created_at)
);

alter table public.compare_groups alter column updated_at set default now();
alter table public.compare_groups alter column updated_at set not null;

create index compare_groups_owner_archive_updated_idx
  on public.compare_groups (owner_id, archived_at, updated_at desc);

create trigger compare_groups_touch
  before update on public.compare_groups
  for each row execute function public.touch_updated_at();

-- 比較只持有選購商品關聯；衣櫃比較品現有的 compare_group_closet_items 暫時保留，
-- 未納入本階段定義的 compare_group_items。
create table public.compare_group_items (
  group_id uuid not null references public.compare_groups (id) on delete cascade,
  wishlist_item_id uuid not null references public.wishlist_items (id) on delete cascade,
  position integer not null default 0 check (position >= 0),
  chosen_size text,
  added_at timestamptz not null default now(),
  primary key (group_id, wishlist_item_id)
);

create index compare_group_items_group_position_idx
  on public.compare_group_items (group_id, position, added_at);

comment on table public.compare_group_items is '比較與選購清單商品的多對多關聯；移除關聯不會刪除商品。';
comment on column public.compare_group_items.position is '商品在此比較中的欄位順序';
comment on column public.compare_group_items.chosen_size is '此比較中用來比對的商品尺碼';
comment on column public.compare_group_items.added_at is '加入此比較的時間；舊資料以商品建立時間作為回填值';

create or replace function public.touch_compare_group_from_item_link() returns trigger
language plpgsql as $$
begin
  -- 比較刪除時父列已不存在，UPDATE 自然不會命中；商品刪除時仍更新其餘比較。
  if tg_op = 'DELETE' then
    update public.compare_groups set updated_at = now() where id = old.group_id;
  elsif tg_op = 'UPDATE' then
    update public.compare_groups set updated_at = now() where id = old.group_id;
    if new.group_id is distinct from old.group_id then
      update public.compare_groups set updated_at = now() where id = new.group_id;
    end if;
  else
    update public.compare_groups set updated_at = now() where id = new.group_id;
  end if;
  return null;
end $$;

alter table public.compare_group_items enable row level security;

create policy "own compare group wishlist items" on public.compare_group_items for all
  using (
    exists (
      select 1 from public.compare_groups as cg
      where cg.id = group_id and cg.owner_id = auth.uid()
    )
    and exists (
      select 1 from public.wishlist_items as wishlist
      where wishlist.id = wishlist_item_id and wishlist.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.compare_groups as cg
      where cg.id = group_id and cg.owner_id = auth.uid()
    )
    and exists (
      select 1 from public.wishlist_items as wishlist
      where wishlist.id = wishlist_item_id and wishlist.owner_id = auth.uid()
    )
  );

-- 舊欄位只允許一個比較；保留所有狀態的既有關聯，按商品建立時間產生初始欄位順序。
insert into public.compare_group_items (group_id, wishlist_item_id, position, chosen_size, added_at)
select
  wishlist.compare_group_id,
  wishlist.id,
  (row_number() over (
    partition by wishlist.compare_group_id
    order by wishlist.created_at, wishlist.id
  ) - 1)::integer,
  null,
  wishlist.created_at
from public.wishlist_items as wishlist
join public.compare_groups as cg
  on cg.id = wishlist.compare_group_id
  and cg.owner_id = wishlist.owner_id
where wishlist.compare_group_id is not null;

do $$
declare
  expected_count bigint;
  migrated_count bigint;
  skipped_cross_owner_count bigint;
begin
  select count(*) into expected_count
  from public.wishlist_items as wishlist
  join public.compare_groups as cg
    on cg.id = wishlist.compare_group_id
    and cg.owner_id = wishlist.owner_id
  where wishlist.compare_group_id is not null;

  select count(*) into migrated_count from public.compare_group_items;

  if migrated_count <> expected_count then
    raise exception '比較商品關聯搬移筆數不符：預期 % 筆，實際 % 筆', expected_count, migrated_count;
  end if;

  select count(*) into skipped_cross_owner_count
  from public.wishlist_items as wishlist
  join public.compare_groups as cg on cg.id = wishlist.compare_group_id
  where wishlist.compare_group_id is not null
    and cg.owner_id <> wishlist.owner_id;

  if skipped_cross_owner_count > 0 then
    raise notice '略過 % 筆跨使用者的舊比較關聯，以維持資料隔離。', skipped_cross_owner_count;
  end if;
end $$;

create trigger compare_group_items_touch_parent
  after insert or update or delete on public.compare_group_items
  for each row execute function public.touch_compare_group_from_item_link();

alter table public.wishlist_items
  drop constraint if exists wishlist_items_compare_group_id_fkey;
alter table public.wishlist_items
  drop column compare_group_id;
