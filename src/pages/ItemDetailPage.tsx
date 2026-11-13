import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ItemImage } from '@/components/closet/ItemImage'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Chip, StatusTag } from '@/components/ui/Chip'
import { DatePicker } from '@/components/ui/DatePicker'
import { DestructiveActionDialog } from '@/components/ui/B10States'
import { Icon } from '@/components/ui/Icon'
import { LoadingState, PageState } from '@/components/ui/PageState'
import { PaperCard, TiltLabel } from '@/components/ui/Paper'
import { Toast, type ToastMessage } from '@/components/ui/Toast'
import { addClosetItemPhotos, deleteClosetItem, fetchCategories, fetchClosetItemDetail, recordClosetItemWear, removeClosetItemPhoto, removeItemBackground, setClosetPhotoCover, updateClosetItem, updateClosetItemStatus } from '@/lib/data'
import { STATUS_LABEL } from '@/lib/slots'
import type { Category, ClosetItem, ItemStatus } from '@/types'

const SEASONS = ['春', '夏', '秋', '冬']
const MEASURE_LABELS: Record<string, string> = {
  shoulder: '肩寬', sleeve: '袖長', chest: '胸寬', length: '衣長', cuff: '袖口',
  waist: '腰寬', rise: '褲檔', hip: '臀寬', thigh: '大腿寬', hem: '褲口寬',
  innerLength: '鞋內長', heelHeight: '跟高', width: '寬', height: '高', depth: '側寬',
}
const INPUT = 'h-11 w-full rounded-btn border-[1.5px] border-line bg-paper px-3 text-sm text-ink outline-none focus:border-mist-deep'

type EditableFields = Pick<ClosetItem, 'name' | 'categoryId' | 'colorName' | 'colorHex' | 'secondColorHex' | 'brand' | 'size' | 'fit' | 'material' | 'materialComposition' | 'seasons' | 'occasions' | 'purchaseDate' | 'purchasePrice' | 'store' | 'productUrl' | 'note' | 'flatMeasurements'>

function editableFields(item: ClosetItem): EditableFields {
  return {
    name: item.name,
    categoryId: item.categoryId,
    colorName: item.colorName,
    colorHex: item.colorHex,
    secondColorHex: item.secondColorHex ?? '',
    brand: item.brand ?? '',
    size: item.size ?? '',
    fit: item.fit ?? '',
    material: item.material ?? '',
    materialComposition: item.materialComposition ?? '',
    seasons: item.seasons ?? [],
    occasions: item.occasions ?? [],
    purchaseDate: item.purchaseDate ?? '',
    purchasePrice: item.purchasePrice ?? undefined,
    store: item.store ?? '',
    productUrl: item.productUrl ?? '',
    note: item.note ?? '',
    flatMeasurements: item.flatMeasurements ?? {},
  }
}

function formatDate(value?: string) {
  if (!value) return '尚未記錄'
  return new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(`${value}T00:00:00`)).replaceAll('/', '/')
}

function formatPrice(value?: number) {
  return value == null ? '尚未記錄' : `NT$${value.toLocaleString('zh-TW')}`
}

