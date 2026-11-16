import type { BodyMeasurement, BodyProfile, ClosetItem, LessonRule, LessonRuleCheck, LessonRuleKind, ReviewDecision, ReviewRecord, Slot, WishlistInput } from '@/types'
import { toISODate } from './date'
import { isInCloset } from './slots'
import { comfortStretch, STRETCH_COMFORT } from './stretch'

/* ── 標記踩雷：處理方式與原因 ─────────────────────── */

export const DECISIONS: { value: ReviewDecision; label: string; desc: string }[] = [
  { value: 'returned', label: '已退貨', desc: '退款後資料仍保留' },
  { value: 'exchanged', label: '換貨', desc: '下一步複製成新的一件' },
  { value: 'kept', label: '留著但不會穿', desc: '之後可以改成轉賣' },
  { value: 'given_away', label: '轉賣・送人', desc: '記下去處就好' },
]

export const DECISION_LABEL: Record<ReviewDecision, string> = { returned: '已退貨', exchanged: '已換貨', kept: '留著不穿', given_away: '轉賣・送人' }

/** 處理方式的標籤顏色（B-Lessons） */
export const DECISION_TAG: Record<ReviewDecision, string> = {
  returned: 'bg-rose-soft text-status-repair-fg',
  exchanged: 'bg-sage-soft text-sage-ink',
  kept: 'bg-oat-soft text-oat-ink',
  given_away: 'bg-mist-soft text-mist-ink',
}

export type ReasonGroup = '尺寸' | '材質' | '其他'

export const REASON_GROUPS: { group: ReasonGroup; reasons: string[] }[] = [
  { group: '尺寸', reasons: ['胸口太緊', '胸口太鬆', '肩膀卡', '肩太寬', '腰太緊', '腰太鬆', '太短', '太長', '袖子太短', '袖子太長', '腳趾擠', '腳跟掉'] },
  { group: '材質', reasons: ['刺癢', '太薄會透', '悶熱', '沒彈性', '起毛球', '容易皺'] },
  { group: '其他', reasons: ['顏色和照片不同', '版型不適合我', '扣子間開縫', '做工差', '其實不需要'] },
]

export function reasonGroup(reason: string): ReasonGroup {
  return REASON_GROUPS.find((entry) => entry.reasons.includes(reason))?.group ?? '其他'
}

/* ── 規則 ─────────────────────────────────────────── */

export const RULE_KIND_LABEL: Record<LessonRuleKind, string> = { brand: '品牌', category: '類別', size: '尺寸' }

/** 規則範圍標籤顏色：品牌燕麥、類別霧藍、尺寸鼠尾草 */
export const RULE_KIND_TAG: Record<LessonRuleKind, string> = {
  brand: 'bg-oat-soft text-oat-ink',
  category: 'bg-mist-soft text-mist-ink',
  size: 'bg-sage-soft text-sage-ink',
}

/* ── 尺寸對照 ─────────────────────────────────────── */

type PartKind = 'girth' | 'width' | 'length'

interface PartDef {
  label: string
  /** 平放尺寸欄位 */
  flatKey: string
  /** 平放尺寸名稱（寫規則用），例如「胸寬」 */
  flatLabel: string
  /** 圍度類：平放 ×2 */
  double: boolean
  kind: PartKind
  /** 對應量測快照或固定身體資料；沒有就只和常穿衣物的數值比 */
  body?: (measurement: BodyMeasurement | null, profile: BodyProfile | null, item: ClosetItem) => number | null
  bodyLabel?: string
}

const TOP_PARTS: PartDef[] = [
  { label: '胸圍', flatKey: 'chest', flatLabel: '胸寬', double: true, kind: 'girth', body: (m) => m?.upperBustCm ?? null, bodyLabel: '上胸圍' },
  { label: '肩寬', flatKey: 'shoulder', flatLabel: '肩寬', double: false, kind: 'width', body: (m) => m?.shoulderCm ?? null },
  { label: '腰圍', flatKey: 'waist', flatLabel: '腰寬', double: true, kind: 'girth', body: (m) => m?.waistCm ?? null },
  { label: '衣長', flatKey: 'length', flatLabel: '衣長', double: false, kind: 'length' },
  { label: '袖長', flatKey: 'sleeve', flatLabel: '袖長', double: false, kind: 'length', body: (_m, profile) => profile?.armLengthCm ?? null, bodyLabel: '手臂長' },
]

function maxRecorded(...values: (number | null | undefined)[]) {
  const recorded = values.filter((value): value is number => value != null)
  return recorded.length ? Math.max(...recorded) : null
}

