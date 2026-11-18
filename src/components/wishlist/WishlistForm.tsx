import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Combobox } from '@/components/ui/Combobox'
import { Icon } from '@/components/ui/Icon'
import { MarkdownNoteField } from '@/components/ui/MarkdownNote'
import { Select } from '@/components/ui/Select'
import { FlatMeasureField } from '@/components/closet/FlatMeasureField'
import { fetchClosetBrands, fetchLessonRules, fetchManagedList, markLessonRulesNotified, useLatestBody } from '@/lib/data'
import { FLAT_LABELS, isLessonRuleReminderDue, matchWishlistLessonRules } from '@/lib/review'
import { collectMeasures, SIZING, toFieldValue, type FlatFieldValue, type MeasureField } from '@/lib/stretch'
import { toUploadableImage } from '@/lib/image'
import { GARMENT_COLORS } from '@/lib/colors'
import { SLOTS } from '@/lib/slots'
import { isValidProductUrl, PRIORITY_LABEL, shopFromUrl, WISH_STATUS } from '@/lib/wishlist'
import { materialNames, parsePercentages } from '@/lib/materials'
import type { ManagedListSummary } from '@/types'
import type { LessonRule, Slot, WishlistColor, WishlistInput, WishlistItem, WishPriority } from '@/types'

type EditableStatus = WishlistInput['status']
const STATUS_OPTIONS: EditableStatus[] = ['considering', 'waiting', 'ready', 'dropped']
const PRIORITY_OPTIONS: WishPriority[] = [3, 2, 1]

interface Draft {
  url: string
  name: string
  primaryPart: Slot | ''
  alsoParts: Slot[]
  colors: WishlistColor[]
  shop: string
  brand: string
  price: string
  shipping: string
  size: string
  sizeNote: string
  necklineSize: string
  priority: WishPriority | null
  status: EditableStatus
  returnPolicy: string
  material: string
  materialComposition: string
  materialPercentages: Record<string, string>
  /** 平放尺寸（可含「40-60」範圍） */
  flat: Record<string, FlatFieldValue>
  reason: string
}

interface PendingPhoto {
  id: string
  file: File
  url: string
  colorFamily: string | null
}

export interface WishlistFormDefaults {
  url?: string
  slot?: WishlistInput['slot']
  primaryPart?: Slot
}

const COLOR_FAMILIES = GARMENT_COLORS.slice(0, 16)
const fallbackHex = (family?: string) => COLOR_FAMILIES.find((color) => color.name === family)?.hex ?? '#D9CBB3'
const resolvedColor = (color?: WishlistColor) => color?.hex ?? fallbackHex(color?.family)

function toDraft(item?: WishlistItem, defaults?: WishlistFormDefaults): Draft {
  const num = (value?: number) => (value === undefined ? '' : String(value))
  const primaryPart = item?.primaryPart ?? item?.slot ?? defaults?.primaryPart ?? defaults?.slot ?? ''
  const colors = item?.colors !== undefined ? item.colors.map((color) => ({ ...color })) : item?.colorName || item?.colorHex ? [{ family: item.colorName || '其他', hex: item.colorHex }] : []
  return {
    url: item?.url ?? defaults?.url ?? '',
    name: item?.name ?? '',
    primaryPart,
    alsoParts: (item?.alsoParts ?? []).filter((part) => part !== primaryPart),
    colors,
    shop: item?.shop === '尚未決定' ? '' : (item?.shop ?? ''),
    brand: item?.brand ?? '',
    price: num(item?.price),
    shipping: num(item?.shipping),
    size: item?.size ?? '',
    sizeNote: item?.sizeNote ?? '',
    necklineSize: item?.necklineSize == null ? '' : String(item.necklineSize),
    priority: item?.priority ?? null,
    status: item && item.status !== 'bought' ? item.status : 'considering',
    returnPolicy: item?.returnPolicy ?? '',
    material: item?.material ?? '',
    materialComposition: item?.materialComposition ?? '',
    materialPercentages: Object.fromEntries(Object.entries(item?.materialPercentages ?? {}).map(([name, value]) => [name, String(value)])),
    flat: Object.fromEntries(Object.entries(item?.flatMeasurements ?? {}).map(([key, value]) => [key, toFieldValue(value, item?.flatStretch?.[key])])),
    reason: item?.reason ?? '',
  }
}

/** 這個部位的平放尺寸欄位，加上這件已存但不在預設清單裡的欄位（例如洋裝的下擺寬） */
function measureFields(slot: Draft['primaryPart'], flat: Record<string, FlatFieldValue>): MeasureField[] {
  if (!slot) return []
  const base = SIZING[slot]
  const extra = Object.keys(flat).filter((key) => !base.some((field) => field.key === key) && flat[key]?.text.trim())
  return [...base, ...extra.map((key) => ({ key, label: FLAT_LABELS[key] ?? key }))]
}

type Errors = Partial<Record<'name' | 'primaryPart' | 'price' | 'shipping' | 'url' | 'necklineSize' | 'materialPercentages' | 'flat' | 'colors', string>>

