import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { DatePicker } from '@/components/ui/DatePicker'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Icon } from '@/components/ui/Icon'
import { ImageUploadProgressState, CutoutFailureState, CutoutProcessingState } from '@/components/ui/B10States'
import { PaperCard, Tape, TiltLabel, WashBlob } from '@/components/ui/Paper'
import { Toast, type ToastMessage } from '@/components/ui/Toast'
import { fetchCategories, createGarmentDraft, updateGarmentDraft, finalizeGarmentDraft, discardGarmentDraft, removeItemBackground, getGarmentPhotoUrl } from '@/lib/data'
import { toUploadableImage } from '@/lib/image'
import type { AddItemDestination, Category, NewGarmentInput } from '@/types'

type Step = 1 | 2 | 3 | 4
type CutoutState = 'idle' | 'processing' | 'done' | 'failed' | 'demo'
type Photo = { id: string; file: File; url: string }
type MeasureField = { key: string; label: string }

type FormState = Omit<NewGarmentInput, 'flatMeasurements' | 'seasons' | 'destination' | 'useCutout' | 'purchaseDate'> & {
  seasons: string[]
  flatMeasurements: Record<string, string>
  purchaseDate: string | null
}

const MAX_PHOTOS = 8
const STEP_LABELS = ['照片', '去背', '資料', '確認']
const SEASONS = ['春', '夏', '秋', '冬']
const COLORS = [
  { name: '白', hex: '#F4F1EA' }, { name: '米', hex: '#EFE6D2' }, { name: '燕麥', hex: '#D9CBB3' },
  { name: '駝', hex: '#B88A5A' }, { name: '咖啡', hex: '#5A4031' }, { name: '灰', hex: '#9A9893' },
  { name: '黑', hex: '#232322' }, { name: '海軍藍', hex: '#2E3A4F' }, { name: '藍', hex: '#8FA3BC' },
  { name: '綠', hex: '#8C9A86' }, { name: '黃', hex: '#E8C66A' }, { name: '橘', hex: '#D98A4E' },
  { name: '紅', hex: '#A8423A' }, { name: '酒紅', hex: '#6E2E34' }, { name: '粉', hex: '#E7B9B4' },
  { name: '紫', hex: '#8E7AA6' }, { name: '多色', hex: '#8C9A86' }, { name: '其他', hex: '#D9C7AC' },
]
const MATERIALS = ['棉', '羊毛', '喀什米爾', '聚酯纖維', '尼龍', '麻', '丹寧', '皮革']
const INPUT_CLASS = 'h-12 w-full rounded-btn border-[1.5px] border-line bg-card px-3 text-sm text-ink outline-none focus:border-mist-deep'
const SIZING: Record<string, MeasureField[]> = {
  top: [{ key: 'shoulder', label: '肩寬' }, { key: 'sleeve', label: '袖長' }, { key: 'chest', label: '胸寬' }, { key: 'length', label: '衣長' }],
  outer: [{ key: 'shoulder', label: '肩寬' }, { key: 'sleeve', label: '袖長' }, { key: 'chest', label: '胸寬' }, { key: 'cuff', label: '袖口' }, { key: 'length', label: '衣長' }],
  bottom: [{ key: 'waist', label: '腰寬' }, { key: 'rise', label: '褲檔' }, { key: 'hip', label: '臀寬' }, { key: 'thigh', label: '大腿寬' }, { key: 'length', label: '褲長' }, { key: 'hem', label: '褲口寬' }],
  shoes: [{ key: 'innerLength', label: '鞋內長' }, { key: 'heelHeight', label: '跟高' }],
  bag: [{ key: 'width', label: '寬' }, { key: 'height', label: '高' }, { key: 'depth', label: '側寬' }],
  acc: [{ key: 'length', label: '平放長度' }, { key: 'width', label: '平放寬度' }],
}
const BASE_FORM: FormState = {
  name: '', categoryId: '', colorName: '燕麥', colorHex: '#D9CBB3', secondColorHex: '', brand: '', size: '',
  seasons: [], material: '', materialComposition: '', purchasePrice: null, purchaseDate: null, store: '', productUrl: '', note: '', flatMeasurements: {},
}

function slotSizing(category: Category | undefined): MeasureField[] {
  if (!category?.slot) return []
  const name = category.name
  if (name.includes('洋裝')) return [{ key: 'shoulder', label: '肩寬' }, { key: 'chest', label: '胸寬' }, { key: 'waist', label: '腰寬' }, { key: 'length', label: '全長' }, { key: 'hem', label: '下擺寬' }]
  if (name.includes('內衣') || name.includes('小可愛')) return [{ key: 'chest', label: '胸寬' }, { key: 'length', label: '衣長' }]
  if (name.includes('背心')) return [{ key: 'shoulder', label: '肩寬' }, { key: 'chest', label: '胸寬' }, { key: 'length', label: '衣長' }]
  return SIZING[category.slot]
}

function initialForm(categories: Category[]): FormState {
  return { ...BASE_FORM, categoryId: categories[0]?.id ?? '' }
}

function fileKind(file: File) {
  if (file.type.includes('png')) return 'PNG'
  if (file.type.includes('webp')) return 'WebP'
  if (file.type.includes('heic') || /\.heic$/i.test(file.name)) return 'HEIC'
  return '照片'
}