const PARTS: Partial<Record<Slot, PartDef[]>> = {
  top: TOP_PARTS,
  outer: TOP_PARTS,
  bottom: [
    { label: '腰圍', flatKey: 'waist', flatLabel: '腰寬', double: true, kind: 'girth', body: (m, _profile, item) => {
      const itemName = `${item.name} ${item.fit ?? ''}`
      if (/高腰/.test(itemName)) return m?.highWaistCm ?? maxRecorded(m?.waistCm, m?.waistSittingCm)
      if (item.flatStretch?.waist == null) {
        const navel = [m?.navelCm, m?.navelSittingCm].filter((value): value is number => value != null)
        if (navel.length) return Math.max(...navel)
      }
      return maxRecorded(m?.waistCm, m?.waistSittingCm)
    } },
    { label: '臀圍', flatKey: 'hip', flatLabel: '臀寬', double: true, kind: 'girth', body: (m) => m?.hipCm ?? null },
    { label: '大腿圍', flatKey: 'thigh', flatLabel: '大腿寬', double: true, kind: 'girth', body: (m) => m?.thighCm ?? null },
    { label: '褲長', flatKey: 'length', flatLabel: '褲長', double: false, kind: 'length' },
    { label: '股上', flatKey: 'rise', flatLabel: '股上', double: false, kind: 'length', body: (_m, profile) => profile?.seatedRiseCm ?? null, bodyLabel: '坐姿股上' },
  ],
  shoes: [
    { label: '鞋內長', flatKey: 'innerLength', flatLabel: '鞋內長', double: false, kind: 'length', body: (m) => m?.footSockLengthCm ?? m?.footBareLengthCm ?? null, bodyLabel: '腳長' },
    { label: '鞋寬', flatKey: 'width', flatLabel: '鞋寬', double: false, kind: 'width', body: (_m, profile) => {
      const widths = [profile?.footWidthLeftCm, profile?.footWidthRightCm].filter((value): value is number => value != null)
      return widths.length ? Math.max(...widths) : null
    }, bodyLabel: '裸腳腳寬' },
    { label: '跟高', flatKey: 'heelHeight', flatLabel: '跟高', double: false, kind: 'length' },
  ],
}

export const hasSizeComparison = (slot: Slot) => Boolean(PARTS[slot])

/** snug＝有彈性・會貼身；tight＝拉了也不夠（太緊） */
export type Judge = 'ok' | 'small' | 'big' | 'unknown' | 'snug' | 'tight'

/** 常穿範圍至少要幾件沒彈性的衣物才顯示 */
const MIN_BAND_ITEMS = 3

export interface SizeRow {
  part: PartDef
  /** 這件（圍度已 ×2） */
  item: number
  /** 我的身體；沒有對應部位或沒量過為 null */
  body: number | null
  /** 有身體尺寸的部位：缺量測時為 true */
  missingBody: boolean
  /** 比較用的數值：有身體＝這件 − 身體；沒有身體＝這件本身 */
  metric: number | null
  /** 常穿範圍（同 metric 單位） */
  band: [number, number] | null
  judge: Judge
  /** 彈性：拉到最大（圍度已 ×2）；沒有拉伸值為 null */
  stretch: number | null
  /** 平放值／可拉伸值（未 ×2，顯示「40 ↔ 60」用） */
  flat: number
  flatStretch: number | null
  /** 舒適拉伸、拉到最大的比較值（同 metric 單位） */
  comfortMetric: number | null
  maxMetric: number | null
  /** 判定旁的小註：「有彈性」或「有彈性，可拉到 60」 */
  note: string | null
}

const round1 = (n: number) => Math.round(n * 10) / 10

export const formatCm = (n: number) => `${round1(n)}`
export const formatSigned = (n: number) => (n > 0 ? `+${round1(n)}` : n < 0 ? `−${round1(Math.abs(n))}` : '±0')

export function judgeLabel(row: SizeRow): string {
  if (row.judge === 'unknown') return '—'
  if (row.judge === 'snug') return '有彈性・會貼身'
  if (row.judge === 'tight') return '太緊'
  if (row.judge === 'ok') return '剛好'
  const small = row.judge === 'small'
  if (row.part.kind === 'girth') return small ? '偏緊' : '偏鬆'
  if (row.part.kind === 'width') return small ? '偏窄' : '偏寬'
  return small ? '偏短' : '偏長'
}

export function bandLabel(row: SizeRow): string {
  if (!row.band) return '還沒有常穿資料'
  const [min, max] = row.band
  const fmt = row.part.body ? formatSigned : formatCm
  const text = min === max ? fmt(min) : `${fmt(min)}～${fmt(max)}`
  return row.part.body ? text : `${text} cm`
}

/** 身體：購買日前最近一次量測；沒有就用最新一次 */
export function pickBodySnapshot(measurements: BodyMeasurement[], purchaseDate?: string) {
  const sorted = [...measurements].sort((a, b) => b.measuredOn.localeCompare(a.measuredOn))
  const before = purchaseDate ? sorted.find((m) => m.measuredOn <= purchaseDate) : undefined
  if (before) return { measurement: before, beforePurchase: true }
  return { measurement: sorted[0] ?? null, beforePurchase: false }
}

/** 常穿：同類別、還在衣櫃、穿過 ≥ 5 次 */
export function comfortItems(item: ClosetItem, closet: ClosetItem[]) {
  return closet.filter((other) => other.id !== item.id && other.categoryId === item.categoryId && isInCloset(other.status) && (other.wearCount ?? 0) >= 5)
}

function flatValue(item: ClosetItem, part: PartDef) {
  const raw = item.flatMeasurements?.[part.flatKey]
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return null
  return part.double ? raw * 2 : raw
}

/** 這個部位的可拉伸平放值（未 ×2）；沒有或不大於平放值時為 null */
function stretchValue(item: ClosetItem, part: PartDef) {
  const flat = item.flatMeasurements?.[part.flatKey]
  const raw = item.flatStretch?.[part.flatKey]
  if (typeof raw !== 'number' || typeof flat !== 'number' || !Number.isFinite(raw) || raw <= flat) return null
  return raw
}

