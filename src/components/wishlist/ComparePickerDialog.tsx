import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { Checkbox } from '@/components/ui/Checkbox'
import { Icon } from '@/components/ui/Icon'
import { ItemImage } from '@/components/closet/ItemImage'
import { WishlistFilters } from '@/components/wishlist/WishlistFilters'
import { applyWishFacets, formatNT, garmentTypeOf, normalizeFacets, typeKey, WISH_TABS, type WishFacets } from '@/lib/wishlist'
import type { GarmentLength, Slot, WishlistItem, WishStatus } from '@/types'
import './ComparePickerDialog.css'

type SourceTab = 'wishlist' | 'closet' | 'url'
type FilterStatus = WishStatus | 'all'

interface ComparePickerDialogProps {
  groupId: string
  groupName: string
  items: WishlistItem[]
  groupWishlistIds: string[]
  memberships: Record<string, { groupId: string; groupName: string }[]>
  onClose: () => void
  onAdd: (ids: string[]) => void
  onAddUrl: () => void
}

/** 比較加入商品挑選器（B23.1／BM20.1），只做選購清單來源；衣櫃分頁保留第二階段入口。 */
export function ComparePickerDialog({ groupId, groupName, items, groupWishlistIds, memberships, onClose, onAdd, onAddUrl }: ComparePickerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [tab, setTab] = useState<SourceTab>('wishlist')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<FilterStatus>('considering')
  // 預設帶入這個比較裡最多的部位／類型／長度；之後都可多選
  const [facets, setFacets] = useState<WishFacets>(() => {
    const groupItems = items.filter((item) => groupWishlistIds.includes(item.id))
    const slot = majorityPart(groupItems)
    const selectedType = slot ? majorityType(groupItems, slot) : null
    const selectedLength = selectedType ? majorityLength(groupItems, selectedType) : null
    return normalizeFacets({ parts: slot ? [slot] : [], types: slot && selectedType ? [typeKey(slot, selectedType)] : [], lengths: selectedLength ? [selectedLength] : [] })
  })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const existing = useMemo(() => new Set(groupWishlistIds), [groupWishlistIds])

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [])

  const searched = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return items.filter((item) => {
      if (!existing.has(item.id) && status === 'all' && item.status === 'bought') return false
      if (!existing.has(item.id) && status !== 'all' && item.status !== status) return false
      if (!normalized) return true
      return [item.name, item.shop, item.productCode].some((value) => value?.toLocaleLowerCase().includes(normalized))
    })
  }, [existing, items, query, status])
  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(WISH_TABS.map((entry) => [entry.key, 0])) as Record<FilterStatus, number>
    for (const item of items) {
      counts[item.status] += 1
      if (item.status !== 'bought') counts.all += 1
    }
    return counts
  }, [items])
  const { partCounts, typeCounts, lengthCounts, visible } = useMemo(() => applyWishFacets(searched, facets), [searched, facets])
  const available = useMemo(() => visible.filter((item) => !existing.has(item.id)), [visible, existing])
  const selectedVisible = available.filter((item) => selectedIds.has(item.id))
  const allSelected = available.length > 0 && selectedVisible.length === available.length
  const someSelected = selectedVisible.length > 0 && !allSelected

  function toggleAll() {
    setSelectedIds((current) => {
      const next = new Set(current)
      for (const item of available) {
        if (allSelected) next.delete(item.id)
        else next.add(item.id)
      }
      return next
    })
  }
  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }
  function handleAdd() {
    const ids = available.filter((item) => selectedIds.has(item.id)).map((item) => item.id)
    if (ids.length) onAdd(ids)
  }
  function handleBackdrop(event: PointerEvent<HTMLDialogElement>) {
    const dialog = dialogRef.current
    if (!dialog || event.target !== dialog) return
    const bounds = dialog.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
  }

  function closeDialog() {
    dialogRef.current?.close()
    onClose()
  }

  function handleNativeClose() {
    // StrictMode 開發環境會先執行 effect cleanup 再重新掛載；忽略 cleanup 舊 close event。
    if (dialogRef.current?.open) return
    onClose()
  }

  return (
    <dialog ref={dialogRef} aria-labelledby="compare-picker-title" onClose={handleNativeClose} onPointerUp={handleBackdrop} className="compare-picker fixed inset-x-0 top-auto bottom-0 m-0 hidden max-h-[92dvh] w-full max-w-none flex-col gap-3 overflow-hidden rounded-t-block border-0 bg-card px-4 pt-2 pb-[calc(16px+env(safe-area-inset-bottom))] text-ink shadow-sheet backdrop:bg-scrim md:inset-auto md:left-1/2 md:top-1/2 md:bottom-auto md:max-h-[min(88dvh,984px)] md:w-[min(720px,calc(100vw-32px))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-card md:px-5 md:pt-4 md:pb-0 md:shadow-float">
      <span aria-hidden="true" className="mx-auto h-1 w-10 flex-none rounded-sm bg-line-strong md:hidden" />
      <header className="flex flex-none items-center gap-2">
        <h2 id="compare-picker-title" className="m-0 min-w-0 flex-1 truncate font-hd text-xl md:text-2xl">加入「{groupName}」</h2>
        <span className="hidden text-xs text-ink-2 md:inline">已經有 {groupWishlistIds.length} 件</span>
        <button type="button" onClick={closeDialog} aria-label="關閉挑選器" className="flex size-11 flex-none items-center justify-center rounded-btn text-ink"><Icon name="x" /></button>
      </header>

      <div role="tablist" aria-label="從哪裡加" className="flex flex-none gap-1 rounded-btn bg-tile p-[3px]">
        <PickerTab selected={tab === 'wishlist'} onClick={() => setTab('wishlist')}>選購清單 <span className="font-num text-xs opacity-70">{items.length}</span></PickerTab>
        <PickerTab selected={tab === 'closet'} disabled onClick={() => setTab('closet')}>我的衣櫃</PickerTab>
        <PickerTab selected={tab === 'url'} onClick={() => setTab('url')}>貼網址</PickerTab>
      </div>

      {tab === 'wishlist' ? <>
        <label className="flex min-h-11 flex-none items-center gap-2 rounded-tile border-[1.5px] border-line-strong bg-paper px-3">
          <Icon name="search" size={18} className="text-ink-3" />
          <span className="sr-only">搜尋商品名稱、店家或編號</span>
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋名稱、店家、編號" className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-ink-3" />
        </label>

        <div className="compare-picker__filters flex-none">
          <WishlistFilters
            status={status}
            facets={facets}
            statusCounts={statusCounts}
            partCounts={partCounts}
            typeCounts={typeCounts}
            lengthCounts={lengthCounts}
            onStatus={setStatus}
            onFacets={setFacets}
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-0.5" role="group" aria-label="符合條件的選購商品">
          {visible.length === 0 && <p className="m-0 py-8 text-center text-sm text-ink-2">沒有符合篩選的商品。</p>}
          {visible.map((item) => {
            const locked = existing.has(item.id)
            const checked = locked || selectedIds.has(item.id)
            const otherGroups = (memberships[item.id] ?? []).filter((entry) => entry.groupId !== groupId)
            const details = [item.brand ?? item.shop, item.productCode ? `#${item.productCode.replace(/^#/, '')}` : null, item.size].filter(Boolean).join('・')
            return (
              <div key={item.id} className={`compare-picker__item flex min-w-0 items-center gap-2 rounded-card px-1 py-2 ${checked ? 'bg-card-selected' : 'bg-card'} ${locked ? 'opacity-75' : ''}`}>
                <Checkbox checked={checked} disabled={locked} label={`${locked ? '已在這個比較：' : '加入比較：'}${item.name}`} onCheckedChange={(next) => toggleOne(item.id, next)} />
                <span className="flex size-[56px] flex-none items-center justify-center overflow-hidden rounded-btn bg-rose-soft"><ItemImage name={item.name} cutoutUrl={item.cutoutUrl} shape={item.shape} colorHex={item.colorHex} className="h-[80%] w-[80%]" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{item.name}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-ink-2"><span className="font-num font-bold">{formatNT(item.price)}</span>{details && <span>{details}</span>}{locked && <span className="rounded-full bg-tile px-2 py-0.5">已在這個比較</span>}{otherGroups.map((entry) => <span key={entry.groupId} className="rounded-full bg-mist-soft px-2 py-0.5 text-mist-ink">也在：{entry.groupName}</span>)}</span>
                </span>
              </div>
            )
          })}
        </div>
      </> : tab === 'closet' ? (
        <div className="flex min-h-44 flex-1 items-center justify-center rounded-card bg-paper p-6 text-center text-sm leading-6 text-ink-2">「我的衣櫃」作為比較基準會在第二階段開放。</div>
      ) : (
        <div className="flex min-h-44 flex-1 flex-col items-center justify-center gap-3 rounded-card bg-paper p-6 text-center">
          <p className="m-0 text-sm leading-6 text-ink-2">貼上商品網址會開啟「加入選購」表單，存好後自動加入這個比較。</p>
          <button type="button" onClick={onAddUrl} className="inline-flex min-h-11 items-center gap-2 rounded-btn bg-ink px-4 text-sm font-medium text-paper"><Icon name="plus" size={18} />開啟加入選購</button>
        </div>
      )}

      {tab === 'wishlist' && <footer className="compare-picker__footer -mx-4 flex flex-none items-center gap-1 border-t-[1.5px] border-dashed border-line-strong bg-card px-2 py-2 pb-[calc(8px+env(safe-area-inset-bottom))] md:-mx-5 md:gap-2 md:px-4 md:pb-4">
        <Checkbox tone="dark" checked={allSelected} indeterminate={someSelected} disabled={!available.length} label={`全選目前 ${available.length} 件`} onCheckedChange={toggleAll} />
        <span className="min-w-0 flex-1 text-xs leading-5 text-ink-2 md:text-sm">全選目前 <b className="font-num text-ink">{available.length}</b> 件<span className="hidden md:inline">（不含已在比較的 {visible.length - available.length} 件）</span><span className="block md:hidden">已選 {selectedVisible.length}</span></span>
        <button type="button" onClick={closeDialog} className="min-h-11 rounded-btn px-2 text-sm text-ink-2">取消</button>
        <button type="button" disabled={!selectedVisible.length} onClick={handleAdd} className="inline-flex min-h-11 min-w-[118px] items-center justify-center rounded-btn bg-ink px-3 text-sm font-medium text-paper disabled:cursor-not-allowed disabled:opacity-50">{selectedVisible.length ? `加入 ${selectedVisible.length} 件` : '先勾選商品'}</button>
      </footer>}
    </dialog>
  )
}

function PickerTab({ selected, disabled = false, onClick, children }: { selected: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" role="tab" aria-selected={selected} disabled={disabled} onClick={onClick} className={`min-h-10 flex-1 rounded-sm px-1 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-45 ${selected ? 'bg-card text-ink shadow-sticker' : 'text-ink-2'}`}>{children}</button>
}

function majorityPart(items: WishlistItem[]): Slot | null {
  const counts = new Map<Slot, number>()
  for (const item of items) {
    const slot = item.primaryPart ?? item.slot
    counts.set(slot, (counts.get(slot) ?? 0) + 1)
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

function majorityType(items: WishlistItem[], slot: Slot): string | null {
  const counts = new Map<string, number>()
  for (const item of items.filter((entry) => (entry.primaryPart ?? entry.slot) === slot)) {
    const id = garmentTypeOf(item)?.id
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

function majorityLength(items: WishlistItem[], type: string): GarmentLength | null {
  const counts = new Map<GarmentLength, number>()
  for (const item of items.filter((entry) => garmentTypeOf(entry)?.id === type)) if (item.garmentLength) counts.set(item.garmentLength, (counts.get(item.garmentLength) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}
