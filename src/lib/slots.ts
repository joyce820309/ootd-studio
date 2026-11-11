import type { ItemStatus, Slot } from '@/types'

export interface SlotMeta {
  slot: Slot
  label: string
  required: boolean
  /** 實色：圓點、分類標記 */
  solid: string
  /** 疊色：搭配板格子底色（搭配 mix-blend-multiply） */
  wash: string
}

/** 部位設定。顏色引用 tokens.css 的 CSS 變數，不另外寫色碼。 */
export const SLOTS: SlotMeta[] = [
  { slot: 'outer', label: '外套', required: false, solid: 'var(--color-mist)', wash: 'var(--color-mist-wash)' },
  { slot: 'top', label: '上衣', required: true, solid: 'var(--color-oat)', wash: 'var(--color-oat-wash)' },
  { slot: 'bottom', label: '下身', required: true, solid: 'var(--color-sage)', wash: 'var(--color-sage-wash)' },
  { slot: 'shoes', label: '鞋子', required: true, solid: 'var(--color-rose)', wash: 'var(--color-rose-wash)' },
  { slot: 'bag', label: '包包', required: false, solid: 'var(--color-rose)', wash: 'var(--color-rose-wash)' },
  { slot: 'acc', label: '配件', required: false, solid: 'var(--color-oat)', wash: 'var(--color-oat-wash)' },
]

export const SLOT_META = Object.fromEntries(SLOTS.map((s) => [s.slot, s])) as Record<Slot, SlotMeta>

export const REQUIRED_SLOTS = SLOTS.filter((s) => s.required).map((s) => s.slot)

export const STATUS_LABEL: Record<ItemStatus, string> = {
  ok: '可穿',
  cleaning: '送洗中',
  repair: '維修中',
  lent: '借出',
  stored: '收納中',
  retired: '已淘汰',
}

/** 只有「可穿」與「收納中」可以放進今日搭配 */
export const isWearable = (status: ItemStatus) => status === 'ok' || status === 'stored'
