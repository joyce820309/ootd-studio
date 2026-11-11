-- My Closet・OOTD Studio 初始資料表
-- 所有表格都以 owner_id 綁定登入者，並啟用 RLS：只有本人能讀寫自己的資料。

create extension if not exists "pgcrypto";

-- ---------- 列舉 ----------
create type public.slot as enum ('outer', 'top', 'bottom', 'shoes', 'bag', 'acc');
create type public.item_status as enum ('ok', 'cleaning', 'repair', 'lent', 'stored', 'retired');
create type public.cutout_status as enum ('pending', 'processing', 'done', 'failed', 'skipped');
create type public.wish_status as enum ('considering', 'waiting', 'ready', 'bought', 'dropped');
create type public.outfit_template as enum ('full', 'column');

-- ---------- 共用：updated_at ----------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- 個人設定 ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  ai_use_body_data boolean not null default true,
  shoe_sizes jsonb not null default '[]'::jsonb, -- [{ "label": "運動鞋", "eu": "37.5", "us": "6.5", "uk": "4.5", "jp": "23.5" }]
  fit_preferences text[] not null default '{}',
  disliked_cuts text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 分類（不寫死在 UI） ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  slot public.slot, -- null = 不參與搭配板（例如「其他」）
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

-- ---------- 衣物 ----------
create table public.items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  name text not null,
  color_name text not null,
  color_hex text not null default '#D9CBB3' check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  size text not null,
  size_system text, -- 例如 alpha / numeric / EU / US
  brand text,
  fit text,
  material text,
  seasons text[] not null default '{}',
  occasions text[] not null default '{}',
  status public.item_status not null default 'ok',
  is_favorite boolean not null default false,
  purchase_date date,
  purchase_price int check (purchase_price >= 0),
  store text,
  note text,
  image_original_path text,
  image_cutout_path text,
  cutout_status public.cutout_status not null default 'pending',
  wear_count int not null default 0,
  last_worn_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index items_owner_status_idx on public.items (owner_id, status);
create trigger items_touch before update on public.items for each row execute function public.touch_updated_at();

-- ---------- 比較群組（比較試搭台） ----------
create table public.compare_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  budget int check (budget >= 0),
  created_at timestamptz not null default now()
);

-- ---------- 選購清單 ----------
create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  compare_group_id uuid references public.compare_groups (id) on delete set null,
  name text not null,
  slot public.slot not null,
  color_hex text not null default '#D9CBB3' check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  shop text not null,
  url text,
  price int not null check (price >= 0),
  shipping int check (shipping >= 0),
  target_price int check (target_price >= 0),
  size_note text,
  return_policy text,
  material text,
  reason text,
  priority smallint check (priority between 1 and 3),
  status public.wish_status not null default 'considering',
  image_cutout_path text,
  bought_item_id uuid references public.items (id) on delete set null, -- 移至已購買後指向正式衣物
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index wishlist_owner_status_idx on public.wishlist_items (owner_id, status);
create trigger wishlist_touch before update on public.wishlist_items for each row execute function public.touch_updated_at();

-- ---------- 穿搭（穿搭日記） ----------
create table public.outfits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  worn_on date,
  template public.outfit_template not null default 'full',
  occasion text,
  rating smallint check (rating between 1 and 5),
  comfortable boolean,
  note text,
  is_hypothetical boolean not null default false, -- 「如果買了」的試搭，不計入穿著次數
  created_at timestamptz not null default now()
);
create index outfits_owner_date_idx on public.outfits (owner_id, worn_on desc);

create table public.outfit_items (
  outfit_id uuid not null references public.outfits (id) on delete cascade,
  slot public.slot not null,
  item_id uuid references public.items (id) on delete set null,
  wishlist_item_id uuid references public.wishlist_items (id) on delete set null,
  primary key (outfit_id, slot),
  check (num_nonnulls(item_id, wishlist_item_id) <= 1)
);

-- ---------- 體態量測（敏感資料） ----------
create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_on date not null default current_date,
  height_cm numeric(5, 1),
  weight_kg numeric(5, 1),
  shoulder_cm numeric(5, 1),
  bust_cm numeric(5, 1),
  waist_cm numeric(5, 1),
  hip_cm numeric(5, 1),
  arm_cm numeric(5, 1),
  inseam_cm numeric(5, 1),
  thigh_cm numeric(5, 1),
  foot_cm numeric(4, 1),
  note text,
  created_at timestamptz not null default now()
);

-- ---------- RLS：只有本人 ----------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.items enable row level security;
alter table public.compare_groups enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.outfits enable row level security;
alter table public.outfit_items enable row level security;
alter table public.body_measurements enable row level security;

create policy "own profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "own categories" on public.categories for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own items" on public.items for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own compare groups" on public.compare_groups for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own wishlist" on public.wishlist_items for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own outfits" on public.outfits for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own body measurements" on public.body_measurements for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own outfit items" on public.outfit_items for all
  using (exists (select 1 from public.outfits o where o.id = outfit_id and o.owner_id = auth.uid()))
  with check (exists (select 1 from public.outfits o where o.id = outfit_id and o.owner_id = auth.uid()));

-- ---------- 新使用者：建立 profile 與預設分類 ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.categories (owner_id, name, slot, sort) values
    (new.id, '上衣', 'top', 1),
    (new.id, '下身', 'bottom', 2),
    (new.id, '外套', 'outer', 3),
    (new.id, '洋裝／套裝', 'top', 4),
    (new.id, '襪子', 'acc', 5),
    (new.id, '鞋子', 'shoes', 6),
    (new.id, '包包', 'bag', 7),
    (new.id, '配件', 'acc', 8),
    (new.id, '其他', null, 9);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Storage：私人圖片 bucket ----------
-- 路徑規則：{user_id}/{item_id}/original.jpg、{user_id}/{item_id}/cutout.png
insert into storage.buckets (id, name, public) values ('closet-images', 'closet-images', false)
  on conflict (id) do nothing;

create policy "own images read" on storage.objects for select
  using (bucket_id = 'closet-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own images write" on storage.objects for insert
  with check (bucket_id = 'closet-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own images update" on storage.objects for update
  using (bucket_id = 'closet-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own images delete" on storage.objects for delete
  using (bucket_id = 'closet-images' and (storage.foldername(name))[1] = auth.uid()::text);
