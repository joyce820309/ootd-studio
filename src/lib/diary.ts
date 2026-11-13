import { monthGrid, parseISODate, todayISO, WEEKDAYS } from './date'
import { isWearable, STATUS_LABEL } from './slots'
import type { BoardPiece } from '@/components/outfit/OutfitBoard'
import type { ClosetItem, DiaryEntry, DiaryFeel, DiaryWeather, Slot } from '@/types'

type Tone = 'oat' | 'mist' | 'rose' | 'sage'

/** 預設場合與顏色；自訂場合一律用燕麥色。 */
export const OCCASIONS: { label: string; tone: Tone }[] = [
  { label: '上班', tone: 'mist' },
  { label: '簡報', tone: 'mist' },
  { label: '休閒', tone: 'sage' },
  { label: '聚餐', tone: 'rose' },
  { label: '出遊', tone: 'oat' },
  { label: '運動', tone: 'sage' },
]

/** 月曆圖例只列四種主要場合 */
export const OCCASION_LEGEND = ['上班', '休閒', '聚餐', '出遊']

export const occasionTone = (label?: string): Tone => OCCASIONS.find((o) => o.label === label)?.tone ?? 'oat'

export const TONE_CLASS: Record<Tone, { dot: string; chip: string; wash: string }> = {
  mist: { dot: 'bg-mist', chip: 'bg-mist-soft text-mist-ink', wash: 'bg-mist-wash' },
  sage: { dot: 'bg-sage', chip: 'bg-sage-soft text-sage-ink', wash: 'bg-sage-wash' },
  rose: { dot: 'bg-rose', chip: 'bg-rose-soft text-rose-ink', wash: 'bg-rose-wash' },
  oat: { dot: 'bg-oat', chip: 'bg-oat-soft text-oat-ink', wash: 'bg-oat-wash' },
}

export const FEEL_LABEL: Record<DiaryFeel, string> = { comfy: '舒服', ok: '普通', uncomfy: '不太舒服' }
export const FEEL_CLASS: Record<DiaryFeel, string> = {
  comfy: 'bg-sage-soft text-sage-ink',
  ok: 'bg-tile text-ink-2',
  uncomfy: 'bg-rose-soft text-rose-ink',
}

export const WEATHER_LABEL: Record<DiaryWeather, string> = { sunny: '晴', cloudy: '多雲', overcast: '陰', rain: '雨' }
export const WEATHERS: DiaryWeather[] = ['sunny', 'cloudy', 'overcast', 'rain']

export function weatherText(entry: Pick<DiaryEntry, 'weather' | 'temperatureC'>) {
  const parts = [entry.weather ? WEATHER_LABEL[entry.weather] : null, entry.temperatureC !== null ? `${entry.temperatureC}°` : null].filter(Boolean)
  return parts.length ? parts.join(' ') : null
}

/** 11 月 12 日（四） */
export function formatDiaryDate(iso: string) {
  const d = parseISODate(iso)
  if (!d) return iso
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日（${WEEKDAYS[d.getDay()]}）`
}

/** 11/12 */
export const shortDate = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`
export const weekdayOf = (iso: string) => WEEKDAYS[parseISODate(iso)?.getDay() ?? 0]

/** 'YYYY-MM' */
export const monthKey = (iso: string) => iso.slice(0, 7)
export const currentMonthKey = () => todayISO().slice(0, 7)

export function parseMonthKey(key: string | null): { year: number; month: number } | null {
  const m = key ? /^(\d{4})-(\d{2})$/.exec(key) : null
  if (!m) return null
  const month = Number(m[2]) - 1
  return month >= 0 && month <= 11 ? { year: Number(m[1]), month } : null
}

export const toMonthKey = (year: number, month: number) => `${year}-${String(month + 1).padStart(2, '0')}`

/** 月曆格：最後一週全是下個月時拿掉，與設計稿一樣多半是 5 週。 */
export function diaryMonthGrid(year: number, month: number) {
  const cells = monthGrid(year, month)
  return cells.slice(35).every((d) => d.getMonth() !== month) ? cells.slice(0, 35) : cells
}

export const closetIdsOf = (entry: DiaryEntry) => Object.values(entry.picks).flatMap((pick) => (pick?.kind === 'closet' ? [pick.itemId] : []))

export interface MonthStats {
  days: number
  avgRating: number | null
  comfyDays: number
  top: { item: ClosetItem; count: number }[]
  unworn: ClosetItem[]
}

export function monthStats(entries: DiaryEntry[], closet: ClosetItem[]): MonthStats {
  const days = new Set(entries.map((e) => e.date)).size
  const rated = entries.filter((e) => e.rating !== null)
  const avgRating = rated.length ? rated.reduce((sum, e) => sum + (e.rating ?? 0), 0) / rated.length : null
  const comfyDays = new Set(entries.filter((e) => e.feel === 'comfy').map((e) => e.date)).size
  const counts = new Map<string, number>()
  for (const e of entries) for (const id of closetIdsOf(e)) counts.set(id, (counts.get(id) ?? 0) + 1)
  const byId = new Map(closet.map((c) => [c.id, c]))
  const top = [...counts.entries()]
    .filter(([id]) => byId.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, count]) => ({ item: byId.get(id)!, count }))
  const unworn = closet
    .filter((c) => c.status !== 'retired' && !counts.has(c.id))
    .sort((a, b) => Number(isWearable(a.status)) - Number(isWearable(b.status)) || (a.wearCount ?? 0) - (b.wearCount ?? 0))
    .slice(0, 4)
  return { days, avgRating, comfyDays, top, unworn }
}

