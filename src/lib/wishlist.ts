import { isInCloset, isWearable, SLOT_META, SLOTS } from './slots'
import type { ClosetItem, GarmentLength, Slot, WishlistItem, WishPriority, WishStatus } from '@/types'

export const WISH_STATUS: Record<WishStatus, { label: string; className: string }> = {
  considering: { label: '考慮中', className: 'bg-status-stored-bg text-status-stored-fg' },
  ready: { label: '準備購買', className: 'bg-status-ok-bg text-status-ok-fg' },
  bought: { label: '已購買', className: 'bg-oat-soft text-oat-ink' },
  dropped: { label: '已放棄', className: 'bg-tile text-ink-2' },
}

/** 篩選分頁順序；「全部」不含已購買，與設計稿一致。 */
export const WISH_TABS: { key: WishStatus | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'considering', label: '考慮中' },
  { key: 'ready', label: '準備購買' },
  { key: 'bought', label: '已購買' },
  { key: 'dropped', label: '已放棄' },
]

export const ACTIVE_STATUSES: WishStatus[] = ['considering', 'ready']
export const isActiveWish = (item: WishlistItem) => ACTIVE_STATUSES.includes(item.status)

export interface GarmentTypeOption {
  id: string
  label: string
  /** 沒有手動選類型時，用商品名稱比對這些字推測（先比對到的優先）。 */
  pattern: RegExp
}

/**
 * 選購候選的部位類型（規格：docs/specs/categories.md）。
 * 陣列順序是名稱推測的比對優先順序：較明確的字放前面（例：牛仔褲先於褲子、發熱衣先於長袖）；
 * 畫面上的顯示順序另見 GARMENT_TYPE_ORDER。
 */
export const GARMENT_TYPES: Partial<Record<Slot, GarmentTypeOption[]>> = {
  top: [
    { id: 'thermal', label: '發熱衣', pattern: /發熱衣|保暖衣|發熱背心|heattech|thermal/i },
    { id: 'vest', label: '背心・小可愛', pattern: /背心|小可愛|細肩帶|吊帶/ },
    { id: 'shirt', label: '襯衫', pattern: /襯衫|襯衣/ },
    { id: 'knit', label: '針織・毛衣', pattern: /針織|毛衣|羊毛衫/ },
    { id: 'tee', label: 'T 恤・大學 T・帽 T', pattern: /T\s?恤|大學\s?T|帽\s?T|連帽上衣|短袖|長袖|tee|hoodie/i },
  ],
  outer: [
    { id: 'outdoor', label: '機能外套', pattern: /機能外套|衝鋒|防水外套|防風外套|雨衣|gore-?tex|shell jacket|hardshell|softshell/i },
    { id: 'gilet', label: '背心外套', pattern: /毛絨背心|毛毛背心|鋪棉背心|羽絨背心|針織背心|背心外套|gilet/i },
    { id: 'puffer', label: '羽絨・鋪棉', pattern: /羽絨|鋪棉|棉服|派克|puffer|parka/i },
    { id: 'cardigan', label: '開衫・針織', pattern: /開衫|針織外套|針織衫/ },
    { id: 'blazer', label: '西裝', pattern: /西裝外套|西裝|blazer/i },
    { id: 'coat', label: '大衣・風衣', pattern: /大衣|風衣|長版外套|coat|trench/i },
    { id: 'jacket', label: '夾克', pattern: /牛仔外套|牛仔夾克|皮衣|皮外套|飛行外套|襯衫外套|夾克|jacket/i },
  ],
  bottom: [
    { id: 'thermal', label: '發熱褲', pattern: /發熱褲|保暖褲|thermal/i },
    { id: 'outdoor', label: '機能褲', pattern: /機能褲|防水褲|雪褲|衝鋒褲|outdoor pants/i },
    { id: 'leggings', label: '內搭褲・瑜珈褲', pattern: /內搭褲|瑜珈褲|瑜伽褲|leggings/i },
    { id: 'jeans', label: '牛仔褲', pattern: /牛仔褲|牛仔短褲|jeans/i },
    { id: 'wide', label: '寬褲', pattern: /寬褲|闊腿褲|寬版.{0,6}褲|wide[- ]?leg/i },
    { id: 'skirt', label: '裙子', pattern: /裙|褲裙|skirt/i },
    { id: 'pants', label: '褲子', pattern: /褲|pants/i },
  ],
  shoes: [
    { id: 'boots', label: '長靴・雪靴', pattern: /靴|boots?/i },
    { id: 'sandals', label: '涼鞋', pattern: /涼鞋|sandals?/i },
    { id: 'heels', label: '跟鞋', pattern: /跟鞋|高跟鞋|heels?/i },
    { id: 'flats', label: '平底・樂福', pattern: /平底鞋|樂福鞋|便士鞋|flat shoes?|loafers?/i },
    { id: 'sneakers', label: '運動鞋', pattern: /運動鞋|球鞋|慢跑鞋|sneakers?/i },
  ],
  bag: [
    { id: 'mini', label: '小廢包', pattern: /小廢包|迷你包|小包|mini bag/i },
    { id: 'clutch', label: '手拿', pattern: /手拿包|晚宴包|clutch/i },
    { id: 'backpack', label: '後背', pattern: /後背包|背包|backpack/i },
    { id: 'crossbody', label: '斜背', pattern: /斜背|斜肩|crossbody/i },
    { id: 'tote', label: '托特・肩背', pattern: /托特|肩背包|tote/i },
  ],
  acc: [
    { id: 'socks', label: '襪子・襪套', pattern: /襪子|襪套|socks?/i },
    { id: 'scarf', label: '圍巾・披肩', pattern: /圍巾|披肩|絲巾|scarf|shawl/i },
    { id: 'hat', label: '帽子', pattern: /帽子|毛帽|棒球帽|漁夫帽|hat/i },
    { id: 'belt', label: '皮帶', pattern: /皮帶|腰帶|belt/i },
    { id: 'necklace', label: '項鍊', pattern: /項鍊|鎖骨鍊|necklace/i },
  ],
}

