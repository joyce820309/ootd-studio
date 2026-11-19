import { useCallback, useEffect, useId, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ItemImage } from '@/components/closet/ItemImage'
import { Button, ButtonLink } from '@/components/ui/Button'
import { DestructiveActionDialog } from '@/components/ui/B10States'
import { Icon } from '@/components/ui/Icon'
import { LoadingState, PageState } from '@/components/ui/PageState'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { FloatToggle } from '@/components/ui/FloatToggle'
import { Toast, type ToastMessage } from '@/components/ui/Toast'
import { MarkdownNote } from '@/components/ui/MarkdownNote'
import { WishlistAiPanel } from '@/components/wishlist/WishlistAiPanel'
import { WishlistForm } from '@/components/wishlist/WishlistForm'
import { WishlistTabs } from '@/components/wishlist/WishlistTabs'
import { CompareBuyDialog } from '@/components/wishlist/CompareBuyDialog'
import { ComparePickerDialog } from '@/components/wishlist/ComparePickerDialog'
import {
  addWishlistItemsToCompare,
  createCompareGroup,
  createWishlistItem,
  updateWishlistItem,
  deleteCompareGroup,
  fetchAllWishlist,
  fetchClosetItems,
  fetchCompareGroupItems,
  fetchCompareGroups,
  fetchCompareMemberships,
  fetchProfileData,
  removeWishlistItemFromCompare,
  reorderCompareGroupItems,
  setCompareChosenSize,
  setCompareDecision,
  setCompareGroupArchived,
  setWishlistStatus,
  updateCompareGroup,
} from '@/lib/data'
import { formatNT, OVERLAP_LABEL, totalPrice, wishInsights, wishlistSizeOptions } from '@/lib/wishlist'
import { buildSizeRows, formatCm, hasSizeComparison, judgeLabel, type SizeRow } from '@/lib/review'
import { formatStretch } from '@/lib/stretch'
import { bodySummary, defaultAiIncludes, type AiInclude } from '@/lib/wishlistAi'
import { useIsMobile } from '@/lib/useIsMobile'
import type { BodyMeasurement, BodyProfile, ClosetItem, CompareGroup, CompareGroupItem, WishlistInput, WishlistItem } from '@/types'
import './ComparePage.css'

type Tone = 'sage' | 'oat' | 'mist' | 'rose' | 'tile'
interface ValueCell {
  text: string
  note?: string
  /** 我的筆記：跟選購清單一樣，支援「- 」「1 」清單與粗體 */
  markdown?: string
  noteSizes?: { size: string; details: string }[]
  tag?: { label: string; tone: Tone }
  hint?: string
  colors?: { name: string; hex: string; preferred: boolean }[]
}
interface TableRow {
  id: string
  label: string
  bodyLabel?: string
  cells: ValueCell[]
}
interface TableSection {
  id: string
  title: string
  hint?: string
  rows: TableRow[]
}
interface CompareCandidate {
  item: WishlistItem
  link: CompareGroupItem
  sizeRows: SizeRow[]
  insights: ReturnType<typeof wishInsights>
  memberships: string[]
}

type DeleteState = { id: string; name: string } | null

const EMPTY_CLOSET: ClosetItem[] = []
const TONE_CLASSES: Record<Tone, string> = {
  sage: 'bg-sage-soft text-sage-ink',
  oat: 'bg-oat-soft text-oat-ink',
  mist: 'bg-mist-soft text-mist-ink',
  rose: 'bg-rose-soft text-rose-ink',
  tile: 'bg-tile text-ink-2',
}

const cell = (text: string | number | null | undefined, tag?: ValueCell['tag']): ValueCell => ({ text: text == null || text === '' ? '—' : String(text), ...(tag ? { tag } : {}) })
const sizeNoteRows = (note?: string) => {
  const lines = note?.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) ?? []
  const parsed = lines.map((line) => {
    const match = /^(XXXL|XXL|XXS|XL|XS|[SML]|\d{2,3}|F)\s+(.+)$/i.exec(line)
    return match ? { size: match[1].toUpperCase(), details: match[2] } : null
  })
  return parsed.length > 1 && parsed.every((row) => row !== null) ? parsed : undefined
}
const formatDate = (value?: string) => value ? new Intl.DateTimeFormat('zh-TW', { month: '2-digit', day: '2-digit' }).format(new Date(value)).replaceAll('/', '/') : '—'
const colorValues = (item: WishlistItem) => (item.colors?.length ? item.colors : [{ family: item.colorName ?? '未標色', hex: item.colorHex }]).map((color) => ({ name: color.family, hex: color.hex ?? item.colorHex, preferred: !!color.favorite }))
const studioUrl = (item: WishlistItem) => item.status === 'bought' && item.boughtItemId ? `/studio?closet=${encodeURIComponent(item.boughtItemId)}` : `/studio?wish=${encodeURIComponent(item.id)}`

/** 用既有 B20 判斷函式，僅取數字與已核定的判斷；不建立新的寬鬆門檻。 */
function closetShape(item: WishlistItem): ClosetItem {
  return {
    id: item.id,
    name: item.name,
    categoryId: item.primaryPart ?? item.slot,
    slot: item.primaryPart ?? item.slot,
    categorySlot: item.primaryPart ?? item.slot,
    colorName: item.colorName ?? '其他',
    colorHex: item.colorHex,
    brand: item.brand,
    size: item.size,
    material: item.material,
    materialComposition: item.materialComposition,
    materialPercentages: item.materialPercentages,
    flatMeasurements: item.flatMeasurements,
    flatStretch: item.flatStretch,
    status: 'ok',
  }
}

function compareValueRows(items: WishlistItem[], closet: ClosetItem[], body: BodyMeasurement | null, profile: BodyProfile | null, links: CompareGroupItem[], memberships: Record<string, { groupId: string; groupName: string }[]>, groups: CompareGroup[]): CompareCandidate[] {
  const linkById = new Map(links.map((link) => [link.wishlistItemId, link]))
  const groupNameById = new Map(groups.map((group) => [group.id, group.name]))
  return items.flatMap((item) => {
    const link = linkById.get(item.id)
    if (!link) return []
    const sizeRows = hasSizeComparison(item.primaryPart ?? item.slot)
      ? buildSizeRows(closetShape(item), body, EMPTY_CLOSET, profile)
      : []
    const memberNames = (memberships[item.id] ?? []).filter((entry) => entry.groupId !== link.groupId).map((entry) => groupNameById.get(entry.groupId) ?? entry.groupName)
    return [{ item, link, sizeRows, insights: wishInsights(item, closet), memberships: memberNames }]
  }).sort((a, b) => a.link.position - b.link.position || (a.link.addedAt ?? '').localeCompare(b.link.addedAt ?? ''))
}

function sizeChoicesFor(item: WishlistItem) {
  const options = wishlistSizeOptions(item.size)
  return options.length || !item.flatMeasurementsSize ? options : [item.flatMeasurementsSize]
}

function selectedCompareSize(candidate: CompareCandidate) {
  const options = sizeChoicesFor(candidate.item)
  const measured = candidate.item.flatMeasurementsSize
  if (candidate.link.chosenSize && (!options.length || options.includes(candidate.link.chosenSize))) return candidate.link.chosenSize
  return measured && options.includes(measured) ? measured : options[0] ?? measured ?? ''
}

function defaultCompareSize(item: WishlistItem) {
  const options = sizeChoicesFor(item)
  const measured = item.flatMeasurementsSize?.trim()
  return measured && options.includes(measured) ? measured : options[0] ?? measured ?? ''
}

function sizeMeasurementMatches(candidate: CompareCandidate) {
  const measuredSize = candidate.item.flatMeasurementsSize?.trim().toLocaleLowerCase()
  const chosenSize = selectedCompareSize(candidate).trim().toLocaleLowerCase()
  return !!measuredSize && !!chosenSize && measuredSize === chosenSize
}

function sizeJudgement(candidate: CompareCandidate, row: SizeRow) {
  if (!sizeMeasurementMatches(candidate)) return null
  const label = judgeLabel(row)
  return label === '—' ? row.note : label
}

function sizeMismatchHint(candidate: CompareCandidate) {
  if (sizeMeasurementMatches(candidate)) return '目前資料不足，無法判斷合身'
  const measured = candidate.item.flatMeasurementsSize?.trim()
  const chosen = selectedCompareSize(candidate).trim()
  if (!chosen) return '未選尺碼，沒有合身判斷'
  return measured ? `這是 ${measured} 的尺寸，${chosen} 沒有資料` : `尺寸未標尺碼，${chosen} 沒有資料`
}

