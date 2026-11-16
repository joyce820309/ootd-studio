import type { BodyMeasurement, MaterialPercentages, Slot } from '@/types'

/**
 * 彈性尺寸（B20／BM17 規格 v2）
 * 平放值存在 flat_measurements，可拉伸值存在 flat_stretch，兩者都是「平放量」。
 */

/** 舒適拉伸比例：只算可拉伸差距的 60%，拉到極限不算舒服 */
export const STRETCH_COMFORT = 0.6

export interface MeasureField {
  key: string
  label: string
}

/** 各部位的平放尺寸欄位（新增衣物、選購清單共用） */
export const SIZING: Record<Slot, MeasureField[]> = {
  top: [{ key: 'shoulder', label: '肩寬' }, { key: 'sleeve', label: '袖長' }, { key: 'chest', label: '胸寬' }, { key: 'length', label: '衣長' }],
  outer: [{ key: 'shoulder', label: '肩寬' }, { key: 'sleeve', label: '袖長' }, { key: 'chest', label: '胸寬' }, { key: 'cuff', label: '袖口' }, { key: 'length', label: '衣長' }],
  bottom: [{ key: 'waist', label: '腰寬' }, { key: 'rise', label: '股上' }, { key: 'hip', label: '臀寬' }, { key: 'thigh', label: '大腿寬' }, { key: 'length', label: '褲長' }, { key: 'hem', label: '褲口寬' }],
  shoes: [{ key: 'innerLength', label: '鞋內長' }, { key: 'width', label: '鞋寬' }, { key: 'heelHeight', label: '跟高' }],
  bag: [{ key: 'width', label: '寬' }, { key: 'height', label: '高' }, { key: 'depth', label: '側寬' }],
  acc: [{ key: 'length', label: '平放長度' }, { key: 'width', label: '平放寬度' }],
}

/** 可以填範圍（有彈性）的欄位；袖口、褲口只顯示不判定 */
export const STRETCH_KEYS = new Set(['chest', 'waist', 'hip', 'thigh', 'cuff', 'hem'])
export const canStretch = (key: string) => STRETCH_KEYS.has(key)

/* ── 輸入解析 ─────────────────────────────────────── */

/** 全形數字與符號轉半形，去掉空白與 cm／公分 */
function normalize(text: string) {
  return text
    .replace(/[０-９．]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[～〜~－—–‐]/g, '-')
    .replace(/(?:cm|ｃｍ|公分)/gi, '')
    .replace(/\s+/g, '')
}

const NUMBER = /^\d+(?:\.\d+)?$/
const RANGE = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/

export type ParsedText =
  | { kind: 'empty' }
  | { kind: 'single'; value: number }
  | { kind: 'range'; flat: number; stretch: number }
  | { kind: 'invalid' }

/** 解析一格輸入：40、40-60、40~60、40～60、４０、40cm；「/」不視為範圍 */
export function parseMeasureText(text: string): ParsedText {
  const value = normalize(text)
  if (!value) return { kind: 'empty' }
  if (NUMBER.test(value)) {
    const n = Number(value)
    return n > 0 ? { kind: 'single', value: n } : { kind: 'invalid' }
  }
  const range = RANGE.exec(value)
  if (!range) return { kind: 'invalid' }
  const a = Number(range[1])
  const b = Number(range[2])
  if (!(a > 0 && b > 0)) return { kind: 'invalid' }
  if (a === b) return { kind: 'single', value: a }
  return { kind: 'range', flat: Math.min(a, b), stretch: Math.max(a, b) }
}

export interface ResolvedMeasure {
  flat: number | null
  stretch: number | null
  error: string | null
  /** 在單格裡直接貼上範圍並辨識成功 */
  recognized: boolean
}

/**
 * 把一個欄位的輸入轉成平放／拉伸值。
 * stretchText 為 undefined 時是單格模式；有字串（可為空）時是「有彈性」兩格模式。
 */
export function resolveMeasure(field: MeasureField, text: string, stretchText?: string): ResolvedMeasure {
  const stretchable = canStretch(field.key)
  const none: ResolvedMeasure = { flat: null, stretch: null, error: null, recognized: false }
  if (stretchText === undefined || !stretchable) {
    const parsed = parseMeasureText(text)
    if (parsed.kind === 'empty') return none
    if (parsed.kind === 'invalid') return { ...none, error: `看不懂這個寫法。${stretchable ? '範圍請寫成 40-60' : '請填一個數字'}` }
    if (parsed.kind === 'single') return { ...none, flat: parsed.value }
    if (!stretchable) return { ...none, error: `${field.label}不會拉伸，請填一個數字` }
    return { flat: parsed.flat, stretch: parsed.stretch, error: null, recognized: true }
  }
  const flat = parseMeasureText(text)
  const stretch = parseMeasureText(stretchText)
  if (flat.kind === 'invalid' || flat.kind === 'range' || stretch.kind === 'invalid' || stretch.kind === 'range') return { ...none, error: '兩格都請填一個數字' }
  if (flat.kind === 'empty') return stretch.kind === 'empty' ? none : { ...none, error: '要先填平放值，才能存拉伸值' }
  if (stretch.kind === 'empty' || stretch.value === flat.value) return { ...none, flat: flat.value }
  return { flat: Math.min(flat.value, stretch.value), stretch: Math.max(flat.value, stretch.value), error: null, recognized: false }
}

