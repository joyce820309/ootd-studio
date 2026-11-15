import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ItemImage } from '@/components/closet/ItemImage'
import { Button, ButtonLink } from '@/components/ui/Button'
import { DatePicker } from '@/components/ui/DatePicker'
import { Icon } from '@/components/ui/Icon'
import { LoadingState, PageState } from '@/components/ui/PageState'
import { PaperCard, TiltLabel } from '@/components/ui/Paper'
import { Select } from '@/components/ui/Select'
import { StickyNote } from '@/components/ui/StickyNote'
import { addClosetItemPhotos, copyClosetItem, fetchCategories, fetchClosetItemDetail, fetchReviewForItem } from '@/lib/data'
import { GARMENT_COLORS } from '@/lib/colors'
import { todayISO } from '@/lib/date'
import { appraisalEnd, exchangeChecks, FLAT_LABELS } from '@/lib/review'
import type { Category, ClosetItem, ReviewRecord, Slot } from '@/types'

type FieldStatus = 'keep' | 'changed' | 'need'
const STATUS_LABEL: Record<FieldStatus, string> = { keep: '沿用', changed: '已改', need: '要重填' }
const STATUS_TAG: Record<FieldStatus, string> = {
  keep: 'bg-tile text-ink-2',
  changed: 'bg-sage-soft text-sage-ink',
  need: 'bg-card text-oat-ink ring-[1.5px] ring-oat-edge ring-inset',
}
const FIELD_BORDER: Record<FieldStatus, string> = {
  keep: 'border-line bg-card',
  changed: 'border-sage bg-sage-soft/40',
  need: 'border-oat-edge bg-oat-soft/40',
}
const DEFAULT_FLAT_KEYS: Record<Slot, string[]> = {
  top: ['shoulder', 'chest', 'waist', 'length', 'sleeve'],
  outer: ['shoulder', 'chest', 'waist', 'length', 'sleeve'],
  bottom: ['waist', 'hip', 'thigh', 'rise', 'length', 'hem'],
  shoes: ['innerLength', 'heelHeight'],
  bag: ['width', 'height', 'depth'],
  acc: [],
}
const NUMERALS = ['', '一', '兩', '三', '四']

interface Source {
  item: ClosetItem
  review: ReviewRecord | null
  categories: Category[]
}

interface PhotoOption {
  key: string
  label: string
  url?: string
  /** 'cutout' 或 item_photos 的路徑 */
  path: string
}

interface FormState {
  name: string
  brand: string
  categoryId: string
  colorName: string
  colorHex: string
  size: string
  material: string
  store: string
  price: string
  purchaseDate: string
  receivedOn: string
  flat: Record<string, string>
  keepNote: boolean
}

const shortDate = (iso: string) => iso.slice(5).replace('-', '/')

function StatusTag({ status }: { status: FieldStatus }) {
  return <span className={`inline-flex h-6 flex-none items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap ${STATUS_TAG[status]}`}>{STATUS_LABEL[status]}</span>
}

/** 一列欄位：桌面「標籤｜欄位｜狀態」三欄；手機標籤和狀態在上、欄位在下 */
function Row({ label, htmlFor, status, hint, children }: { label: string; htmlFor?: string; status?: FieldStatus; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1.5 border-t-[1.5px] border-dashed border-line py-3.5 first:border-t-0 md:grid-cols-[96px_minmax(0,1fr)_76px]">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="pt-0 text-[13px] font-bold md:pt-3">{label}</label>
      ) : (
        <span className="pt-0 text-[13px] font-bold md:pt-3">{label}</span>
      )}
      <span className="justify-self-end md:order-last md:justify-self-start md:pt-2.5">{status && <StatusTag status={status} />}</span>
      <div className="col-span-2 flex min-w-0 flex-col gap-1.5 md:col-span-1">
        {children}
        {hint && <span className="text-xs leading-5 text-ink-2">{hint}</span>}
      </div>
    </div>
  )
}