function isCutoutSupported(file: File) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type.toLowerCase()) || /\.(jpe?g|png|webp)$/i.test(file.name)
}

function fieldNumber(value: string) {
  if (!value.trim()) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function AddItemPage() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState<Category[]>([])
  const [photos, setPhotos] = useState<Photo[]>([])
  const [cutoutPhotoId, setCutoutPhotoId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(BASE_FORM)
  const [step, setStep] = useState<Step>(1)
  const [destination, setDestination] = useState<AddItemDestination>('closet')
  const [useCutout, setUseCutout] = useState(true)
  const [cutoutState, setCutoutState] = useState<CutoutState>('idle')
  const [cutoutUrl, setCutoutUrl] = useState<string | null>(null)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [draftDemo, setDraftDemo] = useState(false)
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [convertingPhotos, setConvertingPhotos] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [continueAdding, setContinueAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const libraryInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const draftIdRef = useRef<string | null>(null)

  const selectedCategory = categories.find((category) => category.id === form.categoryId)
  const measurements = useMemo(() => slotSizing(selectedCategory), [selectedCategory])
  const cutoutPhoto = photos.find((photo) => photo.id === cutoutPhotoId) ?? photos[0]
  const cutoutPhotoIndex = cutoutPhoto ? photos.indexOf(cutoutPhoto) : 0
  const supportedCutout = !!cutoutPhoto && isCutoutSupported(cutoutPhoto.file)
  const displayStep = step
  const visualSteps = useCutout ? STEP_LABELS : ['照片', '去背（略過）', '資料', '確認']
  const photosRef = useRef<Photo[]>([])

  useEffect(() => {
    let alive = true
    fetchCategories().then((items) => {
      if (!alive) return
      setCategories(items)
      setForm((current) => ({ ...current, categoryId: current.categoryId || items[0]?.id || '' }))
    }).catch((cause: Error) => alive && setError(cause.message || '衣物分類載入失敗。'))
      .finally(() => alive && setLoadingCategories(false))
    return () => { alive = false }
  }, [])

  useEffect(() => { photosRef.current = photos }, [photos])
  useEffect(() => () => photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url)), [])

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const appendFiles = useCallback((list: FileList | File[]) => {
    if (convertingPhotos) return setError('照片轉檔完成後再加入其他照片。')
    const allFiles = Array.from(list)
    const oversizedCount = allFiles.filter((file) => file.size > 10 * 1024 * 1024).length
    const candidates = allFiles.filter((file) => file.size <= 10 * 1024 * 1024 && (file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name)))
    if (!candidates.length) return setError(oversizedCount ? '單張照片需小於 10 MB；過大的照片未加入。' : '請選擇 JPG、PNG、WebP 或 HEIC 照片。')
    const room = MAX_PHOTOS - photos.length
    if (room <= 0) return setError('最多可以加入 8 張照片。')
    const warnings = [
      oversizedCount > 0 ? '單張照片需小於 10 MB；過大的照片未加入。' : '',
      candidates.length > room ? `最多 8 張照片；這次只加入前 ${room} 張。` : '',
    ].filter(Boolean)
    const selected = candidates.filter((file) => file.size <= 10 * 1024 * 1024).slice(0, room)
    if (!selected.length) return
    setError(warnings.length ? warnings.join(' ') : null)
    setConvertingPhotos(true)
    void Promise.all(selected.map(async (file) => {
      try { return await toUploadableImage(file) } catch { return null }
    })).then((prepared) => {
      const uploadable = prepared.filter((file): file is File => file !== null)
      const failedCount = prepared.length - uploadable.length
      if (failedCount) warnings.push(`${failedCount} 張照片轉換失敗，未加入；請確認 HEIC/HEIF 檔案完整後重試。`)
      setError(warnings.length ? warnings.join(' ') : null)
      setPhotos((current) => [...current, ...uploadable.map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }))].slice(0, MAX_PHOTOS))
    }).finally(() => setConvertingPhotos(false))
  }, [photos.length, convertingPhotos])

  function removePhoto(photoId: string) {
    setPhotos((current) => {
      const removed = current.find((photo) => photo.id === photoId)
      if (removed) URL.revokeObjectURL(removed.url)
      return current.filter((photo) => photo.id !== photoId)
    })
  }

  function movePhoto(index: number, direction: -1 | 1) {
    const other = index + direction
    if (other < 0 || other >= photos.length) return
    setPhotos((current) => {
      const next = [...current]
      ;[next[index], next[other]] = [next[other], next[index]]
      return next
    })
  }

  function setCover(index: number) {
    if (index === 0) return
    setPhotos((current) => {
      const next = [...current]
      const [cover] = next.splice(index, 1)
      next.unshift(cover)
      return next
    })
  }

  useEffect(() => {
    if (step !== 1) return
    const onPaste = (event: ClipboardEvent) => {
      const pasted = [...(event.clipboardData?.items ?? [])].flatMap((item) => item.type.startsWith('image/') ? [item.getAsFile()].filter((file): file is File => !!file) : [])
      if (pasted.length) appendFiles(pasted)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [step, appendFiles])

  async function beginMediaStep() {
    setError(null)
    if (loadingCategories || !categories.length) return setError('目前沒有可用衣物分類，請先建立分類後再新增。')
    if (!photos.length) return setError('至少加入一張照片再繼續。')
    setUploading(true)
    try {
      const result = await createGarmentDraft(form.categoryId || categories[0].id, photos.map((photo) => photo.file), useCutout)
      setDraftId(result.id)
      draftIdRef.current = result.id
      setDraftDemo(result.demo)
      if (!useCutout) {
        setStep(3)
        return
      }
      setStep(2)
      if (result.demo) {
        setCutoutState('demo')
        return
      }
      if (!supportedCutout) {
        setCutoutState('failed')
        setError('這張照片格式目前無法自動去背；請回上一步改選 JPG、PNG 或 WebP，或直接使用原圖。')
        return
      }
      await processCutout(result.id, cutoutPhotoIndex)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '照片上傳失敗，請重試。')
    } finally {
      setUploading(false)
    }
  }

  async function processCutout(id = draftIdRef.current, photoIndex = cutoutPhotoIndex) {
    if (!id || draftDemo) return
    setCutoutState('processing')
    setError(null)
    try {
      const result = await removeItemBackground({ itemId: id, photoIndex })
      const url = await getGarmentPhotoUrl(result.cutoutPath)
      setCutoutUrl(url)
      setCutoutState('done')
    } catch (cause) {
      setCutoutState('failed')
      setError(cause instanceof Error ? cause.message : '去背失敗，原始照片仍保留。')
    }
  }

  function continueWithOriginal() {
    setUseCutout(false)
    setCutoutState('idle')
    setCutoutUrl(null)
    setError(null)
    setStep(3)
  }

  async function goToReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.name.trim() || !form.categoryId) {
      setError('必填只有品名和類型，請完成這兩項。')
      return
    }
    if (form.purchasePrice != null && form.purchasePrice < 0) {
      setError('價格不能小於 0。')
      return
    }
    setError(null)
    if (draftId && !draftDemo) {
      setUploading(true)
      try {
        const input = toInput()
        await updateGarmentDraft(draftId, input)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '資料暫存失敗，請重試。')
        return
      } finally {
        setUploading(false)
      }
    }
    setStep(4)
  }

  function toInput(): NewGarmentInput {
    return {
      ...form,
      destination,
      useCutout,
      flatMeasurements: Object.fromEntries(measurements.map(({ key }) => [key, fieldNumber(form.flatMeasurements[key] ?? '')])),
    }
  }

  async function finish() {
    if (!draftId) return setError('照片草稿不存在，請回上一步重新上傳。')
    setSaving(true)
    setError(null)
    try {
      const input = toInput()
      if (draftDemo) {
        const result = await finalizeGarmentDraft(draftId, input)
        setToast({ tone: 'success', text: '示範衣物已加入清單。' })
        if (continueAdding) {
          resetWizard()
          setStep(1)
        } else navigate(result.destination === 'closet' ? '/closet' : '/wishlist')
        return
      }
      await updateGarmentDraft(draftId, input)
      const result = await finalizeGarmentDraft(draftId, input)
      draftIdRef.current = null
      setDraftId(null)
      setToast({ tone: 'success', text: result.destination === 'closet' ? '衣物已放進衣櫃。' : '商品已加入選購清單。' })
      if (continueAdding) {
        resetWizard()
        setStep(1)
      } else navigate(result.destination === 'closet' ? '/closet' : '/wishlist')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '儲存失敗，照片與表單仍保留。')
    } finally {
      setSaving(false)
    }
  }

  function resetWizard() {
    photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url))
    setPhotos([])
    setCutoutPhotoId(null)
    setForm(initialForm(categories))
    setDestination('closet')
    setUseCutout(true)
    setCutoutState('idle')
    setCutoutUrl(null)
    setDraftId(null)
    setDraftDemo(false)
    draftIdRef.current = null
    setError(null)
  }

  async function closeWizard() {
    if (draftId) {
      const shouldDiscard = window.confirm('離開會刪除這次暫存的照片和資料，確定離開嗎？')
      if (!shouldDiscard) return
      try {
        await discardGarmentDraft(draftId)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '暫存清理失敗，請稍後重試。')
        return
      }
    } else if (photos.length > 0 || form.name.trim()) {
      const shouldLeave = window.confirm('目前照片和表單尚未上傳，離開後會清除。確定離開嗎？')
      if (!shouldLeave) return
    }
    navigate('/closet')
  }

  function toggleSeason(season: string) {
    updateForm('seasons', form.seasons.includes(season) ? form.seasons.filter((value) => value !== season) : [...form.seasons, season])
  }

  function toggleMaterial(material: string) {
    const values = form.material ? form.material.split('、') : []
    updateForm('material', values.includes(material) ? values.filter((value) => value !== material).join('、') : [...values, material].join('、'))
  }

  function goBack() {
    if (step === 2) { void returnToPhotos(); return }
    if (step === 3 && useCutout) { setStep(2); return }
    if (step === 3) { void returnToPhotos(); return }
    if (step === 4) { setStep(3); return }
    void closeWizard()
  }

  function navigateStep(target: number) {
    if (target > displayStep) return
    if (target === 1 && draftId) {
      void returnToPhotos()
      return
    }
    if (target === 2 && !useCutout) {
      setStep(3)
      return
    }
    setStep(target as Step)
  }

  async function returnToPhotos() {
    if (draftId) {
      try {
        await discardGarmentDraft(draftId)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '暫存清理失敗，無法返回照片步驟。')
        return
      }
    }
    draftIdRef.current = null
    setDraftId(null)
    setCutoutState('idle')
    setCutoutUrl(null)
    setStep(1)
  }

  const footerHint = step === 1
    ? useCutout ? '下一步會上傳照片並開始去背' : '略過去背，直接保留原始照片'
    : step === 2 ? cutoutState === 'done' ? '去背圖會用在搭配板，原照片仍會保留' : '去背失敗仍可用原始照片繼續'
      : step === 3 ? '必填只有品名和類型，其他想到再補' : '確認後就會儲存這件衣物'

  if (loadingCategories) return <main className="mx-auto max-w-5xl px-4 py-10"><div role="status">正在準備衣物分類…</div></main>

  return (
    <main className="flex min-h-[calc(100dvh-84px)] flex-col pb-36 lg:pb-24">
      <header className="flex flex-wrap items-center gap-3 border-b-[1.5px] border-dashed border-line-strong px-3 py-2 sm:px-6 lg:px-8">
        <button type="button" aria-label="關閉新增衣物" disabled={uploading || saving || convertingPhotos} onClick={() => void closeWizard()} className="flex size-11 flex-none items-center justify-center rounded-btn text-ink hover:bg-tile disabled:opacity-40"><Icon name="x" /></button>
        <div className="flex min-w-0 flex-col"><TiltLabel accent="oat" className="!h-8 !text-[16px]">新增衣物</TiltLabel><span className="mt-1 text-[11px] text-ink-3">照片、表單會保留在這個新增流程中</span></div>
        <ol aria-label="新增步驟" className="ml-auto flex list-none gap-1 p-0">
          {visualSteps.map((label, index) => {
            const number = index + 1
            const active = number === displayStep
            const done = number < displayStep
            return <li key={`${number}-${label}`}><button type="button" onClick={() => navigateStep(number)} aria-current={active ? 'step' : undefined} disabled={uploading || saving || convertingPhotos || cutoutState === 'processing' || number > displayStep || (number < displayStep && number !== 1 && !draftId)} className={`flex size-11 items-center justify-center rounded-full text-xs font-num font-bold disabled:opacity-40 sm:w-auto sm:gap-2 sm:rounded-full sm:px-3 ${active ? 'bg-oat-soft text-ink' : 'bg-transparent text-ink-2'}`}><span className={`flex size-7 items-center justify-center rounded-full ${active ? 'bg-ink text-paper' : done ? 'bg-sage text-sage-ink' : 'bg-tile text-ink-2'}`}>{done ? <Icon name="check" size={14} /> : number}</span><span className="hidden sm:inline">{label}</span></button></li>
          })}
        </ol>
      </header>

      <div className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {error && <div role="alert" className="flex items-start gap-2 rounded-tile border-[1.5px] border-rose bg-rose-soft px-4 py-3 text-sm text-rose-ink"><Icon name="alert" size={18} className="mt-0.5 flex-none" /><span className="flex-1">{error}</span><button type="button" aria-label="關閉錯誤訊息" onClick={() => setError(null)} className="flex size-8 flex-none items-center justify-center"><Icon name="x" size={16} /></button></div>}

        {step === 1 && <section className="space-y-6" onDragOver={(event: DragEvent) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(event: DragEvent) => { event.preventDefault(); setDragging(false); appendFiles(event.dataTransfer.files) }}>
          <div><h1 className="m-0 font-hd text-3xl">放上照片</h1><p className="mb-0 mt-2 text-sm leading-6 text-ink-2">可以放好幾張：自己拍的平拍照、網拍穿搭照、標籤或細節照都行。</p></div>
          {photos.length > 0 && <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5">
            {photos.map((photo, index) => <figure key={photo.id} className="m-0 flex min-w-0 flex-col gap-1.5">
              <div className={`relative aspect-[4/5] overflow-hidden rounded-tile bg-tile ${index === 0 ? 'ring-2 ring-inset ring-sage-deep' : ''}`}>
                <PhotoImage src={photo.url} alt={`${photo.file.name}，${index === 0 ? '封面' : `第 ${index + 1} 張`}`} fileName={photo.file.name} />
                {index === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-ink px-2 py-1 text-[10px] text-paper">★ 封面</span>}
                <span className="absolute bottom-1.5 left-1.5 rounded-full bg-card/95 px-2 py-1 text-[10px] text-ink">{fileKind(photo.file)}</span>
                <button type="button" aria-label={`移除${photo.file.name}`} onClick={() => removePhoto(photo.id)} className="absolute right-1 top-1 flex size-11 items-center justify-center rounded-full bg-card/95 text-ink"><Icon name="x" size={16} /></button>
              </div>
              <figcaption className="flex min-w-0 flex-col gap-1 text-[11px] text-ink-2">
                <div className="flex min-w-0 items-center justify-between gap-1"><span className="min-w-0 truncate">{index === 0 ? '封面照片' : '照片 ' + (index + 1)}</span><span className="flex flex-none"><button type="button" aria-label={`將第 ${index + 1} 張照片往前移`} disabled={index === 0} onClick={() => movePhoto(index, -1)} className="flex size-11 items-center justify-center disabled:opacity-30"><Icon name="back" size={15} /></button><button type="button" aria-label={`將第 ${index + 1} 張照片往後移`} disabled={index === photos.length - 1} onClick={() => movePhoto(index, 1)} className="flex size-11 items-center justify-center disabled:opacity-30"><Icon name="next" size={15} /></button></span></div>
                <div className="flex min-w-0 gap-1"><button type="button" onClick={() => setCutoutPhotoId(photo.id)} aria-pressed={cutoutPhoto?.id === photo.id} className={`min-h-11 min-w-0 flex-1 truncate rounded-sm px-1 text-[10px] ${cutoutPhoto?.id === photo.id ? 'bg-mist-soft text-mist-ink' : 'bg-card text-ink-2'}`}>{cutoutPhoto?.id === photo.id ? '✓ 去背來源' : '選作去背'}</button>{index > 0 && <button type="button" onClick={() => setCover(index)} className="min-h-11 min-w-0 flex-1 truncate rounded-sm bg-card px-1 text-[10px] text-mist-deep">設為封面</button>}</div>
              </figcaption>
            </figure>)}
          </div>}
          {photos.length < MAX_PHOTOS && <div className={`flex min-h-56 flex-col items-center justify-center gap-3 rounded-block border-2 border-dashed bg-card p-5 text-center transition-colors ${dragging ? 'border-mist-deep bg-mist-soft' : 'border-line-strong'}`}>
            <span className="flex size-13 items-center justify-center rounded-[16px] bg-oat text-ink shadow-sticker" style={{ rotate: '-4deg' }}><Icon name="plus" size={26} /></span>
            <p className="m-0 text-sm font-medium">拖放、貼上（Ctrl＋V）或選擇照片</p>
            <p className="m-0 text-xs text-ink-2">JPG、PNG、WebP、HEIC・最多 8 張・HEIC 會自動轉 JPEG</p>
            <div className="flex flex-wrap justify-center gap-2"><Button variant="primary" onClick={() => cameraInput.current?.click()}><Icon name="outfit" size={18} />拍照</Button><Button variant="secondary" onClick={() => libraryInput.current?.click()}><Icon name="plus" size={18} />從裝置選擇</Button></div>
            <input ref={libraryInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple className="sr-only" onChange={(event) => { if (event.target.files) appendFiles(event.target.files); event.target.value = '' }} />
            <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => { if (event.target.files) appendFiles(event.target.files); event.target.value = '' }} />
          </div>}
          {photos.length > 0 && <fieldset className="space-y-3 border-0 p-0">
            <legend className="font-hd text-2xl">搭配板要用哪種圖？</legend>
            <div className="grid gap-3 md:grid-cols-2">
              <ChoiceCard selected={useCutout} accent="oat" title="做一張去背圖" badge="推薦" onClick={() => setUseCutout(true)} description="選第 1 張平拍照自動去背。搭配板會更整齊，原本照片都會保留。" />
              <ChoiceCard selected={!useCutout} accent="mist" title="先不用，直接用照片" onClick={() => setUseCutout(false)} description="適合網拍穿搭照或暫時不去背；搭配板會使用封面照，之後仍可補做。" />
            </div>
          </fieldset>}
        </section>}

        {step === 2 && <section className="space-y-5">
          <div><h1 className="m-0 font-hd text-3xl">確認去背結果</h1><p className="mb-0 mt-2 text-sm text-ink-2">使用「{cutoutPhoto?.file.name ?? '封面照片'}」製作去背圖；其他原始照片也會保留。</p></div>
          {cutoutState === 'processing' && <CutoutProcessingState />}
          {cutoutState === 'failed' && <CutoutFailureState message={error ?? '去背沒有完成，原始照片仍保留。可以重試，或直接用原圖繼續。'} onRetry={() => void processCutout()} onUseOriginal={continueWithOriginal} />}
          {cutoutState === 'demo' && <CutoutFailureState message="示範模式不會連線呼叫去背服務；照片會保留為原圖，你仍可繼續填衣物資料。" onRetry={() => setToast({ tone: 'error', text: '自動去背需連接 Supabase，示範模式無法重試。' })} onUseOriginal={continueWithOriginal} />}
          {cutoutState === 'done' && <div className="grid gap-4 sm:grid-cols-2">
            <PhotoPreview photo={cutoutPhoto} title="去背來源照片（會保留）" />
            <div className="space-y-2"><div className="relative aspect-[4/5] overflow-hidden rounded-block bg-tile"><img src={cutoutUrl ?? photos[0]?.url} alt="去背結果預覽" className="size-full object-contain p-8" /><span className="absolute left-3 top-3 rounded-full bg-sage-deep px-3 py-1.5 text-xs text-white">搭配板會用這張</span></div><p className="m-0 text-xs text-ink-2">去背結果・原照片仍保留</p></div>
          </div>}
          {cutoutState === 'done' && <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => void processCutout()}>重新去背</Button><Button variant="ghost" onClick={continueWithOriginal}>不去背了，直接用照片</Button></div>}
        </section>}

        {step === 3 && <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_250px]">
          <form id="garment-info-form" onSubmit={(event) => void goToReview(event)} className="order-2 space-y-5 lg:order-1">
            <div className="flex items-center gap-3"><PhotoPreview photo={photos[0]} title="封面預覽" compact /><div><h1 className="m-0 font-hd text-3xl">衣物資料</h1><p className="mb-0 mt-2 text-sm text-ink-2">必填只有品名和類型，其他想到再補。</p></div></div>
            <FormSection title="基本" accent="oat">
              <Field label="品名" required><input value={form.name} onChange={(event) => updateForm('name', event.target.value)} required placeholder="例如：燕麥色羊毛圓領針織衫" className={INPUT_CLASS} /></Field>
              <fieldset className="space-y-2 border-0 p-0"><legend className="text-[13px] font-medium text-ink">類型<span className="ml-1 text-rose-deep">必填</span><small className="ml-2 text-ink-3">依你的衣櫃分類</small></legend><div className="flex flex-wrap gap-2" role="radiogroup" aria-label="衣物類型">{categories.map((category) => <Chip key={category.id} selected={form.categoryId === category.id} onClick={() => updateForm('categoryId', category.id)} dotColor={category.slot ? undefined : 'var(--color-line-strong)'}>{category.name}</Chip>)}</div></fieldset>
              <div className="grid gap-3 sm:grid-cols-2"><Field label="品牌"><input value={form.brand} onChange={(event) => updateForm('brand', event.target.value)} placeholder="選填" className={INPUT_CLASS} /></Field><Field label="標籤尺寸"><input value={form.size} onChange={(event) => updateForm('size', event.target.value)} placeholder="衣物標籤上寫的尺寸" className={INPUT_CLASS} /></Field></div>
              <Field label="季節" hint="可複選"><div className="flex flex-wrap gap-2">{SEASONS.map((season) => <Chip key={season} selected={form.seasons.includes(season)} onClick={() => toggleSeason(season)}>{season}</Chip>)}</div></Field>
            </FormSection>
            <FormSection title="平放尺寸" accent="mist" hint="單位 cm・選填">
              {measurements.length ? <><div className="mb-2 rounded-tile bg-apricot p-3 text-xs leading-5 text-ink-2">平放在桌面量，不要拉扯布料；網拍尺寸表通常也是平放量。誤差 1–2 cm 屬於正常。</div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{measurements.map((field) => <Field key={field.key} label={field.label}><span className="flex h-12 items-center rounded-btn border-[1.5px] border-line bg-card px-3 focus-within:border-mist-deep"><input type="number" min="0" step="0.1" inputMode="decimal" value={form.flatMeasurements[field.key] ?? ''} onChange={(event) => updateForm('flatMeasurements', { ...form.flatMeasurements, [field.key]: event.target.value })} placeholder="選填" className="min-w-0 flex-1 bg-transparent text-right font-num text-lg font-bold outline-none" /><span className="ml-2 font-num text-xs text-ink-2">cm</span></span></Field>)}</div></> : <p className="m-0 text-sm text-ink-2">這個分類暫無建議的平放尺寸欄位。</p>}
            </FormSection>
            <FormSection title="顏色" accent="rose" hint="選一個色系作篩選">
              <div className="flex flex-wrap gap-2">{COLORS.map((color) => <button key={color.name} type="button" aria-pressed={form.colorHex === color.hex} onClick={() => { updateForm('colorName', color.name); updateForm('colorHex', color.hex) }} className={`flex min-h-11 items-center gap-2 rounded-full border-[1.5px] px-2.5 text-xs ${form.colorHex === color.hex ? 'border-ink bg-ink text-paper' : 'border-line bg-card text-ink'}`}><span aria-hidden="true" className="size-6 rounded-full border border-ink/15" style={{ background: color.hex }} />{color.name}</button>)}</div>
              <details className="border-t border-dashed border-line pt-3"><summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">自訂色碼與第二色 <span className="ml-2 text-xs font-normal text-ink-3">選填</span></summary><div className="grid gap-3 sm:grid-cols-2"><Field label="主色色碼"><input type="color" value={form.colorHex} onChange={(event) => updateForm('colorHex', event.target.value)} className="h-12 w-full rounded-btn border border-line bg-card p-1" /></Field><Field label="第二色"><input type="color" value={form.secondColorHex || '#FFFFFF'} onChange={(event) => updateForm('secondColorHex', event.target.value)} className="h-12 w-full rounded-btn border border-line bg-card p-1" /></Field></div></details>
            </FormSection>
            <FormSection title="材質" accent="sage" hint="可複選；可補成分比例">
              <div className="flex flex-wrap gap-2">{MATERIALS.map((material) => { const selected = (form.material ?? '').split('、').includes(material); return <Chip key={material} selected={selected} onClick={() => toggleMaterial(material)}>{material}</Chip> })}</div>
              <Field label="成分比例"><input value={form.materialComposition} onChange={(event) => updateForm('materialComposition', event.target.value)} placeholder="例如：羊毛 70%・尼龍 30%" className={INPUT_CLASS} /></Field>
            </FormSection>
            <FormSection title="購買資訊" accent="oat" hint="全部選填">
              <div className="grid gap-3 sm:grid-cols-2"><Field label="價格"><span className="flex h-12 items-center gap-2 rounded-btn border-[1.5px] border-line bg-card px-3"><span className="font-num text-xs text-ink-2">NT$</span><input type="number" min="0" step="1" value={form.purchasePrice ?? ''} onChange={(event) => updateForm('purchasePrice', event.target.value === '' ? null : Number(event.target.value))} placeholder="0" className="min-w-0 flex-1 bg-transparent text-right font-num text-lg outline-none" /></span></Field><Field label="購買通路"><input value={form.store} onChange={(event) => updateForm('store', event.target.value)} placeholder="店名或網站" className={INPUT_CLASS} /></Field></div>
              <DatePicker label="購買日期" value={form.purchaseDate} onChange={(value) => updateForm('purchaseDate', value)} clearable />
              <Field label="商品網址"><input type="url" value={form.productUrl} onChange={(event) => updateForm('productUrl', event.target.value)} placeholder="https://" className={INPUT_CLASS} /></Field>
            </FormSection>
            <FormSection title="備註" accent="mist"><textarea rows={3} value={form.note} onChange={(event) => updateForm('note', event.target.value)} placeholder="洗滌方式、穿著感受或其他備註" className={`${INPUT_CLASS} h-auto resize-y py-3`} /></FormSection>
          </form>
          <aside className="order-1 hidden space-y-3 lg:sticky lg:top-4 lg:order-2 lg:block"><PaperCard className="p-3"><Tape accent="mist" /><PhotoPreview photo={photos[0]} title="封面預覽" /><p className="mb-0 mt-2 text-xs text-ink-2">{form.name || '尚未命名'}<br />{selectedCategory?.name ?? '尚未選類型'}・{form.brand || '未填品牌'}・{form.size || '未填尺寸'}</p></PaperCard><nav aria-label="跳到欄位" className="space-y-1 text-sm">{['基本', '平放尺寸', '顏色', '材質', '購買資訊', '備註'].map((section) => <a key={section} href={`#section-${section}`} className="block min-h-9 py-2 text-ink-2">{section}</a>)}</nav></aside>
          </section>}

        {step === 4 && <section className="grid gap-6 md:grid-cols-[260px_minmax(0,1fr)]">
          <PaperCard className="relative space-y-3 p-3"><Tape accent="oat" /><PhotoPreview photo={photos[0]} title="搭配板預覽" /><div><p className="mb-1 font-medium">{form.name}</p><p className="m-0 text-sm text-ink-2">{form.colorName}・{form.brand || '未填品牌'}・{form.size || '未填尺寸'}</p></div><div className="flex flex-wrap gap-1.5"><span className="rounded-full bg-tile px-2.5 py-1 text-xs">{photos.length} 張照片</span><span className="rounded-full bg-sage-soft px-2.5 py-1 text-xs text-sage-ink">{cutoutState === 'done' && useCutout ? '去背圖' : '使用原圖'}</span><span className="rounded-full bg-mist-soft px-2.5 py-1 text-xs text-mist-ink">平放尺寸 {Object.values(form.flatMeasurements).filter(Boolean).length} 項</span></div></PaperCard>
          <div className="space-y-5"><h1 className="m-0 font-hd text-3xl">要放到哪裡？</h1><div role="radiogroup" aria-label="儲存位置" className="space-y-3"><ChoiceCard selected={destination === 'closet'} accent="sage" title="我的衣櫃（已購買）" description="可以馬上用在今日搭配。" onClick={() => setDestination('closet')} /><ChoiceCard selected={destination === 'wishlist'} accent="rose" title="選購清單（還在考慮）" description="網拍穿搭照和尺寸表一起留著，方便比較。" disabled={!selectedCategory?.slot} onClick={() => setDestination('wishlist')} /></div><div className="space-y-1 rounded-tile bg-card p-4 text-sm text-ink-2"><p className="m-0">搭配板用圖：<b className="font-medium text-ink">{cutoutState === 'done' && useCutout ? '去背圖' : '封面原圖'}</b></p><p className="m-0">平放尺寸：<b className="font-medium text-ink">已填 {Object.values(form.flatMeasurements).filter(Boolean).length} 項</b></p></div><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={continueAdding} onChange={(event) => setContinueAdding(event.target.checked)} className="size-5 accent-[var(--color-ink)]" />存好後繼續新增下一件</label></div>
        </section>}
      </div>

      <footer className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-20 flex items-center gap-2 border-t-[1.5px] border-dashed border-line-strong bg-card/95 px-4 py-3 backdrop-blur md:bottom-0 md:px-8">
        {step > 1 && <Button variant="ghost" onClick={goBack} disabled={uploading || saving}><Icon name="back" />上一步</Button>}
        <span className="hidden min-w-0 flex-1 truncate text-sm text-ink-2 sm:block">{footerHint}</span>
        {step === 1 && <Button variant="primary" className="ml-auto" disabled={uploading || convertingPhotos || photos.length === 0} onClick={() => void beginMediaStep()}>{convertingPhotos ? 'HEIC 轉檔中…' : uploading ? '照片上傳中…' : '下一步'}<Icon name="next" /></Button>}
        {step === 2 && <Button variant="primary" className="ml-auto" disabled={cutoutState === 'processing'} onClick={() => { if (cutoutState === 'failed' || cutoutState === 'demo') continueWithOriginal(); else setStep(3) }}>下一步<Icon name="next" /></Button>}
        {step === 3 && <Button variant="primary" className="ml-auto" disabled={uploading} type="submit" form="garment-info-form">{uploading ? '儲存草稿中…' : '確認'}<Icon name="next" /></Button>}
        {step === 4 && <Button variant="oat" className="ml-auto" disabled={saving} onClick={() => void finish()}><Icon name="check" />{saving ? '儲存中…' : destination === 'closet' ? '放進衣櫃' : '加入選購清單'}</Button>}
      </footer>
      {uploading && <div className="fixed inset-0 z-30 flex items-center justify-center bg-scrim p-5"><div className="w-full max-w-md"><ImageUploadProgressState title="正在上傳照片" files={photos.map((photo, index) => ({ id: photo.id, name: photo.file.name, progress: 0, status: index === 0 ? '封面・上傳中' : '上傳中' }))} backgroundNote="照片完成後會保留在私人衣櫃空間。" /></div></div>}
      {saving && <div className="fixed inset-0 z-40 flex items-center justify-center bg-scrim p-5"><div className="w-full max-w-sm">{useCutout && cutoutState !== 'done' ? <CutoutProcessingState /> : <PaperCard aria-busy="true" className="p-6 text-center"><span className="mx-auto mb-3 block size-8 animate-pulse rounded-full bg-sage" /><p className="m-0 font-hd text-xl">正在儲存衣物</p><p className="mb-0 mt-2 text-sm text-ink-2">照片和資料都會一併整理好。</p></PaperCard>}</div></div>}
      <Toast message={toast} onClose={() => setToast(null)} />
    </main>
  )
}

