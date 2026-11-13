-- 體態量測 v2：拆分胸圍、增加肚臍圍及三種腳部量測快照。
-- 可在原始 schema、已執行舊版 0005，或部分執行 v2 的資料庫上重複執行。

-- 將舊值搬到新欄位。若新舊欄位同時存在，僅補新欄位的空值，不覆蓋已輸入的新資料。
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'body_measurements' and column_name = 'bust_cm'
  ) then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'body_measurements' and column_name = 'upper_bust_cm'
    ) then
      alter table public.body_measurements rename column bust_cm to upper_bust_cm;
    else
      execute 'update public.body_measurements set upper_bust_cm = bust_cm where upper_bust_cm is null and bust_cm is not null';
    end if;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'body_measurements' and column_name = 'foot_cm'
  ) then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'body_measurements' and column_name = 'foot_bare_length_cm'
    ) then
      alter table public.body_measurements rename column foot_cm to foot_bare_length_cm;
    else
      execute 'update public.body_measurements set foot_bare_length_cm = foot_cm where foot_bare_length_cm is null and foot_cm is not null';
    end if;
  end if;
end $$;

alter table public.body_measurements
  add column if not exists upper_bust_cm numeric(5, 1),
  add column if not exists under_bust_cm numeric(5, 1),
  add column if not exists navel_cm numeric(5, 1),

  add column if not exists foot_toe_length_cm numeric(4, 1),
  add column if not exists foot_toe_width_cm numeric(4, 1),
  add column if not exists foot_toe_ball_cm numeric(4, 1),
  add column if not exists foot_toe_instep_cm numeric(4, 1),

  add column if not exists foot_sock_length_cm numeric(4, 1),
  add column if not exists foot_sock_width_cm numeric(4, 1),
  add column if not exists foot_sock_ball_cm numeric(4, 1),
  add column if not exists foot_sock_instep_cm numeric(4, 1),

  add column if not exists foot_bare_length_cm numeric(4, 1),
  add column if not exists foot_bare_width_cm numeric(4, 1),
  add column if not exists foot_bare_ball_cm numeric(4, 1),
  add column if not exists foot_bare_instep_cm numeric(4, 1),

  add column if not exists updated_at timestamptz not null default now();

update public.body_measurements
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

alter table public.body_measurements
  alter column updated_at set default now(),
  alter column updated_at set not null;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists body_measurements_touch on public.body_measurements;
create trigger body_measurements_touch before update on public.body_measurements
  for each row execute function public.touch_updated_at();

comment on column public.body_measurements.upper_bust_cm is '上胸圍';
comment on column public.body_measurements.under_bust_cm is '下胸圍';
comment on column public.body_measurements.navel_cm is '肚臍圍';
comment on column public.body_measurements.foot_toe_length_cm is '穿五指襪・腳長';
comment on column public.body_measurements.foot_toe_width_cm is '穿五指襪・腳寬';
comment on column public.body_measurements.foot_toe_ball_cm is '穿五指襪・前掌圍';
comment on column public.body_measurements.foot_toe_instep_cm is '穿五指襪・腳背圍';
comment on column public.body_measurements.foot_sock_length_cm is '穿一般襪・腳長';
comment on column public.body_measurements.foot_sock_width_cm is '穿一般襪・腳寬';
comment on column public.body_measurements.foot_sock_ball_cm is '穿一般襪・前掌圍';
comment on column public.body_measurements.foot_sock_instep_cm is '穿一般襪・腳背圍';
comment on column public.body_measurements.foot_bare_length_cm is '裸腳・腳長';
comment on column public.body_measurements.foot_bare_width_cm is '裸腳・腳寬';
comment on column public.body_measurements.foot_bare_ball_cm is '裸腳・前掌圍';
comment on column public.body_measurements.foot_bare_instep_cm is '裸腳・腳背圍';

-- 重新建立完整排序索引；若舊 0003 已建過同名索引，確保新增 created_at 排序欄位。
drop index if exists public.body_measurements_owner_date_idx;
create index body_measurements_owner_date_idx
  on public.body_measurements (owner_id, measured_on desc, created_at desc);