/** 篩選、表單與卡片的顯示順序，與規格列出的順序一致。 */
export const GARMENT_TYPE_ORDER: Partial<Record<Slot, string[]>> = {
  top: ['tee', 'knit', 'vest', 'shirt', 'thermal'],
  outer: ['cardigan', 'blazer', 'jacket', 'coat', 'puffer', 'gilet', 'outdoor'],
  bottom: ['pants', 'wide', 'jeans', 'skirt', 'leggings', 'thermal', 'outdoor'],
  shoes: ['sneakers', 'flats', 'boots', 'sandals', 'heels'],
  bag: ['tote', 'crossbody', 'backpack', 'clutch', 'mini'],
  acc: ['hat', 'scarf', 'belt', 'socks', 'necklace'],
}

export const GARMENT_LENGTH_LABELS: Record<GarmentLength, string> = { short: '短', mid: '中', long: '長' }
export const GARMENT_LENGTH_TYPE_IDS = ['pants', 'wide', 'jeans', 'skirt', 'leggings'] as const
export const hasGarmentLength = (typeId: string | null | undefined) => GARMENT_LENGTH_TYPE_IDS.includes(typeId as (typeof GARMENT_LENGTH_TYPE_IDS)[number])

const GARMENT_LENGTH_NAMES: Record<string, Partial<Record<GarmentLength, string>>> = {
  pants: { short: '短褲', mid: '七分褲', long: '長褲' },
  wide: { short: '寬版短褲', mid: '寬版七分褲', long: '寬褲' },
  jeans: { short: '牛仔短褲', mid: '七分牛仔褲', long: '牛仔長褲' },
  skirt: { short: '短裙', mid: '中長裙', long: '長裙' },
  leggings: { short: '短版內搭褲', mid: '七分內搭褲', long: '內搭褲' },
}

/* ── 篩選列（部位／類型／長度皆可多選） ───────────────── */

/**
 * 空陣列＝「全部」。類型以「部位:類型」記錄（不同部位有同名代碼，例如 thermal、outdoor），
 * 沒有類型的寫成「部位:uncategorized」。
 */
export interface WishFacets {
  parts: Slot[]
  types: string[]
  lengths: GarmentLength[]
}