function ChoiceCard({ selected, accent, title, description, badge, disabled = false, onClick }: { selected: boolean; accent: 'oat' | 'mist' | 'rose' | 'sage'; title: string; description: string; badge?: string; disabled?: boolean; onClick: () => void }) {
  return <button type="button" role="radio" aria-checked={selected} disabled={disabled} onClick={onClick} className={`relative flex w-full gap-3 overflow-hidden rounded-card border-[1.5px] p-4 text-left disabled:cursor-not-allowed disabled:opacity-50 ${selected ? 'border-ink bg-card shadow-paper' : 'border-line-strong bg-card'}`}><WashBlob accent={accent} className="-right-4 -top-4 size-16" tilt={12} /><span aria-hidden="true" className={`mt-0.5 flex size-5 flex-none items-center justify-center rounded-full border ${selected ? 'border-ink' : 'border-line-strong'}`}>{selected && <span className="size-2.5 rounded-full bg-ink" />}</span><span className="relative min-w-0"><span className="flex flex-wrap items-center gap-2 font-medium">{title}{badge && <span className="rounded-full bg-sage-soft px-2 py-0.5 text-[10px] text-sage-ink">{badge}</span>}</span><span className="mt-1 block text-xs leading-5 text-ink-2">{description}</span></span></button>
}

