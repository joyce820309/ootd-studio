/** 搭配板上的部位。順序即固定板型由上而下的邏輯順序。 */
export type Slot = 'outer' | 'top' | 'bottom' | 'shoes' | 'bag' | 'acc'

export type ItemStatus = 'ok' | 'cleaning' | 'repair' | 'lent' | 'stored' | 'retired'

export type CutoutStatus = 'pending' | 'processing' | 'done' | 'failed' | 'skipped'

/** 示範資料用的衣物剪影；正式資料使用去背圖片。 */
export type GarmentShape =
  | 'tee'
  | 'shirt'
  | 'knit'
  | 'pants'
  | 'skirt'
  | 'coat'
  | 'dress'
  | 'shoe'
  | 'boot'
  | 'bag'
  | 'scarf'
  | 'sock'

export interface Category {
  id: string
  name: string
  /** 對應到搭配板的哪個部位；「其他」為 null */
  slot: Slot | null
  sort: number
}

export interface ClosetItem {
  id: string
  name: string
  categoryId: string
  slot: Slot
  colorName: string
  colorHex: string
  brand?: string
  size?: string
  status: ItemStatus
  isFavorite?: boolean
  cutoutUrl?: string
  /** 沒有圖片時的示範剪影 */
  shape?: GarmentShape
  wearCount?: number
  lastWornAt?: string
}

export type WishStatus = 'considering' | 'waiting' | 'ready' | 'bought' | 'dropped'

export interface WishlistItem {
  id: string
  name: string
  slot: Slot
  colorHex: string
  shop: string
  price: number
  shipping?: number
  url?: string
  sizeNote?: string
  status: WishStatus
  compareGroupId?: string
  cutoutUrl?: string
  shape?: GarmentShape
}

/** 搭配板上的一格：可以是衣櫃單品或選購中的商品 */
export type OutfitPick =
  | { kind: 'closet'; itemId: string }
  | { kind: 'wish'; wishId: string }

export type OutfitTemplate = 'full' | 'column'

export interface Outfit {
  id?: string
  name: string
  date: string
  template: OutfitTemplate
  picks: Partial<Record<Slot, OutfitPick>>
  occasion?: string
  note?: string
}