function metricOf(value: number, part: PartDef, body: BodyMeasurement | null, profile: BodyProfile | null, item: ClosetItem) {
  if (!part.body) return value
  const bodyValue = part.body(body, profile, item)
  return bodyValue == null ? null : round1(value - bodyValue)
}

export function buildSizeRows(item: ClosetItem, body: BodyMeasurement | null, comfort: ClosetItem[], profile: BodyProfile | null = null): SizeRow[] {
  const parts = PARTS[item.slot] ?? []
  const rows: SizeRow[] = []
  for (const part of parts) {
    const value = flatValue(item, part)
    if (value == null) continue
    const flat = item.flatMeasurements?.[part.flatKey] as number
    const flatStretch = stretchValue(item, part)
    const bodyValue = part.body ? part.body(body, profile, item) : null
    const metric = metricOf(value, part, body, profile, item)
    // 常穿範圍以部位計算：排除這個部位有拉伸值的衣物；少於 3 件不顯示
    const others = comfort.flatMap((other) => {
      if (stretchValue(other, part) != null) return []
      const otherValue = flatValue(other, part)
      if (otherValue == null) return []
      const otherMetric = metricOf(otherValue, part, body, profile, other)
      return otherMetric == null ? [] : [otherMetric]
    })
    const band: [number, number] | null = others.length >= MIN_BAND_ITEMS ? [Math.min(...others), Math.max(...others)] : null
    const base = { part, item: round1(value), body: bodyValue, missingBody: Boolean(part.body) && bodyValue == null, metric, band, flat, flatStretch }

    if (flatStretch == null) {
      const judge: Judge = metric == null || !band ? 'unknown' : metric < band[0] ? 'small' : metric > band[1] ? 'big' : 'ok'
      rows.push({ ...base, judge, stretch: null, comfortMetric: null, maxMetric: null, note: null })
      continue
    }

    const factor = part.double ? 2 : 1
    const stretch = round1(flatStretch * factor)
    const comfortValue = round1(comfortStretch(flat, flatStretch) * factor)
    const stretchRow = { ...base, stretch }
    // 有拉伸值、沒有身體量測 → 不判定，只顯示資訊
    if (!part.body || bodyValue == null || metric == null) {
      rows.push({ ...stretchRow, judge: 'unknown', comfortMetric: null, maxMetric: null, note: `有彈性，可拉到 ${flatStretch}` })
      continue
    }
    const comfortMetric = round1(comfortValue - bodyValue)
    const maxMetric = round1(stretch - bodyValue)
    const withBody = { ...stretchRow, comfortMetric, maxMetric }
    if (band && metric >= band[0]) {
      // 1. 平放就在常穿範圍內或以上 → 照原本邏輯
      rows.push({ ...withBody, judge: metric > band[1] ? 'big' : 'ok', note: '有彈性' })
    } else if (value >= bodyValue) {
      // 2. 不拉伸也穿得下，但比常穿小
      rows.push({ ...withBody, judge: band ? 'small' : 'unknown', note: '有彈性' })
    } else if (comfortValue >= bodyValue) {
      // 3. 平放小於身體，舒適拉伸後夠
      rows.push({ ...withBody, judge: 'snug', note: null })
    } else {
      // 4. 拉了也不夠
      rows.push({ ...withBody, judge: 'tight', note: null })
    }
  }
  return rows
}

/** 範圍條的位置（百分比）：平放、常穿範圍；有彈性時加上身體（0）、舒適拉伸、拉到最大 */
export function rangeBarPositions(row: SizeRow) {
  if (row.metric == null) return null
  const stretchPoints = row.comfortMetric != null && row.maxMetric != null ? [row.comfortMetric, row.maxMetric, 0] : []
  const points = [row.metric, ...(row.band ?? []), ...stretchPoints]
  const lo = Math.min(...points)
  const hi = Math.max(...points)
  const pad = Math.max(2, (hi - lo) * (stretchPoints.length ? 0.12 : 0.35))
  const min = lo - pad
  const span = hi + pad - min
  const pct = (v: number) => Math.round(((v - min) / span) * 1000) / 10
  return {
    marker: pct(row.metric),
    band: row.band ? { left: pct(row.band[0]), width: Math.max(1.5, pct(row.band[1]) - pct(row.band[0])) } : null,
    stretch: stretchPoints.length ? { zero: pct(0), comfort: pct(row.comfortMetric!), max: pct(row.maxMetric!) } : null,
  }
}

/* ── AI 覆盤：整理成文字給外部 AI，再把回覆拆回來（平台不呼叫 AI） ── */

export type PromptSection = 'item' | 'body' | 'comfort' | 'material' | 'reasons' | 'feeling'

export const FLAT_LABELS: Record<string, string> = {
  shoulder: '肩寬', chest: '胸寬', waist: '腰寬', length: '衣長', sleeve: '袖長', cuff: '袖口',
  rise: '股上', hip: '臀寬', thigh: '大腿寬', hem: '褲口寬', innerLength: '鞋內長', heelHeight: '跟高',
  width: '寬', height: '高', depth: '側寬',
}