export const wishPartOf = (item: Pick<WishlistItem, 'slot' | 'primaryPart'>): Slot => item.primaryPart ?? item.slot
export const typeKey = (part: Slot, typeId: string) => `${part}:${typeId}`
export const splitTypeKey = (key: string) => { const [part, typeId = ''] = key.split(':'); return { part: part as Slot, typeId } }
export const wishTypeKey = (item: Pick<WishlistItem, 'name' | 'slot' | 'primaryPart' | 'garmentType'>) => typeKey(wishPartOf(item), garmentTypeOf(item)?.id ?? 'uncategorized')
export const toggleValue = <T,>(list: readonly T[], value: T): T[] => (list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value])

const LENGTH_ORDER: GarmentLength[] = ['short', 'mid', 'long']

/** 已選類型屬於還沒選的部位就拿掉；沒選下身、或選的下身類型都沒有長度時清掉長度。 */
export function normalizeFacets(facets: WishFacets): WishFacets {
  const parts = SLOTS.map((slot) => slot.slot).filter((slot) => facets.parts.includes(slot))
  const types = [...new Set(facets.types)].filter((key) => {
    const { part, typeId } = splitTypeKey(key)
    return parts.includes(part) && (typeId === 'uncategorized' || garmentTypeOptions(part).some((option) => option.id === typeId))
  })
  const bottomTypes = types.filter((key) => splitTypeKey(key).part === 'bottom').map((key) => splitTypeKey(key).typeId)
  const lengthOn = parts.includes('bottom') && (!bottomTypes.length || bottomTypes.some(hasGarmentLength))
  return { parts, types, lengths: lengthOn ? LENGTH_ORDER.filter((value) => facets.lengths.includes(value)) : [] }
}

/** 是否要顯示「長度」那一排 */
export const facetsShowLength = (facets: WishFacets) => {
  const bottomTypes = facets.types.filter((key) => splitTypeKey(key).part === 'bottom').map((key) => splitTypeKey(key).typeId)
  return facets.parts.includes('bottom') && (!bottomTypes.length || bottomTypes.some(hasGarmentLength))
}

/**
 * 由上往下縮小：部位 → 類型 → 長度；每一層的件數以上一層的結果計算。
 * 類型按部位各自篩：選了「下身・寬褲」不影響同時選的上衣；長度只篩下身。
 */
export function applyWishFacets<T extends WishlistItem>(list: T[], facets: WishFacets) {
  const partCounts = Object.fromEntries([['all', list.length], ...SLOTS.map((slot) => [slot.slot, 0])]) as Record<Slot | 'all', number>
  for (const item of list) partCounts[wishPartOf(item)] += 1
  const byPart = facets.parts.length ? list.filter((item) => facets.parts.includes(wishPartOf(item))) : list

  const typeCounts: Record<string, number> = {}
  for (const item of byPart) {
    const part = wishPartOf(item)
    typeCounts[typeKey(part, 'all')] = (typeCounts[typeKey(part, 'all')] ?? 0) + 1
    typeCounts[wishTypeKey(item)] = (typeCounts[wishTypeKey(item)] ?? 0) + 1
  }
  const byType = byPart.filter((item) => {
    const part = wishPartOf(item)
    const picked = facets.types.filter((key) => splitTypeKey(key).part === part)
    return !picked.length || picked.includes(wishTypeKey(item))
  })

  const lengthCounts: Record<GarmentLength | 'all', number> = { all: 0, short: 0, mid: 0, long: 0 }
  for (const item of byType) {
    if (wishPartOf(item) !== 'bottom') continue
    lengthCounts.all += 1
    if (item.garmentLength) lengthCounts[item.garmentLength] += 1
  }
  const visible = facets.lengths.length ? byType.filter((item) => wishPartOf(item) !== 'bottom' || (!!item.garmentLength && facets.lengths.includes(item.garmentLength))) : byType
  return { partCounts, typeCounts, lengthCounts, visible }
}

export function garmentLengthName(typeId: string, length?: GarmentLength) {
  return length ? GARMENT_LENGTH_NAMES[typeId]?.[length] ?? null : null
}