function buildTableSections(candidates: CompareCandidate[]): TableSection[] {
  if (!candidates.length) return []
  const prices = candidates.map(({ item }) => item.price)
  const priceSet = new Set(prices)
  const minPrice = Math.min(...prices)
  const matches = candidates.map(({ insights }) => insights.matchCount)
  const maxMatches = Math.max(...matches)
  const matchSet = new Set(matches)
  const sections: TableSection[] = [
    {
      id: 'price', title: '價格', rows: [
        // 通常會湊免運，比較表只比售價（運費、含運總價不列）
        { id: 'price', label: '售價', cells: candidates.map(({ item }) => cell(formatNT(item.price), priceSet.size > 1 && item.price === minPrice ? { label: '最便宜', tone: 'sage' } : undefined)) },
      ],
    },
    {
      id: 'size-note', title: '商品頁尺寸表', hint: '原文照貼，不判斷', rows: [
        { id: 'size-note', label: '', cells: candidates.map(({ item }) => ({ text: item.sizeNote ? '' : '未提供', note: item.sizeNote, noteSizes: sizeNoteRows(item.sizeNote) })) },
      ],
    },
  ]

  const dimensionKeys = [...new Set(candidates.flatMap(({ sizeRows }) => sizeRows.map((row) => row.part.flatKey)))]
  const dimensions = dimensionKeys.map((key) => {
    const matched = candidates.map(({ sizeRows }) => sizeRows.find((row) => row.part.flatKey === key) ?? null)
    const label = matched.find((row) => row)?.part.label ?? key
    const bodyValue = matched.find((row) => row?.body != null)?.body
    return {
      id: `size-${key}`,
      label,
      bodyLabel: bodyValue == null ? undefined : `我 ${formatCm(bodyValue)}`,
      cells: matched.map((row, index) => {
        if (!row) return cell('—')
        const value = formatStretch(row.flat, row.flatStretch)
        const candidate = candidates[index]
        const judged = sizeJudgement(candidate, row)
        const tone: Tone = row.judge === 'ok' ? 'sage' : row.judge === 'tight' ? 'rose' : row.judge === 'snug' ? 'oat' : row.judge === 'big' || row.judge === 'small' ? 'mist' : 'tile'
        return { ...cell(value, judged && judged !== '—' ? { label: judged, tone } : undefined), ...(judged && judged !== '—' ? {} : { hint: sizeMismatchHint(candidate) }) }
      }),
    }
  })
  if (dimensions.length) sections.push({ id: 'size', title: '尺寸 vs 我的身體', hint: '依 B20 既有規則判斷；沒有判斷資料時只顯示數字', rows: dimensions })

  sections.push({
    id: 'colors', title: '顏色', hint: '框起來的是「最想要」', rows: [
      { id: 'color-list', label: '可選', cells: candidates.map(({ item }) => ({ text: `${colorValues(item).length} 色`, colors: colorValues(item) })) },
    ],
  })
  sections.push({ id: 'notes', title: '我的筆記', rows: [{ id: 'note', label: '', cells: candidates.map(({ item }) => item.reason?.trim() ? { text: item.reason.trim(), markdown: item.reason.trim() } : cell(null)) }] })

  // 材質與版型各自一列；選購商品目前只存成分，版型／彈性／季節／洗滌沒有欄位，整列空白時自動隱藏
  sections.push({
    id: 'material', title: '材質與版型', rows: [
      { id: 'composition', label: '成分', cells: candidates.map(({ item }) => cell(compositionText(item))) },
      { id: 'fit', label: '版型', cells: candidates.map(() => cell(null)) },
      { id: 'stretch', label: '彈性', cells: candidates.map(() => cell(null)) },
      { id: 'seasons', label: '季節', cells: candidates.map(() => cell(null)) },
      { id: 'washing', label: '洗滌', cells: candidates.map(() => cell(null)) },
    ],
  })
  sections.push({
    id: 'closet', title: '跟衣櫃', rows: [
      { id: 'matches', label: '可以搭', cells: candidates.map(({ insights }) => cell(`${insights.matchCount} 件`, matchSet.size > 1 && insights.matchCount === maxMatches ? { label: '最好搭', tone: 'sage' } : undefined)) },
      { id: 'overlap', label: '重複', cells: candidates.map(({ insights }) => cell(insights.closest ? `${OVERLAP_LABEL[insights.overlap]}・像${insights.closest.name}` : `${OVERLAP_LABEL[insights.overlap]}・衣櫃沒有${insights.compareLabel}`, insights.overlap === 'high' ? { label: '有點重複', tone: 'oat' } : undefined)) },
    ],
  })
  sections.push({
    id: 'purchase', title: '購買', rows: [
      { id: 'returns', label: '退換', cells: candidates.map(({ item }) => {
        const value = item.returnPolicy?.trim() || null
        return cell(value, value && /不含運|自付|不可退|不退/.test(value) ? { label: '退換有限制', tone: 'rose' } : undefined)
      }) },
    ],
  })
  // 每件都沒填的列不顯示；整個區塊沒列了就整塊拿掉
  return sections
    .map((section) => ({ ...section, rows: section.rows.filter((row) => row.cells.some(cellHasContent)) }))
    .filter((section) => section.rows.length)
}

/** 成分：有百分比時排成「聚酯 70%・羊毛 30%」，否則用原文，再退回材質名稱 */
function compositionText(item: WishlistItem) {
  const percentages = Object.entries(item.materialPercentages ?? {}).filter(([, value]) => value != null)
  if (percentages.length) return percentages.sort((a, b) => b[1] - a[1]).map(([name, value]) => `${name} ${value}%`).join('・')
  return item.materialComposition?.trim() || item.material?.trim() || null
}

/** 預設收起、由右下角懸浮鈕（B26）展開的區塊 */
const FOLD_SECTION_IDS = new Set(['material', 'closet', 'purchase'])

function cellHasContent(value: ValueCell) {
  if (value.note?.trim() || value.markdown?.trim() || value.colors?.length) return true
  return !['', '—', '未提供'].includes(value.text.trim())
}

function valueSignature(value: ValueCell) {
  return JSON.stringify([value.text, value.note ?? '', value.noteSizes ?? [], value.tag?.label ?? '', value.hint ?? '', value.colors?.map((color) => `${color.name}:${color.hex}:${color.preferred}`).join('|') ?? ''])
}

function filteredSections(sections: TableSection[], onlyDifferent: boolean, indexes?: readonly number[]) {
  return sections.map((section) => ({
    ...section,
    rows: section.rows.filter((row) => {
      if (!onlyDifferent) return true
      return rowIsDifferent(row, indexes)
    }),
  })).filter((section) => section.rows.length)
}

function rowIsDifferent(row: TableRow, indexes?: readonly number[]) {
  const values = indexes ? indexes.map((index) => row.cells[index]).filter((entry): entry is ValueCell => !!entry) : row.cells
  return values.length > 1 && new Set(values.map(valueSignature)).size > 1
}

/** 桌機一次並排的件數；超過時在表頭左欄翻頁，不左右捲 */
const DESK_PAGE = 5

const EMPTY_STATUS: ToastMessage = { tone: 'error', text: '操作沒有完成，請稍後再試。' }