const BODY_FIELDS: [keyof BodyMeasurement, string][] = [
  ['upperBustCm', '上胸圍'], ['underBustCm', '下胸圍'], ['highWaistCm', '高腰圍'], ['waistCm', '腰圍・站'], ['waistSittingCm', '腰圍・坐'], ['navelCm', '肚臍圍・站'], ['navelSittingCm', '肚臍圍・坐'], ['hipCm', '臀圍'],
  ['shoulderCm', '肩寬'], ['thighCm', '大腿圍'],
  ['footSockLengthCm', '腳長（一般襪）'], ['footSockWidthCm', '腳寬（一般襪）'],
]

export interface PromptContext {
  item: ClosetItem
  record: ReviewRecord
  rows: SizeRow[]
  body: BodyMeasurement | null
  bodyProfile: BodyProfile
  comfortCount: number
}

export function promptSections(ctx: PromptContext): { key: PromptSection; label: string; available: boolean }[] {
  return [
    { key: 'item', label: '衣物與平放尺寸', available: true },
    { key: 'body', label: ctx.body ? `${ctx.body.measuredOn.slice(5).replace('-', '/')} 量測＋固定資料` : '量測與固定資料', available: Boolean(ctx.body) || Object.values(ctx.bodyProfile).some((value) => typeof value === 'number') },
    { key: 'comfort', label: '常穿範圍', available: ctx.rows.some((row) => row.band) },
    { key: 'material', label: '材質', available: Boolean(ctx.item.materialComposition || ctx.item.material) },
    { key: 'reasons', label: '哪裡不對', available: ctx.record.reasons.length > 0 },
    { key: 'feeling', label: '穿上的感覺', available: ctx.record.personalNote.length > 0 },
  ]
}

export const AI_REPLY_FORMAT = ['請照這個格式回覆：', '原因：', '- （一行一個原因）', '規則：', '- 範圍｜條件（例如：襯衫｜平放胸寬 ≥ 47）'].join('\n')

/** 把衣物、量測、常穿範圍、原因整理成一段可以貼給 AI 的文字（不含照片和價格） */
export function buildAiPrompt(ctx: PromptContext, include: Set<PromptSection>): string {
  const { item, record, rows, body, bodyProfile, comfortCount } = ctx
  const lines = ['請幫我覆盤一件買錯的衣服，用繁體中文回答。', '']
  if (include.has('item')) {
    lines.push(`【衣物】${[item.name, item.size, item.categoryName].filter(Boolean).join('・')}`)
    if (include.has('material') && (item.materialComposition || item.material)) lines.push(`材質：${item.materialComposition || item.material}`)
    const flat = Object.entries(item.flatMeasurements ?? {})
      .filter(([, value]) => typeof value === 'number' && value > 0)
      .map(([key, value]) => {
        const stretch = item.flatStretch?.[key]
        const measureLabel = key === 'width' && item.slot === 'shoes' ? '鞋寬' : FLAT_LABELS[key] ?? key
        const label = `${measureLabel} ${value}`
        return typeof stretch === 'number' && stretch > (value as number) ? `${label}（有彈性，可拉到 ${stretch}）` : label
      })
    lines.push(flat.length ? `平放尺寸（cm）：${flat.join('、')}` : '平放尺寸：沒有記錄')
    lines.push('')
  } else if (include.has('material') && (item.materialComposition || item.material)) {
    lines.push(`【材質】${item.materialComposition || item.material}`, '')
  }
  if (include.has('body') && (body || Object.values(bodyProfile).some((value) => typeof value === 'number'))) {
    const values = body ? BODY_FIELDS.map(([key, label]) => [label, body[key]] as const).filter(([, value]) => typeof value === 'number') : []
    const fixedValues = [
      ['身高', bodyProfile.heightCm], ['手臂長', bodyProfile.armLengthCm], ['腿長（內側）', bodyProfile.inseamCm], ['坐姿股上', bodyProfile.seatedRiseCm],
      ['左腳寬（裸腳）', bodyProfile.footWidthLeftCm], ['右腳寬（裸腳）', bodyProfile.footWidthRightCm], ['腳跟寬', bodyProfile.heelWidthCm],
    ].filter((entry): entry is [string, number] => typeof entry[1] === 'number')
    const datedLabel = body ? `${body.measuredOn.replace(/-/g, '/')} 量測` : '固定資料'
    lines.push(`【我的身體】${datedLabel}`, [...values, ...fixedValues].map(([label, value]) => `${label} ${value}`).join('、'), '')
  }
  if (include.has('comfort')) {
    const banded = rows.filter((row) => row.band)
    if (banded.length) {
      lines.push(`【我常穿的${item.categoryName ?? '同類衣物'} ${comfortCount} 件：衣服 − 身體】`, banded.map((row) => `${row.part.label} ${bandLabel(row)}`).join('、'), '')
    }
  }
  if (include.has('reasons') && record.reasons.length) lines.push(`【哪裡不對】${record.reasons.join('、')}`, '')
  if (include.has('feeling') && record.personalNote.length) lines.push(`【穿上的感覺】${record.personalNote.join('；')}`, '')
  lines.push(AI_REPLY_FORMAT)
  return lines.join('\n')
}

export interface KnownNames {
  brands: string[]
  categories: string[]
}

export interface RuleDraft {
  scope: string
  condition: string
  kind: LessonRuleKind
  checkKind: LessonRuleCheck
}

