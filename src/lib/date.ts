/**
 * 日期工具：App 內一律用本地時區的 'YYYY-MM-DD' 字串傳遞日期，
 * 和 Supabase 的 date 欄位直接對應，避免 UTC 換算造成差一天。
 */

const pad = (n: number) => String(n).padStart(2, '0')

export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

/** 'YYYY-MM-DD' → 本地 Date；格式不對回傳 null */
export function parseISODate(s?: string | null): Date | null {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return d.getMonth() === Number(m[2]) - 1 ? d : null
}

export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const todayISO = () => toISODate(new Date())

export const isSameDay = (a: Date | null, b: Date | null) =>
  !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/** 加減月份；日期超過該月天數時停在月底（1/31 + 1 個月 = 2/28） */
export function addMonths(d: Date, n: number) {
  const first = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  return new Date(first.getFullYear(), first.getMonth(), Math.min(d.getDate(), last))
}

/** 月曆格：從該月第一天所在週的週日開始，固定 6 週 42 格 */
export function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const start = addDays(first, -first.getDay())
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

/** 2026 年 11 月 12 日（四） */
export const formatLongDate = (d: Date) =>
  `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日（${WEEKDAYS[d.getDay()]}）`

/** 只比較日期，不比較時間 */
export function clampOutOfRange(d: Date, min: Date | null, max: Date | null) {
  if (min && d < min) return min
  if (max && d > max) return max
  return d
}