export function ComparePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const isMobile = useIsMobile()
  const [groups, setGroups] = useState<CompareGroup[] | null>(null)
  const [wishlist, setWishlist] = useState<WishlistItem[]>([])
  const [links, setLinks] = useState<CompareGroupItem[]>([])
  const [memberships, setMemberships] = useState<Record<string, { groupId: string; groupName: string }[]>>({})
  const [closet, setCloset] = useState<ClosetItem[]>([])
  const [body, setBody] = useState<BodyMeasurement | null>(null)
  const [bodyProfile, setBodyProfile] = useState<BodyProfile | null>(null)
  const [allowBody, setAllowBody] = useState(true)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [saving, setSaving] = useState(false)
  const [nameEditing, setNameEditing] = useState(false)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const [onlyDifferent, setOnlyDifferent] = useState(false)
  // 材質與版型、跟衣櫃、購買預設收起
  const [foldOpen, setFoldOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiInclude, setAiInclude] = useState<Set<AiInclude>>(defaultAiIncludes)
  const [buying, setBuying] = useState<WishlistItem | null>(null)
  const [deleteGroup, setDeleteGroup] = useState<DeleteState>(null)
  const [addFormOpen, setAddFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null)
  const [groupsSheetOpen, setGroupsSheetOpen] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [mobileIndexes, setMobileIndexes] = useState<[number, number]>([0, 1])
  const [deskStart, setDeskStart] = useState(0)
  const closeToast = useCallback(() => setToast(null), [])
  const load = useCallback(() => Promise.all([fetchCompareGroups(), fetchAllWishlist(), fetchCompareGroupItems(), fetchCompareMemberships(), fetchClosetItems(), fetchProfileData().catch(() => null)])
    .then(([nextGroups, nextWishlist, nextLinks, nextMemberships, nextCloset, profileData]) => {
      setGroups(nextGroups)
      setWishlist(nextWishlist)
      const defaultsToPersist: CompareGroupItem[] = []
      const linksWithDefaults = nextLinks.map((entry) => {
        if (!id || entry.groupId !== id || entry.chosenSize) return entry
        const item = nextWishlist.find((candidate) => candidate.id === entry.wishlistItemId)
        const chosenSize = item ? defaultCompareSize(item) : ''
        if (!chosenSize) return entry
        defaultsToPersist.push({ ...entry, chosenSize })
        return { ...entry, chosenSize }
      })
      setLinks(linksWithDefaults)
      if (defaultsToPersist.length) {
        void Promise.all(defaultsToPersist.map((entry) => setCompareChosenSize(entry.groupId, entry.wishlistItemId, entry.chosenSize ?? null)))
          .catch((cause: unknown) => setToast({ tone: 'error', text: cause instanceof Error ? `尺碼預設值沒有儲存：${cause.message}` : '尺碼預設值沒有儲存。' }))
      }
      setMemberships(nextMemberships)
      setCloset(nextCloset)
      if (profileData) {
        setBody([...profileData.measurements].sort((a, b) => b.measuredOn.localeCompare(a.measuredOn))[0] ?? null)
        setBodyProfile(profileData.bodyProfile)
        setAllowBody(profileData.profile.aiUseBodyData)
      }
      setLoadError(null)
    })
    .catch((cause: unknown) => {
      setLoadError(cause instanceof Error ? cause : new Error(String(cause)))
    }), [id])

  useEffect(() => { void load() }, [load])
  const group = groups?.find((entry) => entry.id === id) ?? null
  const activeGroups = useMemo(() => (groups ?? []).filter((entry) => !entry.archivedAt), [groups])
  const archivedGroups = useMemo(() => (groups ?? []).filter((entry) => !!entry.archivedAt), [groups])

  const groupLinks = useMemo(() => (id ? links.filter((entry) => entry.groupId === id).sort((a, b) => a.position - b.position) : []), [id, links])
  const candidates = useMemo(() => group ? compareValueRows(wishlist, closet, body, bodyProfile, groupLinks, memberships, groups ?? []) : [], [group, wishlist, closet, body, bodyProfile, groupLinks, memberships, groups]) // Calculate candidates based on group
  const sections = useMemo(() => buildTableSections(candidates), [candidates])
  const pageStart = candidates.length <= DESK_PAGE ? 0 : Math.min(deskStart, Math.floor((candidates.length - 1) / DESK_PAGE) * DESK_PAGE)
  const pageIndexes = useMemo(() => candidates.slice(pageStart, pageStart + DESK_PAGE).map((_, index) => pageStart + index), [candidates, pageStart])
  // 「只看不一樣」只比這一組看得到的欄；這組只剩 1 件時改比全部
  const diffIndexes = pageIndexes.length > 1 ? pageIndexes : undefined
  const visibleSections = useMemo(() => filteredSections(sections, onlyDifferent, diffIndexes), [sections, onlyDifferent, diffIndexes])
  const leftIndex = candidates.length < 2 ? 0 : Math.min(mobileIndexes[0], candidates.length - 1)
  const rightIndex = candidates.length < 2 ? 1 : Math.min(mobileIndexes[1], candidates.length - 1)
  const activeIndexes: readonly [number, number] = [leftIndex, rightIndex]
  const mobileSections = useMemo(() => filteredSections(sections, onlyDifferent, [leftIndex, rightIndex]), [sections, onlyDifferent, leftIndex, rightIndex])
  const sizeChoices = (diffIndexes ?? candidates.map((_, index) => index)).map((index) => selectedCompareSize(candidates[index]) || '未提供')
  const hiddenSizeRow = !isMobile && onlyDifferent && sizeChoices.length > 1 && new Set(sizeChoices).size === 1
  const hiddenNames = [...(hiddenSizeRow ? ['比的尺碼'] : []), ...sections.flatMap((section) => section.rows.filter((row) => onlyDifferent && !rowIsDifferent(row, isMobile ? activeIndexes : diffIndexes)).map((row) => row.label || section.title))]
  const hiddenRows = hiddenNames.length
  const foldSections = (isMobile ? mobileSections : visibleSections).filter((section) => FOLD_SECTION_IDS.has(section.id))
  const unfolded = (list: TableSection[]) => (foldOpen ? list : list.filter((section) => !FOLD_SECTION_IDS.has(section.id)))
  const folded = foldOpen ? [] : foldSections.map((section) => section.title)
  // 收起時捲回第一個被收起的區塊上緣（收起後那裡會是「還有 N 區收起來了」橫條）
  const toggleFold = () => {
    const closing = foldOpen
    setFoldOpen(!closing)
    if (closing) requestAnimationFrame(() => document.getElementById('compare-fold-start')?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }))
  }
  const groupItems = useMemo(() => groupLinks.map((entry) => wishlist.find((item) => item.id === entry.wishlistItemId)).filter((item): item is WishlistItem => !!item), [groupLinks, wishlist])
  if (!id && params.get('group')) return <Navigate replace to={`/wishlist/compare/${encodeURIComponent(params.get('group')!)}`} />
  if (!id && groups && activeGroups[0]) return <Navigate replace to={`/wishlist/compare/${activeGroups[0].id}`} />

  async function run(action: () => Promise<void>) {
    setSaving(true)
    try { await action() }
    catch (error) { setToast(error instanceof Error ? { tone: 'error', text: `沒有完成：${error.message}` } : EMPTY_STATUS) }
    finally { setSaving(false) }
  }

  async function createBlankCompare() {
    await run(async () => {
      const { group: created, demo } = await createCompareGroup({ name: '新的比較' })
      setToast({ tone: 'success', text: `已建立比較${demo ? '（示範模式，重新整理後會還原）' : ''}` })
      await load()
      navigate(`/wishlist/compare/${created.id}`)
    })
  }

  async function saveName() {
    if (!group || editingGroupId !== group.id || !nameDraft.trim()) return setToast({ tone: 'error', text: '比較名稱不能空白。' })
    await run(async () => {
      await updateCompareGroup(group.id, { name: nameDraft })
      setNameEditing(false)
      setEditingGroupId(null)
      await load()
    })
  }

  async function addItems(ids: string[]) {
    if (!group) return
    await run(async () => {
      await addWishlistItemsToCompare(group.id, ids)
      setPickerOpen(false)
      setToast({ tone: 'success', text: `已加入 ${ids.length} 件商品。` })
      await load()
    })
  }

  async function removeItem(item: WishlistItem) {
    if (!group) return
    await run(async () => {
      await removeWishlistItemFromCompare(group.id, item.id)
      setToast({ tone: 'success', text: `已從「${group.name}」移除「${item.name}」，商品仍保留在選購清單。` })
      await load()
    })
  }

  async function reorderItems(nextIds: string[]) {
    if (!group) return
    setLinks((current) => current.map((entry) => entry.groupId === group.id ? { ...entry, position: nextIds.indexOf(entry.wishlistItemId) } : entry))
    await run(async () => { await reorderCompareGroupItems(group.id, nextIds); await load() })
  }

  async function chooseSize(item: WishlistItem, size: string) {
    if (!group) return
    setLinks((current) => current.map((entry) => entry.groupId === group.id && entry.wishlistItemId === item.id ? { ...entry, chosenSize: size || undefined } : entry))
    await run(async () => { await setCompareChosenSize(group.id, item.id, size || null); await load() })
  }

  async function setArchive(archived: boolean) {
    if (!group) return
    await run(async () => {
      await setCompareGroupArchived(group.id, archived)
      setToast({ tone: 'success', text: archived ? '比較已封存。' : '比較已還原。' })
      await load()
      if (archived) navigate('/wishlist/compare', { replace: true })
    })
  }

  async function confirmBuy(input: { dropIds: string[]; archive: boolean }) {
    if (!group || !buying) return
    const bought = buying
    await run(async () => {
      await setWishlistStatus(bought.id, 'ready')
      await Promise.all(input.dropIds.filter((wishId) => wishId !== bought.id).map((wishId) => setWishlistStatus(wishId, 'dropped')))
      await setCompareDecision(group.id, bought.id)
      if (input.archive) await setCompareGroupArchived(group.id, true)
      setBuying(null)
      setToast({ tone: 'success', text: `「${bought.name}」已改為準備購買${input.archive ? '，比較已封存' : ''}。` })
      await load()
      if (input.archive) navigate('/wishlist/compare', { replace: true })
    })
  }

  async function confirmDeleteGroup() {
    if (!deleteGroup) return
    const deletingId = deleteGroup.id
    await run(async () => {
      await deleteCompareGroup(deletingId)
      setDeleteGroup(null)
      setToast({ tone: 'success', text: '比較已刪除，選購商品仍保留。' })
      await load()
      navigate('/wishlist/compare', { replace: true })
    })
  }

  async function addFromForm(input: WishlistInput) {
    if (!group) return
    await run(async () => {
      const { item } = await createWishlistItem(input)
      await addWishlistItemsToCompare(group.id, [item.id])
      setAddFormOpen(false)
      setToast({ tone: 'success', text: `已加入「${group.name}」。` })
      await load()
    })
  }

  async function saveEdit(item: WishlistItem, input: WishlistInput) {
    await run(async () => {
      const { demo } = await updateWishlistItem(item.id, input)
      setEditingItem(null)
      setToast({ tone: 'success', text: `已儲存「${input.name || item.name}」${demo ? '（示範模式，重新整理後會還原）' : ''}` })
      await load()
    })
  }

  function moveMobile(index: number, direction: -1 | 1) {
    if (candidates.length < 2) return
    setMobileIndexes((current) => {
      const left = Math.min(current[0], candidates.length - 1)
      let right = Math.min(current[1], candidates.length - 1)
      if (right === left) right = (left + 1) % candidates.length
      const active = index === 0 ? left : right
      const other = index === 0 ? right : left
      let next = (active + direction + candidates.length) % candidates.length
      while (next === other) next = (next + direction + candidates.length) % candidates.length
      return index === 0 ? [next, right] : [left, next]
    })
  }

  if (groups === null && !loadError) return <main className="mx-auto max-w-[1400px] px-4 py-8"><LoadingState label="正在整理比較…" /></main>
  if (loadError) return <main className="mx-auto max-w-[1400px] px-4 py-8"><PageState icon="alert" tone="rose" title="比較暫時打不開" description={loadError.message} /></main>
  if (!id && !groups?.length) return <EmptyCompare onCreate={() => navigate('/wishlist?select=1')} archivedGroups={archivedGroups} />
  if (id && !group) return <main className="mx-auto max-w-[1400px] px-4 py-8"><PageState icon="wish" tone="oat" title="找不到這個比較" description="它可能已被刪除，或你沒有查看權限。" action={<ButtonLink to="/wishlist/compare" variant="secondary">看我的比較</ButtonLink>} /></main>
  if (!group) return <EmptyCompare onCreate={() => navigate('/wishlist?select=1')} archivedGroups={archivedGroups} />

  const sizeComparisonEnabled = candidates.length > 1
  const mobileCandidates: (CompareCandidate | null)[] = [candidates[activeIndexes[0]] ?? null, candidates[activeIndexes[1]] && activeIndexes[1] !== activeIndexes[0] ? candidates[activeIndexes[1]] : null]
  const currentIsArchived = !!group.archivedAt
  const editingCurrentName = nameEditing && editingGroupId === group.id
  const startRename = () => { setNameDraft(group.name); setEditingGroupId(group.id); setNameEditing(true) }
  const cancelRename = () => { setNameEditing(false); setEditingGroupId(null); setNameDraft(group.name) }

  return (
    <main className="compare-page mx-auto flex max-w-[1360px] flex-col gap-3 px-4 pt-5 pb-[calc(208px+env(safe-area-inset-bottom))] [--float-toggle-bottom:calc(146px+env(safe-area-inset-bottom))] md:px-[clamp(16px,3vw,40px)] md:pt-3.5 md:pb-24">
      <div className="compare-page__top flex flex-wrap items-center gap-3 md:hidden">
        <div className="flex w-full items-center gap-1 border-b-[1.5px] border-dashed border-line-strong pb-2">
          <ButtonLink to="/wishlist" variant="ghost" className="-ml-2 h-11 px-2"><Icon name="back" size={18} />回選購清單</ButtonLink>
          {editingCurrentName ? <RenameField value={nameDraft} onChange={setNameDraft} onSave={() => void saveName()} onCancel={cancelRename} saving={saving} mobile /> : <h1 className="m-0 min-w-0 flex-1 truncate font-hd text-xl">{group.name}</h1>}
          {!editingCurrentName && <button type="button" aria-label="改比較名稱" onClick={startRename} className="flex size-11 flex-none items-center justify-center rounded-btn text-ink-2"><Icon name="edit" size={18} /></button>}
          <details className="relative"><summary aria-label="更多比較操作" className="flex size-11 cursor-pointer list-none items-center justify-center rounded-btn [&::-webkit-details-marker]:hidden"><Icon name="more" /></summary><div className="absolute right-0 top-full z-30 mt-1 flex w-48 flex-col rounded-card border border-line bg-card p-1.5 shadow-float"><button type="button" onClick={() => setGroupsSheetOpen(true)} className="min-h-11 rounded-sm px-3 text-left text-sm">我的比較</button><button type="button" onClick={() => void setArchive(!currentIsArchived)} className="min-h-11 rounded-sm px-3 text-left text-sm">{currentIsArchived ? '取消封存' : '封存比較'}</button><button type="button" onClick={() => setDeleteGroup({ id: group.id, name: group.name })} className="min-h-11 rounded-sm px-3 text-left text-sm text-rose-deep">刪除比較</button></div></details>
        </div>
      </div>

      {/* B23 v2：頁首合成一列；比較名稱點下去切換其他比較，取代原本左側「我的比較」欄 */}
      <header className="compare-bar hidden min-h-[52px] flex-wrap items-center gap-2.5 md:flex">
        <WishlistTabs />
        <span aria-hidden="true" className="mx-1 h-7 w-px bg-line-strong" />
        {editingCurrentName ? <RenameField value={nameDraft} onChange={setNameDraft} onSave={() => void saveName()} onCancel={cancelRename} saving={saving} /> : <>
          <CompareGroupMenu current={group} activeGroups={activeGroups} archivedGroups={archivedGroups} links={links} wishlist={wishlist} saving={saving} onCreate={() => void createBlankCompare()} />
          <button type="button" onClick={startRename} aria-label="改比較名稱" className="flex size-11 items-center justify-center rounded-btn text-ink-2"><Icon name="edit" size={18} /></button>
        </>}
        <span className="text-xs text-ink-2">{candidates.length} 件・{formatDate(group.updatedAt ?? group.createdAt)} 更新{currentIsArchived ? '・已封存' : ''}</span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Switch tone="mist" checked={onlyDifferent} disabled={!sizeComparisonEnabled} label="只看不一樣" onChange={() => setOnlyDifferent((value) => !value)} className="px-2 text-sm font-medium" />
          <Button variant="secondary" disabled={!candidates.length} onClick={() => setAiOpen(true)}><Icon name="copy" size={17} />整理給 AI</Button>
          <Button variant="oat" onClick={() => setPickerOpen(true)}><Icon name="plus" size={18} />加入商品</Button>
          <details className="relative"><summary aria-label="更多：封存、刪除這個比較" className="flex size-11 cursor-pointer list-none items-center justify-center rounded-btn text-ink-2 [&::-webkit-details-marker]:hidden"><Icon name="more" /></summary><div className="absolute right-0 top-full z-30 mt-1 flex w-48 flex-col rounded-card border border-line bg-card p-1.5 shadow-float"><button type="button" onClick={() => void setArchive(!currentIsArchived)} className="min-h-11 rounded-sm px-3 text-left text-sm">{currentIsArchived ? '取消封存' : '封存比較'}</button><button type="button" onClick={() => setDeleteGroup({ id: group.id, name: group.name })} className="min-h-11 rounded-sm px-3 text-left text-sm text-rose-deep">刪除比較</button></div></details>
        </div>
      </header>

      <section aria-label={`比較：${group.name}`} className="compare-page__content min-w-0">
        <div className="compare-page__mobile-meta flex items-center gap-2 px-1 md:hidden">
          <span className="text-xs text-ink-2">{candidates.length} 件・一次看 {Math.min(2, candidates.length)} 件</span>
          <Switch tone="mist" checked={onlyDifferent} disabled={!sizeComparisonEnabled} label="只看不一樣" onChange={() => setOnlyDifferent((value) => !value)} className="ml-auto text-xs" />
        </div>

        {!groupLinks.length ? (
          <div className="mt-1 rounded-card bg-card p-8 text-center shadow-paper"><h2 className="m-0 font-hd text-2xl">這個比較還沒有商品</h2><p className="mx-auto my-2 max-w-md text-sm leading-6 text-ink-2">加入選購清單裡的候選，排成比較表。商品可以同時放在多個比較裡。</p><Button variant="oat" onClick={() => setPickerOpen(true)}><Icon name="plus" />加入商品</Button></div>
        ) : isMobile ? (
          <MobileCompare onEdit={(candidate) => setEditingItem(candidate.item)} columns={mobileCandidates} sections={unfolded(mobileSections)} folded={folded} onUnfold={toggleFold} indexes={mobileIndexes} total={candidates.length} onMove={moveMobile} onBuy={(candidate) => setBuying(candidate.item)} onChooseSize={(candidate, size) => void chooseSize(candidate.item, size)} />
        ) : (
          <DesktopCompare onEdit={(candidate) => setEditingItem(candidate.item)} candidates={candidates} indexes={pageIndexes} sections={unfolded(visibleSections)} folded={folded} onUnfold={toggleFold} showSizeRow={!hiddenSizeRow} onPage={(direction) => setDeskStart(Math.max(0, pageStart + direction * DESK_PAGE))} onAdd={() => setPickerOpen(true)} onRemove={(candidate) => void removeItem(candidate.item)} onMove={(from, to) => { const next = [...candidates.map((candidate) => candidate.item.id)]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); void reorderItems(next) }} onBuy={(candidate) => setBuying(candidate.item)} onChooseSize={(candidate, size) => void chooseSize(candidate.item, size)} />
        )}
        {onlyDifferent && hiddenRows > 0 && <p className="compare-page__diff-summary mx-1 mt-3 flex flex-wrap items-center rounded-btn bg-oat-soft px-3 py-1.5 text-[13px] leading-5 text-oat-ink">已收起 {hiddenRows} 列看得到的幾件都一樣的：{hiddenNames.join('、')}。<button type="button" onClick={() => setOnlyDifferent(false)} className="min-h-10 px-1.5 text-mist-deep underline">全部顯示</button></p>}
      </section>

      {isMobile && <div className="compare-page__mobile-actions fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-20 flex gap-2 border-t-[1.5px] border-dashed border-line-strong bg-card px-3 py-2"><Button variant="oat" className="flex-1" onClick={() => setPickerOpen(true)}><Icon name="plus" size={18} />加入商品</Button><Button variant="secondary" className="flex-1" disabled={!candidates.length} onClick={() => setAiOpen(true)}><Icon name="copy" size={17} />整理給 AI</Button></div>}

      {!!groupLinks.length && !pickerOpen && !editingItem && !addFormOpen && !buying && !deleteGroup && !aiOpen && <FloatToggle open={foldOpen} count={foldSections.length} onToggle={toggleFold} controls="compare-body" compact={isMobile} />}
      {pickerOpen && <ComparePickerDialog groupId={group.id} groupName={group.name} items={wishlist} groupWishlistIds={groupLinks.map((entry) => entry.wishlistItemId)} memberships={memberships} onClose={() => setPickerOpen(false)} onAdd={(ids) => void addItems(ids)} onAddUrl={() => { setPickerOpen(false); setAddFormOpen(true) }} />}
      {editingItem && <WishlistForm key={`edit-${editingItem.id}`} item={editingItem} saving={saving} onCancel={() => setEditingItem(null)} onSubmit={(input) => void saveEdit(editingItem, input)} />}
      {addFormOpen && <WishlistForm key="compare-add" saving={saving} onCancel={() => setAddFormOpen(false)} onSubmit={(input) => void addFromForm(input)} />}
      {buying && <CompareBuyDialog item={buying} others={groupItems.filter((item) => item.id !== buying.id && item.status !== 'bought')} groupName={group.name} saving={saving} onCancel={() => setBuying(null)} onConfirm={(input) => void confirmBuy(input)} />}
      {deleteGroup && <DestructiveActionDialog title={`刪除「${deleteGroup.name}」？`} description="只會刪除這個比較和它的商品關聯，選購清單中的商品不會被刪除。" confirmLabel="刪除比較" onCancel={() => setDeleteGroup(null)} onConfirm={() => void confirmDeleteGroup()} />}
      {aiOpen && <CompareAiDialog candidates={candidates} closet={closet} body={body} bodyProfile={bodyProfile} allowBody={allowBody} include={aiInclude} onIncludeChange={setAiInclude} onClose={() => setAiOpen(false)} onCopied={(ok) => setToast(ok ? { tone: 'success', text: '比較資料已複製，可貼到外部 AI。' } : { tone: 'error', text: '無法複製，請手動選取預覽文字。' })} />}
      {groupsSheetOpen && <CompareGroupsSheet groups={showArchived ? archivedGroups : activeGroups} currentId={group.id} onClose={() => setGroupsSheetOpen(false)} onCreate={() => void createBlankCompare()} onToggleArchived={() => setShowArchived((value) => !value)} archivedCount={archivedGroups.length} showArchived={showArchived} />}
      <Toast message={toast} onClose={closeToast} />
    </main>
  )
}

