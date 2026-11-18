import { parseISODate, toISODate } from '@/lib/date'
import type { BodyMeasurement, MeasurementTrendPrefs, TrendMetricKey, TrendRange } from '@/types'

/**
 * 量測趨勢（B8.3 B-History-Trend、BM6.2 B-M-History-Trend）
 * 不設目標、不分好壞：上升下降同色，不畫目標線，也不寫評價字眼。
 */

export interface TrendMetric {
  key: TrendMetricKey
  label: string
  unit: 'cm' | 'kg'
}

export const TREND_METRICS: TrendMetric[] = [
  { key: 'weightKg', label: '體重', unit: 'kg' },
  { key: 'shoulderCm', label: '肩寬', unit: 'cm' },
  { key: 'upperBustCm', label: '上胸圍', unit: 'cm' },
  { key: 'underBustCm', label: '下胸圍', unit: 'cm' },
  { key: 'highWaistCm', label: '高腰圍', unit: 'cm' },
  { key: 'waistCm', label: '腰圍・站', unit: 'cm' },
  { key: 'waistSittingCm', label: '腰圍・坐', unit: 'cm' },
  { key: 'navelCm', label: '肚臍圍・站', unit: 'cm' },
  { key: 'navelSittingCm', label: '肚臍圍・坐', unit: 'cm' },
  { key: 'hipCm', label: '臀圍', unit: 'cm' },
  { key: 'thighCm', label: '大腿圍', unit: 'cm' },
]

const METRIC_KEYS = new Set<string>(TREND_METRICS.map((metric) => metric.key))
export const trendMetric = (key: TrendMetricKey) => TREND_METRICS.find((metric) => metric.key === key)!

export const TREND_RANGES: { id: TrendRange; label: string; months: number | null }[] = [
  { id: 'half', label: '半年', months: 6 },
  { id: 'year', label: '一年', months: 12 },
  { id: 'all', label: '全部', months: null },
]

/** 系列色：已驗證色盲與對比（tokens.css 的 trend-1／trend-2） */
export const SERIES_TONES = [
  { stroke: 'var(--color-trend-1)', light: 'var(--color-trend-1-light)' },
  { stroke: 'var(--color-trend-2)', light: 'var(--color-trend-2-light)' },
] as const

/** Y 軸最小範圍：cm 類 10 cm、體重 3 kg，避免小變化被放大 */
export const minSpan = (unit: TrendMetric['unit']) => (unit === 'kg' ? 3 : 10)

/** 桌面一次最多 2 個部位，手機 1 個 */
export const maxSeries = (mobile: boolean) => (mobile ? 1 : 2)

export const DEFAULT_TREND_PREFS: MeasurementTrendPrefs = { metrics: ['waistCm'], range: 'year', morningOnly: false, showWeight: true }

/** 從資料庫讀回的值不可信：過濾未知部位、混單位、超過 2 個 */
export function normalizeTrendPrefs(input: Partial<MeasurementTrendPrefs> | null | undefined): MeasurementTrendPrefs {
  const range = input?.range === 'half' || input?.range === 'all' ? input.range : 'year'
  const raw = (input?.metrics ?? []).filter((key): key is TrendMetricKey => METRIC_KEYS.has(key))
  const unit = raw[0] ? trendMetric(raw[0]).unit : null
  const metrics = [...new Set(raw)].filter((key) => trendMetric(key).unit === unit).slice(0, unit === 'kg' ? 1 : 2)
  return {
    metrics: metrics.length ? metrics : [...DEFAULT_TREND_PREFS.metrics],
    range,
    morningOnly: Boolean(input?.morningOnly),
    showWeight: input?.showWeight ?? true,
    ...(input?.updatedAt ? { updatedAt: input.updatedAt } : {}),
  }
}

/* ── 資料整理 ─────────────────────────────────────── */

const DAY = 86_400_000
const time = (iso: string) => parseISODate(iso)?.getTime() ?? 0

/** 時間軸：半年／一年從 6／12 個月前那個月的 1 號到本月底（一年＝去年同月起）；全部從第一筆的月初開始 */
export function trendDomain(records: BodyMeasurement[], range: TrendRange, today = new Date()) {
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const months = TREND_RANGES.find((option) => option.id === range)!.months
  let start: Date
  if (months != null) start = new Date(today.getFullYear(), today.getMonth() - months, 1)
  else {
    const first = records.reduce<string | null>((min, record) => (!min || record.measuredOn < min ? record.measuredOn : min), null)
    const firstDate = parseISODate(first) ?? today
    start = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1)
  }
  return { start: toISODate(start), end: toISODate(end), t0: start.getTime(), t1: end.getTime() + DAY - 1 }
}

export interface TrendRecord {
  id: string
  date: string
  morning: boolean
  timeOfDay: BodyMeasurement['timeOfDay']
  values: Partial<Record<TrendMetricKey, number>>
  /** 0–100，時間軸位置 */
  x: number
}

