import { formatNT } from '@/lib/wishlist'
import type { BuyLine, CompareGroup, CompareGroupItem, WishlistItem } from '@/types'

/** 這件商品可選的顏色（沒有 colors 時用主色） */
export function buyColorOptions(item: WishlistItem): { name: string; hex?: string; favorite: boolean }[] {
  if (!item.colors?.length) return [{ name: item.colorName || '未標色', hex: item.colorHex, favorite: false }]
  return item.colors.map((color) => ({ name: color.name, hex: color.hex, favorite: color.favorite }))
}

/** 第一次準備購買：最想要的顏色（沒有就第一個顏色）× 1 × 原價 */
export function defaultBuyLines(item: WishlistItem): BuyLine[] {
  const options = buyColorOptions(item)
  const color = options.find((option) => option.favorite) ?? options[0]
  return [{ colorName: color?.name ?? '未標色', hex: color?.hex ?? item.colorHex, qty: 1, unitPrice: item.price }]
}

/** 目前生效的明細：準備購買但還沒有明細時，用預設一行 */
export function effectiveBuyLines(item: WishlistItem): BuyLine[] {
  return item.buyLines?.length ? item.buyLines : defaultBuyLines(item)
}

export const buyQty = (lines: BuyLine[]) => lines.reduce((sum, line) => sum + line.qty, 0)
export const buyTotal = (lines: BuyLine[]) => lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0)

/** 「黑 × 1・杏 × 1（各 $500）」；單價都一樣且超過 1 件時才補「各 $」 */
export function buyLinesText(lines: BuyLine[]) {
  const text = lines.map((line) => `${line.colorName} × ${line.qty}`).join('・')
  const prices = new Set(lines.map((line) => line.unitPrice))
  if (buyQty(lines) > 1 && prices.size === 1) return `${text}（各 $${lines[0].unitPrice.toLocaleString('en-US')}）`
  if (prices.size > 1) return lines.map((line) => `${line.colorName} × ${line.qty}（$${line.unitPrice.toLocaleString('en-US')}）`).join('・')
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
  const rows = basket.groups.flatMap((group) => group.rows).map(({ item, lines, total }) => `${item.name} ${lines.map((line) => `${line.colorName}×${line.qty}`).join(' ')} $${total.toLocaleString('en-US')}`)
  return [...rows, `共 ${basket.kinds} 款 ${basket.qty} 件 ${formatNT(basket.total)}`].join('\n')
}
