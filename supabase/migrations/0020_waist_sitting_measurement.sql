-- 新增坐姿自然腰圍，與原有站姿腰圍分開記錄。
alter table public.body_measurements
  add column waist_sitting_cm numeric(5, 1);

comment on column public.body_measurements.waist_sitting_cm is '坐姿自然腰圍（最細處）';