function EmptyCompare({ onCreate, archivedGroups }: { onCreate: () => void; archivedGroups: CompareGroup[] }) {
  return <main className="mx-auto flex min-h-[55dvh] max-w-3xl flex-col items-center justify-center px-5 py-12 text-center"><span className="mb-3 flex size-16 items-center justify-center rounded-block bg-oat-soft text-oat-ink"><Icon name="wish" size={28} /></span><h1 className="m-0 font-hd text-3xl">還沒有未封存的比較</h1><p className="my-2 max-w-lg text-sm leading-6 text-ink-2">先到選購清單勾選幾件商品，選「比較」建立新比較；也可以先建立空比較再加入商品。</p><Button variant="oat" onClick={onCreate}><Icon name="plus" />到選購清單挑商品</Button>{archivedGroups.length > 0 && <section aria-label="已封存比較" className="mt-8 w-full max-w-md text-left"><h2 className="m-0 mb-2 font-hd text-lg">已封存・{archivedGroups.length}</h2><div className="flex flex-col gap-1">{archivedGroups.map((archived) => <Link key={archived.id} to={`/wishlist/compare/${archived.id}`} className="flex min-h-11 items-center rounded-tile bg-card px-3 text-sm text-ink no-underline">{archived.name}</Link>)}</div></section>}</main>
}

