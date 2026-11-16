import { useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { DatePicker } from '@/components/ui/DatePicker'
import { Icon } from '@/components/ui/Icon'
import { MarkdownNote, MarkdownNoteField } from '@/components/ui/MarkdownNote'
import { PaperCard, TiltLabel, WashBlob } from '@/components/ui/Paper'
import { LoadingState, PageState } from '@/components/ui/PageState'
import { Toast, type ToastMessage } from '@/components/ui/Toast'
import { SAMPLE_BODY_PROFILE, SAMPLE_PROFILE } from '@/data/sample'
import { fetchProfileData, saveBodyMeasurement, saveBodyProfile, saveProfilePreferences } from '@/lib/data'
import { todayISO } from '@/lib/date'
import { FOOT_FIELDS, FOOT_TABS, MEASUREMENT_GROUPS, METRIC_KEYS, blankMeasurementDraft, fixedDraftValues, fixedProfileToDraft, measurementDateLabel, measurementToDraft, toBodyProfileInput, toMeasurementInput, type FixedDraft, type FixedKey, type MeasurementDraft, type MeasurementGroup } from '@/lib/bodyMeasurement'
import type { BodyMeasurement, BodyProfile, ProfilePreferences, ShoeSize } from '@/types'

const FIT_OPTIONS = ['高腰', '直筒', '落肩', '九分褲長', '合身', 'A 字']
const DEFAULT_SHOE_SIZE: ShoeSize = { label: '新鞋款', eu: '', us: '', uk: '', jp: '' }
const GROUPS = MEASUREMENT_GROUPS
const blankDraft = blankMeasurementDraft
const dateLabel = measurementDateLabel

function today() {
  return todayISO()
}

function MetricField({
  field,
  draft,
  setDraft,
  baseline,
  hideVisualLabel = false,
  accessibleLabel,
}: {
  field: MeasurementGroup['fields'][number]
  draft: MeasurementDraft
  setDraft: Dispatch<SetStateAction<MeasurementDraft>>
  baseline?: BodyMeasurement | null
  hideVisualLabel?: boolean
  accessibleLabel?: string
}) {
  const baselineValue = baseline?.[field.key]
  const isChanged = !!baseline && draft[field.key].trim() !== (baselineValue == null ? '' : String(baselineValue))
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-[13px] text-ink">
      <span className={hideVisualLabel ? 'sr-only' : undefined}>{field.label}</span>
      <span className={`flex h-12 items-center gap-2 rounded-btn border-[1.5px] px-3 focus-within:border-mist-deep ${isChanged ? 'border-oat-edge bg-oat-soft' : 'border-line bg-paper'}`}>
        <input
          type="number"
          min="0"
          step="0.1"
          inputMode="decimal"
          value={draft[field.key]}
          onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
          placeholder="選填"
          aria-label={accessibleLabel ?? `${field.label}（${field.unit}）`}
          className="h-full min-w-0 flex-1 bg-transparent text-right font-num text-lg font-bold text-ink outline-none placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:text-ink-3"
        />
        <span className="w-7 flex-none text-right font-num text-[13px] text-ink-2">{field.unit}</span>
        {isChanged && <span className="whitespace-nowrap rounded-full bg-oat px-2 py-0.5 text-[10px] font-medium text-oat-ink">已修改</span>}
      </span>
    </label>
  )
}

function FixedMetricField({ field, draft, setDraft, baseline }: {
  field: { key: FixedKey; label: string; hint?: string }
  draft: FixedDraft
  setDraft: Dispatch<SetStateAction<FixedDraft>>
  baseline: BodyProfile
}) {
  const isChanged = draft[field.key] !== (baseline[field.key]?.toString() ?? '')
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-[13px] text-ink">
      <span>{field.label}</span>
      <span className={`flex h-12 items-center gap-2 rounded-btn border-[1.5px] px-3 focus-within:border-mist-deep ${isChanged ? 'border-oat-edge bg-oat-soft' : 'border-line bg-paper'}`}>
        <input type="number" min="0" step="0.1" inputMode="decimal" value={draft[field.key]} onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))} placeholder="選填" aria-label={`${field.label}（cm）`} className="h-full min-w-0 flex-1 bg-transparent text-right font-num text-lg font-bold text-ink outline-none placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:text-ink-3" />
        <span className="w-7 flex-none text-right font-num text-[13px] text-ink-2">cm</span>
        {isChanged && <span className="whitespace-nowrap rounded-full bg-oat px-2 py-0.5 text-[10px] font-medium text-oat-ink">已修改</span>}
      </span>
      {field.hint && <span className="text-[11px] leading-5 text-mist-deep">{field.hint}</span>}
    </label>
  )
}

