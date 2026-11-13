-- 進階搭配工作台支援同一部位放入多件衣物，位置直接存於各畫布項目。
create table public.outfit_canvas_items (
  id uuid primary key default gen_random_uuid(),
  outfit_id uuid not null references public.outfits (id) on delete cascade,
  item_id uuid references public.items (id) on delete cascade,
  wishlist_item_id uuid references public.wishlist_items (id) on delete cascade,
  x numeric(5, 2) not null check (x between 0 and 100),
  y numeric(5, 2) not null check (y between 0 and 100),
  w numeric(5, 2) not null check (w between 8 and 70),
  rot numeric(6, 2) not null default 0 check (rot between -180 and 180),
  z integer not null default 1,
  created_at timestamptz not null default now(),
  check (num_nonnulls(item_id, wishlist_item_id) = 1)
);

create unique index outfit_canvas_closet_unique_idx
  on public.outfit_canvas_items (outfit_id, item_id) where item_id is not null;
create unique index outfit_canvas_wishlist_unique_idx
  on public.outfit_canvas_items (outfit_id, wishlist_item_id) where wishlist_item_id is not null;
create index outfit_canvas_outfit_z_idx on public.outfit_canvas_items (outfit_id, z);

alter table public.outfit_canvas_items enable row level security;

create policy "own outfit canvas items" on public.outfit_canvas_items for all
  using (exists (
    select 1 from public.outfits o
    where o.id = outfit_id and o.owner_id = auth.uid()
  ))
  with check (
    exists (
      select 1 from public.outfits o
      where o.id = outfit_id and o.owner_id = auth.uid()
    )
    and (item_id is null or exists (
      select 1 from public.items i
      where i.id = item_id and i.owner_id = auth.uid()
    ))
    and (wishlist_item_id is null or exists (
      select 1 from public.wishlist_items w
      where w.id = wishlist_item_id and w.owner_id = auth.uid()
    ))
  );
