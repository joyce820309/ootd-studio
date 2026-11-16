-- 記錄每條覆盤規則最近一次提醒時間，選購時七天內不重複提醒。
alter table public.lesson_rules
  add column last_notified_at timestamptz;