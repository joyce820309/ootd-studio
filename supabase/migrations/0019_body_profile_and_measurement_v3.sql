-- 量測 v3：新增高腰圍、坐姿肚臍圍與量測時段。
alter table public.body_measurements
  add column high_waist_cm numeric(5, 1),
  add column navel_sitting_cm numeric(5, 1),
  add column time_of_day text not null default 'morning_fasting'
    check (time_of_day in ('morning_fasting', 'afternoon_evening', 'other'));

comment on column public.body_measurements.high_waist_cm is '高腰褲頭位置的腰圍';
comment on column public.body_measurements.navel_sitting_cm is '坐姿肚臍圍';
comment on column public.body_measurements.time_of_day is '量測時段；只記錄，不影響尺寸計算';

-- 不常變動的身體資料直接更新，不隨每次量測新增快照。
create table public.body_profile (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  height_cm numeric(5, 1),
  arm_length_cm numeric(5, 1),
  inseam_cm numeric(5, 1),
  seated_rise_cm numeric(5, 1),
  foot_width_left_cm numeric(4, 1),
  foot_width_right_cm numeric(4, 1),
  heel_width_cm numeric(4, 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.body_profile enable row level security;
create policy "own body profile" on public.body_profile
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create trigger body_profile_touch before update on public.body_profile
  for each row execute function public.touch_updated_at();

-- 舊快照保留原欄位，但只用最新一筆回填固定資料；已有固定資料時不覆蓋。
with latest as (
  select distinct on (owner_id) owner_id, height_cm, arm_cm, inseam_cm
  from public.body_measurements
  order by owner_id, measured_on desc, created_at desc
)
insert into public.body_profile (owner_id, height_cm, arm_length_cm, inseam_cm)
select owner_id, height_cm, arm_cm, inseam_cm
from latest
where height_cm is not null or arm_cm is not null or inseam_cm is not null
on conflict (owner_id) do nothing;