export function ProfilePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [profile, setProfile] = useState<ProfilePreferences>(SAMPLE_PROFILE)
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([])
  const [bodyProfile, setBodyProfile] = useState<BodyProfile>(SAMPLE_BODY_PROFILE)
  const [fixedDraft, setFixedDraft] = useState<FixedDraft>(() => fixedProfileToDraft(SAMPLE_BODY_PROFILE))
  const [draft, setDraft] = useState<MeasurementDraft>(blankDraft)
  const [editingId, setEditingId] = useState<string | undefined>()
  const [baseline, setBaseline] = useState<BodyMeasurement | null>(null)
  const [feetTab, setFeetTab] = useState<(typeof FOOT_TABS)[number]['id']>('toe')
  const [loading, setLoading] = useState(true)
  const [savingMeasurements, setSavingMeasurements] = useState(false)
  const [savingBodyProfile, setSavingBodyProfile] = useState(false)
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
      .then(({ profile: nextProfile, measurements: nextMeasurements, bodyProfile: nextBodyProfile }) => {
        if (!alive) return
        setProfile(nextProfile)
        setMeasurements(nextMeasurements)
        setBodyProfile(nextBodyProfile)
        setFixedDraft(fixedProfileToDraft(nextBodyProfile))
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
  const fixedMetricValues = fixedDraftValues(fixedDraft)
  const fixedFilledCount = fixedMetricValues.filter((value) => value.trim() !== '').length
  const progress = Math.round(((filledCount + fixedFilledCount) / (METRIC_KEYS.length + fixedMetricValues.length)) * 100)
  const progressGroups = [
    ...GROUPS.map((group) => group.fields.map(({ key }) => draft[key])),
    FOOT_FIELDS.map(({ key }) => draft[key]),
    fixedMetricValues,
  ]
  const completedGroups = progressGroups.filter((values) => values.length > 0 && values.every((value) => value.trim() !== '')).length
  const fixedChangedCount = (Object.keys(bodyProfile) as (keyof BodyProfile)[]).filter((key) => key !== 'updatedAt' && fixedDraft[key as FixedKey] !== (bodyProfile[key]?.toString() ?? '')).length

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

  async function handleSaveBodyProfile() {
    if (fixedMetricValues.some((value) => value.trim() && (!Number.isFinite(Number(value)) || Number(value) <= 0))) {
      setToast({ tone: 'error', text: '固定資料請輸入大於 0 的數字。' })
      return
    }
    setSavingBodyProfile(true)
    try {
      const result = await saveBodyProfile(toBodyProfileInput(fixedDraft))
      setBodyProfile(result.bodyProfile)
      setFixedDraft(fixedProfileToDraft(result.bodyProfile))
      setToast({ tone: 'success', text: result.demo ? '固定資料已套用在本次示範工作階段。' : '固定資料已更新，不會新增量測紀錄。' })
    } catch (cause) {
      setToast({ tone: 'error', text: cause instanceof Error ? cause.message : '固定資料儲存失敗。' })
    } finally {
      setSavingBodyProfile(false)
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
          <Link to="/me/shops" className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] border-line-strong bg-card px-4 text-sm text-ink no-underline hover:border-ink-3"><Icon name="closet" size={16} />購買通路<Icon name="next" size={14} className="text-ink-3" /></Link>
          <Link to="/me/materials" className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] border-line-strong bg-card px-4 text-sm text-ink no-underline hover:border-ink-3"><Icon name="closet" size={16} />材質<Icon name="next" size={14} className="text-ink-3" /></Link>
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
          <section aria-label="這次量測設定" className="relative flex flex-wrap items-end gap-3 overflow-hidden rounded-card bg-oat-soft p-4 sm:gap-4 sm:px-5">
            <WashBlob accent="mist" className="-right-4 -top-5 size-20 rounded-block" tilt={12} />
            <DatePicker label="這次量測日期" value={draft.measuredOn || null} onChange={(value) => setDraft((current) => ({ ...current, measuredOn: value ?? '' }))} max={todayISO()} required className="relative w-full sm:max-w-[300px]" />
            <fieldset className="relative m-0 min-w-0 border-0 p-0">
              <legend className="mb-1.5 p-0 text-[13px] font-medium text-ink">量測時段</legend>
              <div role="radiogroup" aria-label="量測時段" className="flex flex-wrap gap-1.5">
                {([
                  ['morning_fasting', '早上空腹'],
                  ['afternoon_evening', '下午・晚上'],
                  ['other', '其他'],
                ] as const).map(([value, label]) => <button key={value} type="button" role="radio" aria-checked={draft.timeOfDay === value} onClick={() => setDraft((current) => ({ ...current, timeOfDay: value }))} className={`min-h-11 rounded-full border-[1.5px] px-3 text-xs ${draft.timeOfDay === value ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-card text-ink'}`}>{label}</button>)}
              </div>
            </fieldset>
            <p className="relative m-0 w-full text-xs leading-5 text-oat-ink">圍度建議固定在早上空腹量，腳建議下午或晚上量（一天中較腫時）。時段只是紀錄，不影響計算。</p>
            {baseline && !editingId && <p className="relative m-0 w-full text-xs leading-5 text-ink-2">欄位已帶入上次（{baseline.measuredOn.slice(5).replace('-', '/')}）的數字；儲存會新增快照，舊紀錄會保留。</p>}
          </section>
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
                  {group.fields.map((field) => <MetricField key={field.key} field={field} draft={draft} setDraft={setDraft} baseline={baseline} />)}
                </div>
              </details>
            )
          })}
          <details open className="group overflow-hidden rounded-block bg-card shadow-paper">
            <summary className="relative flex min-h-[62px] cursor-pointer list-none items-center gap-3 px-5 py-3 [&::-webkit-details-marker]:hidden">
              <WashBlob accent="rose" className="-right-4 -top-5 size-[70px] rounded-block" tilt={14} />
              <span className="relative font-hd text-xl text-ink">腳</span>
              <span className="relative text-xs text-ink-2">3 種狀態・各 4 項</span>
              <Icon name="down" size={18} className="relative ml-auto flex-none text-ink-2 transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-3 px-4 pb-5 sm:px-5">
              <p className="m-0 text-xs leading-5 text-ink-2">襪子厚度會影響尺寸，所以分開記。請量比較大的那隻腳，建議下午或晚上量；左右腳寬差異和腳跟寬記在固定資料。</p>
              <div role="table" aria-label="腳的尺寸（公分），量比較大的那隻腳" className="hidden items-center gap-x-2 md:grid md:grid-cols-[100px_repeat(4,minmax(0,1fr))] md:gap-x-3">
                <span role="columnheader" className="py-2 text-xs text-ink-3">狀態</span>
                {['腳長', '腳寬', '前掌圍', '腳背圍'].map((label) => <span key={label} role="columnheader" className="py-2 text-[13px]">{label}</span>)}
                {FOOT_TABS.map((tab) => <div key={tab.id} role="row" className="contents">
                  <span role="rowheader" className="flex min-h-12 items-center gap-1.5 border-t border-dashed border-line text-xs font-medium"><span className={`size-2.5 rounded-[3px] ${tab.accent === 'oat' ? 'bg-oat' : tab.accent === 'mist' ? 'bg-mist' : 'bg-rose'}`} />{tab.label}</span>
                  {FOOT_FIELDS.filter((field) => field.key.startsWith(tab.prefix)).map((field) => <span key={field.key} role="cell" className="border-t border-dashed border-line py-1"><MetricField field={{ ...field, unit: 'cm' }} draft={draft} setDraft={setDraft} baseline={baseline} hideVisualLabel accessibleLabel={`${tab.label}・${field.label}（cm）`} /></span>)}
                </div>)}
              </div>
              <div className="space-y-3 md:hidden">
                <div role="tablist" aria-label="腳部量測狀態" className="grid grid-cols-3 gap-1 rounded-btn bg-tile p-1">
                  {FOOT_TABS.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={feetTab === tab.id} onClick={() => setFeetTab(tab.id)} className={`min-h-11 rounded-sm px-1 text-xs ${feetTab === tab.id ? 'bg-card font-medium text-ink shadow-paper' : 'text-ink-2'}`}>{tab.label}</button>)}
                </div>
                <div role="tabpanel" className="grid grid-cols-2 gap-3">
                  {FOOT_FIELDS.filter((field) => field.key.startsWith(FOOT_TABS.find((tab) => tab.id === feetTab)!.prefix)).map((field) => <MetricField key={field.key} field={{ ...field, unit: 'cm' }} draft={draft} setDraft={setDraft} baseline={baseline} />)}
                </div>
              </div>
            </div>
          </details>
          <section aria-labelledby="fixed-profile-title" className="space-y-4 rounded-block border-[1.5px] border-oat-edge bg-card p-4 shadow-paper sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="fixed-profile-title" className="m-0 font-hd text-xl">固定資料</h2>
              <span className="rounded-full bg-oat-soft px-2.5 py-1 text-[11px] text-oat-ink">不太會變・不跟著每次紀錄</span>
              {bodyProfile.updatedAt && <span className="ml-auto text-[11px] text-ink-3">更新於 {dateLabel(bodyProfile.updatedAt.slice(0, 10))}</span>}
            </div>
            <p className="m-0 text-xs leading-5 text-ink-2">骨架長度和腳型，記一次就好。改了會直接更新，不會產生新的量測紀錄；尺寸對照會使用最新資料。</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {([
                { key: 'heightCm', label: '身高', hint: '赤腳站直' },
                { key: 'armLengthCm', label: '手臂長', hint: '肩峰到手腕' },
                { key: 'inseamCm', label: '腿長（內側）', hint: '褲長參考' },
                { key: 'seatedRiseCm', label: '坐姿股上', hint: '坐硬椅，腰側到椅面；比褲子的股上' },
              ] as const).map((field) => <FixedMetricField key={field.key} field={field} draft={fixedDraft} setDraft={setFixedDraft} baseline={bodyProfile} />)}
            </div>
            <div className="space-y-3 border-t border-dashed border-line pt-3">
              <label className="flex min-h-11 items-center gap-2 text-[13px] font-medium text-ink">
                <span>裸腳腳寬</span>
                <span className="ml-auto text-xs font-normal text-ink-2">左右不同</span>
                <input type="checkbox" checked={fixedDraft.footWidthsDiffer} onChange={(event) => setFixedDraft((current) => ({ ...current, footWidthsDiffer: event.target.checked, footWidthRightCm: event.target.checked ? (current.footWidthRightCm === current.footWidthLeftCm ? '' : current.footWidthRightCm) : current.footWidthLeftCm }))} className="size-5 accent-[var(--color-sage-deep)]" />
              </label>
              <div className={`grid gap-3 ${fixedDraft.footWidthsDiffer ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'}`}>
                {fixedDraft.footWidthsDiffer ? <>
                  <FixedMetricField field={{ key: 'footWidthLeftCm', label: '左腳' }} draft={fixedDraft} setDraft={setFixedDraft} baseline={bodyProfile} />
                  <FixedMetricField field={{ key: 'footWidthRightCm', label: '右腳' }} draft={fixedDraft} setDraft={setFixedDraft} baseline={bodyProfile} />
                </> : <FixedMetricField field={{ key: 'footWidthLeftCm', label: '左右腳寬' }} draft={fixedDraft} setDraft={setFixedDraft} baseline={bodyProfile} />}
                <FixedMetricField field={{ key: 'heelWidthCm', label: '腳跟寬' }} draft={fixedDraft} setDraft={setFixedDraft} baseline={bodyProfile} />
              </div>
              {(fixedDraft.footWidthLeftCm || fixedDraft.footWidthRightCm) && <p className="m-0 text-xs leading-5 text-sage-ink">選鞋對照會採用較寬的腳：{(() => { const left = Number(fixedDraft.footWidthLeftCm) || 0; const right = Number(fixedDraft.footWidthsDiffer ? fixedDraft.footWidthRightCm : fixedDraft.footWidthLeftCm) || 0; return `${left >= right ? '左腳' : '右腳'} ${Math.max(left, right)} cm` })()}。</p>}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-ink-3">固定資料修改 {fixedChangedCount} 項</span>
                <Button type="button" variant="secondary" disabled={savingBodyProfile} onClick={() => void handleSaveBodyProfile()}><Icon name="check" size={16} />{savingBodyProfile ? '儲存中…' : '儲存固定資料'}</Button>
              </div>
            </div>
          </section>
          <label className="flex flex-col gap-1.5 text-[13px] text-ink">
            這次量測備註 <span className="text-xs text-ink-3">選填</span>
            <MarkdownNoteField id="measurement-note" value={draft.note} onChange={(value) => setDraft((current) => ({ ...current, note: value }))} rows={2} placeholder="例如：更新腰圍、腿長" className="w-full resize-y rounded-btn border-[1.5px] border-line bg-paper px-3 py-2.5 text-sm outline-none placeholder:text-ink-3 focus:border-mist-deep" />
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
              {measurements.slice(0, 3).map((measurement, index) => <li key={measurement.id} className={`rounded-tile border-l-4 bg-card p-3.5 shadow-paper ${index === 0 ? 'border-sage' : index === 1 ? 'border-mist' : 'border-oat'}`}><Link to={`/me/measurements/${measurement.id}`} className="block text-ink no-underline"><div className="flex items-center justify-between gap-2"><span className="font-num font-bold">{dateLabel(measurement.measuredOn)}</span><span className="text-xs text-ink-2">{index === 0 ? '最近量測' : ''}</span></div><MarkdownNote value={measurement.note || '尺寸紀錄'} className="mt-1 line-clamp-2 text-xs leading-5 text-ink-2" /></Link></li>)}
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
