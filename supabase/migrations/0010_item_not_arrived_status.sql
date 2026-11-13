-- 衣物可標記為未到貨；此狀態不會出現在可穿／搭配候選中。
alter type public.item_status add value if not exists 'not_arrived';