/** B17.2／BM14.2：換貨的下一步、衣物詳細的「複製這件」。所有欄位先填好，每欄標狀態。 */
export function CopyItemPage({ fromId, reason }: { fromId: string; reason: string | null }) {
  const navigate = useNavigate()
  const [source, setSource] = useState<Source | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  // 從衣物詳細或標記對話框過來時，畫面從頂端開始
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [fromId])

  useEffect(() => {
    let alive = true
    Promise.all([fetchClosetItemDetail(fromId), reason === 'exchange' ? fetchReviewForItem(fromId) : Promise.resolve(null), fetchCategories()])
      .then(([item, review, categories]) => {
        if (!alive) return
        setSource(item ? { item, review, categories } : null)
        setLoaded(true)
      })
      .catch((cause) => {
        if (alive) setLoadError(cause instanceof Error ? cause.message : '讀取原本的衣物失敗。')
      })
    return () => {
      alive = false
    }
  }, [fromId, reason])

  if (loadError) {
    return (
      <main className="mx-auto max-w-[1240px] px-4 pt-6 pb-16 md:px-12">
        <PageState icon="alert" tone="rose" title="沒能讀到原本那件" description={loadError} action={<ButtonLink to="/closet" variant="primary">回我的衣櫃</ButtonLink>} />
      </main>
    )
  }
  if (!loaded) {
    return (
      <main className="mx-auto max-w-[1240px] px-4 pt-6 pb-16 md:px-12">
        <LoadingState label="正在複製資料…" rows={4} />
      </main>
    )
  }
  if (!source) {
    return (
      <main className="mx-auto max-w-[1240px] px-4 pt-6 pb-16 md:px-12">
        <PageState icon="closet" title="找不到原本那件" description="可能已經刪除。可以改用一般的新增衣物。" action={<ButtonLink to="/closet/new" variant="primary">新增衣物</ButtonLink>} />
      </main>
    )
  }
  return <CopyItemForm source={source} onDone={(id) => navigate(`/closet/${id}`, { replace: true })} />
}

