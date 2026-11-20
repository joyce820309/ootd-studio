-- 準備購買的購買明細（B23.3）：每色一行，件數 × 單價；平台不計算任何滿額規則
alter table public.wishlist_items
  add column buy_lines jsonb not null default '[]'::jsonb;

alter table public.wishlist_items
  add constraint wishlist_items_buy_lines_is_array check (jsonb_typeof(buy_lines) = 'array');

comment on column public.wishlist_items.buy_lines is '準備購買明細：[{ color_name, hex, qty, unit_price }]；小計 = Σ qty × unit_price。改回考慮中時保留，再次準備購買時沿用。';

-- 採購籃的目標金額（選填），只用來顯示「還差多少」
alter table public.profiles
  add column shopping_target integer check (shopping_target is null or shopping_target >= 0);

comment on column public.profiles.shopping_target is '採購籃目標金額（NT$，選填）；只用來算還差多少，不代表任何活動規則。';
