import { Link } from 'react-router-dom'
import { StatusTag } from '@/components/ui/Chip'
import { SLOT_META } from '@/lib/slots'
import type { ClosetItem } from '@/types'
import { ItemImage } from './ItemImage'

/** 衣櫃網格卡片：4:5 去背圖為主角，只顯示名稱、顏色、品牌；非可穿狀態才顯示標籤。 */
export function ItemTile({ item }: { item: ClosetItem }) {
  const away = item.status !== 'ok'
  const categoryColor = item.categorySlot === null ? undefined : SLOT_META[item.categorySlot ?? item.slot].solid
  return (
    <Link to={`/closet/${item.id}`} className="group flex flex-col gap-2 text-ink no-underline">
      <span className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-tile bg-tile transition-colors group-hover:bg-apricot">
        <ItemImage
          name={item.name}
          colorHex={item.colorHex}
          cutoutUrl={item.cutoutUrl}
          shape={item.shape}
          className={`size-[72%] ${away ? 'opacity-55' : ''}`}
        />
        {categoryColor && <span aria-hidden="true" className="absolute top-2.5 left-2.5 size-2.5 rounded-full ring-2 ring-card" style={{ background: categoryColor }} />}
        {away && <StatusTag status={item.status} className="absolute bottom-2 left-2" />}
      </span>
      <span className="text-sm leading-snug font-medium">{item.name}</span>
      <span className="-mt-1 text-xs text-ink-2">
        {item.colorName}
        {item.brand ? ` · ${item.brand}` : ''}
      </span>
    </Link>
  )
}