const FLAT_WORDS = [...new Set([...Object.values(FLAT_LABELS).filter((word) => word.length > 1), '褲長', '胸圍', '腰圍', '臀圍', '大腿圍', '腳長'])].join('|')
const COMPARE = '(?:≥|≤|>=|<=|＞|＜|>|<|至少|不超過|不少於|不低於|不高於|低於|高於|以上|以下)'
const AUTO_PATTERNS = [
  // 尺寸碼：尺寸選 M、選 38
  /(?:尺寸|尺碼)?\s*(?:選|挑|買|要)\s*[A-Za-z0-9.]{1,5}(?:\s|$|，|。|號)/,
  // 平放尺寸：平放胸寬 ≥ 47、褲長 98 cm 以下
  new RegExp(`(?:${FLAT_WORDS}).{0,4}?${COMPARE}\\s*\\d|(?:${FLAT_WORDS}).{0,6}?\\d+(?:\\.\\d+)?\\s*(?:cm|公分)?\\s*(?:以上|以下)`),
  // 材質比例：彈性纖維 ≥ 5%、羊毛低於 50%
  new RegExp(`[\\u4e00-\\u9fa5A-Za-z]{1,6}\\s*${COMPARE}\\s*\\d+\\s*%`),
]

const norm = (text: string) => text.toLowerCase().replace(/\s+/g, '')

export type WishlistRuleCandidate = Omit<Pick<WishlistInput, 'brand' | 'shop' | 'slot' | 'size' | 'sizeNote' | 'material' | 'materialPercentages' | 'materialComposition' | 'flatMeasurements' | 'flatStretch'>, 'slot'> & { slot: Slot | '' }

export interface WishlistRuleMatch {
  rule: LessonRule
  /** 有資料可比較且不符合規則時提供差異；沒有足夠資料時只提醒使用者核對。 */
  detail?: string
  mismatch: boolean
  /** 平放未達「至少」型規則，但舒適拉伸後達標：燕麥色「有彈性，可能可以」 */
  stretchOk?: boolean
}

/** 是否已超過七日提醒冷卻；now 參數方便測試固定時間。 */
export function isLessonRuleReminderDue(rule: LessonRule, now = Date.now()) {
  if (!rule.lastNotifiedAt) return true
  const lastNotified = Date.parse(rule.lastNotifiedAt)
  return !Number.isFinite(lastNotified) || now - lastNotified >= 7 * 24 * 60 * 60 * 1000
}

const SLOT_SCOPE_WORDS: Record<Slot, string[]> = {
  outer: ['外套', '大衣', '西裝外套', '夾克'],
  top: ['上衣', '襯衫', '針織', '毛衣', 'T恤', 'T恤', '背心'],
  bottom: ['下身', '褲', '裙', '洋裝'],
  shoes: ['鞋', '靴'],
  bag: ['包'],
  acc: ['配件', '飾品', '圍巾', '帽子', '襪'],
}

function ruleScopeMatches(rule: LessonRule, candidate: WishlistRuleCandidate) {
  const scope = norm(rule.scope)
  if (!scope) return false
  if (['所有衣物', '所有', '全部'].some((word) => scope.includes(norm(word)))) return true

  const brandAndShop = [candidate.brand, candidate.shop]
    .map((value) => norm(value ?? ''))
    .filter((value) => value && value !== norm('尚未決定'))
  const brandMatches = brandAndShop.some((value) => scope.includes(value) || value.includes(scope))
  const categoryMatches = candidate.slot ? SLOT_SCOPE_WORDS[candidate.slot].some((word) => scope.includes(norm(word))) : false
  const scopeNamesCategory = Object.values(SLOT_SCOPE_WORDS).flat().some((word) => scope.includes(norm(word)))
  if (rule.kind === 'brand') return brandMatches && (!scopeNamesCategory || categoryMatches)
  if (rule.kind === 'category') return categoryMatches
  return categoryMatches || brandMatches
}

type RuleRelation = 'min' | 'max'
interface RuleThreshold { metric: string; relation: RuleRelation; value: number }

const RULE_METRICS = ['胸寬', '胸圍', '肩寬', '腰寬', '腰圍', '臀寬', '臀圍', '大腿寬', '大腿圍', '褲長', '衣長', '袖長', '坐姿股上', '褲檔', '股上', '褲口寬']
const RULE_OPERATORS: [string, RuleRelation][] = [
  ['至少', 'min'], ['不少於', 'min'], ['不低於', 'min'], ['以上', 'min'], ['>=', 'min'], ['≥', 'min'], ['＞', 'min'], ['>', 'min'],
  ['不超過', 'max'], ['不高於', 'max'], ['至多', 'max'], ['低於', 'max'], ['以下', 'max'], ['<=', 'max'], ['≤', 'max'], ['＜', 'max'], ['<', 'max'],
]

function parseRuleThreshold(text: string): RuleThreshold | null {
  const metric = [...RULE_METRICS].sort((a, b) => b.length - a.length).find((word) => text.includes(word))
  if (!metric) return null
  const rest = text.slice(text.indexOf(metric) + metric.length).trim()
  for (const [operator, relation] of RULE_OPERATORS) {
    const direct = rest.startsWith(operator) ? new RegExp(`^\\s*(\\d+(?:\\.\\d+)?)`).exec(rest.slice(operator.length)) : null
    if (direct) return { metric, relation, value: Number(direct[1]) }
    const reversed = /^(\d+(?:\.\d+)?)(?:cm|公分)?\s*(.*)$/.exec(rest)
    const reversedOperator = reversed ? RULE_OPERATORS.find(([token]) => reversed[2].startsWith(token)) : undefined
    if (reversed && reversedOperator?.[0] === operator) return { metric, relation, value: Number(reversed[1]) }
  }
  return null
}