function RenameField({ value, onChange, onSave, onCancel, saving, mobile = false }: { value: string; onChange: (value: string) => void; onSave: () => void; onCancel: () => void; saving: boolean; mobile?: boolean }) {
  const id = useId()
  return <form className="flex min-w-0 items-center gap-1.5" onSubmit={(event) => { event.preventDefault(); onSave() }}><label className="sr-only" htmlFor={id}>比較名稱</label><input id={id} autoFocus value={value} onChange={(event) => onChange(event.target.value)} maxLength={60} className={`min-w-0 rounded-tile border-2 border-mist-deep bg-card px-3 text-ink ${mobile ? 'h-10 w-full text-sm' : 'h-[46px] w-[min(300px,32vw)] font-hd text-xl'}`} /><button type="submit" disabled={saving || !value.trim()} className="min-h-11 rounded-btn bg-ink px-3 text-xs font-medium text-paper disabled:opacity-50">儲存</button><button type="button" disabled={saving} onClick={onCancel} className="min-h-11 rounded-btn px-2 text-xs text-ink-2">取消</button></form>
}

/** 比較名稱＋下拉選單：切換其他比較、新的比較、已封存（取代左側「我的比較」欄） */
function CompareGroupMenu({ current, activeGroups, archivedGroups, links, wishlist, saving, onCreate }: { current: CompareGroup; activeGroups: CompareGroup[]; archivedGroups: CompareGroup[]; links: CompareGroupItem[]; wishlist: WishlistItem[]; saving: boolean; onCreate: () => void }) {
  const [open, setOpen] = useState(false)
  const [archived, setArchived] = useState(!!current.archivedAt)
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const close = useCallback((refocus: boolean) => { setOpen(false); if (refocus) buttonRef.current?.focus() }, [])
  const menuItems = () => [...(wrapRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]

  useEffect(() => {
    if (!open) return
    const items = menuItems()
    ;(items.find((item) => item.getAttribute('aria-current') === 'page') ?? items[0])?.focus()
    const onPointer = (event: PointerEvent) => { if (!wrapRef.current?.contains(event.target as Node)) close(false) }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open, archived, close])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = menuItems()
    const index = items.indexOf(document.activeElement as HTMLElement)
    if (event.key === 'Escape') { event.preventDefault(); close(true) }
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      items[(index + step + items.length) % items.length]?.focus()
    } else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); items[event.key === 'Home' ? 0 : items.length - 1]?.focus() }
    else if (event.key === 'Tab') close(false)
  }

  const list = archived ? archivedGroups : activeGroups
  return <div ref={wrapRef} className="relative" onKeyDown={open ? onKeyDown : undefined}>
    <h1 id="compare-title" className="m-0">
      <button ref={buttonRef} type="button" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={() => { setArchived(!!current.archivedAt); setOpen((value) => !value) }} onKeyDown={(event) => { if (event.key === 'ArrowDown' && !open) { event.preventDefault(); setOpen(true) } }} className={`flex h-11 max-w-[min(420px,36vw)] items-center gap-1.5 rounded-btn pr-2 pl-2.5 text-ink ${open ? 'bg-tile' : 'hover:bg-tile'}`}>
        <span className="truncate font-hd text-2xl font-normal">{current.name}</span><Icon name="down" size={18} className="flex-none text-ink-3" />
      </button>
    </h1>
    {open && <div id={menuId} role="menu" aria-label={archived ? '已封存的比較' : '我的比較'} className="absolute top-[calc(100%+6px)] left-0 z-40 flex w-[300px] flex-col rounded-card bg-card p-1.5 shadow-float ring-[1.5px] ring-line">
      <span className="px-3 pt-1.5 pb-1 text-[11px] text-ink-3">{archived ? '已封存' : '我的比較'}</span>
      {list.length ? list.map((entry) => {
        const memberIds = new Set(links.filter((link) => link.groupId === entry.id).map((link) => link.wishlistItemId))
        const sample = wishlist.filter((item) => memberIds.has(item.id)).slice(0, 2)
        return <Link key={entry.id} role="menuitem" to={`/wishlist/compare/${entry.id}`} onClick={() => close(false)} aria-current={entry.id === current.id ? 'page' : undefined} className={`flex min-h-11 items-center gap-2.5 rounded-btn px-3 text-sm text-ink no-underline hover:bg-paper focus-visible:bg-paper ${entry.id === current.id ? 'bg-paper font-bold' : ''}`}>
          <span aria-hidden="true" className="flex flex-none">{sample.map((item, index) => <span key={item.id} className="-mr-1.5 h-5 w-4 rounded-[4px] ring-2 ring-card" style={{ backgroundColor: item.colorHex, zIndex: sample.length - index }} />)}</span>
          <span className="ml-1.5 min-w-0 flex-1 truncate">{entry.name}</span><span className="font-num text-xs text-ink-2 tabular">{memberIds.size}</span>
        </Link>
      }) : <span className="px-3 py-2 text-sm text-ink-3">{archived ? '沒有封存的比較' : '沒有其他比較'}</span>}
      <span aria-hidden="true" className="mx-2 my-1 h-[1.5px] bg-line" />
      {!archived && <button type="button" role="menuitem" disabled={saving} onClick={() => { close(false); onCreate() }} className="flex min-h-11 items-center gap-2.5 rounded-btn px-3 text-left text-sm font-medium text-mist-deep hover:bg-paper focus-visible:bg-paper"><Icon name="plus" size={18} />新的比較</button>}
      <button type="button" role="menuitem" onClick={() => setArchived((value) => !value)} className="flex min-h-11 items-center gap-2.5 rounded-btn px-3 text-left text-sm text-ink-2 hover:bg-paper focus-visible:bg-paper">{archived ? <><Icon name="back" size={16} />回到我的比較</> : <>已封存<span className="ml-auto font-num text-xs tabular">{archivedGroups.length}</span></>}</button>
    </div>}
  </div>
}

