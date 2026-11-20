import { formatNT, wishlistSizeOptions } from '@/lib/wishlist'
import type { BuyLine, CompareGroup, CompareGroupItem, WishlistItem } from '@/types'

/** 商品沒有任何顏色時唯一的選項（B28） */
export const UNSPECIFIED_COLOR = '不指定顏色'

/** 這件商品可選的顏色（沒有 colors 時用舊的主色名；連主色名都沒有就是「不指定顏色」） */
export function buyColorOptions(item: WishlistItem): { name: string; hex?: string; favorite: boolean }[] {
  if (!item.colors?.length) return [{ name: item.colorName || UNSPECIFIED_COLOR, hex: item.colorHex, favorite: true }]
  return item.colors.map((color) => ({ name: color.name, hex: color.hex, favorite: color.favorite }))
}

/** 這件商品可選的尺碼；沒有尺碼清單時用平放尺寸量的尺碼，都沒有就是空陣列（不選尺碼） */
export function buySizeOptions(item: WishlistItem): string[] {
  const options = wishlistSizeOptions(item.size)
  return options.length || !item.flatMeasurementsSize ? options : [item.flatMeasurementsSize]
}

/**
 * 預設尺碼：比較裡選的「比的尺碼」→ 有平放尺寸的那個尺碼 → 清單第一個。
 * 依身體尺寸推薦需要各尺碼的尺寸表，目前只有一組平放尺寸，所以還不推算。
 */
export function defaultBuySize(item: WishlistItem, preferred?: string): string | undefined {
  const options = buySizeOptions(item)
  if (!options.length) return undefined
  if (preferred && options.includes(preferred)) return preferred
  if (item.flatMeasurementsSize && options.includes(item.flatMeasurementsSize)) return item.flatMeasurementsSize
  return options[0]
}

/** 不在比較頁時的「比的尺碼」：用最近更新的那個比較裡選的尺碼 */
export function chosenSizeFor(itemId: string, groups: CompareGroup[], links: CompareGroupItem[]): string | undefined {
  const stamp = (groupId: string) => { const group = groups.find((entry) => entry.id === groupId); return group?.updatedAt ?? group?.createdAt ?? '' }
  return links.filter((link) => link.wishlistItemId === itemId && link.chosenSize).sort((a, b) => stamp(b.groupId).localeCompare(stamp(a.groupId)))[0]?.chosenSize
}

/** 同一行的識別：顏色＋尺碼 */
export const buyLineKey = (line: BuyLine) => `${line.colorName}\u0000${line.size ?? ''}`

/** 「灰杏 M」；沒有尺碼只顯示色名 */
export const buyLineLabel = (line: BuyLine) => (line.size ? `${line.colorName} ${line.size}` : line.colorName)

/** 第一次準備購買：最想要的顏色（沒有就第一個顏色）× 預設尺碼 × 1 × 原價 */
export function defaultBuyLines(item: WishlistItem, preferredSize?: string): BuyLine[] {
  const options = buyColorOptions(item)
  const color = options.find((option) => option.favorite) ?? options[0]
  return [{ colorName: color?.name ?? UNSPECIFIED_COLOR, hex: color?.hex ?? item.colorHex, size: defaultBuySize(item, preferredSize), qty: 1, unitPrice: item.price }]
}

/** 舊明細沒有尺碼時補上預設尺碼 */
const withSizes = (item: WishlistItem, lines: BuyLine[], preferredSize?: string) => {
  const size = defaultBuySize(item, preferredSize)
  return lines.map((line) => (line.size || !size ? line : { ...line, size }))
}

/** 購買明細選擇器（B28）的起始草稿：已在採購籃就帶入目前明細，否則預設最想要那色 × 1 × 原價 */
export function buyDraftLines(item: WishlistItem, preferredSize?: string): BuyLine[] {
  return item.status === 'ready' && item.buyLines?.length ? withSizes(item, item.buyLines.map((line) => ({ ...line })), preferredSize) : defaultBuyLines(item, preferredSize)
}

/** 兩份明細是否相同（判斷草稿有沒有改過） */
export function sameBuyLines(a: BuyLine[], b: BuyLine[]) {
  return a.length === b.length && a.every((line, index) => buyLineKey(line) === buyLineKey(b[index]) && line.qty === b[index].qty && line.unitPrice === b[index].unitPrice)
}

