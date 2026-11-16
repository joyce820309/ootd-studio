import { todayISO } from '@/lib/date'
import type { BodyMeasurement, BodyMeasurementInput, BodyProfile, BodyProfileInput } from '@/types'

/** 量測快照與固定資料的表單共用工具（桌面 /me、手機 /me/measurements/new 共用） */

export type MeasurementKey = 'weightKg' | 'shoulderCm' | 'upperBustCm' | 'underBustCm' | 'highWaistCm' | 'waistCm' | 'waistSittingCm' | 'navelCm' | 'navelSittingCm' | 'hipCm' | 'thighCm' | 'footToeLengthCm' | 'footToeWidthCm' | 'footToeBallCm' | 'footToeInstepCm' | 'footSockLengthCm' | 'footSockWidthCm' | 'footSockBallCm' | 'footSockInstepCm' | 'footBareLengthCm' | 'footBareWidthCm' | 'footBareBallCm' | 'footBareInstepCm'
export type MeasurementDraft = Record<MeasurementKey, string> & { measuredOn: string; timeOfDay: BodyMeasurement['timeOfDay']; note: string }
export type FixedKey = Exclude<keyof BodyProfile, 'updatedAt'>
export type FixedDraft = Record<FixedKey, string> & { footWidthsDiffer: boolean }

export type MeasurementGroup = {
  title: string
  accent: 'oat' | 'mist' | 'sage' | 'rose'
  fields: { key: MeasurementKey; label: string; unit: string; hint?: string }[]
}

export const MEASUREMENT_GROUPS: MeasurementGroup[] = [
  { title: '基本', accent: 'oat', fields: [{ key: 'weightKg', label: '體重', unit: 'kg' }] },
  { title: '上半身', accent: 'mist', fields: [{ key: 'shoulderCm', label: '肩寬', unit: 'cm' }, { key: 'upperBustCm', label: '上胸圍', unit: 'cm' }, { key: 'underBustCm', label: '下胸圍', unit: 'cm' }] },
  {
    title: '下半身',
    accent: 'sage',
    fields: [
      { key: 'highWaistCm', label: '高腰圍', unit: 'cm', hint: '肚臍上方，高腰褲頭的位置' },
      { key: 'waistCm', label: '腰圍・站著', unit: 'cm', hint: '最細處，站著量' },
      { key: 'waistSittingCm', label: '腰圍・坐著', unit: 'cm', hint: '最細處，坐著量' },
      { key: 'navelCm', label: '肚臍圍・站著', unit: 'cm', hint: '中腰褲頭的位置' },
      { key: 'navelSittingCm', label: '肚臍圍・坐著', unit: 'cm', hint: '坐在椅子上量' },
      { key: 'hipCm', label: '臀圍', unit: 'cm', hint: '最寬處' },
      { key: 'thighCm', label: '大腿圍', unit: 'cm', hint: '大腿最粗處' },
    ],
  },
]

export const FOOT_FIELDS: { key: MeasurementKey; label: string }[] = [
  { key: 'footToeLengthCm', label: '腳長' }, { key: 'footToeWidthCm', label: '腳寬' }, { key: 'footToeBallCm', label: '前掌圍' }, { key: 'footToeInstepCm', label: '腳背圍' },
  { key: 'footSockLengthCm', label: '腳長' }, { key: 'footSockWidthCm', label: '腳寬' }, { key: 'footSockBallCm', label: '前掌圍' }, { key: 'footSockInstepCm', label: '腳背圍' },
  { key: 'footBareLengthCm', label: '腳長' }, { key: 'footBareWidthCm', label: '腳寬' }, { key: 'footBareBallCm', label: '前掌圍' }, { key: 'footBareInstepCm', label: '腳背圍' },
]

export const FOOT_TABS = [
  { id: 'toe', label: '穿五指襪', short: '五指襪', prefix: 'footToe', accent: 'oat' },
  { id: 'sock', label: '穿一般襪', short: '一般襪', prefix: 'footSock', accent: 'mist' },
  { id: 'bare', label: '裸腳', short: '裸腳', prefix: 'footBare', accent: 'rose' },
] as const

export const METRIC_KEYS: MeasurementKey[] = [...MEASUREMENT_GROUPS.flatMap((group) => group.fields.map((field) => field.key)), ...FOOT_FIELDS.map((field) => field.key)]

export const TIME_OF_DAY_OPTIONS = [
  ['morning_fasting', '早上空腹'],
  ['afternoon_evening', '下午・晚上'],
  ['other', '其他'],
] as const satisfies readonly (readonly [BodyMeasurement['timeOfDay'], string])[]

export const FIXED_FIELDS: { key: FixedKey; label: string; short: string; hint: string }[] = [
  { key: 'heightCm', label: '身高', short: '身高', hint: '赤腳站直' },
  { key: 'armLengthCm', label: '手臂長', short: '手臂長', hint: '肩峰到手腕' },
  { key: 'inseamCm', label: '腿長（內側）', short: '腿長', hint: '褲長看這個' },
  { key: 'seatedRiseCm', label: '坐姿股上', short: '坐姿股上', hint: '坐硬椅，腰側量到椅面' },
]

