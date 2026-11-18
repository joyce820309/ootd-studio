-- 量測趨勢：每位使用者一筆檢視設定（選了哪些部位、時間範圍、只看早上空腹、顯示體重）。
-- 趨勢圖本身直接用 body_measurements 的快照計算，不另存資料。
create table public.measurement_trend_prefs (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  metrics text[] not null default array['waistCm']::text[]
    check (cardinality(metrics) between 1 and 2),
  time_range text not null default 'year'
    check (time_range in ('half', 'year', 'all')),
  morning_only boolean not null default false,
  show_weight boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.measurement_trend_prefs is '量測趨勢頁的檢視設定；刪除即還原預設';
comment on column public.measurement_trend_prefs.metrics is '主圖顯示的部位（前端欄位名，例如 waistCm）；最多 2 個且單位相同';

alter table public.measurement_trend_prefs enable row level security;
create policy "own measurement trend prefs" on public.measurement_trend_prefs
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create trigger measurement_trend_prefs_touch before update on public.measurement_trend_prefs
  for each row execute function public.touch_updated_at();
