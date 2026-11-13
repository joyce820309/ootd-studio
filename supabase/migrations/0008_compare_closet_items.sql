-- 比較試搭台可將衣櫃既有單品加入群組作為比較基準；移除比較關聯不會刪除衣物。
create table public.compare_group_closet_items (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  compare_group_id uuid not null references public.compare_groups (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (compare_group_id, item_id)
);

create index compare_group_closet_items_owner_idx
  on public.compare_group_closet_items (owner_id, compare_group_id);

alter table public.compare_group_closet_items enable row level security;

create policy "own compare group closet items" on public.compare_group_closet_items for all
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.compare_groups g
      where g.id = compare_group_id and g.owner_id = auth.uid()
    )
    and exists (
      select 1 from public.items i
      where i.id = item_id and i.owner_id = auth.uid() and not i.is_draft
    )
  );
