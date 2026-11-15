import type { BodyMeasurement, ClosetItem, LessonRuleCheck, LessonRuleKind, ReviewDecision, ReviewRecord, Slot } from '@/types'
import { toISODate } from './date'
import { isInCloset } from './slots'

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
  /** 對應的身體尺寸；沒有就只和常穿衣物的數值比 */
  body?: (m: BodyMeasurement) => number | null
  bodyLabel?: string
}

const TOP_PARTS: PartDef[] = [
  { label: '胸圍', flatKey: 'chest', flatLabel: '胸寬', double: true, kind: 'girth', body: (m) => m.upperBustCm, bodyLabel: '上胸圍' },
  { label: '肩寬', flatKey: 'shoulder', flatLabel: '肩寬', double: false, kind: 'width', body: (m) => m.shoulderCm },
  { label: '腰圍', flatKey: 'waist', flatLabel: '腰寬', double: true, kind: 'girth', body: (m) => m.waistCm },
  { label: '衣長', flatKey: 'length', flatLabel: '衣長', double: false, kind: 'length' },
  { label: '袖長', flatKey: 'sleeve', flatLabel: '袖長', double: false, kind: 'length', body: (m) => m.armCm, bodyLabel: '手臂' },
]

const PARTS: Partial<Record<Slot, PartDef[]>> = {
  top: TOP_PARTS,
  outer: TOP_PARTS,
  bottom: [
    { label: '腰圍', flatKey: 'waist', flatLabel: '腰寬', double: true, kind: 'girth', body: (m) => m.waistCm },
    { label: '臀圍', flatKey: 'hip', flatLabel: '臀寬', double: true, kind: 'girth', body: (m) => m.hipCm },
    { label: '大腿圍', flatKey: 'thigh', flatLabel: '大腿寬', double: true, kind: 'girth', body: (m) => m.thighCm },
    { label: '褲長', flatKey: 'length', flatLabel: '褲長', double: false, kind: 'length' },
    { label: '褲檔', flatKey: 'rise', flatLabel: '褲檔', double: false, kind: 'length' },
  ],
  shoes: [
    { label: '鞋內長', flatKey: 'innerLength', flatLabel: '鞋內長', double: false, kind: 'length', body: (m) => m.footSockLengthCm ?? m.footBareLengthCm, bodyLabel: '腳長' },
    { label: '跟高', flatKey: 'heelHeight', flatLabel: '跟高', double: false, kind: 'length' },
  ],
}

export const hasSizeComparison = (slot: Slot) => Boolean(PARTS[slot])

export type Judge = 'ok' | 'small' | 'big' | 'unknown'

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
}

const round1 = (n: number) => Math.round(n * 10) / 10

export const formatCm = (n: number) => `${round1(n)}`
export const formatSigned = (n: number) => (n > 0 ? `+${round1(n)}` : n < 0 ? `−${round1(Math.abs(n))}` : '±0')