/** 圍度的「一圈」與「平放寬」：平放寬 × 2 ＝ 一圈 */
const GIRTH_PAIRS: [girth: string, flat: string][] = [['胸圍', '胸寬'], ['腰圍', '腰寬'], ['臀圍', '臀寬'], ['大腿圍', '大腿寬']]

interface CandidateMetric {
  /** 已換算成規則所用單位的數值 */
  value: number
  /** 可拉伸到的數值（同單位）；沒有為 null */
  stretch: number | null
  /** 實際讀到的名稱與數字 */
  sourceLabel: string
  sourceValue: number
  /** 讀自平放尺寸欄位或尺寸備註 */
  source: 'flat' | 'note'
}

/** 規則指標對應的平放尺寸欄位與倍數（一圈 ＝ 平放 × 2） */
const RULE_FLAT_KEYS: Record<string, { key: string; factor: number; label: string }> = {
  胸寬: { key: 'chest', factor: 1, label: '胸寬' }, 胸圍: { key: 'chest', factor: 2, label: '胸寬' },
  腰寬: { key: 'waist', factor: 1, label: '腰寬' }, 腰圍: { key: 'waist', factor: 2, label: '腰寬' },
  臀寬: { key: 'hip', factor: 1, label: '臀寬' }, 臀圍: { key: 'hip', factor: 2, label: '臀寬' },
  大腿寬: { key: 'thigh', factor: 1, label: '大腿寬' }, 大腿圍: { key: 'thigh', factor: 2, label: '大腿寬' },
  肩寬: { key: 'shoulder', factor: 1, label: '肩寬' }, 袖長: { key: 'sleeve', factor: 1, label: '袖長' },
  衣長: { key: 'length', factor: 1, label: '衣長' }, 褲長: { key: 'length', factor: 1, label: '褲長' },
  褲檔: { key: 'rise', factor: 1, label: '股上' }, 股上: { key: 'rise', factor: 1, label: '股上' }, 褲口寬: { key: 'hem', factor: 1, label: '褲口寬' },
}

/** 先讀平放尺寸欄位（含拉伸值）；讀不到再從尺寸備註抓 */
function candidateMeasure(candidate: WishlistRuleCandidate, metric: string): CandidateMetric | null {
  const mapping = RULE_FLAT_KEYS[metric]
  const flat = mapping ? candidate.flatMeasurements?.[mapping.key] : null
  if (mapping && typeof flat === 'number' && flat > 0) {
    const stretch = candidate.flatStretch?.[mapping.key]
    return {
      value: round1(flat * mapping.factor),
      stretch: typeof stretch === 'number' && stretch > flat ? round1(stretch * mapping.factor) : null,
      sourceLabel: `平放${mapping.label}`,
      sourceValue: flat,
      source: 'flat',
    }
  }
  return candidateMetricValue(candidate.sizeNote ?? '', metric)
}

/**
 * 從尺寸備註找規則指標的數值。先找同名指標；找不到時改找對應的一圈／平放寬並換算
 * （規則寫胸圍、備註寫胸寬 → ×2；規則寫胸寬、備註寫胸圍 → ÷2）。備註寫「胸寬 40-60」時 60 當拉伸值。
 */
export function candidateMetricValue(sizeNote: string, metric: string): CandidateMetric | null {
  const pair = GIRTH_PAIRS.find((entry) => entry.includes(metric))
  const aliases: { label: string; factor: number }[] = [{ label: metric, factor: 1 }]
  if (pair) aliases.push(metric === pair[0] ? { label: pair[1], factor: 2 } : { label: pair[0], factor: 0.5 })
  for (const { label, factor } of aliases) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = new RegExp(`${escaped}[^\\d]{0,12}(\\d+(?:\\.\\d+)?)(?:\\s*(?:cm|公分)?\\s*[-~～〜]\\s*(\\d+(?:\\.\\d+)?))?`).exec(sizeNote)
    if (match) {
      const sourceValue = Number(match[1])
      const upper = match[2] ? Number(match[2]) : null
      return {
        value: round1(sourceValue * factor),
        stretch: upper != null && upper > sourceValue ? round1(upper * factor) : null,
        sourceLabel: label,
        sourceValue,
        source: 'note',
      }
    }
  }
  return null
}

