import { isWearable, SLOTS } from './slots'
import type { ClosetItem, Slot, WishlistItem, WishPriority, WishStatus } from '@/types'

export const WISH_STATUS: Record<WishStatus, { label: string; className: string }> = {
  considering: { label: '考慮中', className: 'bg-status-stored-bg text-status-stored-fg' },
  waiting: { label: '等待降價', className: 'bg-status-cleaning-bg text-status-cleaning-fg' },
  ready: { label: '準備購買', className: 'bg-status-ok-bg text-status-ok-fg' },
  bought: { label: '已購買', className: 'bg-oat-soft text-oat-ink' },
  dropped: { label: '已放棄', className: 'bg-tile text-ink-2' },
}

/** 篩選分頁順序；「全部」不含已購買，與設計稿一致。 */
export const WISH_TABS: { key: WishStatus | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'considering', label: '考慮中' },
  { key: 'waiting', label: '等待降價' },
  { key: 'ready', label: '準備購買' },
  { key: 'bought', label: '已購買' },
  { key: 'dropped', label: '已放棄' },
]

export const ACTIVE_STATUSES: WishStatus[] = ['considering', 'waiting', 'ready']
export const isActiveWish = (item: WishlistItem) => ACTIVE_STATUSES.includes(item.status)

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

const SHOP_NAMES: [RegExp, string][] = [
  [/shopee\./, '蝦皮'],
  [/momoshop\./, 'momo'],
  [/pchome\./, 'PChome'],
  [/uniqlo\./, 'UNIQLO 線上'],
  [/gu-global\.|\.gu\./, 'GU 線上'],
  [/cos\.com|cosstores\./, 'COS 官網'],
  [/arket\./, 'Arket 官網'],
  [/zara\./, 'ZARA 官網'],
  [/massimodutti\./, 'Massimo Dutti'],
  [/hm\.com/, 'H&M 官網'],
  [/muji\./, 'MUJI 線上'],
  [/zalora\./, 'ZALORA'],
  [/pinkoi\./, 'Pinkoi'],
]

/** 從商品網址推測店家名稱；無法解析時回傳 null。 */
export function shopFromUrl(url: string): string | null {
  let host: string
  try {
    host = new URL(url.trim()).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
  return SHOP_NAMES.find(([pattern]) => pattern.test(host))?.[1] ?? host
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

  const sameSlot = closet.filter((item) => item.slot === wish.slot && item.status !== 'retired')
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
  return { matchCount, overlap, closest, lookCount, looks }
}
