import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Icon } from '@/components/ui/Icon'
import type { CompareGroup, WishlistItem } from '@/types'

interface WishlistCompareMenuProps {
  item: WishlistItem
  groups: CompareGroup[]
  groupIds: string[]
  disabled?: boolean
  onToggle: (groupId: string, included: boolean) => void
  onCreate: () => void
}

/** 商品詳細「加入比較」多選選單，勾選即時生效。 */
export function WishlistCompareMenu({ item, groups, groupIds, disabled = false, onToggle, onCreate }: WishlistCompareMenuProps) {
  const [open, setOpen] = useState(false)
  const activeGroups = groups
  return <details className="relative" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary className={`inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-btn border-[1.5px] border-line-strong bg-card px-3 text-sm text-ink [&::-webkit-details-marker]:hidden ${disabled ? 'pointer-events-none opacity-50' : ''}`} aria-label={`將「${item.name}」加入比較`}>
      加入比較<Icon name="down" size={15} className="text-ink-2" />
    </summary>
    <div aria-label="加入比較" className="absolute left-0 top-full z-30 mt-1 flex w-[min(320px,calc(100vw-32px))] flex-col rounded-card border border-line bg-card p-1.5 shadow-float">
      {activeGroups.length ? activeGroups.map((group) => {
        const checked = groupIds.includes(group.id)
        return <div key={group.id} className="flex min-h-11 items-center gap-1 rounded-sm pr-2 hover:bg-paper">
          <Checkbox checked={checked} disabled={disabled} label={`${checked ? '從' : '加入'}「${group.name}」比較`} onCheckedChange={(next) => onToggle(group.id, next)} />
          <span className="min-w-0 flex-1 truncate text-sm">{group.name}</span>
          {group.archivedAt && <span className="text-[10px] text-ink-3">已封存</span>}
        </div>
      }) : <p className="m-0 px-3 py-2 text-xs text-ink-2">目前沒有未封存的比較。</p>}
      <div className="my-1 border-t border-line" />
      <Button type="button" variant="ghost" className="justify-start text-mist-deep" disabled={disabled} onClick={() => { setOpen(false); onCreate() }}><Icon name="plus" size={17} />新的比較</Button>
    </div>
  </details>
}
