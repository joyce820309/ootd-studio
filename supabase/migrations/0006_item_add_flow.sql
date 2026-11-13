-- 新增衣物流程補充欄位與多張照片索引。
alter table public.items
  add column if not exists second_color_hex text check (second_color_hex is null or second_color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  add column if not exists material_composition text,
  add column if not exists product_url text,
  add column if not exists flat_measurements jsonb not null default '{}'::jsonb,
  add column if not exists is_draft boolean not null default false;

alter table public.items
  add constraint items_flat_measurements_is_object
  check (jsonb_typeof(flat_measurements) = 'object');

alter table public.wishlist_items
  add column if not exists image_original_path text,
  add column if not exists cutout_status public.cutout_status not null default 'skipped',
  add column if not exists category_id uuid references public.categories (id) on delete set null,
  add column if not exists color_name text,
  add column if not exists second_color_hex text check (second_color_hex is null or second_color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  add column if not exists brand text,
  add column if not exists size text,
  add column if not exists seasons text[] not null default '{}',
  add column if not exists material_composition text,
  add column if not exists flat_measurements jsonb not null default '{}'::jsonb;

create table if not exists public.item_photos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid references public.items (id) on delete cascade,
  wishlist_item_id uuid references public.wishlist_items (id) on delete cascade,
  storage_path text not null,
  sort_order smallint not null default 0 check (sort_order between 0 and 7),
  is_cover boolean not null default false,
  created_at timestamptz not null default now(),
  check (num_nonnulls(item_id, wishlist_item_id) = 1),
  unique (storage_path)
);

create unique index if not exists item_photos_item_cover_idx
  on public.item_photos (item_id) where item_id is not null and is_cover;
create unique index if not exists item_photos_wishlist_cover_idx
  on public.item_photos (wishlist_item_id) where wishlist_item_id is not null and is_cover;
create index if not exists item_photos_item_order_idx on public.item_photos (item_id, sort_order);
create index if not exists item_photos_wishlist_order_idx on public.item_photos (wishlist_item_id, sort_order);

alter table public.item_photos enable row level security;

create policy "own item photos" on public.item_photos for all
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and (item_id is null or exists (
      select 1 from public.items i where i.id = item_id and i.owner_id = auth.uid()
    ))
    and (wishlist_item_id is null or exists (
      select 1 from public.wishlist_items w where w.id = wishlist_item_id and w.owner_id = auth.uid()
    ))
  );