/** 表單欄位狀態（FlatMeasureField） */
export interface FlatFieldValue {
  /** 單格模式的文字，或兩格模式的平放值 */
  text: string
  /** undefined＝單格；字串＝已點「有彈性」展開的拉開後欄位 */
  stretch?: string
}

/** 從已存的值建立欄位狀態：有拉伸值時直接展開兩格 */
export function toFieldValue(flat?: number | null, stretch?: number | null): FlatFieldValue {
  if (flat == null) return { text: '' }
  return stretch != null && stretch > flat ? { text: String(flat), stretch: String(stretch) } : { text: String(flat) }
}

/** 整組欄位轉成要存的平放值與拉伸值；有錯誤時回傳第一個錯誤欄位 */
export function collectMeasures(fields: MeasureField[], values: Record<string, FlatFieldValue>) {
  const flat: Record<string, number | null> = {}
  const stretch: Record<string, number> = {}
  let error: { field: MeasureField; message: string } | null = null
  for (const field of fields) {
    const value = values[field.key] ?? { text: '' }
    const resolved = resolveMeasure(field, value.text, value.stretch)
    if (resolved.error && !error) error = { field, message: resolved.error }
    flat[field.key] = resolved.flat
    if (resolved.flat != null && resolved.stretch != null) stretch[field.key] = resolved.stretch
  }
  return { flat, stretch, error }
}

/** 把已存的平放／拉伸值轉回輸入框的文字 */
export function measureToText(flat?: number | null, stretch?: number | null) {
  if (flat == null) return ''
  return stretch != null && stretch > flat ? `${flat}-${stretch}` : String(flat)
}

/** 只留下有對應平放值、且大於平放值的拉伸值 */
export function cleanStretch(flat: Record<string, number | null | undefined>, stretch: Record<string, number | null | undefined> | undefined): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(stretch ?? {})) {
    const base = flat[key]
    if (typeof value === 'number' && typeof base === 'number' && canStretch(key) && value > base) out[key] = value
  }
  return out
}

/* ── 一圈量防呆 ───────────────────────────────────── */

const CIRCLE_CHECK: Record<string, { body: (m: BodyMeasurement) => number | null; fallback: number }> = {
  chest: { body: (m) => m.upperBustCm, fallback: 75 },
  waist: { body: (m) => Math.max(m.waistCm ?? 0, m.waistSittingCm ?? 0) || null, fallback: 70 },
  hip: { body: (m) => m.hipCm, fallback: 80 },
}

/** 平放值看起來像一整圈：有身體量測時 > 對應圍度 × 0.8，沒有時用固定上限 */
export function looksLikeCircle(key: string, flat: number | null, body: BodyMeasurement | null) {
  const check = CIRCLE_CHECK[key]
  if (!check || flat == null) return false
  const bodyValue = body ? check.body(body) : null
  return flat > (bodyValue != null ? bodyValue * 0.8 : check.fallback)
}

const half = (n: number) => Math.round((n / 2) * 10) / 10

/** 除以 2 後的文字 */
export function halveText(text: string) {
  const parsed = parseMeasureText(text)
  if (parsed.kind === 'single') return String(half(parsed.value))
  if (parsed.kind === 'range') return `${half(parsed.flat)}-${half(parsed.stretch)}`
  return text
}

/* ── 判定與顯示 ───────────────────────────────────── */

const round1 = (n: number) => Math.round(n * 10) / 10

/** 舒適拉伸後的平放值：平放 ＋（拉伸 − 平放）× 60% */
export const comfortStretch = (flat: number, stretch: number) => round1(flat + (stretch - flat) * STRETCH_COMFORT)

/** 「40 ↔ 60」 */
export const formatStretch = (flat: number, stretch?: number | null) => (stretch != null && stretch > flat ? `${flat} ↔ ${stretch}` : `${flat}`)

/* ── 材質彈性提示 ─────────────────────────────────── */

const ELASTIC_WORDS = ['彈性纖維', '彈性', '萊卡', 'lycra', 'spandex', 'elastane', '氨綸', '聚氨酯', 'pu']

const isElasticName = (name: string) => {
  const key = name.toLowerCase().replace(/\s+/g, '')
  return ELASTIC_WORDS.some((word) => (word === 'pu' ? key === 'pu' : key.includes(word)))
}

/** 彈性纖維合計 ≥ 2% 時回傳百分比；只是提示，不影響判定 */
export function elasticFiberPercent(percentages?: MaterialPercentages, composition?: string): number | null {
  let total = Object.entries(percentages ?? {}).filter(([name]) => isElasticName(name)).reduce((sum, [, value]) => sum + (Number(value) || 0), 0)
  if (!total && composition) {
    for (const match of composition.matchAll(/([一-龥A-Za-z]+)\s*(\d+(?:\.\d+)?)\s*%/g)) {
      if (isElasticName(match[1])) total += Number(match[2])
    }
  }
  return total >= 2 ? round1(total) : null
}
