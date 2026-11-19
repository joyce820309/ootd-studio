import { Chip } from '@/components/ui/Chip'
import { Select } from '@/components/ui/Select'
import { SLOTS } from '@/lib/slots'
import { facetsShowLength, GARMENT_LENGTH_LABELS, garmentTypeOptions, normalizeFacets, toggleValue, typeKey, WISH_TABS, type WishFacets } from '@/lib/wishlist'
import type { GarmentLength, Slot, WishStatus } from '@/types'

type StatusKey = WishStatus | 'all'

interface WishlistFiltersProps {
  status: StatusKey
  facets: WishFacets
  statusCounts: Record<StatusKey, number>
  partCounts: Record<Slot | 'all', number>
  /** 鍵為「部位:類型」與「部位:all」 */
  typeCounts: Record<string, number>
  lengthCounts?: Record<GarmentLength | 'all', number>
  onStatus: (status: StatusKey) => void
  onFacets: (facets: WishFacets) => void
  /** 是否顯示長度那一排（比較挑選器也用） */
  withLength?: boolean
  className?: string
}

/**
 * 篩選區（B7.2）：狀態 → 部位 → 類型 → 長度。
 * 狀態單選；部位、類型、長度都可多選，「全部」＝清空該排。選了幾個部位就出現幾排類型。
 */
export function WishlistFilters({ status, facets, statusCounts, partCounts, typeCounts, lengthCounts, onStatus, onFacets, withLength = true, className = '' }: WishlistFiltersProps) {
  const set = (next: Partial<WishFacets>) => onFacets(normalizeFacets({ ...facets, ...next }))
  const typeParts = facets.parts.filter((part) => garmentTypeOptions(part).length > 0)
  const showLength = withLength && !!lengthCounts && facetsShowLength(facets)
  const statusLabel = WISH_TABS.find((tab) => tab.key === status)?.label ?? '全部'
  const scrollRow = '-mx-4 flex flex-none gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:overflow-visible md:px-0'

  return (
    <section aria-label="篩選" className={`wishlist-filters flex flex-col gap-2.5 md:rounded-[16px] md:bg-card md:px-4 md:py-3.5 ${className}`}>
      <div className="wishlist-filters__row wishlist-filters__row--status hidden items-center gap-2 md:flex">
        <span className="wishlist-filters__label w-9 flex-none text-xs text-ink-3">狀態</span>
        <div role="group" aria-label="依狀態篩選" className="flex flex-wrap gap-2">
          {WISH_TABS.map((tab) => (
            <Chip key={tab.key} selected={status === tab.key} onClick={() => onStatus(tab.key)} className="h-[38px]">
              {tab.label}
              <span className="font-num text-xs font-bold tabular opacity-70">{statusCounts[tab.key]}</span>
            </Chip>
          ))}
        </div>
      </div>

      <div className="wishlist-filters__row--status-mobile md:hidden">
        <Select
          label="依狀態篩選"
          value={status}
          options={WISH_TABS.map((tab) => ({ value: tab.key, label: tab.label, hint: String(statusCounts[tab.key]) }))}
          onChange={onStatus}
          display={<span className="text-xs text-ink-2">狀態：<b className="font-medium text-ink">{statusLabel}</b></span>}
          triggerClassName="h-11 rounded-btn px-1 text-xs"
          className="w-fit"
        />
      </div>

      <div className="wishlist-filters__row wishlist-filters__row--part flex items-center gap-2">
        <span className="wishlist-filters__label hidden w-9 flex-none text-xs text-ink-3 md:block">部位</span>
        <div role="group" aria-label="依部位篩選，可多選" className={scrollRow}>
          <Chip selected={!facets.parts.length} onClick={() => set({ parts: [], types: [], lengths: [] })} dotColor="var(--color-line-strong)" className="h-[38px] flex-none">
            全部<span className="font-num text-xs font-bold tabular opacity-70">{partCounts.all}</span>
          </Chip>
          {SLOTS.map((slot) => (
            <Chip key={slot.slot} selected={facets.parts.includes(slot.slot)} onClick={() => set({ parts: toggleValue(facets.parts, slot.slot) })} dotColor={slot.solid} className="h-[38px] flex-none">
              {slot.label}
              <span className="font-num text-xs font-bold tabular opacity-70">{partCounts[slot.slot]}</span>
            </Chip>
          ))}
        </div>
      </div>

      {typeParts.map((part) => {
        const label = SLOTS.find((slot) => slot.slot === part)?.label ?? ''
        const picked = facets.types.filter((key) => key.startsWith(`${part}:`))
        const others = facets.types.filter((key) => !key.startsWith(`${part}:`))
        const uncategorized = typeKey(part, 'uncategorized')
        return (
          <div key={part} className="wishlist-filters__row wishlist-filters__row--type flex items-center gap-2 md:pl-11">
            <span className="wishlist-filters__label hidden flex-none text-xs text-ink-3 md:block">{label}類型</span>
            <div role="group" aria-label={`${label}類型，可多選`} className={scrollRow}>
              <TypeChip selected={!picked.length} count={typeCounts[typeKey(part, 'all')] ?? 0} onClick={() => set({ types: others })}>{typeParts.length > 1 ? `${label}全部` : '全部'}</TypeChip>
              {garmentTypeOptions(part).filter((option) => (typeCounts[typeKey(part, option.id)] ?? 0) > 0).map((option) => (
                <TypeChip key={option.id} selected={picked.includes(typeKey(part, option.id))} count={typeCounts[typeKey(part, option.id)] ?? 0} onClick={() => set({ types: toggleValue(facets.types, typeKey(part, option.id)) })}>{option.label}</TypeChip>
              ))}
              {(typeCounts[uncategorized] ?? 0) > 0 && <TypeChip selected={picked.includes(uncategorized)} count={typeCounts[uncategorized]} onClick={() => set({ types: toggleValue(facets.types, uncategorized) })}>未分類</TypeChip>}
            </div>
          </div>
        )
      })}

      {showLength && (
        <div className="wishlist-filters__row wishlist-filters__row--length flex items-center gap-2 md:pl-11">
          <span className="wishlist-filters__label hidden flex-none text-xs text-ink-3 md:block">{facets.parts.length > 1 ? '下身長度' : '長度'}</span>
          <div role="group" aria-label="依下身長度篩選，可多選" className={scrollRow}>
            <TypeChip selected={!facets.lengths.length} count={lengthCounts?.all ?? 0} onClick={() => set({ lengths: [] })}>全部</TypeChip>
            {(['short', 'mid', 'long'] as const).filter((value) => (lengthCounts?.[value] ?? 0) > 0 || facets.lengths.includes(value)).map((value) => (
              <TypeChip key={value} selected={facets.lengths.includes(value)} count={lengthCounts?.[value] ?? 0} onClick={() => set({ lengths: toggleValue(facets.lengths, value) })}>{GARMENT_LENGTH_LABELS[value]}</TypeChip>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

/** 第三層「類型」：虛線框是沒選、霧藍實線框是已選，和上面兩層的深色 Chip 區分開。 */
function TypeChip({ selected, count, onClick, children }: { selected: boolean; count: number; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`wishlist-type-chip inline-flex h-[34px] flex-none items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-3 text-[13px] font-medium ${
        selected ? 'border-mist-deep bg-mist-soft text-mist-ink' : 'border-dashed border-line-strong bg-transparent text-ink-2 hover:border-ink-3'
      }`}
    >
      {children}
      <span className="font-num text-xs tabular opacity-75">{count}</span>
    </button>
  )
}