function CopyItemForm({ source, onDone }: { source: Source; onDone: (id: string) => void }) {
  const { item, review, categories } = source
  const exchange = review?.decision === 'exchanged' ? review : null
  const kind = exchange?.exchangeKind
  const sizeChanged = kind === 'size' || kind === 'other'
  const fileInput = useRef<HTMLInputElement>(null)

  const flatKeys = useMemo(() => {
    const own = Object.entries(item.flatMeasurements ?? {}).filter(([, value]) => typeof value === 'number').map(([key]) => key)
    return [...new Set([...own, ...DEFAULT_FLAT_KEYS[item.slot]])]
  }, [item])

  const initial = useMemo<FormState>(() => {
    const color = kind === 'color' && exchange?.exchangeColorName && exchange.exchangeColorHex ? { name: exchange.exchangeColorName, hex: exchange.exchangeColorHex } : { name: item.colorName, hex: item.colorHex }
    return {
      name: kind === 'other' ? '' : item.name,
      brand: item.brand ?? '',
      categoryId: item.categoryId,
      colorName: color.name,
      colorHex: color.hex,
      size: kind === 'size' ? exchange?.exchangeSize ?? '' : kind === 'other' ? '' : item.size ?? '',
      material: kind === 'other' ? '' : item.materialComposition || item.material || '',
      store: item.store ?? '',
      price: item.purchasePrice != null ? String(item.purchasePrice + (exchange?.exchangeExtra ?? 0)) : '',
      purchaseDate: item.purchaseDate ?? '',
      receivedOn: '',
      flat: Object.fromEntries(flatKeys.map((key) => [key, sizeChanged ? '' : item.flatMeasurements?.[key] != null ? String(item.flatMeasurements[key]) : ''])),
      keepNote: false,
    }
  }, [item, exchange, kind, flatKeys, sizeChanged])

  const [form, setForm] = useState<FormState>(initial)
  const photoOptions = useMemo<PhotoOption[]>(() => {
    const options: PhotoOption[] = []
    if (item.cutoutPath || (!item.photos?.length && item.cutoutUrl)) options.push({ key: 'cutout', label: '去背圖', url: item.cutoutUrl, path: 'cutout' })
    for (const [index, photo] of (item.photos ?? []).entries()) options.push({ key: photo.id, label: photo.isCover ? '封面照片' : `照片 ${index + 1}`, url: photo.url, path: photo.path })
    return options
  }, [item])
  // 換顏色時，去背圖和照片預設不勾，建議重拍
  const [photoOn, setPhotoOn] = useState<Set<string>>(() => new Set(kind === 'color' ? [] : photoOptions.map((option) => option.key)))
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }))

  /** 欄位狀態：要重填的欄位填了就算已改；其他和原本一樣是沿用 */
  const statusOf = (key: keyof FormState, mustRefill = false): FieldStatus => {
    const value = form[key]
    const original =
      key === 'name' ? item.name : key === 'size' ? item.size ?? '' : key === 'material' ? item.materialComposition || item.material || '' : key === 'colorName' ? item.colorName : key === 'price' ? (item.purchasePrice != null ? String(item.purchasePrice) : '') : (initial[key] as string)
    if (mustRefill) return value ? 'changed' : 'need'
    return value === original ? 'keep' : 'changed'
  }
  const flatFilled = flatKeys.some((key) => form.flat[key])
  const flatStatus: FieldStatus = sizeChanged ? (flatFilled ? 'changed' : 'need') : flatKeys.every((key) => form.flat[key] === initial.flat[key]) ? 'keep' : 'changed'

  const statuses: FieldStatus[] = [
    statusOf('name', kind === 'other'),
    statusOf('brand'),
    statusOf('categoryId'),
    statusOf('colorName'),
    statusOf('size', kind === 'other'),
    statusOf('material'),
    statusOf('store'),
    statusOf('price'),
    statusOf('purchaseDate'),
    ...(exchange ? [statusOf('receivedOn', true)] : []),
    flatStatus,
  ]
  const counts = { keep: statuses.filter((s) => s === 'keep').length, changed: statuses.filter((s) => s === 'changed').length, need: statuses.filter((s) => s === 'need').length }

  const checks = exchange ? exchangeChecks(exchange.reasons) : []
  const sourceLabel = `${item.name}${item.size ? `・${item.size}` : ''}`
  const backTo = exchange ? `/closet/${item.id}/review` : `/closet/${item.id}`

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.name.trim()) return setError('請填品名。')
    if (form.price.trim() && !/^\d+(\.\d+)?$/.test(form.price.trim())) return setError('價格請填數字。')
    const flatMeasurements: Record<string, number | null> = {}
    for (const key of flatKeys) {
      const raw = form.flat[key]?.trim()
      if (!raw) continue
      if (!/^\d+(\.\d+)?$/.test(raw)) return setError(`${FLAT_LABELS[key] ?? key}請填數字。`)
      flatMeasurements[key] = Number(raw)
    }
    setError(null)
    setSaving(true)
    try {
      const materialChanged = form.material !== (item.materialComposition || item.material || '')
      const { id } = await copyClosetItem(item, {
        name: form.name,
        categoryId: form.categoryId,
        colorName: form.colorName,
        colorHex: form.colorHex,
        secondColorHex: kind === 'color' ? undefined : item.secondColorHex,
        brand: form.brand,
        size: form.size,
        material: materialChanged ? form.material : item.material,
        materialComposition: materialChanged ? form.material : item.materialComposition,
        materialPercentages: materialChanged ? undefined : (item.materialPercentages as Record<string, number> | undefined),
        seasons: item.seasons ?? [],
        purchaseDate: form.purchaseDate || undefined,
        purchasePrice: form.price.trim() ? Number(form.price) : null,
        store: form.store,
        productUrl: kind === 'other' ? undefined : item.productUrl,
        note: form.keepNote ? item.note : undefined,
        flatMeasurements,
        receivedOn: exchange ? form.receivedOn || undefined : undefined,
        exchangedFrom: exchange ? item.id : undefined,
        status: exchange && !form.receivedOn ? 'not_arrived' : 'ok',
        copyCutout: photoOn.has('cutout'),
        photoPaths: photoOptions.filter((option) => option.key !== 'cutout' && photoOn.has(option.key)).map((option) => option.path),
      })
      if (newFiles.length) await addClosetItemPhotos(id, newFiles)
      onDone(id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '沒能存成新衣物，請再試一次。')
      setSaving(false)
    }
  }

  const input = (status: FieldStatus) => `h-11 w-full rounded-btn border-[1.5px] px-3 text-sm text-ink ${FIELD_BORDER[status]}`

  const photosCard = (
    <PaperCard className="flex flex-col gap-3 p-4">
      <h2 className="m-0 text-sm font-bold">
        照片 <span className="text-xs font-normal text-ink-2">同款可以沿用</span>
      </h2>
      <div className="grid grid-cols-3 gap-2.5">
        {photoOptions.map((option) => {
          const on = photoOn.has(option.key)
          return (
            <label key={option.key} className={`relative flex cursor-pointer flex-col gap-1 ${on ? '' : 'opacity-60'}`}>
              <input
                type="checkbox"
                checked={on}
                onChange={() =>
                  setPhotoOn((current) => {
                    const next = new Set(current)
                    if (next.has(option.key)) next.delete(option.key)
                    else next.add(option.key)
                    return next
                  })
                }
                aria-label={`沿用${option.label}`}
                className="peer absolute top-1.5 left-1.5 z-[1] size-5 accent-ink"
              />
              <span className={`flex aspect-square items-center justify-center overflow-hidden rounded-tile bg-tile p-1.5 ${on ? 'ring-2 ring-ink' : ''} peer-focus-visible:outline peer-focus-visible:outline-[2.5px] peer-focus-visible:outline-mist-deep`}>
                {option.url ? <img src={option.url} alt="" className="max-h-full max-w-full object-contain" /> : <ItemImage name={item.name} shape={item.shape} colorHex={item.colorHex} className="max-h-full max-w-full" />}
              </span>
              <span className="text-center text-xs text-ink-2">{option.label}</span>
            </label>
          )
        })}
        {newFiles.map((file) => (
          <span key={file.name + file.size} className="flex flex-col gap-1">
            <span className="flex aspect-square items-center justify-center rounded-tile bg-mist-soft p-1.5 text-center text-xs break-all text-mist-ink">{file.name}</span>
            <span className="text-center text-xs text-ink-2">新照片</span>
          </span>
        ))}
        <button type="button" onClick={() => fileInput.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-tile border-[1.5px] border-dashed border-line-strong text-xs text-mist-deep" aria-label="加新照片">
          <Icon name="plus" />
          加新照片
        </button>
      </div>
      <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(event) => setNewFiles((current) => [...current, ...Array.from(event.target.files ?? [])].slice(0, 8))} />
      {kind === 'color' && <p className="m-0 text-xs leading-5 text-ink-2">換顏色時，去背圖和照片預設不勾，建議重拍。</p>}
      {photoOptions.length === 0 && <p className="m-0 text-xs leading-5 text-ink-2">原本那件沒有照片，可以加新的，也可以之後再補。</p>}
    </PaperCard>
  )

  const checksNote = checks.length > 0 && (
    <StickyNote
      id={`checks-${item.id}`}
      tone="rose"
      variant="mixed"
      title={`收到後試穿這${NUMERALS[checks.length] ?? ` ${checks.length} `}處`}
      headingLevel="h2"
      items={checks}
      collapsible={false}
      footnote={form.receivedOn ? `來自上次的踩雷原因・鑑賞期到 ${shortDate(appraisalEnd(form.receivedOn))}` : '來自上次的踩雷原因・鑑賞期從收到日起算 7 天'}
    />
  )

  return (
    <main className="mx-auto flex max-w-[1240px] flex-col gap-4 px-4 pt-2 pb-16 md:gap-5 md:px-[clamp(16px,4vw,48px)] md:pt-6">
      <nav aria-label="麵包屑" className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-2">
        <Link to={backTo} className="inline-flex min-h-11 items-center gap-1 text-ink-2 no-underline hover:text-ink md:hidden">
          <Icon name="back" size={16} />
          上一步
        </Link>
        <Link to="/closet" className="hidden min-h-11 items-center text-ink-2 md:inline-flex">我的衣櫃</Link>
        <span aria-hidden="true" className="hidden md:inline">/</span>
        <span className="hidden md:inline">新增衣物</span>
      </nav>

      <div className="flex flex-wrap items-center gap-3.5">
        <TiltLabel accent="oat" className="hidden md:inline-flex">{exchange ? '換貨' : '複製'}</TiltLabel>
        <h1 className="m-0 font-hd text-[24px] md:text-[30px]">{exchange ? '建立換到的那件' : '複製這件'}</h1>
      </div>

      <div role="note" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-tile bg-oat-soft px-4 py-3 text-[13px] leading-6 text-oat-ink">
        <Icon name="merge" size={18} />
        <span className="min-w-[min(100%,240px)] flex-1 basis-[calc(100%-30px)] md:basis-0">
          從「{sourceLabel}」複製，資料都帶過來了，只要看一下標成「已改」和「要重填」的欄位。
          {exchange && '舊的那件已標成「已換貨」，留在踩雷筆記本。'}
        </span>
        <span className="flex flex-wrap gap-1.5">
          {(['keep', 'changed', 'need'] as const).map((status) => (
            <span key={status} className={`inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-medium ${STATUS_TAG[status]}`}>
              {STATUS_LABEL[status]} <span className="font-num tabular">{counts[status]}</span>
            </span>
          ))}
        </span>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)] lg:gap-7">
        <aside aria-label="照片與檢查" className="flex flex-col gap-6">
          {photosCard}
          <div className="hidden pt-2 lg:block">{checksNote}</div>
        </aside>

        <form onSubmit={submit} noValidate aria-label="衣物資料" className="rounded-card bg-card px-4 py-1 shadow-paper md:px-6">
          <Row label="品名" htmlFor="copy-name" status={statuses[0]} hint={kind === 'other' ? '換成另一款，請填新的品名。' : undefined}>
            <input id="copy-name" value={form.name} onChange={(e) => update('name', e.target.value)} className={input(statuses[0])} />
          </Row>
          <Row label="品牌" htmlFor="copy-brand" status={statuses[1]}>
            <input id="copy-brand" value={form.brand} onChange={(e) => update('brand', e.target.value)} className={input(statuses[1])} />
          </Row>
          <Row label="類別" status={statuses[2]}>
            <Select label="類別" value={form.categoryId} options={categories.map((category) => ({ value: category.id, label: category.name }))} onChange={(value) => update('categoryId', value)} triggerClassName={input(statuses[2])} />
          </Row>
          <Row label="顏色" status={statuses[3]} hint={statuses[3] === 'changed' ? `原本是${item.colorName}` : undefined}>
            <Select
              label="顏色"
              value={form.colorName}
              options={GARMENT_COLORS.map((color) => ({ value: color.name, label: color.name }))}
              onChange={(value) => {
                const color = GARMENT_COLORS.find((entry) => entry.name === value)
                setForm((current) => ({ ...current, colorName: value, colorHex: color?.hex ?? current.colorHex }))
              }}
              display={
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className="size-[18px] rounded-[5px] border border-ink/20" style={{ background: form.colorHex }} />
                  {form.colorName}
                </span>
              }
              triggerClassName={input(statuses[3])}
            />
          </Row>
          <Row label="尺寸" htmlFor="copy-size" status={statuses[4]} hint={statuses[4] !== 'keep' && item.size ? `原本是 ${item.size}${kind === 'size' ? '（在上一步選的）' : ''}` : undefined}>
            <input id="copy-size" value={form.size} onChange={(e) => update('size', e.target.value)} className={`${input(statuses[4])} font-num`} />
          </Row>
          <Row label="材質" htmlFor="copy-material" status={statuses[5]}>
            <input id="copy-material" value={form.material} onChange={(e) => update('material', e.target.value)} className={input(statuses[5])} />
          </Row>
          <Row label="購買通路" htmlFor="copy-store" status={statuses[6]}>
            <input id="copy-store" value={form.store} onChange={(e) => update('store', e.target.value)} className={input(statuses[6])} />
          </Row>
          <Row label="價格" htmlFor="copy-price" status={statuses[7]} hint={exchange?.exchangeExtra ? `補差價 NT$${exchange.exchangeExtra.toLocaleString('zh-TW')}，已加總` : exchange ? '沒有補差價' : undefined}>
            <input id="copy-price" inputMode="decimal" value={form.price} onChange={(e) => update('price', e.target.value)} placeholder="NT$" className={`${input(statuses[7])} font-num`} />
          </Row>
          <Row label="購買日期" status={statuses[8]} hint={exchange ? '沿用原購買日，衣物年齡從這天算' : undefined}>
            <DatePicker label="購買日期" value={form.purchaseDate || null} onChange={(value) => update('purchaseDate', value ?? '')} max={todayISO()} clearable hideLabel />
          </Row>
          {exchange && (
            <Row label="收到日期" status={statuses[9]} hint="換貨收到的那天；鑑賞期從這天起算。還沒收到可以先空著，衣物會標成「未到貨」。">
              <DatePicker label="收到日期" value={form.receivedOn || null} onChange={(value) => update('receivedOn', value ?? '')} max={todayISO()} clearable hideLabel />
            </Row>
          )}
          {flatKeys.length > 0 && (
            <Row
              label="平放尺寸"
              status={flatStatus}
              hint={
                sizeChanged
                  ? `換了尺寸，數字一定不同，所以清空了。灰字是 ${item.size || '原本那件'} 的數字，量完直接蓋過去；原本的數字仍留在舊的那件。`
                  : undefined
              }
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                {flatKeys.map((key) => {
                  const old = item.flatMeasurements?.[key]
                  return (
                    <label key={key} className="flex flex-col gap-1 text-xs text-ink-2">
                      {FLAT_LABELS[key] ?? key}
                      <input
                        inputMode="decimal"
                        value={form.flat[key] ?? ''}
                        onChange={(e) => setForm((current) => ({ ...current, flat: { ...current.flat, [key]: e.target.value } }))}
                        placeholder={sizeChanged && old != null ? `${item.size || '舊'}：${old}` : 'cm'}
                        className={`h-11 w-full rounded-btn border-[1.5px] px-2.5 font-num text-sm text-ink placeholder:text-ink-3 ${FIELD_BORDER[flatStatus]}`}
                      />
                    </label>
                  )
                })}
              </div>
            </Row>
          )}
          {item.note && (
            <Row label="我的筆記" hint={exchange ? '踩雷的體感不會帶過來。' : undefined}>
              <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm">
                <input type="checkbox" checked={form.keepNote} onChange={(e) => update('keepNote', e.target.checked)} className="size-[18px] accent-ink" />
                沿用舊的筆記
              </label>
            </Row>
          )}
          {exchange && (
            <Row label="關聯">
              <Link to={`/closet/${item.id}/review`} className="inline-flex min-h-11 items-center gap-1 text-sm">
                換貨自：{sourceLabel}（已換貨）
                <Icon name="next" size={16} />
              </Link>
            </Row>
          )}

          <div className="lg:hidden">{checksNote && <div className="pt-4 pb-2">{checksNote}</div>}</div>

          <div className="flex flex-wrap items-center gap-3 border-t-[1.5px] border-dashed border-line py-4">
            {error && (
              <p role="alert" className="m-0 w-full text-[13px] text-rose-deep">
                {error}
              </p>
            )}
            <span className="w-full text-xs text-ink-2 md:w-auto md:flex-1">平放尺寸可以先空著，之後在衣物詳細補。</span>
            <ButtonLink to={backTo} variant="ghost" className="max-md:!hidden">
              上一步
            </ButtonLink>
            <Button type="submit" variant="primary" size="lg" className="w-full md:h-11 md:w-auto md:text-sm" disabled={saving} aria-busy={saving}>
              <Icon name="check" />
              {saving ? '儲存中…' : '存成新衣物'}
            </Button>
          </div>
        </form>
      </div>
    </main>
  )
}
