import { useMemo, useState, type ReactNode } from 'react'
import { ItemTile } from '@/components/closet/ItemTile'
import { ButtonLink } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Icon } from '@/components/ui/Icon'
import { LoadingState, PageState } from '@/components/ui/PageState'
import { PaperCard, TiltLabel } from '@/components/ui/Paper'
import { fetchClosetItems, useAsync } from '@/lib/data'
import { SLOTS } from '@/lib/slots'
import type { ItemStatus, Slot } from '@/types'

const STATUS_OPTIONS: { value: ItemStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部狀態' }, { value: 'ok', label: '可穿' }, { value: 'cleaning', label: '送洗中' },
  { value: 'repair', label: '維修中' }, { value: 'lent', label: '借出' }, { value: 'stored', label: '收納中' },
]

export function ClosetPage() {
  const { data: items, loading, error } = useAsync(fetchClosetItems)
  const [slot, setSlot] = useState<Slot | 'all'>('all')
  const [q, setQ] = useState('')
  const [season, setSeason] = useState('')
  const [color, setColor] = useState('')
  const [brand, setBrand] = useState('')
  const [size, setSize] = useState('')
  const [status, setStatus] = useState<ItemStatus | 'all'>('all')
  const [material, setMaterial] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const visible = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return (items ?? []).filter(
      (item) => (slot === 'all' || (item.categorySlot !== undefined ? item.categorySlot === slot : item.slot === slot))
        && (!kw || `${item.name} ${item.brand ?? ''} ${item.colorName} ${item.material ?? ''}`.toLowerCase().includes(kw))
        && (!season || item.seasons?.includes(season))
        && (!color || item.colorName.toLowerCase().includes(color.toLowerCase()))
        && (!brand || item.brand?.toLowerCase().includes(brand.toLowerCase()))
        && (!size || item.size?.toLowerCase().includes(size.toLowerCase()))
        && (status === 'all' || item.status === status)
        && (!material || item.material?.toLowerCase().includes(material.toLowerCase())),
    )
  }, [items, slot, q, season, color, brand, size, status, material])

  const availableCount = (items ?? []).filter((item) => item.status === 'ok' || item.status === 'stored').length
  const activeFilters = [
    season && { id: 'season', label: season, clear: () => setSeason('') },
    color && { id: 'color', label: `顏色：${color}`, clear: () => setColor('') },
    brand && { id: 'brand', label: `品牌：${brand}`, clear: () => setBrand('') },
    size && { id: 'size', label: `尺寸：${size}`, clear: () => setSize('') },
    status !== 'all' && { id: 'status', label: STATUS_OPTIONS.find((option) => option.value === status)?.label ?? '', clear: () => setStatus('all') },
    material && { id: 'material', label: `材質：${material}`, clear: () => setMaterial('') },
  ].filter((filter): filter is { id: string; label: string; clear: () => void } => Boolean(filter))
  const hasAnyFilter = activeFilters.length > 0 || slot !== 'all' || q.trim().length > 0

  function clearFilters() {
    setSeason('')
    setColor('')
    setBrand('')
    setSize('')
    setStatus('all')
    setMaterial('')
    setSlot('all')
    setQ('')
  }

  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-4 px-4 pt-5 pb-36 sm:gap-5 sm:px-6 sm:pt-8 md:px-8 md:pb-14">
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <TiltLabel accent="mist" as="h1">我的衣櫃</TiltLabel>
        {items && <span className="font-num text-sm text-ink-2 tabular">{items.length} 件・可穿 {availableCount}</span>}
        <ButtonLink to="/closet/new" variant="oat" className="ml-auto hidden sm:inline-flex"><Icon name="plus" />新增衣物</ButtonLink>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
          <span className="sr-only">搜尋衣物</span>
          <span className="absolute top-[11px] left-3 text-ink-3">
            <Icon name="search" size={18} />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜尋名稱、品牌、材質"
            className="h-11 w-full rounded-btn border-[1.5px] border-line bg-card pr-3 pl-[38px] text-sm text-ink"
          />
        </label>
        <Chip className="hidden sm:inline-flex" selected={slot === 'all'} onClick={() => setSlot('all')}>
          全部
        </Chip>
        {SLOTS.map((s) => (
          <Chip key={s.slot} className="hidden sm:inline-flex" selected={slot === s.slot} dotColor={s.solid} onClick={() => setSlot(s.slot)}>
            {s.label}
          </Chip>
        ))}
        <button type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)} className="flex h-11 flex-none items-center gap-2 rounded-btn border-[1.5px] border-line-strong bg-card px-3 text-sm text-ink"><Icon name="reset" size={17} />篩選{activeFilters.length > 0 && <span className="flex size-5 items-center justify-center rounded-full bg-ink text-[11px] text-paper">{activeFilters.length}</span>}</button>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:hidden" aria-label="衣物分類"><Chip selected={slot === 'all'} onClick={() => setSlot('all')}>全部</Chip>{SLOTS.map((meta) => <Chip key={meta.slot} selected={slot === meta.slot} dotColor={meta.solid} onClick={() => setSlot(meta.slot)}>{meta.label}</Chip>)}</div>
        {filtersOpen && <PaperCard className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
          <FilterField label="季節"><select value={season} onChange={(event) => setSeason(event.target.value)} className="h-11 w-full rounded-sm border border-line bg-paper px-2 text-sm"><option value="">全部季節</option>{['春', '夏', '秋', '冬'].map((value) => <option key={value} value={value}>{value}</option>)}</select></FilterField>
          <FilterField label="顏色"><input value={color} onChange={(event) => setColor(event.target.value)} placeholder="例如：燕麥" className="h-11 w-full rounded-sm border border-line bg-paper px-2 text-sm" /></FilterField>
          <FilterField label="品牌"><input value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="輸入品牌" className="h-11 w-full rounded-sm border border-line bg-paper px-2 text-sm" /></FilterField>
          <FilterField label="尺寸"><input value={size} onChange={(event) => setSize(event.target.value)} placeholder="輸入尺寸" className="h-11 w-full rounded-sm border border-line bg-paper px-2 text-sm" /></FilterField>
          <FilterField label="狀態"><select value={status} onChange={(event) => setStatus(event.target.value as ItemStatus | 'all')} className="h-11 w-full rounded-sm border border-line bg-paper px-2 text-sm">{STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></FilterField>
          <FilterField label="材質"><input value={material} onChange={(event) => setMaterial(event.target.value)} placeholder="輸入材質" className="h-11 w-full rounded-sm border border-line bg-paper px-2 text-sm" /></FilterField>
        </PaperCard>}
        {hasAnyFilter && <div className="flex flex-wrap items-center gap-2">{slot !== 'all' && <button type="button" onClick={() => setSlot('all')} className="min-h-9 rounded-full border border-line bg-card px-3 text-xs text-ink-2">{SLOTS.find((meta) => meta.slot === slot)?.label} ×</button>}{q.trim() && <button type="button" onClick={() => setQ('')} className="min-h-9 rounded-full border border-line bg-card px-3 text-xs text-ink-2">搜尋：{q} ×</button>}{activeFilters.map((filter) => <button key={filter.id} type="button" onClick={filter.clear} className="min-h-9 rounded-full border border-line bg-card px-3 text-xs text-ink-2">{filter.label} ×</button>)}<button type="button" onClick={clearFilters} className="min-h-9 px-2 text-xs text-mist-deep underline">清除篩選</button></div>}
        <div className="flex items-center justify-between text-xs text-ink-2"><span role="status" className="font-num tabular">顯示 {visible.length} / {items?.length ?? 0} 件</span>{items && <span>{hasAnyFilter ? '已套用篩選' : `${availableCount} 件目前可穿`}</span>}</div>
      </div>

      {loading && <LoadingState label="正在整理你的衣櫃…" />}
      {error && <div role="alert"><PageState icon="alert" tone="rose" compact title="衣櫃暫時打不開" description="資料讀取沒有成功，衣物內容不會被更動。確認連線後可以再試一次。" action={<ButtonLink to="/closet" variant="secondary" onClick={(event) => { event.preventDefault(); window.location.reload() }}>重新載入</ButtonLink>} /></div>}
      {items && items.length === 0 && (
        <PageState icon="closet" tone="oat" title="衣櫃還是空的" description="先放進第一件衣物吧，從最常穿的那件開始。" action={<ButtonLink to="/closet/new" variant="primary">加入第一件衣物</ButtonLink>} />
      )}
      {items && items.length > 0 && visible.length === 0 && (
        <PageState icon="search" tone="mist" compact title={q ? `找不到「${q}」` : '這個條件沒有衣物'} description="試試更短的關鍵字，或搜尋顏色、品牌；也可以換個分類看看。" action={<ButtonLink to="/wishlist/compare" variant="secondary">到比較試搭台找商品</ButtonLink>} />
      )}

      {!loading && !error && items && items.length > 0 && visible.length > 0 && <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-[repeat(auto-fill,minmax(168px,1fr))] sm:gap-x-4 sm:gap-y-6">
        {visible.map((item) => (
          <ItemTile key={item.id} item={item} />
        ))}
      </div>}
      <ButtonLink to="/closet/new" variant="oat" size="lg" className="fixed inset-x-4 bottom-[calc(82px+env(safe-area-inset-bottom))] z-20 shadow-float sm:hidden"><Icon name="plus" />新增衣物</ButtonLink>
    </main>
  )
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex min-w-0 flex-col gap-1 text-xs text-ink-2">{label}{children}</label>
}