function PhotoPreview({ photo, title, compact = false }: { photo?: Photo; title: string; compact?: boolean }) {
  if (!photo) return <div role="img" aria-label={`${title}尚未選擇`} className={`${compact ? 'h-20 w-16' : 'aspect-[4/5] w-full'} flex items-center justify-center rounded-tile bg-tile text-ink-3`}><Icon name="closet" size={compact ? 24 : 38} /></div>
  return <div className={`${compact ? 'h-20 w-16' : 'aspect-[4/5] w-full'} overflow-hidden rounded-tile bg-tile`}><PhotoImage src={photo.url} alt={title} fileName={photo.file.name} /></div>
}

function PhotoImage({ src, alt, fileName }: { src: string; alt: string; fileName: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <div role="img" aria-label={`${alt}，瀏覽器無法預覽 ${fileName}`} className="flex size-full flex-col items-center justify-center gap-2 p-2 text-center text-xs text-ink-2"><Icon name="alert" size={22} />保留照片<br /><span className="break-all">{fileName}</span></div>
  return <img src={src} alt={alt} className="size-full object-cover" onError={() => setFailed(true)} />
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return <label className="flex min-w-0 flex-col gap-1.5"><span className="text-[13px] font-medium text-ink">{label}{required && <span className="ml-1 text-[11px] font-normal text-rose-deep">必填</span>}{hint && <small className="ml-1 text-[11px] font-normal text-ink-3">{hint}</small>}</span>{children}</label>
}

function FormSection({ title, accent, hint, children }: { title: string; accent: 'oat' | 'mist' | 'rose' | 'sage'; hint?: string; children: ReactNode }) {
  return <section id={`section-${title}`} className="space-y-4 rounded-block bg-card p-4 shadow-paper sm:p-5"><div className="flex flex-wrap items-center gap-2"><TiltLabel accent={accent}>{title}</TiltLabel>{hint && <span className="text-xs text-ink-2">{hint}</span>}</div>{children}</section>
}
