// 只用相對路徑匯入，讓 `node --test` 可以直接跑這個檔案的測試。
import type { MaterialPercentages } from '../types.ts'
import { materialNames } from './materials.ts'

/**
 * 材質比例（全專案統一）：一律依 % 從多到少排。
 * - 有 %：畫比例條＋圖例；加總不到 100 補灰色「其他 X%」。
 * - 沒填 %：只列名稱、不畫比例條。
 * - 色點用材質色（B16 材質管理的色票；自訂材質依名稱固定配一個淡色）。
 */

export interface MaterialMixPart {
  name: string
  /** 沒填比例為 null */
  percent: number | null
  color: string
  /** 補上的「其他」 */
  other?: boolean
}

export interface MaterialMix {
  parts: MaterialMixPart[]
  /** 至少一種材質有 %：可以畫比例條 */
  hasPercent: boolean
}

/** B16 材質管理的材質色；別名共用同一色 */
const MATERIAL_COLORS: Record<string, string> = {
  棉: '#E8DCC4',
  羊毛: '#D9CBB3',
  喀什米爾: '#EFE6D2',
  聚酯纖維: '#A9C6CF',
  彈性纖維: '#E2B4A8',
  尼龍: '#B7CBB0',
  麻: '#D9CBB3',
  亞麻: '#D9CBB3',
  絲: '#EADFD0',
  嫘縈: '#C9D3DC',
  丹寧: '#8FA3BC',
  皮革: '#9A6B43',
}
const MATERIAL_ALIASES: Record<string, string> = {
  cotton: '棉', wool: '羊毛', cashmere: '喀什米爾', polyester: '聚酯纖維', 聚脂纖維: '聚酯纖維', 聚酯: '聚酯纖維',
  spandex: '彈性纖維', elastane: '彈性纖維', 萊卡: '彈性纖維', lycra: '彈性纖維', 彈性: '彈性纖維', 氨綸: '彈性纖維',
  nylon: '尼龍', 錦綸: '尼龍', linen: '麻', silk: '絲', 真絲: '絲', rayon: '嫘縈', 人造絲: '嫘縈', denim: '丹寧', 牛仔布: '丹寧', leather: '皮革',
}
/** 自訂材質：依名稱固定挑一個淡色，不同頁面顏色一致 */
const FALLBACK_COLORS = ['#C8BFD6', '#BFD3C4', '#E6CFA6', '#D6B9C3', '#B9C9D9', '#D3C7B5']
/** 其他：灰色 */
export const MATERIAL_OTHER_COLOR = '#E2D2B8'

export function materialColor(name: string): string {
  const key = name.trim()
  const canonical = MATERIAL_ALIASES[key.toLocaleLowerCase()] ?? MATERIAL_ALIASES[key] ?? key
  if (MATERIAL_COLORS[canonical]) return MATERIAL_COLORS[canonical]
  let hash = 0
  for (const char of canonical) hash = (hash * 31 + char.codePointAt(0)!) >>> 0
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length]
}

const round1 = (value: number) => Math.round(value * 10) / 10

/** 從舊版成分原文抓「棉 60%」這類片段 */
function parseCompositionText(text: string): MaterialPercentages {
  const result: MaterialPercentages = {}
  for (const match of text.matchAll(/([一-龥A-Za-z][一-龥A-Za-z ]*?)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*%/g)) {
    const name = match[1].trim()
    if (name) result[name] = (result[name] ?? 0) + Number(match[2])
  }
  return result
}

export function materialMix(source: { material?: string | null; materialComposition?: string | null; materialPercentages?: MaterialPercentages | null }): MaterialMix {
  const names = materialNames(source.material ?? undefined)
  let percentages = Object.entries(source.materialPercentages ?? {}).filter(([, value]) => Number.isFinite(value) && value > 0)
  if (!percentages.length && source.materialComposition?.trim()) percentages = Object.entries(parseCompositionText(source.materialComposition))

  if (percentages.length) {
    const withPercent = percentages
      .map(([name, value]) => ({ name, percent: round1(value), color: materialColor(name) }))
      .sort((a, b) => b.percent - a.percent)
    // 選了材質但沒填比例的，排在有比例的後面
    const listed = new Set(withPercent.map((part) => part.name))
    const without = names.filter((name) => !listed.has(name)).map((name) => ({ name, percent: null, color: materialColor(name) }))
    const total = withPercent.reduce((sum, part) => sum + part.percent, 0)
    const rest = round1(100 - total)
    const other: MaterialMixPart[] = !without.length && rest > 0 ? [{ name: '其他', percent: rest, color: MATERIAL_OTHER_COLOR, other: true }] : []
    return { parts: [...withPercent, ...other, ...without], hasPercent: true }
  }

  const fallbackNames = names.length ? names : source.materialComposition?.trim() ? [source.materialComposition.trim()] : []
  return { parts: fallbackNames.map((name) => ({ name, percent: null, color: materialColor(name) })), hasPercent: false }
}

/** 清單卡片用的短名：「聚酯纖維」→「聚酯」 */
export function shortMaterialName(name: string) {
  return name.length > 3 && name.endsWith('纖維') ? name.slice(0, -2) : name
}

/**
 * 一行文字：「聚酯纖維 85%・彈性纖維 15%」。
 * limit：只取前幾種（清單卡片 2）；short：用短名。
 */
export function materialMixText(mix: MaterialMix, options: { limit?: number; short?: boolean } = {}) {
  const parts = options.limit ? mix.parts.filter((part) => !part.other).slice(0, options.limit) : mix.parts
  if (!parts.length) return null
  return parts.map((part) => `${options.short ? shortMaterialName(part.name) : part.name}${part.percent != null ? ` ${part.percent}%` : ''}`).join('・')
}
