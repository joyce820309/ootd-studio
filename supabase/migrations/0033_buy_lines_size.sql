-- 購買明細補尺碼（B28 v2）：同一件商品裡 color_name＋size 不重複；同色不同尺碼是兩行。jsonb 欄位不需改結構。
comment on column public.wishlist_items.buy_lines is '準備購買明細：[{ color_name, hex, size, qty, unit_price }]；color_name＋size 不重複；小計 = Σ qty × unit_price。改回考慮中時保留，再次準備購買時沿用。';
