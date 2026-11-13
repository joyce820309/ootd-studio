-- 今日搭配新增第三種板型「自由擺放」
-- 位置存在 outfits.layout：{ "top": { "x": 52, "y": 24, "w": 28, "rot": 0, "z": 1 }, ... }
--   x / y：中心點，佔畫布寬／高的百分比（0–100）
--   w：寬度，佔畫布寬的百分比
--   rot：旋轉角度；z：圖層

alter type public.outfit_template add value if not exists 'free';

alter table public.outfits
  add column if not exists layout jsonb;

alter table public.outfits
  add constraint outfits_layout_is_object check (layout is null or jsonb_typeof(layout) = 'object');
