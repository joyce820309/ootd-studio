-- 保存搭配工作台的背景主題，讓穿搭資料可在重新載入後還原畫布。
alter table public.outfits
  add column bg_theme text not null default 'plain'
    check (bg_theme in ('plain', 'oat', 'lemon', 'rose', 'mist', 'journal', 'custom')),
  add column bg_blob_mode text not null default 'on'
    check (bg_blob_mode in ('on', 'soft', 'off')),
  add column bg_custom jsonb not null default '{"a":"#E7B9B4","b":"#8C9A86"}'::jsonb
    check (
      jsonb_typeof(bg_custom) = 'object'
      and bg_custom ->> 'a' ~ '^#[0-9A-Fa-f]{6}$'
      and bg_custom ->> 'b' ~ '^#[0-9A-Fa-f]{6}$'
    );