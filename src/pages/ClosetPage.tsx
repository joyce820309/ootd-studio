import { useMemo, useState } from 'react'
import { ItemTile } from '@/components/closet/ItemTile'
import { ButtonLink } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Icon } from '@/components/ui/Icon'
import { TiltLabel } from '@/components/ui/Paper'
import { fetchClosetItems, useAsync } from '@/lib/data'
import { SLOTS } from '@/lib/slots'
import type { Slot } from '@/types'

export function ClosetPage() {
  const { data: items, loading, error } = useAsync(fetchClosetItems)
  const [slot, setSlot] = useState<Slot | 'all'>('all')
  const [q, setQ] = useState('')

  const visible = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return (items ?? []).filter(
      (i) => (slot === 'all' || i.slot === slot) && (!kw || `${i.name} ${i.brand ?? ''} ${i.colorName}`.toLowerCase().includes(kw)),
    )
  }, [items, slot, q])

  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-5 px-[clamp(16px,4vw,48px)] pt-8 pb-14">
      <div className="flex flex-wrap items-center gap-4">
        <TiltLabel accent="mist" as="h1">我的衣櫃</TiltLabel>
        {items && <span className="font-num text-sm text-ink-2 tabular">{items.length} 件</span>}
        <ButtonLink to="/closet/new" variant="oat" className="ml-auto">
          <Icon name="plus" />
          新增衣物
        </ButtonLink>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative w-full sm:w-72">
          <span className="sr-only">搜尋衣物</span>
          <span className="absolute top-[11px] left-3 text-ink-3">
            <Icon name="search" size={18} />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜尋名稱、品牌、顏色"
            className="h-10 w-full rounded-btn border-[1.5px] border-line bg-card pr-3 pl-[38px] text-sm text-ink"
          />
        </label>
        <Chip selected={slot === 'all'} onClick={() => setSlot('all')}>
          全部
        </Chip>
        {SLOTS.map((s) => (
          <Chip key={s.slot} selected={slot === s.slot} dotColor={s.solid} onClick={() => setSlot(s.slot)}>
            {s.label}
          </Chip>
        ))}
        <span role="status" className="ml-auto font-num text-[13px] text-ink-2 tabular">
          顯示 {visible.length} 件
        </span>
      </div>

      {loading && <p role="status" className="text-sm text-ink-2">正在整理你的衣櫃…</p>}
      {error && (
        <p role="alert" className="rounded-tile border-[1.5px] border-rose bg-rose-soft p-4 text-sm text-rose-ink">
          衣櫃資料讀取失敗，請重新整理再試一次。
        </p>
      )}
      {items && items.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-card bg-card p-10 text-center shadow-paper">
          <p className="m-0 font-hd text-xl font-bold">衣櫃還是空的</p>
          <p className="m-0 text-sm text-ink-2">先放進第一件衣物吧，從最常穿的那件開始。</p>
          <ButtonLink to="/closet/new" variant="primary">加入第一件衣物</ButtonLink>
        </div>
      )}
      {items && items.length > 0 && visible.length === 0 && (
        <p className="rounded-card bg-card p-8 text-center text-sm text-ink-2">這個條件下沒有衣物，換個關鍵字或分類看看。</p>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(168px,1fr))]">
        {visible.map((item) => (
          <ItemTile key={item.id} item={item} />
        ))}
      </div>
    </main>
  )
}