/** 選購候選的尺碼選項；沒資料時回空陣列，不臆測衣物尺碼。 */
export function wishlistSizeOptions(value?: string) {
  if (!value?.trim()) return []
  const normalized = value.trim().replace(/[–—]/g, '-')
  const alpha = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
  const range = /^([A-Z]+)\s*-\s*([A-Z]+)$/i.exec(normalized)
  if (range) {
    const start = alpha.indexOf(range[1].toUpperCase())
    const end = alpha.indexOf(range[2].toUpperCase())
    if (start >= 0 && end >= start && end - start < 7) return alpha.slice(start, end + 1)
  }
  return normalized.split(/[、,/|・]/).map((part) => part.trim()).filter(Boolean)
}

export function garmentTypeOptions(part: Slot | undefined): GarmentTypeOption[] {
  if (!part) return []
  const options = GARMENT_TYPES[part] ?? []
  const order = GARMENT_TYPE_ORDER[part] ?? []
  return [...options].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
}

/** 手動選的類型優先；沒選就依名稱推測，推測不到回傳 null。 */
export function garmentTypeOf(item: Pick<WishlistItem, 'name' | 'slot' | 'primaryPart' | 'garmentType'>): GarmentTypeOption | null {
  const part = item.primaryPart ?? item.slot
  if (!part) return null
  const options = GARMENT_TYPES[part] ?? []
  return options.find((option) => option.id === item.garmentType) ?? options.find((option) => option.pattern.test(item.name)) ?? null
}

/**
 * 衣櫃單品的類型：衣櫃還沒存類型，先用名稱推測，推不出來再看分類名稱。
 * 和選購候選用同一組比對順序，所以「牛仔褲」只會算牛仔褲，不會同時算成褲子。
 */
export function closetItemTypeOf(item: Pick<ClosetItem, 'name' | 'categoryName' | 'slot'>): GarmentTypeOption | null {
  const options = GARMENT_TYPES[item.slot] ?? []
  return options.find((option) => option.pattern.test(item.name)) ?? (item.categoryName ? options.find((option) => option.pattern.test(item.categoryName!)) : undefined) ?? null
}

/** 衣櫃單品是否屬於某類型 */
export const closetItemHasType = (item: Pick<ClosetItem, 'name' | 'categoryName' | 'slot'>, type: GarmentTypeOption) => closetItemTypeOf(item)?.id === type.id

export const PRIORITY_LABEL: Record<WishPriority, string> = { 3: '高', 2: '中', 1: '低' }

export const formatNT = (value: number) => `NT$${value.toLocaleString('en-US')}`

/** 含運價格 */
export const totalPrice = (item: WishlistItem) => item.price + (item.shipping ?? 0)

export function formatAddedDate(iso?: string) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const SHOP_DOMAINS: [string[], string][] = [
  [['shopee.tw', 'shopee.com.tw', 'shopee.sg', 'shopee.com'], '蝦皮'],
  [['momoshop.com.tw'], 'momo'],
  [['pchome.com.tw'], 'PChome'],
  [['uniqlo.com', 'uniqlo.com.tw'], 'UNIQLO 線上'],
  [['gu-global.com', 'gu.com'], 'GU 線上'],
  [['cos.com', 'cosstores.com'], 'COS 官網'],
  [['arket.com'], 'Arket 官網'],
  [['zara.com'], 'ZARA 官網'],
  [['massimodutti.com'], 'Massimo Dutti'],
  [['hm.com'], 'H&M 官網'],
  [['muji.com', 'muji.com.tw'], 'MUJI 線上'],
  [['zalora.com', 'zalora.com.tw'], 'ZALORA'],
  [['pinkoi.com'], 'Pinkoi'],
]

/** 僅依 URL 網域推測已知店家，不連線讀取網頁；未知網域回傳 null。 */
export function shopFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url.trim())
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
    return SHOP_DOMAINS.find(([domains]) => domains.some((domain) => host === domain || host.endsWith(`.${domain}`)))?.[1] ?? null
  } catch {
    return null
  }
}

export function isValidProductUrl(url: string) {
  try {
    const parsed = new URL(url.trim())
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && !!parsed.hostname
  } catch {
    return false
  }
}