function DesktopCompare({ onEdit, candidates, indexes, sections, folded, onUnfold, showSizeRow, onPage, onAdd, onRemove, onMove, onBuy, onChooseSize }: { onEdit: (candidate: CompareCandidate) => void; candidates: CompareCandidate[]; indexes: number[]; sections: TableSection[]; folded: string[]; onUnfold: () => void; showSizeRow: boolean; onPage: (direction: -1 | 1) => void; onAdd: () => void; onRemove: (candidate: CompareCandidate) => void; onMove: (from: number, to: number) => void; onBuy: (candidate: CompareCandidate) => void; onChooseSize: (candidate: CompareCandidate, size: string) => void }) {
  const [dragged, setDragged] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [compact, setCompact] = useState(false)
  const headRef = useRef<HTMLTableSectionElement>(null)
  const shown = indexes.map((index) => candidates[index])
  const showAdd = candidates.length < DESK_PAGE
  const fillers = DESK_PAGE - shown.length - Number(showAdd)
  const paged = candidates.length > DESK_PAGE
  const dimmed = (candidate: CompareCandidate) => candidate.item.status === 'dropped'

  // 商品列離開畫面頂端後，改顯示黏在頂端、約 60px 的精簡列（大表頭本身不黏，避免捲動時版面跳動）
  useEffect(() => {
    const head = headRef.current
    if (!head || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setCompact(!entry.isIntersecting && entry.boundingClientRect.top < 0))
    observer.observe(head)
    return () => observer.disconnect()
  }, [])

  const changeOrder = (from: number, to: number) => {
    if (to < 0 || to >= candidates.length || from === to) return
    setAnnouncement(`「${candidates[from].item.name}」已移到第 ${to + 1} 欄。`)
    onMove(from, to)
  }
  const beginDrag = (event: DragEvent<HTMLButtonElement>, candidate: CompareCandidate) => { setDragged(candidate.item.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', candidate.item.id) }
  const dropOn = (event: DragEvent<HTMLTableCellElement>, target: CompareCandidate) => {
    event.preventDefault()
    const sourceId = event.dataTransfer.getData('text/plain') || dragged
    const from = candidates.findIndex((entry) => entry.item.id === sourceId)
    const to = candidates.findIndex((entry) => entry.item.id === target.item.id)
    setDragged(null)
    if (from >= 0 && to >= 0) changeOrder(from, to)
  }
  const blanks = (key: string, count = fillers + Number(showAdd)) => Array.from({ length: Math.max(0, count) }, (_, index) => <td key={`${key}-blank-${index}`} className="compare-table__cell" />)
  const pager = paged && <div className="compare-pager" role="group" aria-label="切換顯示的商品">
    <button type="button" disabled={indexes[0] === 0} onClick={() => onPage(-1)} aria-label="上一組商品"><Icon name="back" size={16} /></button>
    <span className="font-num tabular">{indexes[0] + 1}–{indexes[indexes.length - 1] + 1} / {candidates.length}</span>
    <button type="button" disabled={indexes[indexes.length - 1] >= candidates.length - 1} onClick={() => onPage(1)} aria-label="下一組商品"><Icon name="next" size={16} /></button>
  </div>

  return <div className="compare-sheet">
    <span className="sr-only" aria-live="polite">{announcement}</span>
    {compact && <div className="compare-compact"><div className="compare-compact__bar">
      <div className="compare-compact__corner">{pager}</div>
      {shown.map((candidate) => <div key={candidate.item.id} className={`compare-compact__item ${dimmed(candidate) ? 'opacity-55' : ''}`}>
        <span className="compare-compact__thumb" style={{ backgroundColor: candidate.item.colorHex + '26' }}><ItemImage name={candidate.item.name} cutoutUrl={candidate.item.cutoutUrl} shape={candidate.item.shape} colorHex={candidate.item.colorHex} className="h-[80%] w-[78%]" /></span>
        <span className="flex min-w-0 flex-col"><span className="truncate text-[12.5px] font-bold">{candidate.item.name}</span><b className="font-num text-[13px] tabular">{formatNT(candidate.item.price)}<span className="ml-1.5 font-medium text-ink-2">{selectedCompareSize(candidate)}</span></b></span>
      </div>)}
    </div></div>}

    <table className="compare-table">
      <caption className="sr-only">比較表：每欄一件商品，每列一項比較資料{paged ? `；目前顯示第 ${indexes[0] + 1} 到 ${indexes[indexes.length - 1] + 1} 件，共 ${candidates.length} 件` : ''}</caption>
      <colgroup><col className="compare-table__label-col" />{Array.from({ length: DESK_PAGE }, (_, index) => <col key={index} />)}</colgroup>
      <thead ref={headRef} className="compare-table__head"><tr>
        <th scope="col" className="compare-table__corner">{pager || <span className="block text-[11px] leading-5 text-ink-3">拖曳 ⋮⋮ 排序；鍵盤用左右鍵</span>}</th>
        {shown.map((candidate) => {
          const index = candidates.indexOf(candidate)
          const also = candidate.memberships.filter((name) => name !== candidate.item.name)
          return <th key={candidate.item.id} scope="col" className={`compare-head ${dimmed(candidate) ? 'opacity-65' : ''} ${dragged === candidate.item.id ? 'is-dragging' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropOn(event, candidate)}>
            <div className="compare-head__photo" style={{ backgroundColor: candidate.item.colorHex + '26' }}>
              <ItemImage name={candidate.item.name} cutoutUrl={candidate.item.cutoutUrl} shape={candidate.item.shape} colorHex={candidate.item.colorHex} className="h-[84%] w-[64%]" />
              <button type="button" draggable onDragStart={(event) => beginDrag(event, candidate)} onDragEnd={() => setDragged(null)} onKeyDown={(event) => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); changeOrder(index, index + (event.key === 'ArrowLeft' ? -1 : 1)) } }} aria-label={`排序：${candidate.item.name}，第 ${index + 1} 欄，可拖曳或按左右鍵移動`} title="拖曳排序" className="compare-head__drag"><span aria-hidden="true">⋮⋮</span></button>
              <button type="button" onClick={() => onEdit(candidate)} aria-label={`編輯商品：${candidate.item.name}`} title="編輯商品" className="compare-head__edit"><span><Icon name="edit" size={14} /></span></button>
              <button type="button" onClick={() => onRemove(candidate)} aria-label={`從這個比較移除：${candidate.item.name}`} className="compare-head__remove"><span><Icon name="x" size={14} /></span></button>
              {candidate.link.isDecided && <span className="compare-head__decided">決定買</span>}
            </div>
            <span className="compare-head__name" title={candidate.item.name}>{candidate.item.name}</span>
            <span className="compare-head__price"><b className="font-num tabular">{formatNT(candidate.item.price)}</b>{candidate.item.shop && <span>{candidate.item.shop}</span>}{also.length > 0 && <span className="text-mist-ink">・也在「{also.join('、')}」</span>}</span>
          </th>
        })}
        {showAdd && <th scope="col" className="compare-head"><button type="button" onClick={onAdd} className="compare-add-card"><Icon name="plus" size={22} /><span>加入商品</span></button></th>}
        {Array.from({ length: Math.max(0, fillers) }, (_, index) => <td key={`head-blank-${index}`} />)}
      </tr></thead>
      <tbody id="compare-body">
        {showSizeRow && <tr className="compare-table__row">
          <th scope="row" className="compare-table__row-label"><b>比的尺碼</b></th>
          {shown.map((candidate) => {
            const choices = sizeChoicesFor(candidate.item)
            return <td key={candidate.item.id} className={`compare-table__cell ${dimmed(candidate) ? 'opacity-55' : ''}`}>{choices.length ? <Select label={`${candidate.item.name}要比較的尺碼`} value={selectedCompareSize(candidate)} options={choices.map((size) => ({ value: size, label: size }))} onChange={(size) => onChooseSize(candidate, size)} triggerClassName="h-[34px] w-full max-w-[120px] rounded-btn border-[1.5px] border-line-strong bg-card px-2.5 text-[13px] font-medium" /> : <span className="text-[13px] text-ink-3">未提供尺碼</span>}</td>
          })}
          {blanks('size')}
        </tr>}
        {sections.map((section) => <SectionRows key={section.id} section={section} indexes={indexes} blanks={blanks} dimmed={shown.map(dimmed)} anchor={FOLD_SECTION_IDS.has(section.id) && section.id === sections.find((entry) => FOLD_SECTION_IDS.has(entry.id))?.id} />)}
        {folded.length > 0 && <tr><td colSpan={1 + DESK_PAGE} className="pt-3"><FoldBar names={folded} onUnfold={onUnfold} /></td></tr>}
      </tbody>
      <tfoot className="compare-table__foot"><tr>
        <th scope="row" className="compare-table__row-label"><span className="text-xs leading-[1.6] text-ink-2">看完了，決定吧</span></th>
        {shown.map((candidate) => <td key={candidate.item.id} className="compare-table__cell">
          <div className="flex flex-col gap-0.5">
            <Button variant={candidate.link.isDecided ? 'primary' : 'secondary'} disabled={candidate.item.status === 'bought'} className="w-full" onClick={() => onBuy(candidate)}>{candidate.item.status === 'bought' ? '已購買' : candidate.link.isDecided ? '✓ 決定買' : '就買這件'}</Button>
            <ButtonLink to={studioUrl(candidate.item)} variant="ghost" className="w-full text-[13px] text-mist-deep" aria-label={`拿去試搭：${candidate.item.name}`}>拿去試搭</ButtonLink>
          </div>
        </td>)}
        {blanks('foot')}
      </tr></tfoot>
    </table>
  </div>
}

/** 收起處的斜紋橫條：「還有 N 區收起來了：…」，點了跟右下角懸浮鈕一樣展開 */
function FoldBar({ names, onUnfold }: { names: string[]; onUnfold: () => void }) {
  return <button id="compare-fold-start" type="button" aria-expanded="false" aria-controls="compare-body" onClick={onUnfold} className="compare-fold-bar">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l5 5 5-5M7 13l5 5 5-5" /></svg>
    <span>還有 <b className="font-num tabular">{names.length}</b> 區收起來了：{names.join('、')}</span>
    <span className="compare-fold-bar__hint">右下角的按鈕也能展開</span>
  </button>
}

function SectionRows({ section, indexes, blanks, dimmed, anchor = false }: { section: TableSection; indexes: number[]; blanks: (key: string) => ReactNode[]; dimmed: boolean[]; anchor?: boolean }) {
  return <>
    <tr id={anchor ? 'compare-fold-start' : undefined} className="compare-table__section"><th colSpan={1 + DESK_PAGE} scope="colgroup"><span className="font-hd text-[17px]">{section.title}</span>{section.hint && <span className="ml-2.5 text-[11.5px] text-ink-2">{section.hint}</span>}</th></tr>
    {section.rows.map((row) => <tr key={row.id} className="compare-table__row">
      <th scope="row" className="compare-table__row-label"><span>{row.label}</span>{row.bodyLabel && <small>{row.bodyLabel}</small>}</th>
      {indexes.map((candidateIndex, index) => {
        const value = row.cells[candidateIndex] ?? cell('—')
        // 商品頁尺寸表一律完整顯示，原文照貼
        if (row.id === 'size-note') return <td key={`${row.id}-${candidateIndex}`} className={`compare-table__cell align-top ${dimmed[index] ? 'opacity-55' : ''}`}>{value.note?.trim() ? <div className="compare-note"><MarkdownNote value={value.note.trim()} /></div> : <span className="text-ink-3">未提供</span>}</td>
        return <td key={`${row.id}-${candidateIndex}`} className={`compare-table__cell ${dimmed[index] ? 'opacity-55' : ''}`}><CellContent value={value} /></td>
      })}
      {blanks(row.id)}
    </tr>)}
  </>
}

function CellContent({ value }: { value: ValueCell }) {
  if (value.markdown) return <div className="compare-cell"><div className="w-full min-w-0 rounded-btn bg-paper px-3 py-2 text-[13px] leading-[1.7] text-ink [overflow-wrap:anywhere]"><MarkdownNote value={value.markdown} /></div></div>
  return <div className="compare-cell">{value.note ? <div className="compare-cell__note w-full min-w-0 rounded-btn bg-mist-soft px-2.5 py-2 text-xs leading-[1.65] text-ink"><span className="mb-1.5 block text-[11px] font-medium text-ink-2">尺寸備註</span>{value.noteSizes ? <div className="grid min-w-0 gap-1">{value.noteSizes.map((row) => <div key={row.size} className="grid min-w-0 grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-1.5 rounded-sm bg-card/75 px-2 py-1.5"><b className="font-num text-ink">{row.size}</b><span className="min-w-0 break-words [overflow-wrap:anywhere]">{row.details}</span></div>)}</div> : <MarkdownNote value={value.note} />}</div> : <span className="compare-cell__main">{value.text}{value.colors?.map((color) => <span key={`${color.name}-${color.hex}`} title={`${color.name}${color.preferred ? '・最想要' : ''}`} aria-label={`${color.name}${color.preferred ? '・最想要' : ''}`} className={`compare-cell__color ${color.preferred ? 'is-preferred' : ''}`} style={{ backgroundColor: color.hex }} />)}</span>}{value.tag && <span className={`compare-cell__tag ${TONE_CLASSES[value.tag.tone]}`}>{value.tag.label}</span>}{value.hint && <small className="compare-cell__hint">{value.hint}</small>}</div>
}

function MobileCompare({ onEdit, columns, sections, folded, onUnfold, indexes, total, onMove, onBuy, onChooseSize }: { onEdit: (candidate: CompareCandidate) => void; columns: (CompareCandidate | null)[]; sections: TableSection[]; folded: string[]; onUnfold: () => void; indexes: [number, number]; total: number; onMove: (index: number, direction: -1 | 1) => void; onBuy: (candidate: CompareCandidate) => void; onChooseSize: (candidate: CompareCandidate, size: string) => void }) {
  const indexedValues = (row: TableRow) => indexes.map((index) => row.cells[index] ?? cell('—'))
  return <div className="compare-mobile mt-1">
    <div className="compare-mobile__products">
      <div className="compare-mobile__product-grid">
        {columns.map((candidate, columnIndex) => <div key={candidate?.item.id ?? `empty-${columnIndex}`} className="compare-mobile__product">
          {candidate ? <>
            <div className="compare-mobile__photo"><ItemImage name={candidate.item.name} cutoutUrl={candidate.item.cutoutUrl} shape={candidate.item.shape} colorHex={candidate.item.colorHex} className="h-[78%] w-[72%]" /><button type="button" onClick={() => onEdit(candidate)} aria-label={`編輯商品：${candidate.item.name}`} className="compare-head__edit compare-mobile__edit"><span><Icon name="edit" size={14} /></span></button>{candidate.link.isDecided && <span className="absolute bottom-1 left-1 rounded-full bg-ink px-2 py-0.5 text-[10px] text-paper">決定買</span>}</div>
            <div className="compare-mobile__pager"><button type="button" disabled={total <= 2} onClick={() => onMove(columnIndex, -1)} aria-label="這欄換上一件"><Icon name="back" size={17} /></button><span className="font-num text-xs tabular">{indexes[columnIndex] + 1} / {total}</span><button type="button" disabled={total <= 2} onClick={() => onMove(columnIndex, 1)} aria-label="這欄換下一件"><Icon name="next" size={17} /></button></div>
            <span className="compare-mobile__name">{candidate.item.name}</span><span className="compare-mobile__price"><b className="font-num">{formatNT(candidate.item.price)}</b></span>
            {sizeChoicesFor(candidate.item).length ? <Select label={`${candidate.item.name}要比較的尺碼`} value={selectedCompareSize(candidate)} options={sizeChoicesFor(candidate.item).map((size) => ({ value: size, label: size }))} onChange={(size) => onChooseSize(candidate, size)} triggerClassName="h-9 w-full rounded-btn border-[1.5px] border-line-strong bg-card px-2 text-xs" /> : <span className="text-[11px] text-ink-3">未提供尺碼</span>}
          </> : <div className="compare-mobile__no-column">目前只有 1 件商品</div>}
        </div>)}
      </div>
    </div>
    <div id="compare-body" className="compare-mobile__body">
      {sections.map((section) => {
        const rows = section.rows
        if (!rows.length) return null
        const anchor = FOLD_SECTION_IDS.has(section.id) && section.id === sections.find((entry) => FOLD_SECTION_IDS.has(entry.id))?.id
        return <section key={section.id} id={anchor ? 'compare-fold-start' : undefined} className="compare-mobile__section"><h2 className="m-0 mt-4 font-hd text-lg">{section.title}</h2>
          {rows.map((row) => <div key={row.id} className="compare-mobile__row"><div className="compare-mobile__row-label"><span>{row.label}</span>{row.bodyLabel && <small>{row.bodyLabel}</small>}</div><div className="compare-mobile__values">{indexedValues(row).map((value, index) => <div key={`${row.id}-${index}`} className={`compare-table__cell ${columns[index]?.item.status === 'dropped' ? 'opacity-55' : ''}`}><CellContent value={value} /></div>)}</div></div>)}
        </section>
      })}
      {folded.length > 0 && <div className="mt-4"><FoldBar names={folded} onUnfold={onUnfold} /></div>}
      <div className="compare-mobile__buy-grid">{columns.map((candidate) => candidate ? <div key={candidate.item.id} className="flex flex-col gap-1.5"><Button variant={candidate.link.isDecided ? 'primary' : 'secondary'} disabled={candidate.item.status === 'bought'} className="w-full px-2 text-xs" onClick={() => onBuy(candidate)}>{candidate.item.status === 'bought' ? '已購買' : candidate.link.isDecided ? '✓ 決定買' : '就買這件'}</Button><ButtonLink to={studioUrl(candidate.item)} variant="ghost" className="w-full px-1 text-xs text-mist-deep"><Icon name="outfit" size={15} />拿去試搭</ButtonLink></div> : <span key="blank" />)}</div>
    </div>
  </div>
}

function CompareAiDialog({ candidates, closet, body, bodyProfile, allowBody, include, onIncludeChange, onClose, onCopied }: { candidates: CompareCandidate[]; closet: ClosetItem[]; body: BodyMeasurement | null; bodyProfile: BodyProfile | null; allowBody: boolean; include: Set<AiInclude>; onIncludeChange: (value: Set<AiInclude>) => void; onClose: () => void; onCopied: (ok: boolean) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [])
  const textBuilder = (items: WishlistItem[], sections: Set<AiInclude>) => {
    const bodyText = sections.has('body') && allowBody ? bodySummary(body, bodyProfile) : null
    const candidateById = new Map(candidates.map((candidate) => [candidate.item.id, candidate]))
    return [
      '請依照我的體態與需求，比較以下候選商品，協助我判斷哪件最值得買。請只根據提供資料分析；資料不足時明確列出需要補問的資訊。',
      bodyText ? `【我的體態】${bodyText}` : null,
      ...items.map((item, index) => {
        const candidate = candidateById.get(item.id)
        const lines = [`${index + 1}. ${item.name}`]
        if (sections.has('basics')) lines.push(`價格：售價 ${formatNT(item.price)}、運費 ${item.shipping == null ? '未提供' : item.shipping === 0 ? '免運' : formatNT(item.shipping)}、含運 ${formatNT(totalPrice(item))}`)
        if (sections.has('colorSize')) lines.push(`比較尺碼：${candidate ? selectedCompareSize(candidate) || '未提供' : '未提供'}；顏色：${colorValues(item).map((color) => `${color.name}${color.preferred ? '（最想要）' : ''}`).join('、')}`)
        if (sections.has('flat')) lines.push(`尺寸：${candidate ? candidate.sizeRows.map((row) => {
          const judgment = sizeJudgement(candidate, row)
          const note = judgment && judgment !== '—' ? `・${judgment}` : `・${sizeMismatchHint(candidate)}`
          return `${row.part.label} ${formatStretch(row.flat, row.flatStretch)} cm${note}`
        }).join('；') || '未提供可比尺寸' : '未提供可比尺寸'}`)
        if (sections.has('material')) lines.push(`材質與版型：${item.materialComposition ?? item.material ?? '未提供'}；版型／季節／洗滌：未提供`)
        if (sections.has('closet') && candidate) lines.push(`跟衣櫃：可搭 ${candidate.insights.matchCount} 件；${OVERLAP_LABEL[candidate.insights.overlap]}${candidate.insights.closest ? `（像「${candidate.insights.closest.name}」）` : `（衣櫃沒有${candidate.insights.compareLabel}）`}`)
        lines.push(`退換：${item.returnPolicy ?? '未提供'}`)
        lines.push(`尺寸備註：${item.sizeNote?.trim() || '未提供'}`)
        if (sections.has('url') && item.url) lines.push(`商品網址：${item.url}`)
        if (sections.has('closet') && item.reason) lines.push(`我的筆記：${item.reason}`)
        return lines.join('\n')
      }),
      '請依序比較價格、尺碼與判斷、材質、顏色、退換條件、跟衣櫃的關係和我的筆記，說明推薦與風險。',
    ].filter((entry): entry is string => !!entry).join('\n\n')
  }
  return <dialog ref={dialogRef} aria-labelledby="compare-ai-title" onClose={onClose} className="compare-ai-dialog fixed inset-x-0 top-auto bottom-0 m-0 max-h-[88dvh] w-full max-w-none overflow-y-auto rounded-t-block border-0 bg-card p-4 pb-[calc(20px+env(safe-area-inset-bottom))] text-ink shadow-sheet backdrop:bg-scrim sm:inset-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[min(720px,calc(100vw-32px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card sm:p-5 sm:shadow-float">
    <WishlistAiPanel titleId="compare-ai-title" items={candidates.map((candidate) => candidate.item)} closet={closet} body={body} bodyProfile={bodyProfile} allowBody={allowBody} include={include} onIncludeChange={onIncludeChange} onCopied={({ ok }) => onCopied(ok)} onClose={onClose} summaryLabel={`比較 ${candidates.length} 件`} templateOptions={[{ value: 'compare', label: '比較' }]} buildText={textBuilder} />
  </dialog>
}

function CompareGroupsSheet({ groups, currentId, onClose, onCreate, onToggleArchived, archivedCount, showArchived }: { groups: CompareGroup[]; currentId: string; onClose: () => void; onCreate: () => void; onToggleArchived: () => void; archivedCount: number; showArchived: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => { const dialog = dialogRef.current; if (dialog && !dialog.open) dialog.showModal(); return () => { if (dialog?.open) dialog.close() } }, [])
  return <dialog ref={dialogRef} aria-labelledby="compare-groups-title" onClose={onClose} className="compare-groups-sheet fixed inset-x-0 top-auto bottom-0 m-0 max-h-[80dvh] w-full max-w-none overflow-y-auto rounded-t-block border-0 bg-card p-4 pb-[calc(20px+env(safe-area-inset-bottom))] text-ink shadow-sheet backdrop:bg-scrim sm:inset-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[min(420px,calc(100vw-32px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card sm:shadow-float"><header className="flex items-center"><h2 id="compare-groups-title" className="m-0 flex-1 font-hd text-xl">我的比較</h2><button type="button" onClick={onClose} aria-label="關閉比較清單" className="flex size-11 items-center justify-center rounded-btn"><Icon name="x" /></button></header><div className="mt-2 flex flex-col gap-1">{groups.map((group) => <Link key={group.id} to={`/wishlist/compare/${group.id}`} onClick={onClose} aria-current={group.id === currentId ? 'page' : undefined} className={`flex min-h-12 items-center rounded-tile px-3 text-sm no-underline ${group.id === currentId ? 'bg-tile font-medium text-ink' : 'text-ink-2'}`}>{group.name}</Link>)}</div><div className="mt-3 flex justify-between border-t border-dashed border-line-strong pt-2"><button type="button" onClick={onToggleArchived} className="min-h-11 text-sm text-mist-deep">{showArchived ? '未封存' : `已封存 ${archivedCount}`}</button><Button variant="secondary" onClick={onCreate}><Icon name="plus" size={16} />新的比較</Button></div></dialog>
}