export function ItemDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState<ClosetItem | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [form, setForm] = useState<EditableFields | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [imageMode, setImageMode] = useState<'cutout' | 'original'>('cutout')
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<'delete' | 'archive' | null>(null)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [cutoutBusy, setCutoutBusy] = useState(false)
  const photoInput = useRef<HTMLInputElement>(null)

  const reload = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const [nextItem, nextCategories] = await Promise.all([fetchClosetItemDetail(id), fetchCategories()])
      setItem(nextItem)
      setCategories(nextCategories)
      setForm(nextItem ? editableFields(nextItem) : null)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '衣物資料讀取失敗。')
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [id])

  useEffect(() => { void Promise.resolve().then(() => reload()) }, [reload])

  const category = categories.find((entry) => entry.id === item?.categoryId)
  const photos = item?.photos?.length ? item.photos : []
  const activePhoto = photos.find((photo) => photo.id === selectedPhoto) ?? photos.find((photo) => photo.isCover) ?? photos[0]
  const mainUrl = selectedPhoto && activePhoto?.url
    ? activePhoto.url
    : imageMode === 'cutout'
      ? item?.cutoutStatus === 'done' ? item.cutoutUrl : activePhoto?.url ?? item?.originalUrl ?? item?.cutoutUrl
      : activePhoto?.url ?? item?.originalUrl ?? item?.cutoutUrl
  const costPerWear = item?.purchasePrice != null && item.wearCount ? Math.round(item.purchasePrice / item.wearCount) : null

  function updateForm<K extends keyof EditableFields>(key: K, value: EditableFields[K]) {
    setForm((current) => current ? { ...current, [key]: value } : current)
  }

  async function saveEdits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!item || !form) return
    if (!form.name.trim()) return setError('品名不能空白。')
    setSaving(true)
    try {
      await updateClosetItem(item.id, {
        ...form,
        name: form.name.trim(),
        categoryName: undefined,
        status: undefined,
        size: form.size?.trim() || undefined,
        brand: form.brand?.trim() || undefined,
        fit: form.fit?.trim() || undefined,
        material: form.material?.trim() || undefined,
        materialComposition: form.materialComposition?.trim() || undefined,
        store: form.store?.trim() || undefined,
        productUrl: form.productUrl?.trim() || undefined,
        note: form.note?.trim() || undefined,
      })
      await reload()
      setEditing(false)
      setToast({ tone: 'success', text: '衣物資料已更新。' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '儲存失敗，修改內容仍保留。')
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(status: ItemStatus) {
    if (!item) return
    setSaving(true)
    try {
      await updateClosetItemStatus(item.id, status)
      await reload()
      setToast({ tone: 'success', text: `狀態已改為「${STATUS_LABEL[status]}」。` })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '狀態更新失敗。')
    } finally {
      setSaving(false)
    }
  }

  async function markWorn() {
    if (!item) return
    try {
      const result = await recordClosetItemWear(item.id)
      await reload()
      setToast({ tone: 'success', text: result.demo ? '已記錄今天穿著（示範資料）。' : '已記錄今天穿著。' })
    } catch (cause) {
      setToast({ tone: 'error', text: cause instanceof Error ? cause.message : '穿著紀錄未能儲存。' })
    }
  }

  async function confirmActionNow() {
    if (!item || !confirmAction) return
    try {
      if (confirmAction === 'archive') {
        await updateClosetItemStatus(item.id, 'retired')
        navigate('/closet', { replace: true })
        return
      }
      const result = await deleteClosetItem(item.id)
      if (result.cleanupWarning) setToast({ tone: 'error', text: result.cleanupWarning })
      navigate('/closet', { replace: true })
    } catch (cause) {
      setToast({ tone: 'error', text: cause instanceof Error ? cause.message : '操作未完成，衣物資料仍保留。' })
    } finally {
      setConfirmAction(null)
    }
  }

  async function addPhotos(files: FileList | null) {
    if (!item || !files?.length) return
    setPhotoBusy(true)
    try {
      await addClosetItemPhotos(item.id, Array.from(files))
      await reload()
      setToast({ tone: 'success', text: '照片已新增。' })
    } catch (cause) {
      setToast({ tone: 'error', text: cause instanceof Error ? cause.message : '照片新增失敗。' })
    } finally {
      setPhotoBusy(false)
      if (photoInput.current) photoInput.current.value = ''
    }
  }

  async function chooseCover(photoId: string) {
    if (!item) return
    try {
      await setClosetPhotoCover(item.id, photoId)
      setSelectedPhoto(photoId)
      await reload()
      setToast({ tone: 'success', text: '封面照片已更新。' })
    } catch (cause) {
      setToast({ tone: 'error', text: cause instanceof Error ? cause.message : '封面更新失敗。' })
    }
  }

  async function removePhoto(photoId: string) {
    if (!item || !window.confirm('移除這張照片？原始照片會從私人儲存空間刪除。')) return
    try {
      await removeClosetItemPhoto(item.id, photoId)
      setSelectedPhoto(null)
      await reload()
    } catch (cause) {
      setToast({ tone: 'error', text: cause instanceof Error ? cause.message : '照片移除失敗。' })
    }
  }

  if (loading) return <main className="mx-auto max-w-6xl px-4 py-8"><LoadingState label="正在整理衣物資料…" /></main>
  if (error && !item) return <main className="mx-auto max-w-4xl px-4 py-8"><PageState icon="alert" tone="rose" title="衣物暫時打不開" description={error} action={<><Button variant="secondary" onClick={() => void reload()}>重試</Button><ButtonLink to="/closet" variant="ghost">回衣櫃</ButtonLink></>} /></main>
  if (!item) return <main className="mx-auto max-w-4xl px-4 py-8"><PageState icon="search" title="找不到這件衣物" description="它可能已刪除或封存。" action={<ButtonLink to="/closet" variant="secondary">回我的衣櫃</ButtonLink>} /></main>

  return (
    <main className="closet-item-detail mx-auto flex max-w-[1240px] flex-col gap-5 px-4 py-5 pb-36 sm:px-6 md:px-8 md:py-8 md:pb-12">
      <div className="closet-item-detail__mobile-nav -mx-2 flex items-center gap-2 border-b border-dashed border-line-strong px-1 pb-2 md:hidden"><Link to="/closet" aria-label="返回我的衣櫃" className="flex size-11 flex-none items-center justify-center rounded-btn text-ink"><Icon name="back" /></Link><span className="min-w-0 flex-1 truncate font-hd text-lg">{item.name}</span><StatusTag status={item.status} /></div>
      <nav aria-label="麵包屑" className="closet-item-detail__breadcrumb hidden items-center gap-2 text-[13px] text-ink-2 md:flex"><Link to="/closet">我的衣櫃</Link><span aria-hidden="true">›</span><span>{category?.name ?? item.categoryName ?? '衣物'}</span><span aria-hidden="true">›</span><span aria-current="page" className="text-ink">{item.name}</span></nav>
      {error && <div role="alert" className="flex items-center gap-2 rounded-tile border border-rose bg-rose-soft px-3 py-2 text-sm text-rose-ink"><Icon name="alert" size={17} />{error}</div>}

      <article aria-labelledby="closet-item-title" className="closet-item-detail__layout grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-9">
        <section aria-label="衣物照片" className="closet-item-detail__gallery min-w-0 space-y-3">
          <div className="relative aspect-[4/5] max-h-[72dvh] overflow-hidden rounded-block bg-tile md:max-h-[780px]">
            {mainUrl ? <img src={mainUrl} alt={item.name} className="size-full object-contain p-5" /> : <ItemImage name={item.name} colorHex={item.colorHex} shape={item.shape} className="size-full p-12" />}
            {item.status !== 'ok' && <StatusTag status={item.status} className="absolute bottom-4 left-4" />}
            {photos.length > 0 && <span className="absolute bottom-4 right-4 rounded-full bg-card/90 px-3 py-1 text-xs text-ink">{activePhoto?.isCover ? '封面照片' : '原始照片'}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" aria-pressed={imageMode === 'cutout'} onClick={() => { setImageMode('cutout'); setSelectedPhoto(null) }} className={`min-h-11 rounded-full border px-4 text-sm ${imageMode === 'cutout' ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-card text-ink'}`}>去背圖</button>
            <button type="button" aria-pressed={imageMode === 'original'} onClick={() => { setImageMode('original'); setSelectedPhoto(null) }} className={`min-h-11 rounded-full border px-4 text-sm ${imageMode === 'original' ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-card text-ink'}`}>原始照片</button>
            {item.cutoutStatus !== 'done' && <span className="text-xs text-ink-3">目前使用原圖</span>}
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {photos.map((photo) => <div key={photo.id} className="min-w-0 space-y-1">
              <div className="relative aspect-square overflow-hidden rounded-tile bg-tile">
                <button type="button" aria-label={`查看${photo.isCover ? '封面' : '第 ' + (photo.sortOrder + 1) + ' 張'}照片`} aria-pressed={selectedPhoto === photo.id} onClick={() => { setSelectedPhoto(photo.id); setImageMode('original') }} className={`size-full p-1 ${selectedPhoto === photo.id ? 'ring-2 ring-inset ring-mist-deep' : ''}`}><img src={photo.url} alt="" className="size-full object-cover" /></button>
                {photo.isCover && <span className="absolute bottom-1 left-1 rounded-full bg-ink px-1.5 py-0.5 text-[9px] text-paper">封面</span>}
              </div>
              <div className="grid grid-cols-2 gap-1"><button type="button" aria-label="設為封面" disabled={photo.isCover} onClick={() => void chooseCover(photo.id)} className="flex h-11 min-w-0 items-center justify-center rounded-sm bg-card text-xs text-ink disabled:opacity-40">封面</button><button type="button" aria-label="移除照片" disabled={photos.length <= 1} onClick={() => void removePhoto(photo.id)} className="flex h-11 min-w-0 items-center justify-center rounded-sm bg-card text-ink disabled:opacity-40"><Icon name="x" size={15} /></button></div>
            </div>)}
            <button type="button" disabled={photoBusy || photos.length >= 8} onClick={() => photoInput.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-tile border-2 border-dashed border-line-strong bg-card text-xs text-mist-deep disabled:opacity-40"><Icon name="plus" />新增照片</button>
            <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple className="sr-only" onChange={(event) => void addPhotos(event.target.files)} />
          </div>
          {item.cutoutStatus !== 'processing' && (item.cutoutStatus !== 'done' || selectedPhoto !== null) && <div className="rounded-tile bg-mist-soft p-3 text-sm text-mist-ink">去背來源：{activePhoto ? `第 ${activePhoto.sortOrder + 1} 張照片` : '封面照片'}。可先點選上方縮圖再執行。<button type="button" disabled={cutoutBusy} onClick={async () => { setCutoutBusy(true); try { await removeItemBackground({ itemId: item.id, photoIndex: activePhoto?.sortOrder ?? 0 }); await reload(); setImageMode('cutout'); setSelectedPhoto(null); setToast({ tone: 'success', text: '去背完成。' }) } catch (cause) { setToast({ tone: 'error', text: cause instanceof Error ? cause.message : '去背失敗，原圖保留。' }) } finally { setCutoutBusy(false) } }} className="ml-2 min-h-11 underline disabled:opacity-50">{cutoutBusy ? '去背中…' : item.cutoutStatus === 'done' ? '以這張照片重新去背' : '以這張照片補做去背'}</button></div>}
        </section>

        <section className="closet-item-detail__content min-w-0 space-y-5">
          <div className="closet-item-detail__heading flex items-start gap-3"><div className="mr-auto min-w-0"><TiltLabel accent="mist">{category?.name ?? item.categoryName ?? '衣物'}</TiltLabel><h1 id="closet-item-title" className="mb-1 mt-3 break-words font-hd text-3xl text-ink sm:text-[34px]">{item.name}</h1><p className="m-0 text-sm text-ink-2">{item.colorName}{item.brand ? `・${item.brand}` : ''}{item.size ? `・${item.size}` : ''}</p></div><div className="flex items-center gap-1"><StatusTag status={item.status} /><button type="button" aria-label="切換常穿收藏" aria-pressed={item.isFavorite} onClick={async () => { try { await updateClosetItem(item.id, { isFavorite: !item.isFavorite }); await reload() } catch (cause) { setToast({ tone: 'error', text: cause instanceof Error ? cause.message : '收藏狀態更新失敗。' }) } }} className={`flex size-11 items-center justify-center rounded-btn ${item.isFavorite ? 'text-rose-deep' : 'text-ink-3'}`}><Icon name="wish" /></button></div></div>

          <PaperCard className="closet-item-detail__wear-stats grid grid-cols-3 divide-x divide-dashed divide-line p-4 text-center">
            <div><p className="m-0 font-num text-2xl font-bold">{item.wearCount ?? 0}</p><p className="mb-0 mt-1 text-xs text-ink-2">穿著次數</p></div>
            <div className="px-2"><p className="m-0 text-sm font-medium">{formatDate(item.lastWornAt)}</p><p className="mb-0 mt-1 text-xs text-ink-2">最近穿著</p></div>
            <div className="pl-2"><p className="m-0 text-sm font-medium">{costPerWear == null ? '—' : formatPrice(costPerWear)}</p><p className="mb-0 mt-1 text-xs text-ink-2">每次穿著成本</p></div>
          </PaperCard>

            {editing ? <form id="closet-item-edit-form" onSubmit={(event) => void saveEdits(event)} className="closet-item-detail__edit-form space-y-4">
            <PaperCard className="space-y-4 p-4 sm:p-5">
              <h2 className="m-0 font-hd text-xl">衣物資料</h2>
              <label className="flex flex-col gap-1.5 text-[13px]">品名<input required value={form?.name ?? ''} onChange={(event) => updateForm('name', event.target.value)} className={INPUT} /></label>
              <label className="flex flex-col gap-1.5 text-[13px]">分類<select value={form?.categoryId ?? ''} onChange={(event) => updateForm('categoryId', event.target.value)} className={INPUT}>{categories.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
              <div className="grid grid-cols-2 gap-3"><label className="flex flex-col gap-1.5 text-[13px]">色系<input value={form?.colorName ?? ''} onChange={(event) => updateForm('colorName', event.target.value)} className={INPUT} /></label><label className="flex flex-col gap-1.5 text-[13px]">主色<input type="color" value={form?.colorHex ?? item.colorHex} onChange={(event) => updateForm('colorHex', event.target.value)} className="h-11 w-full rounded-btn border border-line bg-card p-1" /></label></div>
              <div className="closet-item-detail__second-color space-y-1.5"><span className="text-[13px]">第二色（選填）</span><div className="flex items-center gap-2"><input aria-label="第二色" type="color" value={form?.secondColorHex || '#FFFFFF'} onChange={(event) => updateForm('secondColorHex', event.target.value)} className="h-11 min-w-0 flex-1 rounded-btn border border-line bg-card p-1" /><span className="shrink-0 text-xs text-ink-3">{form?.secondColorHex ? '已設定' : '未設定'}</span><Button type="button" variant="ghost" aria-label="清除第二色" onClick={() => updateForm('secondColorHex', '')}>清除</Button></div></div>
              <div className="grid grid-cols-2 gap-3"><label className="flex flex-col gap-1.5 text-[13px]">品牌<input value={form?.brand ?? ''} onChange={(event) => updateForm('brand', event.target.value)} className={INPUT} /></label><label className="flex flex-col gap-1.5 text-[13px]">標籤尺寸<input value={form?.size ?? ''} onChange={(event) => updateForm('size', event.target.value)} className={INPUT} /></label></div>
              <div className="grid grid-cols-2 gap-3"><label className="flex flex-col gap-1.5 text-[13px]">版型<input value={form?.fit ?? ''} onChange={(event) => updateForm('fit', event.target.value)} className={INPUT} /></label><label className="flex flex-col gap-1.5 text-[13px]">材質<input value={form?.material ?? ''} onChange={(event) => updateForm('material', event.target.value)} className={INPUT} /></label></div>
              <div className="space-y-2"><span className="text-[13px]">季節</span><div className="flex flex-wrap gap-2">{SEASONS.map((season) => <Chip key={season} selected={form?.seasons?.includes(season)} onClick={() => updateForm('seasons', (form?.seasons ?? []).includes(season) ? form!.seasons!.filter((value) => value !== season) : [...(form?.seasons ?? []), season])}>{season}</Chip>)}</div></div>
              <label className="flex flex-col gap-1.5 text-[13px]">場合<input value={form?.occasions?.join('、') ?? ''} onChange={(event) => updateForm('occasions', event.target.value.split('、').map((value) => value.trim()).filter(Boolean))} placeholder="例如：上班、週末、旅行" className={INPUT} /></label>
              <div className="grid grid-cols-2 gap-3"><label className="flex flex-col gap-1.5 text-[13px]">價格<input type="number" min="0" value={form?.purchasePrice ?? ''} onChange={(event) => updateForm('purchasePrice', event.target.value === '' ? undefined : Number(event.target.value))} className={INPUT} /></label><DatePicker label="購買日期" value={form?.purchaseDate || null} onChange={(value) => updateForm('purchaseDate', value ?? undefined)} clearable /></div>
              <label className="flex flex-col gap-1.5 text-[13px]">購買通路<input value={form?.store ?? ''} onChange={(event) => updateForm('store', event.target.value)} className={INPUT} /></label>
              <label className="flex flex-col gap-1.5 text-[13px]">商品網址<input type="url" value={form?.productUrl ?? ''} onChange={(event) => updateForm('productUrl', event.target.value)} className={INPUT} /></label>
              <label className="flex flex-col gap-1.5 text-[13px]">材質成分<input value={form?.materialComposition ?? ''} onChange={(event) => updateForm('materialComposition', event.target.value)} className={INPUT} /></label>
              <label className="flex flex-col gap-1.5 text-[13px]">備註<textarea rows={3} value={form?.note ?? ''} onChange={(event) => updateForm('note', event.target.value)} className={`${INPUT} h-auto py-3`} /></label>
              {Object.keys(item.flatMeasurements ?? {}).length > 0 && <div className="space-y-2"><h3 className="m-0 font-hd text-lg">平放尺寸</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{Object.entries(form?.flatMeasurements ?? {}).map(([key, value]) => <label key={key} className="flex flex-col gap-1 text-xs">{MEASURE_LABELS[key] ?? key}<input type="number" min="0" step="0.1" value={value ?? ''} onChange={(event) => updateForm('flatMeasurements', { ...form?.flatMeasurements, [key]: event.target.value === '' ? null : Number(event.target.value) })} className={INPUT} /></label>)}</div></div>}
            </PaperCard>
              <div className="hidden justify-end gap-2 md:flex"><Button variant="secondary" onClick={() => { setForm(editableFields(item)); setEditing(false) }}>取消</Button><Button type="submit" variant="primary" disabled={saving}>{saving ? '儲存中…' : '儲存修改'}</Button></div>
          </form> : <>
            <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => { setForm(editableFields(item)); setEditing(true) }}><Icon name="reset" size={17} />編輯</Button><Button variant="secondary" onClick={() => void markWorn()}><Icon name="check" size={17} />記錄今天穿了</Button><details className="relative"><summary className="flex h-11 cursor-pointer list-none items-center gap-2 rounded-btn border-[1.5px] border-line-strong bg-card px-4 text-sm text-ink [&::-webkit-details-marker]:hidden"><Icon name="closet" size={17} />變更狀態</summary><div className="absolute left-0 top-full z-10 mt-2 min-w-40 rounded-card bg-card p-2 shadow-float">{(['ok', 'cleaning', 'repair', 'lent', 'stored'] as ItemStatus[]).map((status) => <button key={status} type="button" onClick={() => void changeStatus(status)} className="flex min-h-11 w-full items-center rounded-sm px-3 text-left text-sm hover:bg-paper">{STATUS_LABEL[status]}</button>)}</div></details><Button variant="ghost" onClick={() => setConfirmAction('archive')}><Icon name="closet" size={17} />封存</Button></div>
            <PaperCard className="closet-item-detail__information space-y-3 p-4"><h2 className="m-0 font-hd text-xl">衣物資訊</h2><InfoRow label="顏色" value={item.colorName} color={item.colorHex} /><InfoRow label="品牌" value={item.brand} /><InfoRow label="標籤尺寸" value={item.size} /><InfoRow label="版型" value={item.fit} /><InfoRow label="材質" value={item.material} /><InfoRow label="成分" value={item.materialComposition} /><InfoRow label="季節" value={item.seasons?.join('、')} /><InfoRow label="場合" value={item.occasions?.join('、')} /><InfoRow label="購買日期" value={item.purchaseDate ? formatDate(item.purchaseDate) : undefined} /><InfoRow label="購買價格" value={item.purchasePrice == null ? undefined : formatPrice(item.purchasePrice)} /><InfoRow label="購買通路" value={item.store} /><InfoRow label="商品網址" value={item.productUrl} href={item.productUrl} /></PaperCard>
            {Object.keys(item.flatMeasurements ?? {}).length > 0 && <PaperCard className="space-y-3 p-4"><div className="flex items-center justify-between"><h2 className="m-0 font-hd text-xl">平放尺寸</h2><Button variant="ghost" className="h-9 px-2 text-xs" onClick={() => { setForm(editableFields(item)); setEditing(true) }}>編輯尺寸</Button></div><p className="m-0 text-xs text-ink-2">單位 cm・平放測量，不拉扯布料</p><div className="grid grid-cols-2 gap-x-4">{Object.entries(item.flatMeasurements ?? {}).map(([key, value]) => <InfoRow key={key} label={MEASURE_LABELS[key] ?? key} value={value == null ? undefined : `${value} cm`} />)}</div></PaperCard>}
            <PaperCard className="closet-item-detail__notes space-y-2 p-4"><h2 className="m-0 font-hd text-xl">我的筆記</h2><p className={`m-0 whitespace-pre-wrap ${item.note ? 'font-hd text-lg leading-8 text-ink-2' : 'font-sans text-xs leading-5 text-ink-3'}`}>{item.note || '還沒有筆記，編輯衣物即可新增。'}</p></PaperCard>
            <section className="closet-item-detail__pairings space-y-5"><h2 className="closet-item-detail__pairings-title m-0 ml-3 font-hd text-xl">常一起穿的</h2><PaperCard className="closet-item-detail__pairings-card p-4 text-sm leading-6 text-ink-2">穿搭日記尚未啟用，記錄穿著後就能整理常搭單品。</PaperCard></section>
            <Button variant="ghost" className="self-start text-rose-deep" onClick={() => setConfirmAction('delete')}><Icon name="x" size={17} />永久刪除衣物</Button>
          </>}
        </section>
      </article>

      <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-20 grid grid-cols-2 gap-2 border-t border-dashed border-line-strong bg-paper/95 p-3 backdrop-blur md:hidden">{editing ? <><Button variant="secondary" onClick={() => { setForm(editableFields(item)); setEditing(false) }}>取消</Button><Button type="submit" form="closet-item-edit-form" variant="primary" disabled={saving}><Icon name="check" size={17} />{saving ? '儲存中…' : '儲存修改'}</Button></> : <><Button variant="secondary" onClick={() => { setForm(editableFields(item)); setEditing(true) }}><Icon name="reset" size={17} />編輯</Button><Button variant="primary" onClick={() => void markWorn()}><Icon name="check" size={17} />今天穿了</Button></>}</div>

      {confirmAction && <DestructiveActionDialog title={confirmAction === 'archive' ? '封存這件衣物？' : '永久刪除這件衣物？'} description={confirmAction === 'archive' ? '封存後會從一般衣櫃隱藏，穿搭歷史仍會保留。' : `「${item.name}」會從衣櫃移除，搭配記錄的衣物連結也可能解除。此操作無法復原。`} secondaryAction={confirmAction === 'delete' ? { label: '改為封存', onClick: () => { setConfirmAction(null); void changeStatus('retired').then(() => navigate('/closet')) } } : undefined} onCancel={() => setConfirmAction(null)} onConfirm={() => void confirmActionNow()} />}
      <Toast message={toast} onClose={() => setToast(null)} />
    </main>
  )
}

function InfoRow({ label, value, color, href }: { label: string; value?: string; color?: string; href?: string }) {
  return <div className="flex min-h-11 items-center justify-between gap-3 border-t border-dashed border-line text-sm"><span className="flex-none text-ink-2">{label}</span>{value ? <span className="flex min-w-0 items-center gap-2 text-right text-ink">{color && <span aria-hidden="true" className="size-3 flex-none rounded-full border border-ink/15" style={{ background: color }} />}{href ? <a href={href} target="_blank" rel="noreferrer" className="truncate">{value}</a> : <span className="break-words">{value}</span>}</span> : <span className="text-xs text-ink-3">尚未記錄</span>}</div>
}