function hexToRgb(hex: string) {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function colorDistance(a: string, b: string) {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2)
}

function hexToHsl(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l }
  const s = d / (1 - Math.abs(2 * l - 1))
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h = (h * 60 + 360) % 360
  return { h, s, l }
}

/** 中性色（黑白灰、米色、低彩度）跟什麼都好搭 */
const isNeutral = (hex: string) => {
  const { s, l } = hexToHsl(hex)
  return s < 0.22 || l > 0.88 || l < 0.16
}

/** 簡單配色規則：任一方為中性色、同色系（色相差 ≤ 45°）或對比色（≥ 150°）視為好搭。 */
export function colorsGoTogether(a: string, b: string) {
  if (isNeutral(a) || isNeutral(b)) return true
  const diff = Math.abs(hexToHsl(a).h - hexToHsl(b).h)
  const hue = Math.min(diff, 360 - diff)
  return hue <= 45 || hue >= 150
}

export type Overlap = 'low' | 'mid' | 'high'
export const OVERLAP_LABEL: Record<Overlap, string> = { low: '重複度低', mid: '重複度中', high: '重複度高' }

export interface LookCell {
  slot: Slot
  name: string
  colorHex: string
  shape?: ClosetItem['shape']
  cutoutUrl?: string
  isWish: boolean
}

export interface WishInsights {
  /** 其他部位、目前可穿、配色合得來的衣物件數 */
  matchCount: number
  overlap: Overlap
  closest?: ClosetItem
  /** 拿來比重複的範圍：候選有類型時只比同類型（例：寬褲），沒類型時比同部位 */
  compareLabel: string
  /** 不重複使用單品的情況下，能組出幾套新穿搭 */
  lookCount: number
  looks: LookCell[][]
}

const LOOK_SLOTS: Slot[] = ['top', 'bottom', 'shoes']

/** 依衣櫃現況估算：能搭幾件、跟現有單品像不像、可以怎麼穿（簡單規則，不是 AI）。 */
export function wishInsights(wish: WishlistItem, closet: ClosetItem[]): WishInsights {
  const wearable = closet.filter((item) => isWearable(item.status))
  const matching = wearable.filter((item) => item.slot !== wish.slot && colorsGoTogether(item.colorHex, wish.colorHex))
  const matchCount = matching.length

  // 重複度只跟同類型比（寬褲只比寬褲），再從中挑顏色最接近的；候選沒有類型時才退回同部位
  const part = wish.primaryPart ?? wish.slot
  const type = garmentTypeOf(wish)
  const compareLabel = type ? type.label : SLOT_META[part].label
  const sameSlot = closet.filter((item) => item.slot === part && isInCloset(item.status) && (!type || closetItemHasType(item, type)))
  let closest: ClosetItem | undefined
  let best = Infinity
  for (const item of sameSlot) {
    const d = colorDistance(item.colorHex, wish.colorHex)
    if (d < best) {
      best = d
      closest = item
    }
  }
  const overlap: Overlap = !closest ? 'low' : best < 50 ? 'high' : best < 120 ? 'mid' : 'low'

  const needed = LOOK_SLOTS.filter((slot) => slot !== wish.slot)
  const bySlot = Object.fromEntries(SLOTS.map((s) => [s.slot, matching.filter((item) => item.slot === s.slot)])) as Record<Slot, ClosetItem[]>
  const lookCount = Math.min(...needed.map((slot) => bySlot[slot].length))

  const wishCell: LookCell = { slot: wish.slot, name: `${wish.name}（選購中）`, colorHex: wish.colorHex, shape: wish.shape, cutoutUrl: wish.cutoutUrl, isWish: true }
  const looks: LookCell[][] = []
  for (let i = 0; i < Math.min(2, lookCount); i++) {
    const cells: LookCell[] = needed.map((slot) => {
      const item = bySlot[slot][i]
      return { slot, name: item.name, colorHex: item.colorHex, shape: item.shape, cutoutUrl: item.cutoutUrl, isWish: false }
    })
    looks.push([wishCell, ...cells])
  }
  return { matchCount, overlap, closest, compareLabel, lookCount, looks }
}