export const unwornLabel = (item: ClosetItem) => (item.status === 'ok' ? item.name : `${item.name}・${STATUS_LABEL[item.status]}`)

// ---------- 今日搭配 ↔ 日記 ----------

const TODAY_PICKS_KEY = 'ootd.todayPicks'

/** 今日搭配頁排好的單品，存在瀏覽器裡給「記一筆」帶入。 */
export function storeTodayPicks(picks: Partial<Record<Slot, string | null>>) {
  try {
    localStorage.setItem(TODAY_PICKS_KEY, JSON.stringify({ date: todayISO(), picks }))
  } catch {
    // 私密模式等情況寫不進去，不影響今日搭配
  }
}

export function readTodayPicks(): Partial<Record<Slot, string>> | null {
  try {
    const raw = JSON.parse(localStorage.getItem(TODAY_PICKS_KEY) ?? 'null') as { date?: string; picks?: Record<string, string | null> } | null
    if (!raw || raw.date !== todayISO() || !raw.picks) return null
    const picks = Object.fromEntries(Object.entries(raw.picks).filter(([, id]) => typeof id === 'string' && id)) as Partial<Record<Slot, string>>
    return Object.keys(picks).length ? picks : null
  } catch {
    return null
  }
}

/** 「再穿一次」帶到今日搭配的資料（放在 router state） */
export interface RewearState {
  rewear: { name: string; picks: Partial<Record<Slot, string>> }
}

export function rewearState(entry: DiaryEntry): RewearState {
  const picks: Partial<Record<Slot, string>> = {}
  for (const [slot, pick] of Object.entries(entry.picks)) if (pick?.kind === 'closet') picks[slot as Slot] = pick.itemId
  return { rewear: { name: entry.name, picks } }
}

/** 再穿一次前先看哪些單品不能穿（送洗、借出、已刪除…） */
export function unavailablePieces(entry: DiaryEntry, closet: ClosetItem[]): string[] {
  const byId = new Map(closet.map((c) => [c.id, c]))
  return closetIdsOf(entry).flatMap((id) => {
    const item = byId.get(id)
    if (!item) return ['一件已不在衣櫃的單品']
    return isWearable(item.status) ? [] : [`${item.name}${STATUS_LABEL[item.status]}`]
  })
}

/** 把日記的單品轉成搭配板內容；已刪除的單品略過。 */
export function entryPieces(entry: DiaryEntry, closetById: Map<string, ClosetItem>): Partial<Record<Slot, BoardPiece>> {
  const out: Partial<Record<Slot, BoardPiece>> = {}
  for (const [slot, pick] of Object.entries(entry.picks) as [Slot, DiaryEntry['picks'][Slot]][]) {
    if (pick?.kind !== 'closet') continue
    const item = closetById.get(pick.itemId)
    if (item) out[slot] = { name: item.name, colorHex: item.colorHex, cutoutUrl: item.cutoutUrl, shape: item.shape }
  }
  return out
}

export function entryItems(entry: DiaryEntry, closetById: Map<string, ClosetItem>): ClosetItem[] {
  return Object.values(entry.picks).flatMap((pick) => {
    const item = pick?.kind === 'closet' ? closetById.get(pick.itemId) : undefined
    return item ? [item] : []
  })
}