export function blankMeasurementDraft(): MeasurementDraft {
  const draft = { measuredOn: todayISO(), timeOfDay: 'morning_fasting', note: '' } as MeasurementDraft
  for (const key of METRIC_KEYS) draft[key] = ''
  return draft
}

export function measurementToDraft(measurement: BodyMeasurement): MeasurementDraft {
  const draft = { measuredOn: measurement.measuredOn, timeOfDay: measurement.timeOfDay, note: measurement.note } as MeasurementDraft
  for (const key of METRIC_KEYS) draft[key] = measurement[key]?.toString() ?? ''
  return draft
}

const numberOrNull = (value: string) => (value.trim() ? Number(value) : null)

export function toMeasurementInput(draft: MeasurementDraft, id?: string): BodyMeasurementInput {
  const input = { ...(id ? { id } : {}), measuredOn: draft.measuredOn, timeOfDay: draft.timeOfDay, note: draft.note.trim() } as BodyMeasurementInput
  for (const key of METRIC_KEYS) input[key] = numberOrNull(draft[key])
  return input
}

/** 量測快照的檢查；沒問題回傳 null */
export function measurementDraftError(draft: MeasurementDraft) {
  if (!draft.measuredOn) return '請先選擇量測日期。'
  if (!METRIC_KEYS.some((key) => draft[key].trim())) return '至少填寫一項尺寸，再儲存量測紀錄。'
  if (METRIC_KEYS.some((key) => draft[key].trim() && (!Number.isFinite(Number(draft[key])) || Number(draft[key]) <= 0))) return '尺寸請輸入大於 0 的數字。'
  return null
}

export function fixedProfileToDraft(profile: BodyProfile): FixedDraft {
  const left = profile.footWidthLeftCm
  const right = profile.footWidthRightCm
  return {
    heightCm: profile.heightCm?.toString() ?? '',
    armLengthCm: profile.armLengthCm?.toString() ?? '',
    inseamCm: profile.inseamCm?.toString() ?? '',
    seatedRiseCm: profile.seatedRiseCm?.toString() ?? '',
    footWidthLeftCm: left?.toString() ?? '',
    footWidthRightCm: right?.toString() ?? '',
    heelWidthCm: profile.heelWidthCm?.toString() ?? '',
    footWidthsDiffer: left != null && right != null && left !== right,
  }
}

export function toBodyProfileInput(draft: FixedDraft): BodyProfileInput {
  const left = numberOrNull(draft.footWidthLeftCm)
  const right = draft.footWidthsDiffer ? numberOrNull(draft.footWidthRightCm) : left
  return {
    heightCm: numberOrNull(draft.heightCm),
    armLengthCm: numberOrNull(draft.armLengthCm),
    inseamCm: numberOrNull(draft.inseamCm),
    seatedRiseCm: numberOrNull(draft.seatedRiseCm),
    footWidthLeftCm: left,
    footWidthRightCm: right,
    heelWidthCm: numberOrNull(draft.heelWidthCm),
  }
}

/** 固定資料中要檢查的數字（左右相同時不檢查右腳） */
export const fixedDraftValues = (draft: FixedDraft) => [draft.heightCm, draft.armLengthCm, draft.inseamCm, draft.seatedRiseCm, draft.footWidthLeftCm, ...(draft.footWidthsDiffer ? [draft.footWidthRightCm] : []), draft.heelWidthCm]

export const fixedDraftError = (draft: FixedDraft) =>
  fixedDraftValues(draft).some((value) => value.trim() && (!Number.isFinite(Number(value)) || Number(value) <= 0)) ? '固定資料請輸入大於 0 的數字。' : null

/** 選鞋採用較寬的那隻腳 */
export function widerFoot(draft: FixedDraft) {
  const left = Number(draft.footWidthLeftCm) || 0
  const right = Number(draft.footWidthsDiffer ? draft.footWidthRightCm : draft.footWidthLeftCm) || 0
  if (!left && !right) return null
  return { side: left >= right ? '左腳' : '右腳', value: Math.max(left, right) }
}

export function measurementDateLabel(date: string) {
  const [year, month, day] = date.split('-')
  return `${year}/${month}/${day}`
}

export const timeOfDayLabel = (value: BodyMeasurement['timeOfDay']) => (value === 'afternoon_evening' ? '下午・晚上' : value === 'other' ? '其他時段' : '早上空腹')

/** 和上一筆比：改了幾項、新記幾項 */
export function measurementChanges(record: Pick<BodyMeasurement, MeasurementKey>, previous?: Pick<BodyMeasurement, MeasurementKey> | null) {
  let changed = 0
  let added = 0
  if (!previous) return { changed, added }
  for (const key of METRIC_KEYS) {
    const value = record[key]
    const before = previous[key]
    if (value == null) continue
    if (before == null) added += 1
    else if (value !== before) changed += 1
  }
  return { changed, added }
}