function matchesRuleCondition(rule: LessonRule, candidate: WishlistRuleCandidate): WishlistRuleMatch | null {
  const text = rule.text
  if (rule.checkKind === 'remind') return { rule, mismatch: false }

  const threshold = parseRuleThreshold(text)
  if (threshold) {
    const found = candidateMeasure(candidate, threshold.metric)
    if (found === null) return { rule, mismatch: false, detail: `商品尚未填「${threshold.metric}」尺寸，記得確認是否符合這條規則。` }
    const actual = found.value
    const violates = threshold.relation === 'min' ? actual < threshold.value : actual > threshold.value
    if (!violates) return null
    const prefix = found.source === 'flat' ? '' : '商品備註為 '
    const shown = found.sourceLabel === threshold.metric || found.sourceValue === actual
      ? `${found.sourceLabel} ${actual} cm`
      : `${found.sourceLabel} ${found.sourceValue} cm（換算${threshold.metric} ${actual} cm）`
    // 只有「至少」型規則會因彈性放寬：平放 ＋（拉伸 − 平放）× 60% 達標就算「可能可以」
    if (threshold.relation === 'min' && found.stretch != null) {
      const comfort = round1(actual + (found.stretch - actual) * STRETCH_COMFORT)
      if (comfort >= threshold.value) {
        return { rule, mismatch: false, stretchOk: true, detail: `${prefix}${shown}，未達 ${threshold.value}；可拉到 ${found.stretch}，舒適拉伸約 ${comfort}，達標。穿起來會比較貼身。` }
      }
      return { rule, mismatch: true, detail: `${prefix}${shown}，未符合至少 ${threshold.value} cm；可拉到 ${found.stretch}，舒適拉伸約 ${comfort}，還是不夠。` }
    }
    return { rule, mismatch: true, detail: `${prefix}${shown}，未符合 ${threshold.relation === 'min' ? '至少' : '不超過'} ${threshold.value} cm。${threshold.relation === 'max' && found.stretch != null ? '「不超過」型規則不因彈性放寬。' : ''}` }
  }

  const sizeMatch = /(?:尺寸|尺碼)?\s*(?:選|挑|買|要)\s*([a-z0-9.]{1,5})(?:\s|$|，|。|號)/i.exec(text)
  if (sizeMatch) {
    const preferred = norm(sizeMatch[1])
    if (!candidate.size?.trim()) return { rule, mismatch: false, detail: '商品尚未填預計尺寸，記得確認後再下單。' }
    return norm(candidate.size) !== preferred
      ? { rule, mismatch: true, detail: `預計尺寸是 ${candidate.size}，與規則建議的 ${sizeMatch[1]} 不同。` }
      : null
  }

  const materialMatch = /([\u4e00-\u9fa5a-z]{1,10})\s*(?:≥|≤|>=|<=|＞|＜|>|<|至少|不超過|不少於|不低於|不高於|低於|高於|以上|以下)\s*(\d+(?:\.\d+)?)\s*%/i.exec(text)
  if (materialMatch) {
    const material = norm(materialMatch[1])
    const entry = Object.entries(candidate.materialPercentages ?? {}).find(([name]) => norm(name).includes(material) || material.includes(norm(name)))
    const note = `${candidate.material ?? ''} ${candidate.materialComposition ?? ''} ${candidate.sizeNote ?? ''}`
    const notedPercent = new RegExp(`${materialMatch[1]}[^\\d]{0,12}(\\d+(?:\\.\\d+)?)\\s*%`, 'i').exec(note)
    const actual = entry?.[1] ?? (notedPercent ? Number(notedPercent[1]) : undefined)
    if (actual === undefined) return { rule, mismatch: false, detail: `商品尚未記錄「${materialMatch[1]}」比例，記得核對材質標示。` }
    const relationText = text.slice(text.indexOf(materialMatch[1]) + materialMatch[1].length)
    const relation = /(?:≥|>=|＞|>|至少|不少於|不低於|以上)/.test(relationText) ? 'min' : 'max'
    const violates = relation === 'min' ? actual < Number(materialMatch[2]) : actual > Number(materialMatch[2])
    return violates
      ? { rule, mismatch: true, detail: `${materialMatch[1]}比例 ${actual}%，未符合規則 ${relation === 'min' ? '至少' : '不超過'} ${materialMatch[2]}%。` }
      : null
  }

  return { rule, mismatch: false }
}

/** 選購時比對已啟用的覆盤規則；不可判定的規則仍以非阻擋提醒呈現。 */
export function matchWishlistLessonRules(rules: LessonRule[], candidate: WishlistRuleCandidate): WishlistRuleMatch[] {
  return rules
    .filter((rule) => rule.active && ruleScopeMatches(rule, candidate))
    .flatMap((rule) => {
      const match = matchesRuleCondition(rule, candidate)
      return match ? [match] : []
    })
}

/** 判斷一條規則：範圍對得到品牌／類別、條件對得到欄位，才「可自動檢查」，否則「只提醒」 */
export function classifyRule(scopeText: string, condition: string, known: KnownNames): RuleDraft {
  const scopeKey = norm(scopeText)
  const brand = [...known.brands].sort((a, b) => b.length - a.length).find((name) => scopeKey.includes(norm(name)))
  const category = [...known.categories].sort((a, b) => b.length - a.length).find((name) => scopeKey.includes(norm(name)))
  const conditionAuto = AUTO_PATTERNS.some((pattern) => pattern.test(condition))
  const isFlat = AUTO_PATTERNS[1].test(condition)
  const scope = brand && category ? `${brand}・${category}` : scopeText.trim() || '所有衣物'
  return {
    scope,
    condition: condition.trim(),
    kind: brand ? 'brand' : isFlat ? 'size' : 'category',
    checkKind: (brand || category) && conditionAuto ? 'auto' : 'remind',
  }
}

