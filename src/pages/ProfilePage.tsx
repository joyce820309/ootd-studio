import { useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { DatePicker } from '@/components/ui/DatePicker'
import { Icon } from '@/components/ui/Icon'
import { PaperCard, TiltLabel, WashBlob } from '@/components/ui/Paper'
import { LoadingState, PageState } from '@/components/ui/PageState'
import { Toast, type ToastMessage } from '@/components/ui/Toast'
import { SAMPLE_PROFILE } from '@/data/sample'
import { fetchProfileData, saveBodyMeasurement, saveProfilePreferences } from '@/lib/data'
import { todayISO } from '@/lib/date'
import type { BodyMeasurement, BodyMeasurementInput, ProfilePreferences, ShoeSize } from '@/types'

type MeasurementKey = 'heightCm' | 'weightKg' | 'shoulderCm' | 'upperBustCm' | 'underBustCm' | 'waistCm' | 'navelCm' | 'hipCm' | 'armCm' | 'inseamCm' | 'thighCm' | 'footToeLengthCm' | 'footToeWidthCm' | 'footToeBallCm' | 'footToeInstepCm' | 'footSockLengthCm' | 'footSockWidthCm' | 'footSockBallCm' | 'footSockInstepCm' | 'footBareLengthCm' | 'footBareWidthCm' | 'footBareBallCm' | 'footBareInstepCm'
type MeasurementDraft = Record<MeasurementKey, string> & { measuredOn: string; note: string }

type MeasurementGroup = {
  title: string
  accent: 'oat' | 'mist' | 'sage' | 'rose'
  fields: { key: MeasurementKey; label: string; unit: string }[]
}

const GROUPS: MeasurementGroup[] = [
  { title: '基本', accent: 'oat', fields: [{ key: 'heightCm', label: '身高', unit: 'cm' }, { key: 'weightKg', label: '體重', unit: 'kg' }] },
  { title: '上半身', accent: 'mist', fields: [{ key: 'shoulderCm', label: '肩寬', unit: 'cm' }, { key: 'upperBustCm', label: '上胸圍', unit: 'cm' }, { key: 'underBustCm', label: '下胸圍', unit: 'cm' }, { key: 'armCm', label: '手臂長', unit: 'cm' }] },
  { title: '下半身', accent: 'sage', fields: [{ key: 'waistCm', label: '腰圍', unit: 'cm' }, { key: 'navelCm', label: '肚臍圍', unit: 'cm' }, { key: 'hipCm', label: '臀圍', unit: 'cm' }, { key: 'inseamCm', label: '腿長（內側）', unit: 'cm' }, { key: 'thighCm', label: '大腿圍', unit: 'cm' }] },
  { title: '腳', accent: 'rose', fields: [
    { key: 'footToeLengthCm', label: '腳長', unit: 'cm' }, { key: 'footToeWidthCm', label: '腳寬', unit: 'cm' }, { key: 'footToeBallCm', label: '前掌圍', unit: 'cm' }, { key: 'footToeInstepCm', label: '腳背圍', unit: 'cm' },
    { key: 'footSockLengthCm', label: '腳長', unit: 'cm' }, { key: 'footSockWidthCm', label: '腳寬', unit: 'cm' }, { key: 'footSockBallCm', label: '前掌圍', unit: 'cm' }, { key: 'footSockInstepCm', label: '腳背圍', unit: 'cm' },
    { key: 'footBareLengthCm', label: '腳長', unit: 'cm' }, { key: 'footBareWidthCm', label: '腳寬', unit: 'cm' }, { key: 'footBareBallCm', label: '前掌圍', unit: 'cm' }, { key: 'footBareInstepCm', label: '腳背圍', unit: 'cm' },
  ] },
]

const METRIC_KEYS: MeasurementKey[] = GROUPS.flatMap((group) => group.fields.map((field) => field.key))
const FIT_OPTIONS = ['高腰', '直筒', '落肩', '九分褲長', '合身', 'A 字']
const DEFAULT_SHOE_SIZE: ShoeSize = { label: '新鞋款', eu: '', us: '', uk: '', jp: '' }
const FOOT_TABS = [
  { id: 'toe', label: '穿五指襪', prefix: 'footToe', accent: 'oat' },
  { id: 'sock', label: '穿一般襪', prefix: 'footSock', accent: 'mist' },
  { id: 'bare', label: '裸腳', prefix: 'footBare', accent: 'rose' },
] as const

function today() {
  return todayISO()
}

function blankDraft(): MeasurementDraft {
  return {
    measuredOn: today(), note: '', heightCm: '', weightKg: '', shoulderCm: '', upperBustCm: '', underBustCm: '',
    waistCm: '', navelCm: '', hipCm: '', armCm: '', inseamCm: '', thighCm: '',
    footToeLengthCm: '', footToeWidthCm: '', footToeBallCm: '', footToeInstepCm: '',
    footSockLengthCm: '', footSockWidthCm: '', footSockBallCm: '', footSockInstepCm: '',
    footBareLengthCm: '', footBareWidthCm: '', footBareBallCm: '', footBareInstepCm: '',
  }
}

function measurementToDraft(measurement: BodyMeasurement): MeasurementDraft {
  return {
    measuredOn: measurement.measuredOn,
    note: measurement.note,
    heightCm: measurement.heightCm?.toString() ?? '',
    weightKg: measurement.weightKg?.toString() ?? '',
    shoulderCm: measurement.shoulderCm?.toString() ?? '',
    upperBustCm: measurement.upperBustCm?.toString() ?? '',
    underBustCm: measurement.underBustCm?.toString() ?? '',
    waistCm: measurement.waistCm?.toString() ?? '',
    navelCm: measurement.navelCm?.toString() ?? '',
    hipCm: measurement.hipCm?.toString() ?? '',
    armCm: measurement.armCm?.toString() ?? '',
    inseamCm: measurement.inseamCm?.toString() ?? '',
    thighCm: measurement.thighCm?.toString() ?? '',
    footToeLengthCm: measurement.footToeLengthCm?.toString() ?? '',
    footToeWidthCm: measurement.footToeWidthCm?.toString() ?? '',
    footToeBallCm: measurement.footToeBallCm?.toString() ?? '',
    footToeInstepCm: measurement.footToeInstepCm?.toString() ?? '',
    footSockLengthCm: measurement.footSockLengthCm?.toString() ?? '',
    footSockWidthCm: measurement.footSockWidthCm?.toString() ?? '',
    footSockBallCm: measurement.footSockBallCm?.toString() ?? '',
    footSockInstepCm: measurement.footSockInstepCm?.toString() ?? '',
    footBareLengthCm: measurement.footBareLengthCm?.toString() ?? '',
    footBareWidthCm: measurement.footBareWidthCm?.toString() ?? '',
    footBareBallCm: measurement.footBareBallCm?.toString() ?? '',
    footBareInstepCm: measurement.footBareInstepCm?.toString() ?? '',
  }
}

function toMeasurementInput(draft: MeasurementDraft, id?: string): BodyMeasurementInput {
  const numberOrNull = (value: string) => value.trim() ? Number(value) : null
  return {
    ...(id ? { id } : {}),
    measuredOn: draft.measuredOn,
    note: draft.note.trim(),
    heightCm: numberOrNull(draft.heightCm),
    weightKg: numberOrNull(draft.weightKg),
    shoulderCm: numberOrNull(draft.shoulderCm),
    upperBustCm: numberOrNull(draft.upperBustCm),
    underBustCm: numberOrNull(draft.underBustCm),
    waistCm: numberOrNull(draft.waistCm),
    navelCm: numberOrNull(draft.navelCm),
    hipCm: numberOrNull(draft.hipCm),
    armCm: numberOrNull(draft.armCm),
    inseamCm: numberOrNull(draft.inseamCm),
    thighCm: numberOrNull(draft.thighCm),
    footToeLengthCm: numberOrNull(draft.footToeLengthCm),
    footToeWidthCm: numberOrNull(draft.footToeWidthCm),
    footToeBallCm: numberOrNull(draft.footToeBallCm),
    footToeInstepCm: numberOrNull(draft.footToeInstepCm),
    footSockLengthCm: numberOrNull(draft.footSockLengthCm),
    footSockWidthCm: numberOrNull(draft.footSockWidthCm),
    footSockBallCm: numberOrNull(draft.footSockBallCm),
    footSockInstepCm: numberOrNull(draft.footSockInstepCm),
    footBareLengthCm: numberOrNull(draft.footBareLengthCm),
    footBareWidthCm: numberOrNull(draft.footBareWidthCm),
    footBareBallCm: numberOrNull(draft.footBareBallCm),
    footBareInstepCm: numberOrNull(draft.footBareInstepCm),
  }
}

function dateLabel(date: string) {
  const [year, month, day] = date.split('-')
  return `${year}/${month}/${day}`
}

function MetricField({
  field,
  draft,
  setDraft,
  baseline,
}: {
  field: MeasurementGroup['fields'][number]
  draft: MeasurementDraft
  setDraft: Dispatch<SetStateAction<MeasurementDraft>>
  baseline?: BodyMeasurement | null
}) {
  const baselineValue = baseline?.[field.key]
  const isChanged = !!baseline && draft[field.key].trim() !== (baselineValue == null ? '' : String(baselineValue))
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-[13px] text-ink">
      <span>{field.label}</span>
      <span className={`flex h-12 items-center gap-2 rounded-btn border-[1.5px] px-3 focus-within:border-mist-deep ${isChanged ? 'border-oat-edge bg-oat-soft' : 'border-line bg-paper'}`}>
        <input
          type="number"
          min="0"
          step="0.1"
          inputMode="decimal"
          value={draft[field.key]}
          onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
          placeholder="選填"
          aria-label={`${field.label}（${field.unit}）`}
          className="h-full min-w-0 flex-1 bg-transparent text-right font-num text-lg font-bold text-ink outline-none placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:text-ink-3"
        />
        <span className="w-7 flex-none text-right font-num text-[13px] text-ink-2">{field.unit}</span>
        {isChanged && <span className="whitespace-nowrap rounded-full bg-oat px-2 py-0.5 text-[10px] font-medium text-oat-ink">已修改</span>}
      </span>
    </label>
  )
}