export function judgeLabel(row: SizeRow): string {
  if (row.judge === 'unknown') return '—'
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

function metricOf(value: number, part: PartDef, body: BodyMeasurement | null) {
  if (!part.body) return value
  const bodyValue = body ? part.body(body) : null
  return bodyValue == null ? null : round1(value - bodyValue)
}

export function buildSizeRows(item: ClosetItem, body: BodyMeasurement | null, comfort: ClosetItem[]): SizeRow[] {
  const parts = PARTS[item.slot] ?? []
  const rows: SizeRow[] = []
  for (const part of parts) {
    const value = flatValue(item, part)
    if (value == null) continue
    const bodyValue = part.body && body ? part.body(body) : null
    const metric = metricOf(value, part, body)
    const others = comfort
      .map((other) => flatValue(other, part))
      .filter((v): v is number => v != null)
      .map((v) => metricOf(v, part, body))
      .filter((v): v is number => v != null)
    const band: [number, number] | null = others.length ? [Math.min(...others), Math.max(...others)] : null
    const judge: Judge = metric == null || !band ? 'unknown' : metric < band[0] ? 'small' : metric > band[1] ? 'big' : 'ok'
    rows.push({ part, item: round1(value), body: bodyValue, missingBody: Boolean(part.body) && bodyValue == null, metric, band, judge })
  }
  return rows
}

/** 範圍條的位置（百分比） */
export function rangeBarPositions(row: SizeRow) {
  if (row.metric == null) return null
  const points = [row.metric, ...(row.band ?? [])]
  const lo = Math.min(...points)
  const hi = Math.max(...points)
  const pad = Math.max(2, (hi - lo) * 0.35)
  const min = lo - pad
  const span = hi + pad - min
  const pct = (v: number) => Math.round(((v - min) / span) * 1000) / 10
  return {
    marker: pct(row.metric),
    band: row.band ? { left: pct(row.band[0]), width: Math.max(1.5, pct(row.band[1]) - pct(row.band[0])) } : null,
  }
}

/* ── AI 覆盤：整理成文字給外部 AI，再把回覆拆回來（平台不呼叫 AI） ── */

export type PromptSection = 'item' | 'body' | 'comfort' | 'material' | 'reasons' | 'feeling'

export const FLAT_LABELS: Record<string, string> = {
  shoulder: '肩寬', chest: '胸寬', waist: '腰寬', length: '衣長', sleeve: '袖長', cuff: '袖口',
  rise: '褲檔', hip: '臀寬', thigh: '大腿寬', hem: '褲口寬', innerLength: '鞋內長', heelHeight: '跟高',
  width: '寬', height: '高', depth: '側寬',
}

const BODY_FIELDS: [keyof BodyMeasurement, string][] = [
  ['heightCm', '身高'], ['upperBustCm', '上胸圍'], ['underBustCm', '下胸圍'], ['waistCm', '腰圍'], ['hipCm', '臀圍'],
  ['shoulderCm', '肩寬'], ['armCm', '手臂長'], ['inseamCm', '跨下長'], ['thighCm', '大腿圍'],
  ['footSockLengthCm', '腳長（一般襪）'], ['footSockWidthCm', '腳寬（一般襪）'],
]

export interface PromptContext {
  item: ClosetItem
  record: ReviewRecord
  rows: SizeRow[]
  body: BodyMeasurement | null
  comfortCount: number
}

export function promptSections(ctx: PromptContext): { key: PromptSection; label: string; available: boolean }[] {
  return [
    { key: 'item', label: '衣物與平放尺寸', available: true },
    { key: 'body', label: ctx.body ? `${ctx.body.measuredOn.slice(5).replace('-', '/')} 量測` : '量測（還沒有）', available: Boolean(ctx.body) },
    { key: 'comfort', label: '常穿範圍', available: ctx.rows.some((row) => row.band) },
    { key: 'material', label: '材質', available: Boolean(ctx.item.materialComposition || ctx.item.material) },
    { key: 'reasons', label: '哪裡不對', available: ctx.record.reasons.length > 0 },
    { key: 'feeling', label: '穿上的感覺', available: ctx.record.personalNote.length > 0 },
  ]
}

export const AI_REPLY_FORMAT = ['請照這個格式回覆：', '原因：', '- （一行一個原因）', '規則：', '- 範圍｜條件（例如：襯衫｜平放胸寬 ≥ 47）'].join('\n')

/** 把衣物、量測、常穿範圍、原因整理成一段可以貼給 AI 的文字（不含照片和價格） */
export function buildAiPrompt(ctx: PromptContext, include: Set<PromptSection>): string {
  const { item, record, rows, body, comfortCount } = ctx
  const lines = ['請幫我覆盤一件買錯的衣服，用繁體中文回答。', '']
  if (include.has('item')) {
    lines.push(`【衣物】${[item.name, item.size, item.categoryName].filter(Boolean).join('・')}`)
    if (include.has('material') && (item.materialComposition || item.material)) lines.push(`材質：${item.materialComposition || item.material}`)
    const flat = Object.entries(item.flatMeasurements ?? {})
      .filter(([, value]) => typeof value === 'number' && value > 0)
      .map(([key, value]) => `${FLAT_LABELS[key] ?? key} ${value}`)
    lines.push(flat.length ? `平放尺寸（cm）：${flat.join('、')}` : '平放尺寸：沒有記錄')
    lines.push('')
  } else if (include.has('material') && (item.materialComposition || item.material)) {
    lines.push(`【材質】${item.materialComposition || item.material}`, '')
  }
  if (include.has('body') && body) {
    const values = BODY_FIELDS.map(([key, label]) => [label, body[key]] as const).filter(([, value]) => typeof value === 'number')
    lines.push(`【我的身體】${body.measuredOn.replace(/-/g, '/')} 量測`, values.map(([label, value]) => `${label} ${value}`).join('、'), '')
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