/** 目前生效的明細：準備購買但還沒有明細時，用預設一行；舊明細補上預設尺碼 */
export function effectiveBuyLines(item: WishlistItem, preferredSize?: string): BuyLine[] {
  return item.buyLines?.length ? withSizes(item, item.buyLines, preferredSize) : defaultBuyLines(item, preferredSize)
}

export const buyQty = (lines: BuyLine[]) => lines.reduce((sum, line) => sum + line.qty, 0)
export const buyTotal = (lines: BuyLine[]) => lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0)

/** 採購籃列：「灰色・F × 1・黑・M × 2（各 $500）」；單價都一樣且超過 1 件時才補「各 $」 */
export function buyLinesText(lines: BuyLine[]) {
  const label = (line: BuyLine) => (line.size ? `${line.colorName}・${line.size}` : line.colorName)
  const text = lines.map((line) => `${label(line)} × ${line.qty}`).join('、')
  const prices = new Set(lines.map((line) => line.unitPrice))
  if (buyQty(lines) > 1 && prices.size === 1) return `${text}（各 $${lines[0].unitPrice.toLocaleString('en-US')}）`
  if (prices.size > 1) return lines.map((line) => `${label(line)} × ${line.qty}（$${line.unitPrice.toLocaleString('en-US')}）`).join('、')
  return text
}

export interface BasketRow { item: WishlistItem; lines: BuyLine[]; qty: number; total: number }
export interface BasketGroup { id: string; name: string; rows: BasketRow[]; qty: number; total: number }
export interface BasketSummary { groups: BasketGroup[]; kinds: number; qty: number; total: number }

/**
 * 採購籃：所有「準備購買」依比較分組。
 * 同一件在好幾個比較裡時，只列在最近更新的那個比較；不在任何比較裡的放「其他」。
 */
export function buildBasket(items: WishlistItem[], groups: CompareGroup[], links: CompareGroupItem[]): BasketSummary {
  const ready = items.filter((item) => item.status === 'ready')
  const groupById = new Map(groups.map((group) => [group.id, group]))
  const stamp = (group?: CompareGroup) => group?.updatedAt ?? group?.createdAt ?? ''
  const byGroup = new Map<string, BasketRow[]>()
  for (const item of ready) {
    const owners = links.filter((link) => link.wishlistItemId === item.id).map((link) => groupById.get(link.groupId)).filter((group): group is CompareGroup => !!group)
    const owner = owners.sort((a, b) => stamp(b).localeCompare(stamp(a)))[0]
    const key = owner?.id ?? 'other'
    const lines = effectiveBuyLines(item)
    const rows = byGroup.get(key) ?? []
    rows.push({ item, lines, qty: buyQty(lines), total: buyTotal(lines) })
    byGroup.set(key, rows)
  }
  const ordered = [...byGroup.entries()].sort(([a], [b]) => (a === 'other' ? 1 : b === 'other' ? -1 : stamp(groupById.get(b)).localeCompare(stamp(groupById.get(a)))))
  const result = ordered.map(([key, rows]) => ({
    id: key,
    name: key === 'other' ? '其他' : groupById.get(key)?.name ?? '其他',
    rows,
    qty: rows.reduce((sum, row) => sum + row.qty, 0),
    total: rows.reduce((sum, row) => sum + row.total, 0),
  }))
  return {
    groups: result,
    kinds: ready.length,
    qty: result.reduce((sum, group) => sum + group.qty, 0),
    total: result.reduce((sum, group) => sum + group.total, 0),
  }
}

/** 目標金額的進度：還差／已達標與百分比；沒設目標回傳 null */
export function targetProgress(total: number, target: number | null) {
  if (!target || target <= 0) return null
  const reached = total >= target
  return {
    reached,
    text: reached ? `已達標，多 ${formatNT(total - target)}` : `還差 ${formatNT(target - total)}`,
    percent: Math.min(100, Math.round((total / target) * 100)),
  }
}

/** 複製清單的純文字：每款一行，最後一行合計 */
export function basketText(basket: BasketSummary) {
  const rows = basket.groups.flatMap((group) => group.rows).map(({ item, lines, total }) => `${item.name} ${lines.map((line) => `${buyLineLabel(line)}×${line.qty}`).join(' ')} $${total.toLocaleString('en-US')}`)
  return [...rows, `共 ${basket.kinds} 款 ${basket.qty} 件 ${formatNT(basket.total)}`].join('\n')
}