export function ProfilePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [profile, setProfile] = useState<ProfilePreferences>(SAMPLE_PROFILE)
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([])
  const [draft, setDraft] = useState<MeasurementDraft>(blankDraft)
  const [editingId, setEditingId] = useState<string | undefined>()
  const [baseline, setBaseline] = useState<BodyMeasurement | null>(null)
  const [feetTab, setFeetTab] = useState<(typeof FOOT_TABS)[number]['id']>('toe')
  const [loading, setLoading] = useState(true)
  const [savingMeasurements, setSavingMeasurements] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [customSize, setCustomSize] = useState('')
  const [customFit, setCustomFit] = useState('')
  const [customDislikedCut, setCustomDislikedCut] = useState('')
  const measurementFormRef = useRef<HTMLFormElement>(null)
  const editId = searchParams.get('edit')

  useEffect(() => {
    let alive = true
    fetchProfileData()
      .then(({ profile: nextProfile, measurements: nextMeasurements }) => {
        if (!alive) return
        setProfile(nextProfile)
        setMeasurements(nextMeasurements)
        const editing = editId ? nextMeasurements.find((measurement) => measurement.id === editId) : undefined
        if (editing) {
          const editIndex = nextMeasurements.findIndex((measurement) => measurement.id === editing.id)
          setBaseline(nextMeasurements[editIndex + 1] ?? null)
          setDraft(measurementToDraft(editing))
          setEditingId(editing.id)
        } else if (nextMeasurements[0]) {
          setBaseline(nextMeasurements[0])
          setDraft({ ...measurementToDraft(nextMeasurements[0]), measuredOn: today() })
          setEditingId(undefined)
        } else {
          setBaseline(null)
          setDraft(blankDraft())
          setEditingId(undefined)
        }
        setError(null)
      })
      .catch((cause: Error) => alive && setError(cause.message || '個人資料載入失敗，請稍後再試。'))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [editId])

  const filledCount = useMemo(() => METRIC_KEYS.filter((key) => draft[key].trim() !== '').length, [draft])
  const progress = Math.round((filledCount / METRIC_KEYS.length) * 100)
  const completedGroups = GROUPS.filter((group) => group.fields.every(({ key }) => draft[key].trim() !== '')).length

  function updateProfile<K extends keyof ProfilePreferences>(key: K, value: ProfilePreferences[K]) {
    setProfile((current) => ({ ...current, [key]: value }))
  }

  function toggleListValue(key: 'fitPreferences' | 'dislikedCuts', value: string) {
    const values = profile[key]
    updateProfile(key, values.includes(value) ? values.filter((item) => item !== value) : [...values, value])
  }

  function addListValue(key: 'fitPreferences' | 'dislikedCuts' | 'frequentSizes', value: string) {
    const normalized = value.trim()
    if (!normalized || profile[key].includes(normalized)) return
    updateProfile(key, [...profile[key], normalized])
  }

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingProfile(true)
    try {
      const result = await saveProfilePreferences(profile)
      setToast({ tone: 'success', text: result.demo ? '偏好已套用在本次示範工作階段，重新整理後會還原。' : '個人偏好已儲存。' })
    } catch (cause) {
      setToast({ tone: 'error', text: cause instanceof Error ? cause.message : '個人偏好儲存失敗。' })
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleSaveMeasurement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft.measuredOn) {
      setToast({ tone: 'error', text: '請先選擇量測日期。' })
      return
    }
    if (filledCount === 0) {
      setToast({ tone: 'error', text: '至少填寫一項尺寸，再儲存量測紀錄。' })
      return
    }
    if (METRIC_KEYS.some((key) => draft[key].trim() && (!Number.isFinite(Number(draft[key])) || Number(draft[key]) <= 0))) {
      setToast({ tone: 'error', text: '尺寸請輸入大於 0 的數字。' })
      return
    }

    setSavingMeasurements(true)
    try {
      const result = await saveBodyMeasurement(toMeasurementInput(draft, editingId))
      setMeasurements((current) => [result.measurement, ...current.filter((item) => item.id !== result.measurement.id)]
        .sort((a, b) => b.measuredOn.localeCompare(a.measuredOn)))
      setBaseline(result.measurement)
      setEditingId(undefined)
      setSearchParams({}, { replace: true })
      setDraft({ ...measurementToDraft(result.measurement), measuredOn: today() })
      setToast({ tone: 'success', text: editingId ? '這筆量測紀錄已更新。' : result.demo ? '新量測快照已加入本次示範工作階段。' : '新量測快照已儲存，舊紀錄保留不變。' })
    } catch (cause) {
      setToast({ tone: 'error', text: cause instanceof Error ? cause.message : '量測紀錄儲存失敗。' })
    } finally {
      setSavingMeasurements(false)
    }
  }

  function startNewMeasurement() {
    setEditingId(undefined)
    setBaseline(measurements[0] ?? null)
    setDraft(measurements[0] ? { ...measurementToDraft(measurements[0]), measuredOn: today() } : blankDraft())
    setSearchParams({}, { replace: true })
    measurementFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function updateShoeSize(index: number, key: keyof ShoeSize, value: string) {
    updateProfile('shoeSizes', profile.shoeSizes.map((size, currentIndex) => currentIndex === index ? { ...size, [key]: value } : size))
  }

  function addShoeSize() {
    updateProfile('shoeSizes', [...profile.shoeSizes, { ...DEFAULT_SHOE_SIZE }])
  }

  function removeShoeSize(index: number) {
    updateProfile('shoeSizes', profile.shoeSizes.filter((_, currentIndex) => currentIndex !== index))
  }

  if (loading) {
    return <main className="mx-auto max-w-5xl px-4 py-10"><LoadingState label="正在打開你的尺寸筆記…" /></main>
  }

  return (
    <main className="mx-auto flex max-w-[1200px] flex-col gap-7 px-4 py-7 sm:px-6 md:flex-row md:items-start md:gap-9 md:px-8 md:py-9">
      <div className="min-w-0 flex-[2_1_520px] space-y-5">
        <TiltLabel accent="mist">我的尺寸筆記</TiltLabel>
        <div className="space-y-2">
          <h1 className="m-0 font-hd text-3xl text-ink sm:text-[34px]">個人資料</h1>
          <p className="m-0 max-w-2xl text-[14px] leading-7 text-ink-2 sm:text-[15px]">記下你的尺寸，讓合身比對和搭配建議更貼近你。每一格都可以留白，想到再補就好。</p>
        </div>

        <nav aria-label="個人資料的其他頁面" className="flex flex-wrap gap-2 xl:hidden">
          <Link to="/me/measurements" className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] border-line-strong bg-card px-4 text-sm text-ink no-underline hover:border-ink-3"><Icon name="calendar" size={16} />量測紀錄<Icon name="next" size={14} className="text-ink-3" /></Link>
          <Link to="/me/brands" className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] border-line-strong bg-card px-4 text-sm text-ink no-underline hover:border-ink-3"><Icon name="closet" size={16} />品牌管理<Icon name="next" size={14} className="text-ink-3" /></Link>
        </nav>

        {error && <div role="alert"><PageState icon="alert" tone="rose" compact title="尺寸筆記暫時載入失敗" description={`${error} 目前仍可編輯示範欄位。`} action={<Button onClick={() => window.location.reload()} variant="secondary">重新載入</Button>} /></div>}

        <section aria-label="量測完成度" className="flex items-center gap-3 rounded-tile bg-sage-soft px-4 py-3">
          <div className="flex min-w-0 flex-1 gap-1" aria-hidden="true">
            {GROUPS.map((group) => {
              const groupFilled = group.fields.filter(({ key }) => draft[key].trim()).length
              return <span key={group.title} className={`h-1.5 flex-1 rounded-full ${groupFilled === group.fields.length ? 'bg-sage' : groupFilled ? 'bg-oat' : 'bg-line'}`} />
            })}
          </div>
          <span className="whitespace-nowrap font-num text-[13px] text-sage-ink">完成 {completedGroups} / {GROUPS.length} 組・慢慢來就好</span>
          <span className="sr-only">已完成 {progress}%</span>
        </section>

        <form ref={measurementFormRef} onSubmit={handleSaveMeasurement} className="space-y-3 scroll-mt-6">
          {GROUPS.map((group) => {
            const groupFilled = group.fields.filter(({ key }) => draft[key].trim()).length
            return (
              <details key={group.title} open className="group overflow-hidden rounded-block bg-card shadow-paper">
                <summary className="relative flex min-h-[62px] cursor-pointer list-none items-center gap-3 px-5 py-3 marker:hidden [&::-webkit-details-marker]:hidden">
                  <WashBlob accent={group.accent} className="-right-4 -top-5 size-[70px] rounded-[16px]" tilt={14} />
                  <span className="relative font-hd text-xl text-ink">{group.title}</span>
                  <span className={`relative text-xs ${groupFilled === group.fields.length ? 'text-sage-deep' : 'text-ink-2'}`}>
                    {groupFilled === group.fields.length ? '已填寫' : `${groupFilled} / ${group.fields.length}`}
                  </span>
                  <Icon name="down" size={18} className="relative ml-auto flex-none text-ink-2 transition-transform group-open:rotate-180" />
                </summary>
                <div className="grid grid-cols-2 gap-3 px-5 pb-5 pt-1 sm:grid-cols-3">
                  {group.title === '基本' && (
                    <DatePicker
                      label="量測日期"
                      value={draft.measuredOn || null}
                      onChange={(value) => setDraft((current) => ({ ...current, measuredOn: value ?? '' }))}
                      max={todayISO()}
                      required
                      className="col-span-2 sm:col-span-1"
                    />
                  )}
                  {group.title === '腳' ? (
                    <div className="col-span-2 space-y-3 sm:col-span-3">
                      <div role="tablist" aria-label="腳部量測狀態" className="grid grid-cols-3 gap-1 rounded-btn bg-tile p-1">
                        {FOOT_TABS.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={feetTab === tab.id} onClick={() => setFeetTab(tab.id)} className={`min-h-10 rounded-sm px-1 text-xs sm:text-sm ${feetTab === tab.id ? 'bg-card font-medium text-ink shadow-paper' : 'text-ink-2'}`}>{tab.label}</button>)}
                      </div>
                      <div role="tabpanel" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {group.fields.filter((field) => field.key.startsWith(FOOT_TABS.find((tab) => tab.id === feetTab)!.prefix)).map((field) => <MetricField key={field.key} field={field} draft={draft} setDraft={setDraft} baseline={baseline} />)}
                      </div>
                    </div>
                  ) : group.fields.map((field) => <MetricField key={field.key} field={field} draft={draft} setDraft={setDraft} baseline={baseline} />)}
                </div>
              </details>
            )
          })}
          <label className="flex flex-col gap-1.5 text-[13px] text-ink">
            這次量測備註 <span className="text-xs text-ink-3">選填</span>
            <textarea value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} rows={2} placeholder="例如：更新腰圍、腿長" className="resize-y rounded-btn border-[1.5px] border-line bg-paper px-3 py-2.5 text-sm outline-none placeholder:text-ink-3 focus:border-mist-deep" />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <span className="text-xs text-ink-3">{editingId ? `正在編輯 ${dateLabel(draft.measuredOn)} 的紀錄` : baseline ? '已帶入最近一次數值；儲存會新增快照，不會覆蓋舊紀錄' : '至少填一項，儲存第一筆量測快照'}</span>
            <Button type="submit" variant="primary" disabled={savingMeasurements}>
              <Icon name="check" size={17} />{savingMeasurements ? '儲存中…' : editingId ? '更新這筆紀錄' : '儲存量測紀錄'}
            </Button>
          </div>
        </form>

        <PaperCard className="overflow-hidden">
          <details open className="group">
            <summary className="relative flex min-h-[62px] cursor-pointer list-none items-center gap-3 px-5 py-3 [&::-webkit-details-marker]:hidden">
              <WashBlob accent="rose" className="-right-4 -top-5 size-[70px] rounded-[16px]" tilt={14} />
              <span className="relative font-hd text-xl text-ink">鞋碼對照</span>
              <span className="relative text-xs text-sage-deep">{profile.shoeSizes.length ? '已填寫' : '選填'}</span>
              <Icon name="down" size={18} className="relative ml-auto text-ink-2 transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-3 px-5 pb-5">
              {profile.shoeSizes.map((shoe, index) => (
                <div key={`${index}-${shoe.label}`} className="rounded-tile border-[1.5px] border-line border-dashed p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <input aria-label="鞋款名稱" value={shoe.label} onChange={(event) => updateShoeSize(index, 'label', event.target.value)} placeholder="鞋款，例如運動鞋" className="h-10 min-w-0 flex-1 rounded-sm border border-line bg-paper px-2.5 text-sm text-ink outline-none focus:border-mist-deep" />
                    <button type="button" onClick={() => removeShoeSize(index)} aria-label={`刪除${shoe.label || '鞋款'}`} className="flex size-10 flex-none items-center justify-center rounded-sm text-ink-2 hover:bg-rose-soft hover:text-rose-ink"><Icon name="x" size={17} /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(['eu', 'us', 'uk', 'jp'] as const).map((system) => (
                      <label key={system} className="flex h-10 items-center gap-1.5 rounded-sm border border-line bg-paper px-2 text-xs text-ink-2">
                        <span className="w-7 font-num font-bold uppercase">{system === 'jp' ? 'JP' : system.toUpperCase()}</span>
                        <input aria-label={`${shoe.label} ${system.toUpperCase()} 尺寸`} value={shoe[system]} onChange={(event) => updateShoeSize(index, system, event.target.value)} className="min-w-0 flex-1 bg-transparent text-right font-num text-sm text-ink outline-none" />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <Button variant="secondary" onClick={addShoeSize}><Icon name="plus" size={16} />新增鞋款尺寸</Button>
            </div>
          </details>
        </PaperCard>

        <PaperCard className="overflow-hidden">
          <details open className="group">
            <summary className="relative flex min-h-[62px] cursor-pointer list-none items-center gap-3 px-5 py-3 [&::-webkit-details-marker]:hidden">
              <WashBlob accent="oat" className="-right-4 -top-5 size-[70px] rounded-[16px]" tilt={14} />
              <span className="relative font-hd text-xl text-ink">版型偏好</span>
              <span className="relative text-xs text-sage-deep">可隨時調整</span>
              <Icon name="down" size={18} className="relative ml-auto text-ink-2 transition-transform group-open:rotate-180" />
            </summary>
            <form onSubmit={handleSaveProfile} className="space-y-5 px-5 pb-5">
              <div className="space-y-2">
                <p className="m-0 text-[13px]">常穿尺寸</p>
                <div className="flex flex-wrap gap-2">
                  {profile.frequentSizes.map((size) => (
                    <button key={size} type="button" onClick={() => updateProfile('frequentSizes', profile.frequentSizes.filter((item) => item !== size))} aria-label={`移除${size}`} className="inline-flex min-h-9 items-center gap-1 rounded-full border-[1.5px] border-line-strong bg-card px-3.5 text-[13px] text-ink">{size}<Icon name="x" size={13} /></button>
                  ))}
                  <label className="flex h-9 min-w-[150px] items-center rounded-full border-[1.5px] border-dashed border-line-strong bg-paper px-3">
                    <span className="sr-only">新增常穿尺寸</span>
                    <input value={customSize} onChange={(event) => setCustomSize(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addListValue('frequentSizes', customSize); setCustomSize('') } }} placeholder="輸入尺寸後按 Enter" className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-ink-3" />
                    <Icon name="plus" size={14} className="text-mist-deep" />
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <p className="m-0 text-[13px]">喜歡的版型</p>
                <div className="flex flex-wrap gap-2">
                  {FIT_OPTIONS.map((option) => <button key={option} type="button" aria-pressed={profile.fitPreferences.includes(option)} onClick={() => toggleListValue('fitPreferences', option)} className={`min-h-9 rounded-full border-[1.5px] px-3.5 text-[13px] ${profile.fitPreferences.includes(option) ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-card text-ink'}`}>{option}</button>)}
                  {profile.fitPreferences.filter((option) => !FIT_OPTIONS.includes(option)).map((option) => <button key={option} type="button" aria-pressed="true" onClick={() => toggleListValue('fitPreferences', option)} className="min-h-9 rounded-full border-[1.5px] border-ink bg-ink px-3.5 text-[13px] text-paper">{option} ×</button>)}
                  <label className="flex h-9 min-w-[150px] items-center rounded-full border-[1.5px] border-dashed border-line-strong bg-paper px-3">
                    <span className="sr-only">新增喜歡的版型</span>
                    <input value={customFit} onChange={(event) => setCustomFit(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addListValue('fitPreferences', customFit); setCustomFit('') } }} placeholder="新增版型後按 Enter" className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-ink-3" />
                    <Icon name="plus" size={14} className="text-mist-deep" />
                  </label>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-[13px]">想讓視覺更突出的地方<input value={profile.highlightAreas} onChange={(event) => updateProfile('highlightAreas', event.target.value)} placeholder="例如肩線、腰線" className="h-11 rounded-btn border-[1.5px] border-line bg-paper px-3 text-sm outline-none focus:border-mist-deep" /></label>
                <label className="flex flex-col gap-1.5 text-[13px]">想調整比例的地方<input value={profile.proportionNotes} onChange={(event) => updateProfile('proportionNotes', event.target.value)} placeholder="例如讓腿部看起來更修長" className="h-11 rounded-btn border-[1.5px] border-line bg-paper px-3 text-sm outline-none focus:border-mist-deep" /></label>
              </div>
              <div className="space-y-2">
                <p className="m-0 text-[13px]">不喜歡的剪裁</p>
                <div className="flex flex-wrap gap-2">
                  {profile.dislikedCuts.map((cut) => <button key={cut} type="button" aria-pressed="true" onClick={() => toggleListValue('dislikedCuts', cut)} className="min-h-9 rounded-full border-[1.5px] border-rose-edge bg-rose-soft px-3.5 text-[13px] text-rose-ink">{cut} ×</button>)}
                  <label className="flex h-9 min-w-[150px] items-center rounded-full border-[1.5px] border-dashed border-line-strong bg-paper px-3">
                    <span className="sr-only">新增不喜歡的剪裁</span>
                    <input value={customDislikedCut} onChange={(event) => setCustomDislikedCut(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addListValue('dislikedCuts', customDislikedCut); setCustomDislikedCut('') } }} placeholder="新增剪裁後按 Enter" className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-ink-3" />
                    <Icon name="plus" size={14} className="text-mist-deep" />
                  </label>
                </div>
              </div>
              <div className="flex justify-end border-t border-dashed border-line pt-4">
                <Button type="submit" variant="primary" disabled={savingProfile}><Icon name="check" size={17} />{savingProfile ? '儲存中…' : '儲存偏好'}</Button>
              </div>
            </form>
          </details>
        </PaperCard>
      </div>

      <aside className="min-w-0 flex-[1_1_280px] space-y-5 md:sticky md:top-5">
        <section className="relative overflow-hidden rounded-block bg-mist-soft p-5 text-mist-ink">
          <WashBlob accent="oat" className="-bottom-6 -right-5 size-24" tilt={12} />
          <div className="relative flex items-center gap-2 font-hd text-lg"><Icon name="lock" size={19} />只有你看得到</div>
          <p className="relative mb-0 mt-2 text-[13px] leading-6">這些資料只用在尺寸比對與搭配比例建議。不會評價身形，也不會分享給任何人。</p>
        </section>

        <PaperCard className="space-y-3 p-5">
          <h2 className="m-0 font-hd text-lg text-ink">AI 的使用方式</h2>
          <button type="button" role="switch" aria-checked={profile.aiUseBodyData} onClick={() => updateProfile('aiUseBodyData', !profile.aiUseBodyData)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-sm text-left text-sm text-ink">
            預設參考體態資料
            <span className={`relative h-7 w-[46px] flex-none rounded-full transition-colors ${profile.aiUseBodyData ? 'bg-sage-deep' : 'bg-line-strong'}`}><span className={`absolute top-[3px] size-[22px] rounded-full bg-white transition-transform ${profile.aiUseBodyData ? 'translate-x-[21px]' : 'translate-x-[3px]'}`} /></span>
          </button>
          <p className="m-0 text-xs leading-5 text-ink-2">每次詢問時仍可以單獨關閉；變更後請在下方儲存偏好。</p>
        </PaperCard>

        <section className="space-y-3" aria-labelledby="measurement-history-title">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="measurement-history-title" className="m-0 font-hd text-xl text-ink">量測紀錄</h2>
            <Link to="/me/measurements" className="flex min-h-10 items-center text-sm text-mist-deep">查看全部 <Icon name="next" size={16} /></Link>
          </div>
          {measurements.length === 0 ? (
            <PaperCard className="space-y-3 p-4 text-sm leading-6 text-ink-2"><p className="m-0">還沒有量測紀錄。先填一兩項尺寸，就能開始建立你的尺寸筆記。</p><Button variant="secondary" className="h-10 px-3 text-[13px]" onClick={startNewMeasurement}><Icon name="plus" size={16} />新增一次</Button></PaperCard>
          ) : (
            <ol className="m-0 flex list-none flex-col gap-2 p-0">
              {measurements.slice(0, 3).map((measurement, index) => <li key={measurement.id} className={`rounded-tile border-l-4 bg-card p-3.5 shadow-paper ${index === 0 ? 'border-sage' : index === 1 ? 'border-mist' : 'border-oat'}`}><Link to={`/me/measurements/${measurement.id}`} className="block text-ink no-underline"><div className="flex items-center justify-between gap-2"><span className="font-num font-bold">{dateLabel(measurement.measuredOn)}</span><span className="text-xs text-ink-2">{index === 0 ? '最近量測' : ''}</span></div><p className="mb-0 mt-1 text-xs leading-5 text-ink-2">{measurement.note || '尺寸紀錄'}</p></Link></li>)}
            </ol>
          )}
          {measurements.length > 0 && <Button variant="secondary" className="h-10 w-full px-3 text-[13px]" onClick={startNewMeasurement}><Icon name="plus" size={16} />新增量測</Button>}
          <p className="m-0 text-xs leading-5 text-ink-2">只記錄日期與更新項目，不畫趨勢圖。</p>
        </section>
      </aside>
      <Toast message={toast} onClose={() => setToast(null)} />
    </main>
  )
}