/** 篩掉範圍外、非早上空腹（勾選時）的紀錄；舊→新排序。同一天多筆時都保留 */
export function trendRecords(records: BodyMeasurement[], prefs: Pick<MeasurementTrendPrefs, 'range' | 'morningOnly'>, today = new Date()) {
  const domain = trendDomain(records, prefs.range, today)
  const span = Math.max(domain.t1 - domain.t0, DAY)
  const list: TrendRecord[] = [...records]
    .filter((record) => record.measuredOn >= domain.start && record.measuredOn <= domain.end)
    .filter((record) => !prefs.morningOnly || record.timeOfDay === 'morning_fasting')
    .sort((a, b) => a.measuredOn.localeCompare(b.measuredOn) || a.createdAt.localeCompare(b.createdAt))
    .map((record) => {
      const values: Partial<Record<TrendMetricKey, number>> = {}
      for (const metric of TREND_METRICS) {
        const value = record[metric.key]
        if (typeof value === 'number' && Number.isFinite(value)) values[metric.key] = value
      }
      return { id: record.id, date: record.measuredOn, morning: record.timeOfDay === 'morning_fasting', timeOfDay: record.timeOfDay, values, x: round1(((time(record.measuredOn) + DAY / 2 - domain.t0) / span) * 100) }
    })
  return { domain, list }
}

export const countFor = (list: TrendRecord[], key: TrendMetricKey) => list.filter((record) => record.values[key] != null).length

/** 這個部位在這段時間能不能畫線（至少 2 筆） */
export const canPlot = (list: TrendRecord[], key: TrendMetricKey) => countFor(list, key) >= 2

/** 某一筆的前一次（同部位、有量到的那筆） */
export function previousValue(list: TrendRecord[], index: number, key: TrendMetricKey) {
  for (let i = index - 1; i >= 0; i -= 1) {
    const value = list[i].values[key]
    if (value != null) return value
  }
  return null
}

/* ── 刻度與線 ─────────────────────────────────────── */

const round1 = (n: number) => Math.round(n * 10) / 10

/** Y 軸範圍：不足最小範圍時以中點撐開；刻度約 4–6 條 */
export function yScale(values: number[], unit: TrendMetric['unit']) {
  const need = minSpan(unit)
  let lo = Math.min(...values)
  let hi = Math.max(...values)
  if (!Number.isFinite(lo)) { lo = 0; hi = need }
  if (hi - lo < need) {
    const center = (hi + lo) / 2
    lo = Math.floor(center - need / 2)
    hi = lo + need
  } else {
    const pad = (hi - lo) * 0.08
    lo = Math.floor(lo - pad)
    hi = Math.ceil(hi + pad)
  }
  const step = [0.5, 1, 2, 5, 10, 20].find((candidate) => (hi - lo) / candidate <= 5) ?? 50
  const ticks: number[] = []
  for (let value = Math.ceil(lo / step) * step; value <= hi + 1e-9; value += step) ticks.push(round1(value))
  const y = (value: number) => round1((1 - (value - lo) / (hi - lo)) * 100)
  return { lo, hi, ticks, y }
}

/** SVG path（viewBox 0 0 1000 300），x、y 都是 0–100 */
export const linePath = (points: { x: number; y: number }[]) => points.map((point, index) => `${index ? 'L' : 'M'}${round1(point.x * 10)} ${round1(point.y * 3)}`).join(' ')

/** 小線圖：每格的比例尺一樣（cm 至少 10、kg 至少 3），只看方向；viewBox 0 0 100 30 */
export function sparkPath(list: TrendRecord[], key: TrendMetricKey) {
  const points = list.filter((record) => record.values[key] != null).map((record) => ({ x: record.x, v: record.values[key]! }))
  if (points.length < 2) return null
  const need = minSpan(trendMetric(key).unit)
  let lo = Math.min(...points.map((point) => point.v))
  let hi = Math.max(...points.map((point) => point.v))
  if (hi - lo < need) {
    const center = (hi + lo) / 2
    lo = center - need / 2
    hi = center + need / 2
  }
  return points.map((point, index) => `${index ? 'L' : 'M'}${point.x} ${round1((1 - (point.v - lo) / (hi - lo)) * 30)}`).join(' ')
}

export const formatTrendNumber = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1))

/** 第一筆到最後一筆的差；不帶好壞 */
export function trendChange(list: TrendRecord[], key: TrendMetricKey) {
  const values = list.map((record) => record.values[key]).filter((value): value is number => value != null)
  if (values.length < 2) return null
  const diff = round1(values[values.length - 1] - values[0])
  return diff === 0 ? '沒變' : `${diff > 0 ? '+' : '−'}${formatTrendNumber(Math.abs(diff))}`
}

export const monthLabel = (iso: string) => `${iso.slice(0, 4)}/${iso.slice(5, 7)}`
export const dayLabel = (iso: string) => iso.replaceAll('-', '/')

/**
 * 點選部位：已選的再點一下取消（至少留一個）；
 * 單位不同或已達上限時換掉最早選的那個（手機一次 1 個＝直接替換）。
 */
export function toggleTrendMetric(current: TrendMetricKey[], key: TrendMetricKey, max: number): TrendMetricKey[] {
  if (current.includes(key)) return current.length > 1 ? current.filter((item) => item !== key) : current
  const unit = trendMetric(key).unit
  if (unit === 'kg') return [key]
  const same = current.filter((item) => trendMetric(item).unit === unit)
  return [...same, key].slice(-max)
}
