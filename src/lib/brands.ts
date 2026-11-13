import type { BrandSummary } from '@/types'

export const brandTotal = (brand: BrandSummary) => brand.closetCount + brand.wishCount

/** 比對用：忽略大小寫、空白與標點（保留中日文字） */
export const normalizeBrand = (name: string) => name.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

function distance(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return 2
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i]
    for (let j = 1; j <= b.length; j += 1) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = row
  }
  return prev[b.length]
}

/** 兩個名稱看起來像同一個品牌：寫法只差大小寫／空白，或拼字只差一個字（至少 3 個字才比） */
export function looksSameBrand(a: string, b: string) {
  const x = normalizeBrand(a)
  const y = normalizeBrand(b)
  if (!x || !y) return false
  if (x === y) return true
  return Math.min(x.length, y.length) >= 3 && distance(x, y) <= 1
}

/** 一組品牌的固定識別字串（排序後以換行串接），用來記住「不是同一個」 */
export const brandGroupKey = (names: string[]) => [...names].sort().join('\n')

export interface DuplicateGroup {
  key: string
  brands: BrandSummary[]
  /** 建議保留的名稱：件數最多的那個 */
  suggested: string
}

/** 找出可能是同一個品牌的組合；使用者標記過「不是同一個」的組合不列出 */
export function findDuplicateGroups(brands: BrandSummary[], dismissed: string[]): DuplicateGroup[] {
  const parent = brands.map((_, i) => i)
  const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i])))
  for (let i = 0; i < brands.length; i += 1)
    for (let j = i + 1; j < brands.length; j += 1)
      if (looksSameBrand(brands[i].name, brands[j].name)) parent[root(j)] = root(i)

  const groups = new Map<number, BrandSummary[]>()
  brands.forEach((brand, i) => groups.set(root(i), [...(groups.get(root(i)) ?? []), brand]))
  const skip = new Set(dismissed)
  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => {
      const sorted = [...group].sort((a, b) => brandTotal(b) - brandTotal(a) || a.name.localeCompare(b.name))
      return { key: brandGroupKey(group.map((b) => b.name)), brands: sorted, suggested: sorted[0].name }
    })
    .filter((group) => !skip.has(group.key))
    .sort((a, b) => brandTotal(b.brands[0]) - brandTotal(a.brands[0]))
}

export type BrandSort = 'count-desc' | 'count-asc' | 'name' | 'recent'

export const BRAND_SORTS: { id: BrandSort; label: string; short: string }[] = [
  { id: 'count-desc', label: '件數多到少', short: '件數' },
  { id: 'count-asc', label: '件數少到多', short: '件數少' },
  { id: 'recent', label: '最近使用', short: '最近' },
  { id: 'name', label: '名稱 A–Z', short: '名稱' },
]

export function sortBrands(brands: BrandSummary[], sort: BrandSort) {
  const byName = (a: BrandSummary, b: BrandSummary) => a.name.localeCompare(b.name, 'zh-TW', { sensitivity: 'base' }) || a.name.localeCompare(b.name)
  return [...brands].sort((a, b) => {
    if (sort === 'count-desc') return brandTotal(b) - brandTotal(a) || b.closetCount - a.closetCount || byName(a, b)
    if (sort === 'count-asc') return brandTotal(a) - brandTotal(b) || byName(a, b)
    if (sort === 'recent') return (b.lastUsed ?? '').localeCompare(a.lastUsed ?? '') || byName(a, b)
    return byName(a, b)
  })
}

/** 11/12；沒用過顯示 — */
export const brandDateLabel = (iso: string | null) => (iso ? `${iso.slice(5, 7)}/${iso.slice(8, 10)}` : '—')

/** 新名稱和既有品牌完全相同（大小寫也相同）時回傳那個品牌 */
export const findExactBrand = (brands: BrandSummary[], name: string) => brands.find((brand) => brand.name === name.trim())

/** 只差大小寫或空白的既有品牌 */
export const findSimilarBrand = (brands: BrandSummary[], name: string) => {
  const key = normalizeBrand(name)
  return key ? brands.find((brand) => normalizeBrand(brand.name) === key) : undefined
}
