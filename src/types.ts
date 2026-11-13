/** 搭配板上的部位。順序即固定板型由上而下的邏輯順序。 */
export type Slot = 'outer' | 'top' | 'bottom' | 'shoes' | 'bag' | 'acc'

export type ItemStatus = 'ok' | 'not_arrived' | 'cleaning' | 'repair' | 'lent' | 'stored' | 'retired'

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

export type AddItemDestination = 'closet' | 'wishlist'

export interface NewGarmentInput {
  name: string
  categoryId: string
  colorName: string
  colorHex: string
  secondColorHex?: string
  brand?: string
  size?: string
  necklineSize?: number | null
  seasons: string[]
  material?: string
  materialComposition?: string
  purchasePrice?: number | null
  purchaseDate?: string | null
  store?: string
  productUrl?: string
  note?: string
  flatMeasurements: Record<string, number | null>
  destination: AddItemDestination
  closetStatus?: Extract<ItemStatus, 'ok' | 'not_arrived'>
  useCutout: boolean
}

export interface ItemPhoto {
  id: string
  itemId?: string
  wishlistItemId?: string
  path: string
  sortOrder: number
  isCover: boolean
}

export interface ClosetItem {
  id: string
  name: string
  categoryId: string
  slot: Slot
  categorySlot?: Slot | null
  categoryName?: string
  colorName: string
  colorHex: string
  secondColorHex?: string
  brand?: string
  size?: string
  necklineSize?: number
  fit?: string
  material?: string
  materialComposition?: string
  seasons?: string[]
  occasions?: string[]
  purchaseDate?: string
  purchasePrice?: number
  store?: string
  productUrl?: string
  note?: string
  flatMeasurements?: Record<string, number | null>
  status: ItemStatus
  isFavorite?: boolean
  cutoutUrl?: string
  originalUrl?: string
  cutoutStatus?: CutoutStatus
  photos?: ClosetPhoto[]
  /** 沒有圖片時的示範剪影 */
  shape?: GarmentShape
  wearCount?: number
  lastWornAt?: string
}

export interface ClosetPhoto {
  id: string
  path: string
  url?: string
  sortOrder: number
  isCover: boolean
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
  colorName?: string
  brand?: string
  /** 預計購買的尺寸 */
  size?: string
  necklineSize?: number
  targetPrice?: number
  /** 1 低・2 中・3 高 */
  priority?: WishPriority
  /** 想買的理由（手帳筆記） */
  reason?: string
  material?: string
  returnPolicy?: string
  boughtItemId?: string
  createdAt?: string
}

export type WishPriority = 1 | 2 | 3

/** 選購清單新增／編輯表單的內容 */
export interface WishlistInput {
  name: string
  slot: Slot
  colorHex: string
  colorName?: string
  shop: string
  url?: string
  price: number
  shipping: number | null
  targetPrice: number | null
  brand?: string
  size?: string
  sizeNote?: string
  necklineSize?: number | null
  priority: WishPriority | null
  reason?: string
  material?: string
  returnPolicy?: string
  status: Exclude<WishStatus, 'bought'>
  /** undefined＝不變更所屬群組；null＝移出群組 */
  compareGroupId?: string | null
}

/** 比較群組：同一個需求的多個候選，例如「冬天想要一條寬褲」。 */
export interface CompareGroup {
  id: string
  title: string
  budget?: number
  createdAt?: string
}

export interface CompareGroupInput {
  title: string
  budget: number | null
}

/** 搭配板上的一格：可以是衣櫃單品或選購中的商品。 */
export type OutfitPick =
  | { kind: 'closet'; itemId: string }
  | { kind: 'wish'; wishId: string }

export type OutfitTemplate = 'full' | 'column' | 'free'

export interface Placement {
  /** 中心點，佔畫布寬度的百分比。 */
  x: number
  /** 中心點，佔畫布高度的百分比。 */
  y: number
  /** 單品寬度，佔畫布寬度的百分比。 */
  w: number
  rot: number
  z: number
}

export type FreeLayout = Record<Slot, Placement>

export interface Outfit {
  id?: string
  name: string
  date: string
  template: OutfitTemplate
  picks: Partial<Record<Slot, OutfitPick>>
  layout?: Partial<FreeLayout>
  occasion?: string
  note?: string
  /** 含未購買單品的「如果買了」試搭，不計入穿著次數 */
  isHypothetical?: boolean
}

export interface ShoeSize {
  label: string
  eu: string
  us: string
  uk: string
  jp: string
}

export interface ProfilePreferences {
  aiUseBodyData: boolean
  shoeSizes: ShoeSize[]
  frequentSizes: string[]
  fitPreferences: string[]
  highlightAreas: string
  proportionNotes: string
  dislikedCuts: string[]
}

export interface BodyMeasurement {
  id: string
  measuredOn: string
  heightCm: number | null
  weightKg: number | null
  shoulderCm: number | null
  upperBustCm: number | null
  underBustCm: number | null
  waistCm: number | null
  navelCm: number | null
  hipCm: number | null
  armCm: number | null
  inseamCm: number | null
  thighCm: number | null
  footToeLengthCm: number | null
  footToeWidthCm: number | null
  footToeBallCm: number | null
  footToeInstepCm: number | null
  footSockLengthCm: number | null
  footSockWidthCm: number | null
  footSockBallCm: number | null
  footSockInstepCm: number | null
  footBareLengthCm: number | null
  footBareWidthCm: number | null
  footBareBallCm: number | null
  footBareInstepCm: number | null
  note: string
  createdAt: string
  updatedAt?: string
}

export type BodyMeasurementInput = Omit<BodyMeasurement, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }

export interface StudioCanvasItem {
  key: string
  source: 'closet' | 'wishlist'
  itemId: string
  placement: Placement
}

export type DiaryFeel = 'comfy' | 'ok' | 'uncomfy'
export type DiaryWeather = 'sunny' | 'cloudy' | 'overcast' | 'rain'

/** 穿搭日記的一筆紀錄（outfits 中有日期、非「如果買了」的穿搭） */
export interface DiaryEntry {
  id: string
  name: string
  /** 'YYYY-MM-DD' */
  date: string
  template: OutfitTemplate
  picks: Partial<Record<Slot, OutfitPick>>
  occasions: string[]
  rating: number | null
  feel: DiaryFeel | null
  weather: DiaryWeather | null
  temperatureC: number | null
  note: string
  photoUrl?: string
  createdAt: string
}

export interface DiaryEntryInput {
  name: string
  date: string
  /** 只放衣櫃單品；日記記的是真的穿過的 */
  picks: Partial<Record<Slot, string>>
  occasions: string[]
  rating: number | null
  feel: DiaryFeel | null
  weather: DiaryWeather | null
  temperatureC: number | null
  note: string
}

/** 新照片 File、null＝移除照片、undefined＝不變 */
export type DiaryPhotoChange = File | null | undefined

/** 品牌管理：一個品牌名稱在衣櫃與選購清單的使用情況 */
export interface BrandSummary {
  name: string
  closetCount: number
  wishCount: number
  /** 最後一次新增、穿著或放進選購清單的日期（YYYY-MM-DD） */
  lastUsed: string | null
}

/** 改名／合併／刪除時被改到的資料，給「復原」用 */
export interface BrandChange {
  name: string
  itemIds: string[]
  wishIds: string[]
}
