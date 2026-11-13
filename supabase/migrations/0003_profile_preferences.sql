-- 個人資料頁補充偏好欄位，並讓個人資料與量測紀錄可追蹤更新時間。
alter table public.profiles
  add column if not exists frequent_sizes text[] not null default '{}',
  add column if not exists highlight_areas text,
  add column if not exists proportion_notes text;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

alter table public.body_measurements
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists body_measurements_touch on public.body_measurements;
create trigger body_measurements_touch before update on public.body_measurements
  for each row execute function public.touch_updated_at();

create index if not exists body_measurements_owner_date_idx
  on public.body_measurements (owner_id, measured_on desc);