export const CHECK_LABEL: Record<LessonRuleCheck, string> = { auto: '可自動檢查', remind: '只提醒' }
export const CHECK_TAG: Record<LessonRuleCheck, string> = { auto: 'bg-sage-soft text-sage-ink', remind: 'bg-oat-soft text-oat-ink' }

const BULLET = /^\s*(?:[-*・•‧]|\d+[.、)）])\s*/

/** 照「原因：／規則：」格式拆開 AI 回覆；沒照格式時整段當成原因 */
export function parseAiReply(text: string, known: KnownNames): { reasons: string[]; rules: RuleDraft[]; formatted: boolean } {
  const reasons: string[] = []
  const rules: RuleDraft[] = []
  let section: 'reasons' | 'rules' | null = null
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    // 去掉 Markdown 標題與粗體記號
    const line = raw.trim().replace(/^#+\s*/, '').replace(/^\*\*(.+?)\*\*$/, '$1').replace(/^\*\*(原因|規則)\s*([:：])\s*\*\*/, '$1$2')
    if (!line) continue
    const header = /^(原因|規則)\s*[:：]\s*(.*)$/.exec(line)
    if (header) {
      section = header[1] === '原因' ? 'reasons' : 'rules'
      if (!header[2]) continue
    }
    if (!section) continue
    const body = (header ? header[2] : line).replace(BULLET, '').trim()
    if (!body) continue
    if (section === 'reasons') {
      reasons.push(body)
    } else {
      const split = body.split(/[｜|]/)
      const [scopeText, condition] = split.length > 1 ? [split[0], split.slice(1).join('｜')] : ['', body]
      if (condition.trim()) rules.push(classifyRule(scopeText, condition, known))
    }
  }
  const formatted = reasons.length > 0 || rules.length > 0
  if (!formatted) {
    return { reasons: text.split('\n').map((line) => line.replace(BULLET, '').trim()).filter(Boolean), rules: [], formatted: false }
  }
  return { reasons, rules, formatted }
}

/* ── 換貨 ─────────────────────────────────────────── */

/** 收到換貨後要試穿檢查的地方（依上次的踩雷原因） */
const CHECK_TIPS: Record<string, string> = {
  胸口太緊: '胸口：扣上第二顆扣子，看扣子之間會不會開縫。',
  扣子間開縫: '胸口：扣上第二顆扣子，看扣子之間會不會開縫。',
  胸口太鬆: '胸口：前傾時會不會空空的、看得到裡面。',
  肩膀卡: '肩膀：手往前伸，背後會不會卡。',
  肩太寬: '肩線：肩線有沒有掉到手臂上。',
  腰太緊: '腰：坐下來時腰會不會勒。',
  腰太鬆: '腰：不繫皮帶會不會往下掉。',
  太短: '長度：抬手時會不會露出肚子。',
  太長: '長度：站直和走路時會不會太拖。',
  袖子太短: '袖子：手往前伸，袖口會不會縮到手腕上面。',
  袖子太長: '袖子：手自然放下，袖口會不會蓋過手指。',
  腳趾擠: '腳趾：站著時腳趾前面有沒有一點空間。',
  腳跟掉: '腳跟：走幾步看腳跟會不會滑出來。',
  沒彈性: '活動：坐下、抬手、彎腰都做一次，看會不會緊。',
}

export function exchangeChecks(reasons: string[]): string[] {
  const tips = reasons.map((reason) => CHECK_TIPS[reason] ?? (reasonGroup(reason) === '尺寸' ? `${reason}：收到後再試穿確認一次。` : null))
  return [...new Set(tips.filter((tip): tip is string => !!tip))].slice(0, 4)
}

/** 鑑賞期：收到日起 7 天 */
export function appraisalEnd(receivedOn: string) {
  const [y, m, d] = receivedOn.split('-').map(Number)
  return toISODate(new Date(y, m - 1, d + 7))
}

/* ── 筆記本統計 ───────────────────────────────────── */

export function lessonStats(records: ReviewRecord[], itemsById: Map<string, ClosetItem>, boughtThisYear: number) {
  const year = String(new Date().getFullYear())
  const returned = records.filter((record) => record.decision === 'returned')
  const refund = returned.reduce((sum, record) => sum + (record.price ?? 0), 0)
  const counts = new Map<string, string[]>()
  for (const record of records) {
    for (const reason of record.reasons) counts.set(reason, [...(counts.get(reason) ?? []), record.itemId])
  }
  const top = [...counts.entries()].sort((a, b) => b[1].length - a[1].length)[0]
  const topCategories = top ? [...new Set(top[1].map((id) => itemsById.get(id)?.categoryName).filter((name): name is string => !!name))] : []
  return {
    total: records.length,
    thisYear: records.filter((record) => (record.purchaseDate ?? toISODate(new Date(record.createdAt))).startsWith(year)).length,
    boughtThisYear,
    returned: returned.length,
    refund,
    topReason: top ? { reason: top[0], count: top[1].length, categories: topCategories } : null,
  }
}

/** 卡片上的日期：退貨日，否則最後更新日（MM/DD） */
export function reviewDate(record: ReviewRecord) {
  const iso = record.returnedOn ?? toISODate(new Date(record.updatedAt ?? record.createdAt))
  return iso.slice(5).replace('-', '/')
}

/** 「**粗體**」轉純文字，給卡片摘要用 */
export const plainText = (text: string) => text.replace(/\*\*/g, '')