function parseAmount(value: string): number | null | 'invalid' {
  const trimmed = value.replace(/[,\s]/g, '')
  if (!trimmed) return null
  if (!/^\d+$/.test(trimmed)) return 'invalid'
  return Number(trimmed)
}

function validate(draft: Draft): { errors: Errors; input?: WishlistInput } {
  const errors: Errors = {}
  if (!draft.name.trim()) errors.name = '請填商品名稱。'
  if (!draft.primaryPart) errors.primaryPart = '請選擇主要部位。'
  const price = parseAmount(draft.price)
  if (price === null) errors.price = '請填價格，還不確定可以先填 0。'
  else if (price === 'invalid') errors.price = '價格請填整數，例如 2990。'
  const shipping = parseAmount(draft.shipping)
  if (shipping === 'invalid') errors.shipping = '運費請填整數，免運可填 0。'
  const necklineSize = draft.necklineSize.trim() ? Number(draft.necklineSize) : null
  if (necklineSize !== null && (!Number.isFinite(necklineSize) || necklineSize < 0)) errors.necklineSize = '領口尺寸請填 0 以上的數字。'
  if (Object.entries(draft.materialPercentages).some(([name, value]) => materialNames(draft.material).includes(name) && value.trim() && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 100))) errors.materialPercentages = '材質比例請填 0 到 100 之間的數字。'
  if (draft.url.trim() && !isValidProductUrl(draft.url)) errors.url = '請輸入有效的 http:// 或 https:// 網址。'
  if (draft.colors.some((color) => !color.family.trim())) errors.colors = '請為每個顏色輸入名稱。'
  if (draft.colors.some((color) => color.hex?.trim() && !/^#[0-9A-F]{6}$/i.test(color.hex.trim()))) errors.colors = '色碼請使用 #RRGGBB 格式，例如 #EFE6D2。'
  const measures = collectMeasures(measureFields(draft.primaryPart, draft.flat), draft.flat)
  if (measures.error) errors.flat = `平放尺寸「${measures.error.field.label}」：${measures.error.message}`
  if (Object.keys(errors).length) return { errors }
  return {
    errors,
    input: {
      name: draft.name,
      slot: draft.primaryPart as Slot,
      primaryPart: draft.primaryPart as Slot,
      alsoParts: draft.alsoParts.filter((part) => part !== draft.primaryPart),
      colors: draft.colors,
      colorHex: resolvedColor(draft.colors[0]),
      colorName: draft.colors[0]?.family,
      shop: draft.shop,
      url: draft.url,
      price: price as number,
      shipping: shipping as number | null,
      brand: draft.brand,
      size: draft.size,
      sizeNote: draft.sizeNote,
      necklineSize: draft.primaryPart === 'top' ? necklineSize : null,
      priority: draft.priority,
      reason: draft.reason,
      material: draft.material,
      materialComposition: draft.materialComposition,
      materialPercentages: parsePercentages(draft.materialPercentages),
      flatMeasurements: measures.flat,
      flatStretch: measures.stretch,
      returnPolicy: draft.returnPolicy,
      status: draft.status,
    },
  }
}

const inputClass = 'h-11 w-full min-w-0 rounded-btn border-[1.5px] border-line bg-card px-3 text-sm text-ink placeholder:text-ink-3 aria-invalid:border-rose-deep'

function Field({ label, htmlFor, error, hint, required, children, className = '' }: { label: string; htmlFor: string; error?: string; hint?: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
        {label}
        {required && <span className="ml-1 text-rose-deep" aria-hidden="true">*</span>}
      </label>
      {children}
      {error ? (
        <span id={`${htmlFor}-error`} className="text-xs text-rose-deep">{error}</span>
      ) : hint ? (
        <span id={`${htmlFor}-hint`} className="text-xs text-ink-2">{hint}</span>
      ) : null}
    </div>
  )
}

export function WishlistForm({
  item,
  defaults,
  title,
  saving,
  onCancel,
  onSubmit,
  onDelete,
}: {
  /** 有值時為編輯模式 */
  item?: WishlistItem
  /** 新增時預填（例如比較台貼上的網址、群組的部位） */
  defaults?: WishlistFormDefaults
  /** 自訂對話框標題 */
  title?: string
  saving: boolean
  onCancel: () => void
  onSubmit: (input: WishlistInput) => void
  onDelete?: () => void
}) {
  const uid = useId()
  const id = (name: string) => `${uid}-${name}`
  const [draft, setDraft] = useState<Draft>(() => {
    const draft = toDraft(item, defaults)
    const guessed = !item && draft.url ? shopFromUrl(draft.url) : null
    return guessed ? { ...draft, shop: guessed } : draft
  })
  const [errors, setErrors] = useState<Errors>({})
  const [editingColorIndex, setEditingColorIndex] = useState<number | null>(null)
  const [shopSuggestions, setShopSuggestions] = useState<string[]>([])
  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([])
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([])
  const [photoColorById, setPhotoColorById] = useState<Record<string, string | null>>(() => Object.fromEntries((item?.photos ?? []).map((photo) => [photo.id, photo.colorFamily ?? null])))
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([])
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [preparingPhotos, setPreparingPhotos] = useState(false)
  const [draggingPhotos, setDraggingPhotos] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const pendingPhotosRef = useRef<PendingPhoto[]>([])
  const [materials, setMaterials] = useState<ManagedListSummary[]>([])
  const [lessonRules, setLessonRules] = useState<LessonRule[]>([])
  const [shownRuleIds, setShownRuleIds] = useState<string[]>([])
  const shownRuleIdsRef = useRef(new Set<string>())
  const editing = !!item
  const existingPhotos = (item?.photos ?? []).filter((photo) => !removedPhotoIds.includes(photo.id))
  const visiblePhotos = [...existingPhotos, ...pendingPhotos]

  const body = useLatestBody()
  const fields = useMemo(() => measureFields(draft.primaryPart, draft.flat), [draft.primaryPart, draft.flat])
  const measures = useMemo(() => collectMeasures(fields, draft.flat), [fields, draft.flat])
  const matchedRuleAlerts = useMemo(() => matchWishlistLessonRules(lessonRules, {
    brand: draft.brand,
    shop: draft.shop,
    slot: draft.primaryPart,
    size: draft.size,
    sizeNote: draft.sizeNote,
    material: draft.material,
    materialComposition: draft.materialComposition,
    materialPercentages: parsePercentages(draft.materialPercentages),
    flatMeasurements: measures.flat,
    flatStretch: measures.stretch,
  }).filter(({ rule }) => !rule.lastNotifiedAt || shownRuleIds.includes(rule.id)), [draft.brand, draft.material, draft.materialComposition, draft.materialPercentages, draft.shop, draft.size, draft.sizeNote, draft.primaryPart, lessonRules, measures, shownRuleIds])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => { pendingPhotosRef.current = pendingPhotos }, [pendingPhotos])
  useEffect(() => () => pendingPhotosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url)), [])

  useEffect(() => {
    let active = true
    void Promise.all([fetchManagedList('shops'), fetchManagedList('materials'), fetchClosetBrands()]).then(([shops, materialList, brands]) => {
      if (!active) return
      setShopSuggestions(shops.entries.map((entry) => entry.name))
      setBrandSuggestions(brands)
      const current = materialNames(item?.material)
      const extras = current.filter((name) => !materialList.entries.some((entry) => entry.name === name)).map((name) => ({ name, aliases: [], sortOrder: 1000, isDefault: false, isHidden: false, closetCount: 0, wishCount: 0, lastUsed: null }))
      setMaterials([...materialList.entries.filter((entry) => !entry.isHidden), ...extras])
    }).catch(() => undefined)
    void fetchLessonRules().then((rules) => active && setLessonRules(rules.filter((rule) => rule.active && isLessonRuleReminderDue(rule)))).catch(() => undefined)
    return () => { active = false }
  }, [item?.id, item?.material])

  useEffect(() => {
    const newAlerts = matchedRuleAlerts.filter(({ rule }) => !shownRuleIdsRef.current.has(rule.id))
    if (!newAlerts.length) return
    const ids = newAlerts.map(({ rule }) => rule.id)
    ids.forEach((ruleId) => shownRuleIdsRef.current.add(ruleId))
    void markLessonRulesNotified(ids).then((markedIds) => {
      const notifiedAt = new Date().toISOString()
      setShownRuleIds((current) => [...new Set([...current, ...ids])])
      if (markedIds.length) setLessonRules((current) => current.map((rule) => markedIds.includes(rule.id) ? { ...rule, lastNotifiedAt: notifiedAt } : rule))
    }).catch(() => {
      // 提醒已在畫面顯示；記錄失敗不阻擋新增商品。
      setShownRuleIds((current) => [...new Set([...current, ...ids])])
    })
  }, [matchedRuleAlerts])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))

  function toggleMaterial(name: string) {
    const current = materialNames(draft.material)
    const next = current.includes(name) ? current.filter((entry) => entry !== name) : [...current, name]
    set('material', next.join('、'))
    if (!next.includes(name)) {
      const percentages = { ...draft.materialPercentages }
      delete percentages[name]
      set('materialPercentages', percentages)
    }
  }

  function toggleColorFamily(family: string) {
    const exists = draft.colors.some((color) => color.family === family)
    if (!exists) {
      set('colors', [...draft.colors, { family }])
      return
    }
    set('colors', draft.colors.filter((color) => color.family !== family))
    setPendingPhotos((current) => current.map((photo) => photo.colorFamily === family ? { ...photo, colorFamily: null } : photo))
    setPhotoColorById((current) => Object.fromEntries(Object.entries(current).map(([photoId, selected]) => [photoId, selected === family ? null : selected])))
  }

  function renameColor(previousFamily: string, nextFamily: string) {
    set('colors', draft.colors.map((color) => color.family === previousFamily ? { ...color, family: nextFamily } : color))
    setPendingPhotos((current) => current.map((photo) => photo.colorFamily === previousFamily ? { ...photo, colorFamily: nextFamily || null } : photo))
    setPhotoColorById((current) => Object.fromEntries(Object.entries(current).map(([photoId, family]) => [photoId, family === previousFamily ? nextFamily || null : family])))
  }

  async function appendPhotos(files: FileList | File[]) {
    if (preparingPhotos) return
    const candidates = Array.from(files)
    const oversized = candidates.filter((file) => file.size > 10 * 1024 * 1024).length
    const valid = candidates.filter((file) => file.size <= 10 * 1024 * 1024 && (file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name)))
    const selected = valid
    if (!selected.length) {
      setPhotoError(oversized ? '單張圖片需小於 10 MB。' : '請選擇有效的圖片檔案。')
      return
    }
    setPhotoError(oversized ? '超過 10 MB 的圖片未加入。' : null)
    setPreparingPhotos(true)
    const prepared: PendingPhoto[] = []
    try {
      for (const source of selected) {
        const file = await toUploadableImage(source)
        prepared.push({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file), colorFamily: null })
      }
      setPendingPhotos((current) => [...current, ...prepared])
    } catch (cause) {
      prepared.forEach((photo) => URL.revokeObjectURL(photo.url))
      setPhotoError(cause instanceof Error ? cause.message : '圖片讀取失敗，請重新選取。')
    } finally {
      setPreparingPhotos(false)
    }
  }

  function removePhoto(photoId: string) {
    const pending = pendingPhotos.find((photo) => photo.id === photoId)
    if (pending) {
      URL.revokeObjectURL(pending.url)
      setPendingPhotos((current) => current.filter((photo) => photo.id !== photoId))
    } else {
      setRemovedPhotoIds((current) => [...new Set([...current, photoId])])
    }
    setPhotoError(null)
  }

  function setPhotoColor(photoId: string, colorFamily: string | null) {
    const pending = pendingPhotos.find((photo) => photo.id === photoId)
    if (pending) {
      setPendingPhotos((current) => current.map((photo) => photo.id === photoId ? { ...photo, colorFamily } : photo))
    } else {
      setPhotoColorById((current) => ({ ...current, [photoId]: colorFamily }))
    }
  }

  function pastePhotos(event: React.ClipboardEvent<HTMLFormElement>) {
    const files = Array.from(event.clipboardData.items).filter((entry) => entry.kind === 'file' && entry.type.startsWith('image/')).map((entry) => entry.getAsFile()).filter((file): file is File => !!file)
    if (!files.length) return
    event.preventDefault()
    void appendPhotos(files)
  }

  const onUrlBlur = () => {
    if (!draft.url.trim() || draft.shop.trim()) return
    const shop = shopFromUrl(draft.url)
    if (shop) set('shop', shop)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const result = validate(draft)
    setErrors(result.errors)
    if (!result.input) {
      const first = Object.keys(result.errors)[0]
      if (first === 'flat') document.getElementById(id('flat'))?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      else if (first === 'colors') document.getElementById(id('colors-title'))?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      else document.getElementById(id(first))?.focus()
      return
    }
    onSubmit({
      ...result.input,
      photosToAdd: pendingPhotos.map(({ file, colorFamily }) => ({ file, colorFamily })),
      photoIdsToRemove: removedPhotoIds,
      photoColorAssignments: existingPhotos.map((photo) => ({ photoId: photo.id, colorFamily: photoColorById[photo.id] ?? null })),
    })
  }

  const described = (name: keyof Errors) => (errors[name] ? `${id(name)}-error` : undefined)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim sm:items-center sm:p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={id('title')}
        noValidate
        onSubmit={submit}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !saving) onCancel()
        }}
        onPaste={pastePhotos}
        className="flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden rounded-none bg-card shadow-sheet sm:h-auto sm:max-h-[92dvh] sm:max-w-2xl sm:rounded-block sm:shadow-float"
      >
        <div className="flex items-center gap-2 border-b-[1.5px] border-dashed border-line-strong px-5 py-3">
          <h2 id={id('title')} className="m-0 font-hd text-xl">{title ?? (editing ? '編輯商品' : '加入選購清單')}</h2>
          <button type="button" onClick={onCancel} disabled={saving} aria-label="關閉" className="ml-auto flex size-11 items-center justify-center rounded-btn bg-transparent text-ink-2 hover:bg-tile">
            <Icon name="x" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          <section aria-labelledby={id('photos-title')} onDragOver={(event) => { event.preventDefault(); setDraggingPhotos(true) }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDraggingPhotos(false) }} onDrop={(event) => { event.preventDefault(); setDraggingPhotos(false); void appendPhotos(event.dataTransfer.files) }} className={`space-y-2 rounded-tile ${draggingPhotos ? 'bg-mist-soft ring-2 ring-mist-deep' : ''}`}>
            <div className="flex items-center gap-2">
              <h3 id={id('photos-title')} className="m-0 text-[13px] font-medium text-ink">圖片</h3>
              <span className="text-xs text-ink-3">選填・張數不限</span>
              <Button type="button" variant="secondary" className="ml-auto h-10 px-3 text-xs" disabled={preparingPhotos} onClick={() => photoInputRef.current?.click()}><Icon name="plus" size={15} />{preparingPhotos ? '處理中…' : '新增圖片'}</Button>
              <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple aria-label="選擇商品圖片，可多選" className="sr-only" onChange={(event) => { if (event.target.files) void appendPhotos(event.target.files); event.target.value = '' }} />
            </div>
            {visiblePhotos.length > 0 ? <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{visiblePhotos.map((photo, index) => {
              const url = 'file' in photo ? photo.url : photo.url ?? photo.path
              const name = 'file' in photo ? photo.file.name : `商品圖片 ${index + 1}`
              const colorValue = photo.colorFamily ?? (photo.id in photoColorById ? photoColorById[photo.id] : null)
              const colorOptions = [{ value: '__none__', label: '未標顏色' }, ...draft.colors.map((color) => ({ value: color.family, label: color.family }))]
              return <div key={photo.id} className="min-w-0 space-y-1.5">
                <div className="relative aspect-square overflow-hidden rounded-sm border border-line bg-paper">
                  {url ? <img src={url} alt={`${name}${index === 0 ? '，封面' : ''}`} className="size-full object-cover" loading="lazy" /> : <div className="flex size-full items-center justify-center text-xs text-ink-3">無法預覽</div>}
                  {index === 0 && <span className="absolute bottom-1 left-1 rounded-full bg-ink px-2 py-0.5 text-[10px] text-paper">封面</span>}
                  <button type="button" aria-label={`移除${name}`} onClick={() => removePhoto(photo.id)} className="absolute right-1 top-1 flex size-9 items-center justify-center rounded-full bg-card/95 text-ink"><Icon name="x" size={15} /></button>
                </div>
                <Select label={`${name}對應顏色`} value={colorValue ?? '__none__'} options={colorOptions} onChange={(value) => setPhotoColor(photo.id, value === '__none__' ? null : value)} placeholder="圖片顏色" triggerClassName="h-9 w-full rounded-sm border border-line bg-card px-2 text-[11px]" />
              </div>
            })}</div> : <p className="m-0 rounded-tile border-[1.5px] border-dashed border-line-strong px-3 py-3 text-xs text-ink-2">可貼上、拖曳或選取商品圖、尺寸表與細節照；每張可標記對應顏色。</p>}
            {photoError && <p role="alert" className="m-0 text-xs text-rose-deep">{photoError}</p>}
          </section>
          <Field label="商品名稱" htmlFor={id('name')} error={errors.name} required>
            <input id={id('name')} value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="例：奶油白羊毛混紡寬褲" aria-invalid={!!errors.name} aria-describedby={described('name')} aria-required="true" className={inputClass} maxLength={80} />
          </Field>

          <fieldset className="m-0 space-y-2 border-0 border-t-[1.5px] border-dashed border-line py-4">
            <legend className="px-0 text-[13px] font-medium text-ink">主要部位 <span className="text-rose-deep">*</span><span className="ml-2 font-normal text-ink-2">選最常怎麼穿；分類和統計使用這個</span></legend>
            <div id={id('primaryPart')} role="radiogroup" aria-label="主要部位" aria-describedby={errors.primaryPart ? `${id('primaryPart')}-error` : undefined} className="flex flex-wrap gap-2">
              {SLOTS.map((slot) => <label key={slot.slot} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-[1.5px] px-3 text-sm ${draft.primaryPart === slot.slot ? 'border-ink bg-ink text-paper' : 'border-line bg-card text-ink'} focus-within:ring-2 focus-within:ring-mist-deep`}>
                <input type="radio" name={id('primaryPart')} value={slot.slot} checked={draft.primaryPart === slot.slot} onChange={() => { set('primaryPart', slot.slot); set('alsoParts', draft.alsoParts.filter((part) => part !== slot.slot)) }} className="size-4 accent-[var(--color-mist-deep)]" />
                <span>{slot.label}</span>
              </label>)}
            </div>
            {errors.primaryPart && <p id={`${id('primaryPart')}-error`} className="m-0 text-xs text-rose-deep">{errors.primaryPart}</p>}
          </fieldset>

          <fieldset className="m-0 space-y-2 border-0 border-t-[1.5px] border-dashed border-line py-4">
            <legend className="px-0 text-[13px] font-medium text-ink">也可以當 <span className="ml-2 font-normal text-ink-2">選填・可複選；今日搭配的其他部位也能找到</span></legend>
            <div className="flex flex-wrap gap-2">
              {SLOTS.filter((slot) => slot.slot !== draft.primaryPart).map((slot) => <label key={slot.slot} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-[1.5px] px-3 text-sm ${draft.alsoParts.includes(slot.slot) ? 'border-mist-deep bg-mist-soft text-mist-ink' : 'border-dashed border-line-strong bg-card text-ink'} focus-within:ring-2 focus-within:ring-mist-deep`}>
                <input type="checkbox" checked={draft.alsoParts.includes(slot.slot)} onChange={(event) => set('alsoParts', event.target.checked ? [...draft.alsoParts, slot.slot] : draft.alsoParts.filter((part) => part !== slot.slot))} className="size-4 accent-[var(--color-mist-deep)]" />
                <span>{slot.label}</span>
              </label>)}
            </div>
          </fieldset>

          <section aria-labelledby={id('colors-title')} className="space-y-3 border-t-[1.5px] border-dashed border-line py-4">
            <div className="flex items-baseline gap-2"><h3 id={id('colors-title')} className="m-0 font-hd text-lg">考慮中的顏色</h3><span className="text-xs text-ink-2">可複選</span></div>
            {draft.colors.length > 0 && <div className="space-y-2">
              {draft.colors.map((color, colorIndex) => {
                const photoCount = visiblePhotos.filter((photo) => (photo.id in photoColorById ? photoColorById[photo.id] : photo.colorFamily ?? null) === color.family).length
                return <div key={colorIndex} className="flex min-w-0 flex-wrap items-center gap-2 rounded-tile bg-paper p-2">
                  <label className="relative size-9 flex-none cursor-pointer overflow-hidden rounded-sm border border-ink/15" title={`選擇${color.family || '顏色'}色彩`}>
                    <span aria-hidden="true" className="absolute inset-0" style={{ background: resolvedColor(color) }} />
                    <input type="color" value={resolvedColor(color)} onChange={(event) => set('colors', draft.colors.map((entry, index) => index === colorIndex ? { ...entry, hex: event.target.value.toUpperCase() } : entry))} aria-label={`選擇${color.family || '自訂'}顏色`} className="absolute inset-0 size-full cursor-pointer opacity-0" />
                  </label>
                  {editingColorIndex === colorIndex ? <input autoFocus value={color.family} onChange={(event) => renameColor(color.family, event.target.value)} onBlur={() => setEditingColorIndex(null)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); setEditingColorIndex(null) } else if (event.key === 'Escape') setEditingColorIndex(null) }} aria-label="自訂顏色名稱" placeholder="顏色名稱" className="h-11 w-24 min-w-0 rounded-sm border border-line bg-card px-2 text-sm font-medium text-ink" /> : <button type="button" onClick={() => setEditingColorIndex(colorIndex)} aria-label={`編輯${color.family || '顏色'}名稱`} className="h-11 min-w-12 rounded-sm px-1 text-left text-sm font-medium text-ink hover:bg-card focus-visible:outline-2 focus-visible:outline-mist-deep">{color.family || '命名顏色'}</button>}
                  <span className="min-w-0 flex-1 text-xs text-ink-2">{photoCount ? `${photoCount} 張圖片` : ''}</span>
                  <label className="flex items-center gap-1 text-[11px] text-ink-2">HEX<input value={color.hex ?? ''} onChange={(event) => { const hex = event.target.value.trim(); set('colors', draft.colors.map((entry, index) => index === colorIndex ? { ...entry, hex: hex ? hex.toUpperCase() : undefined } : entry)) }} placeholder="選填" aria-label={`${color.family || '自訂'}色碼`} className="h-11 w-24 rounded-sm border border-line bg-card px-2 font-num text-xs" /></label>
                  <button type="button" aria-label={`移除${color.family}`} onClick={() => toggleColorFamily(color.family)} className="flex size-11 items-center justify-center rounded-btn text-ink-2 hover:bg-tile"><Icon name="x" size={16} /></button>
                </div>
              })}
            </div>}
            <div role="group" aria-label="從色系新增顏色" className="flex flex-wrap gap-2">
              {COLOR_FAMILIES.map((color) => {
                const selected = draft.colors.some((entry) => entry.family === color.name)
                return <button key={color.name} type="button" aria-label={`${selected ? '移除' : '加入'}${color.name}色`} aria-pressed={selected} title={color.name} onClick={() => toggleColorFamily(color.name)} className={`flex size-11 items-center justify-center rounded-sm ${selected ? 'ring-2 ring-ink ring-offset-2 ring-offset-card' : ''}`}>
                  <span className="size-8 rounded-sm border border-ink/15" style={{ background: color.hex }} />
                </button>
              })}
            </div>
            {errors.colors && <p role="alert" className="m-0 text-xs text-rose-deep">{errors.colors}</p>}
            <p className="m-0 text-xs leading-5 text-ink-2">買的時候再選定顏色；選多色會各建立一件衣物。圖片也可標記對應顏色。</p>
          </section>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1.5"><span className="text-[13px] font-medium text-ink">店家／網站</span><Combobox label="店家／網站" entityName="通路" value={draft.shop} options={shopSuggestions} onChange={(value) => set('shop', value)} placeholder="選擇或輸入店家／網站" manageHref="/me/shops" /><span id={`${id('shop')}-hint`} className="text-xs text-ink-2">留空會顯示「尚未決定」。</span></div>
            <div className="flex min-w-0 flex-col gap-1.5"><span className="text-[13px] font-medium text-ink">品牌</span><Combobox label="品牌" entityName="品牌" value={draft.brand} options={brandSuggestions} onChange={(value) => set('brand', value)} placeholder="選擇或輸入品牌" manageHref="/me/brands" /></div>
          </div>
          {draft.primaryPart === 'top' && <Field label="領口尺寸（cm）" htmlFor={id('necklineSize')} error={errors.necklineSize} hint="選填；衣領尺寸或領圍"><input id={id('necklineSize')} type="number" min="0" step="0.1" inputMode="decimal" value={draft.necklineSize} onChange={(event) => set('necklineSize', event.target.value)} placeholder="選填" aria-invalid={!!errors.necklineSize} className={`${inputClass} font-num tabular`} /></Field>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="價格" htmlFor={id('price')} error={errors.price} required>
              <input id={id('price')} inputMode="numeric" value={draft.price} onChange={(e) => set('price', e.target.value)} placeholder="2990" aria-invalid={!!errors.price} aria-describedby={described('price')} aria-required="true" className={`${inputClass} font-num tabular`} />
            </Field>
            <Field label="運費" htmlFor={id('shipping')} error={errors.shipping}>
              <input id={id('shipping')} inputMode="numeric" value={draft.shipping} onChange={(e) => set('shipping', e.target.value)} placeholder="免運填 0" aria-invalid={!!errors.shipping} aria-describedby={described('shipping')} className={`${inputClass} font-num tabular`} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="預計尺寸" htmlFor={id('size')}>
              <input id={id('size')} value={draft.size} onChange={(e) => set('size', e.target.value)} placeholder="例：S、36、EU 37.5" className={inputClass} />
            </Field>
            <Field label="尺寸備註" htmlFor={id('sizeNote')}>
              <MarkdownNoteField id={id('sizeNote')} value={draft.sizeNote} onChange={(value) => set('sizeNote', value)} rows={2} placeholder="例：36 有貨、只剩 L、肩寬 39 cm" className="w-full min-w-0 rounded-btn border-[1.5px] border-line bg-card px-3 py-2.5 text-sm leading-6 text-ink placeholder:text-ink-3" />
            </Field>
          </div>

          {fields.length > 0 && <section id={id('flat')} aria-labelledby={id('flat-title')} className="space-y-2.5">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h3 id={id('flat-title')} className="m-0 text-[13px] font-medium text-ink">平放尺寸</h3>
              <span className="text-xs text-ink-2">依「{SLOTS.find((slot) => slot.slot === draft.primaryPart)?.label}」顯示・cm・支援平放／可拉伸範圍</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {fields.map((field) => <FlatMeasureField key={field.key} field={field} body={body} value={draft.flat[field.key] ?? { text: '' }} onChange={(value) => set('flat', { ...draft.flat, [field.key]: value })} />)}
            </div>
            {errors.flat && <p id={`${id('flat')}-error`} role="alert" className="m-0 text-xs text-rose-deep">{errors.flat}</p>}
          </section>}

          {matchedRuleAlerts.length > 0 && <section role="status" aria-live="polite" aria-label="覆盤規則提醒" className="space-y-2 rounded-tile border-[1.5px] border-dashed border-oat-edge bg-oat-soft p-3.5 text-ink">
            <h3 className="m-0 flex items-center gap-2 text-sm font-bold"><Icon name="alert" size={17} />你之前記下的挑選提醒</h3>
            <ul className="m-0 space-y-2 p-0">
              {matchedRuleAlerts.map(({ rule, detail, mismatch, stretchOk }) => <li key={rule.id} className={`list-none rounded-sm px-3 py-2 text-[13px] leading-5 ${mismatch ? 'bg-rose-soft text-rose-ink' : stretchOk ? 'bg-card text-oat-ink' : 'bg-card/80 text-ink-2'}`}>
                {stretchOk && <span className="block text-sm font-bold text-oat-ink">有彈性，可能可以</span>}
                <span className="font-medium text-ink">{rule.scope}・{rule.text}</span>
                <span className="mt-0.5 block">{detail ?? rule.why}</span>
              </li>)}
            </ul>
            <p className="m-0 text-[11px] leading-5 text-ink-2">只提醒、不會阻擋加入；同一條規則 7 天內最多提醒一次。</p>
          </section>}

          <section aria-labelledby={id('notes-title')} className="space-y-2 border-t-[1.5px] border-dashed border-line py-4">
            <div className="flex items-baseline gap-2"><h3 id={id('notes-title')} className="m-0 font-hd text-lg">備註</h3><span className="text-xs text-ink-2">選填</span></div>
            <Field label="想買的理由或商品備註" htmlFor={id('reason')}>
              <MarkdownNoteField id={id('reason')} value={draft.reason} onChange={(value) => set('reason', value)} rows={3} placeholder="例：羅紋有彈性，模特兒說扣起來剛好" className="w-full min-w-0 rounded-btn border-[1.5px] border-line bg-card px-3 py-2.5 text-sm leading-6 text-ink placeholder:text-ink-3" />
            </Field>
          </section>

          <section aria-labelledby={id('url-title')} className="space-y-2 border-t-[1.5px] border-dashed border-line py-4">
            <div className="flex items-baseline gap-2"><h3 id={id('url-title')} className="m-0 font-hd text-lg">商品網址</h3><span className="text-xs text-ink-2">選填</span></div>
            <Field label="商品連結" htmlFor={id('url')} error={errors.url} hint="只儲存網址，不會開啟或擷取網頁內容。">
              <div className="relative">
                <span className="pointer-events-none absolute top-[12px] left-3 text-ink-3"><Icon name="link" size={18} /></span>
                <input id={id('url')} type="url" inputMode="url" value={draft.url} onChange={(event) => set('url', event.target.value)} onBlur={onUrlBlur} placeholder="https://" aria-invalid={!!errors.url} aria-describedby={described('url') ?? `${id('url')}-hint`} className={`${inputClass} pl-[38px]`} />
              </div>
            </Field>
            {draft.url.trim() && shopFromUrl(draft.url) && <p role="status" className="m-0 rounded-sm bg-sage-soft px-3 py-2 text-xs text-sage-ink">依網址網域辨識店家：<b>{shopFromUrl(draft.url)}</b>{draft.shop ? '；店家欄已有內容，不會覆蓋。' : '；離開網址欄後填入店家欄。'}</p>}
            <p className="m-0 text-xs leading-5 text-ink-2">只看網址字串判斷網域，不會抓網頁資料；商品資訊請自行填寫或貼圖。</p>
          </section>

          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-1.5 p-0 text-[13px] font-medium text-ink">優先程度</legend>
            <div className="flex flex-wrap gap-2">
              {PRIORITY_OPTIONS.map((p) => (
                <Chip key={p} selected={draft.priority === p} onClick={() => set('priority', draft.priority === p ? null : p)} className="h-11 min-w-14 justify-center">
                  {PRIORITY_LABEL[p]}
                </Chip>
              ))}
            </div>
          </fieldset>

          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-1.5 p-0 text-[13px] font-medium text-ink">狀態</legend>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((s) => (
                <Chip key={s} selected={draft.status === s} onClick={() => set('status', s)} className="h-11">
                  {WISH_STATUS[s].label}
                </Chip>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="退換貨" htmlFor={id('returnPolicy')}>
              <input id={id('returnPolicy')} value={draft.returnPolicy} onChange={(e) => set('returnPolicy', e.target.value)} placeholder="例：30 天內可退" className={inputClass} />
            </Field>
          </div>

          <fieldset className="m-0 space-y-3 border-0 p-0">
            <legend className="mb-1 flex w-full items-center gap-2 text-[13px] font-medium text-ink">材質<span className="text-[11px] font-normal text-ink-3">選填比例</span><Link to="/me/materials" target="_blank" className="ml-auto flex min-h-11 items-center gap-1 text-xs font-medium text-mist-deep">管理材質<Icon name="link" size={13} /><span className="sr-only">（在新分頁開啟）</span></Link></legend>
            <div className="flex flex-wrap gap-2">{materials.map((material) => <Chip key={material.name} selected={materialNames(draft.material).includes(material.name)} onClick={() => toggleMaterial(material.name)} className="h-10">{material.name}</Chip>)}</div>
            {materialNames(draft.material).length > 0 && <div role="group" aria-label="材質比例" className="space-y-2 rounded-tile bg-paper p-3">
              {materialNames(draft.material).map((material, index) => <label key={material} htmlFor={`${id('materialPercent')}-${index}`} className="grid grid-cols-[minmax(0,1fr)_112px_40px] items-center gap-2 text-sm"><span className="min-w-0 truncate">{material}</span><span className="flex h-11 min-w-0 items-center rounded-btn border-[1.5px] border-line bg-card px-2.5 focus-within:border-mist-deep"><input id={`${id('materialPercent')}-${index}`} type="number" min="0" max="100" step="0.1" inputMode="decimal" value={draft.materialPercentages[material] ?? ''} onChange={(event) => set('materialPercentages', { ...draft.materialPercentages, [material]: event.target.value })} aria-label={`${material}比例`} className="min-w-0 flex-1 bg-transparent text-right font-num outline-none" /><span className="ml-1 text-ink-2">%</span></span><button type="button" aria-label={`移除${material}`} onClick={() => toggleMaterial(material)} className="flex size-10 items-center justify-center rounded-btn text-ink-2 hover:bg-tile"><Icon name="x" size={16} /></button></label>)}
              {errors.materialPercentages && <span role="alert" className="text-xs text-rose-deep">{errors.materialPercentages}</span>}
            </div>}
            {draft.materialComposition && <details className="text-xs text-ink-3"><summary className="min-h-9 cursor-pointer">舊版成分文字</summary><input value={draft.materialComposition} onChange={(event) => set('materialComposition', event.target.value)} aria-label="舊版成分文字" className={inputClass} /></details>}
          </fieldset>

          {!editing && (
            <p className="m-0 text-xs text-ink-2">需要去背或更完整的衣物資料？可使用 <Link to="/closet/new">新增衣物流程</Link>，最後一步選「選購清單」。</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t-[1.5px] border-dashed border-line-strong px-5 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
          {onDelete && (
            <Button variant="ghost" className="text-rose-deep" onClick={onDelete} disabled={saving}>
              刪除
            </Button>
          )}
          <Button variant="secondary" className="ml-auto" onClick={onCancel} disabled={saving}>取消</Button>
          <Button type="submit" variant="primary" disabled={saving} aria-busy={saving}>
            {saving ? '儲存中…' : editing ? '儲存變更' : '加入清單'}
          </Button>
        </div>
      </form>
    </div>
  )
}
