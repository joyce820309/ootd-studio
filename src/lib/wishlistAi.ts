import { FLAT_LABELS } from '@/lib/review'
import { isInCloset, SLOT_META } from '@/lib/slots'
import { formatStretch, SIZING } from '@/lib/stretch'
import { closetItemHasType, garmentTypeOf } from '@/lib/wishlist'
import type { BodyMeasurement, BodyProfile, ClosetItem, WishlistItem } from '@/types'

/** 「整理給 AI」要包含的資料區塊（B7.2）。平台不呼叫 AI，只產生可複製的文字。 */
export type AiInclude = 'basics' | 'colorSize' | 'material' | 'flat' | 'body' | 'closet' | 'url'

export const AI_INCLUDES: { key: AiInclude; label: string; defaultOn: boolean }[] = [
  { key: 'basics', label: '名稱與價格', defaultOn: true },
  { key: 'colorSize', label: '顏色與尺寸', defaultOn: true },
  { key: 'material', label: '材質', defaultOn: true },
  { key: 'flat', label: '平放尺寸', defaultOn: true },
  { key: 'body', label: '我的體態', defaultOn: true },
  { key: 'closet', label: '衣櫃裡同類', defaultOn: true },
  { key: 'url', label: '商品網址', defaultOn: false },
]

export const defaultAiIncludes = () => new Set<AiInclude>(AI_INCLUDES.filter((entry) => entry.defaultOn).map((entry) => entry.key))

/** 範本先寫死；之後做「編輯範本」管理頁時，把這裡換成讀取使用者的範本。 */
export const AI_TEMPLATES = [{ id: 'screen', label: '選購評估（預設）' }] as const
export type AiTemplateId = (typeof AI_TEMPLATES)[number]['id']

export function flatMeasurementEntries(item: WishlistItem) {
  const entries = Object.entries(item.flatMeasurements ?? {}).filter((entry): entry is [string, number] => typeof entry[1] === 'number')
  const order = SIZING[item.primaryPart ?? item.slot].map((field) => field.key)
  return entries.sort(([a], [b]) => (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 99 : order.indexOf(b)))
}

export function flatMeasurementText(item: WishlistItem) {
  const entries = flatMeasurementEntries(item)
  return entries.length ? entries.map(([key, value]) => `${FLAT_LABELS[key] ?? key} ${formatStretch(value, item.flatStretch?.[key])}`).join('・') : null
}

const formatDate = (iso: string) => iso.replaceAll('-', '/')

/** 我的體態：最近一次量測的主要圍度，加上固定資料的身高；沒填的欄位不寫。 */
export function bodySummary(body: BodyMeasurement | null, bodyProfile: BodyProfile | null) {
  const pairs: [string, number | null | undefined][] = [
    ['身高', bodyProfile?.heightCm],
    ['肩寬', body?.shoulderCm],
    ['上胸圍', body?.upperBustCm],
    ['下胸圍', body?.underBustCm],
    ['腰圍', body?.waistCm],
    ['臀圍', body?.hipCm],
    ['大腿圍', body?.thighCm],
  ]
  const text = pairs.filter((pair): pair is [string, number] => typeof pair[1] === 'number').map(([label, value]) => `${label} ${value}`).join('、')
  return text ? `${text}（單位 cm${body ? `・${formatDate(body.measuredOn)}` : ''}）` : null
}

/** 衣櫃裡「同部位（有類型就同類型）」的單品，依選取商品分組。 */
function closetSameKind(items: WishlistItem[], closet: ClosetItem[]) {
  const groups = new Map<string, { label: string; matches: ClosetItem[] }>()
  for (const item of items) {
    const part = item.primaryPart ?? item.slot
    const type = garmentTypeOf(item)
    const key = `${part}:${type?.id ?? ''}`
    if (groups.has(key)) continue
    const matches = closet.filter((entry) => isInCloset(entry.status) && entry.slot === part && (!type || closetItemHasType(entry, type)))
    groups.set(key, { label: type?.label ?? SLOT_META[part].label, matches })
  }
  return [...groups.values()].map(({ label, matches }) => {
    const names = matches.slice(0, 8).map((entry) => entry.name).join('、')
    return `${label} ${matches.length} 件${names ? `：${names}${matches.length > 8 ? '…' : ''}` : ''}`
  })
}

interface AiTextInput {
  items: WishlistItem[]
  closet: ClosetItem[]
  body: BodyMeasurement | null
  bodyProfile: BodyProfile | null
  include: Set<AiInclude>
}

/** 選購評估範本：依勾選的資料區塊，把選取的商品整理成給外部 AI 的文字。 */
export function buildAiText({ items, closet, body, bodyProfile, include }: AiTextInput) {
  const has = (key: AiInclude) => include.has(key)

  const formatItem = (item: WishlistItem) => {
    const part = item.primaryPart ?? item.slot
    const parts = [...new Set([part, ...(item.alsoParts ?? [])])]
    const type = garmentTypeOf(item)
    const category = parts.map((entry) => (entry === part && type ? `${SLOT_META[entry].label}・${type.label}` : SLOT_META[entry].label)).join('、')
    const lines: string[] = []
    if (has('basics')) lines.push(`- 商品編號：${item.productCode?.trim() || '未填'}`, `- 名稱：${item.name}`)
    lines.push(`- 類別：${category}`)
    if (has('basics')) lines.push(`- 價格：NT$${item.price.toLocaleString('zh-TW')}${item.shipping ? `（運費 NT$${item.shipping.toLocaleString('zh-TW')}）` : ''}`)
    if (has('colorSize')) {
      const colors = item.colors?.map((color) => `${color.family}${color.hex ? `（${color.hex}）` : ''}`).join('、') || item.colorName || '未提供'
      lines.push(`- 顏色：${colors}`, `- 預計尺寸：${item.size?.trim() || '未提供'}`)
    }
    if (has('material')) {
      const material = [item.materialComposition, item.material, ...Object.entries(item.materialPercentages ?? {}).map(([name, percent]) => `${name} ${percent}%`)].filter(Boolean).join('；') || '未提供'
      lines.push(`- 材質與厚薄：${material}；厚薄：未提供`)
    }
    if (has('flat')) {
      const flat = flatMeasurementEntries(item).map(([key, value]) => `${FLAT_LABELS[key] ?? key} ${formatStretch(value, item.flatStretch?.[key])} cm`).join('、') || '未提供'
      lines.push(`- 平放尺寸（尺寸備註）：${flat}（${item.sizeNote?.trim() || '未提供'}）`)
    }
    if (has('url') && item.url) lines.push(`- 商品網址：${item.url}`)
    return lines.join('\n')
  }

  const bodyLine = has('body') ? bodySummary(body, bodyProfile) : null
  const closetLines = has('closet') && items.length ? closetSameKind(items, closet) : []

  return [
    '請幫我初篩這批酸酸賣場商品，依我的身形、成功款與踩雷紀錄、現有衣櫃和預算評估。',
    bodyLine ? `【我的體態】${bodyLine}` : null,
    closetLines.length ? `【衣櫃裡已有】\n${closetLines.map((line) => `- ${line}`).join('\n')}` : null,
    ...items.map((item, index) => `${items.length > 1 ? `商品 ${index + 1}\n` : ''}${formatItem(item)}`),
    '請分為：優先看實穿／需要補資料／可以淘汰，並解釋原因。不要只因為尺寸寬鬆就判定適合，也不要只因為已經有類似顏色就直接淘汰。',
  ]
    .filter((block): block is string => !!block)
    .join('\n\n')
}
