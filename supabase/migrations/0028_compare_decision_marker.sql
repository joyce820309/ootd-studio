-- 比較內記錄使用者最後決定購買的候選；商品狀態仍沿用 wishlist_items.status = ready。
alter table public.compare_group_items
  add column is_decided boolean not null default false;

create unique index compare_group_items_one_decision_idx
  on public.compare_group_items (group_id)
  where is_decided;

comment on column public.compare_group_items.is_decided is '此比較中使用者按「就買這件」確認的候選；每個比較最多一件';

create or replace function public.set_compare_decision(p_group_id uuid, p_wishlist_item_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  affected integer;
begin
  update public.compare_group_items
    set is_decided = false
    where group_id = p_group_id and is_decided;

  if p_wishlist_item_id is null then
    return;
  end if;

  update public.compare_group_items
    set is_decided = true
    where group_id = p_group_id and wishlist_item_id = p_wishlist_item_id;
  get diagnostics affected = row_count;

  if affected = 0 then
    raise exception '選購商品不在指定比較中';
  end if;
end;
$$;

revoke all on function public.set_compare_decision(uuid, uuid) from public;
grant execute on function public.set_compare_decision(uuid, uuid) to authenticated;
