import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, ButtonLink } from '@/components/ui/Button'
import { DatePicker } from '@/components/ui/DatePicker'
import { Icon } from '@/components/ui/Icon'
import { MarkdownNoteField } from '@/components/ui/MarkdownNote'
import { LoadingState, PageState } from '@/components/ui/PageState'
import { Toast, type ToastMessage } from '@/components/ui/Toast'
import { FOOT_FIELDS, FOOT_TABS, MEASUREMENT_GROUPS, METRIC_KEYS, TIME_OF_DAY_OPTIONS, blankMeasurementDraft, measurementDraftError, measurementToDraft, toMeasurementInput, type MeasurementDraft, type MeasurementKey } from '@/lib/bodyMeasurement'
import { fetchProfileData, saveBodyMeasurement } from '@/lib/data'
import { todayISO } from '@/lib/date'
import type { BodyMeasurement } from '@/types'

const ACCENT_DOT = { oat: 'bg-oat', mist: 'bg-mist', sage: 'bg-sage', rose: 'bg-rose' } as const

const shortDate = (date: string) => `${date.slice(5, 7)}/${date.slice(8, 10)}`
const sameValue = (text: string, value: number | null | undefined) => (text.trim() === '' ? value == null : value != null && Number(text) === value)

function Field({ label, unit, hint, value, previous, hasBaseline, onChange }: {
  label: string
  unit: string
  hint?: string
  value: string
  previous: number | null | undefined
  hasBaseline: boolean
  onChange: (value: string) => void
}) {
  const changed = hasBaseline && !sameValue(value, previous)
  const box = changed ? 'border-oat-edge bg-stretch-cell' : value.trim() ? 'border-line bg-paper' : 'border-dashed border-line bg-paper'
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[13px] font-medium text-ink">
      {label}
      <span className={`flex h-12 items-center gap-1.5 rounded-tile border-[1.5px] px-3 focus-within:border-mist-deep ${box}`}>
        <input
          type="number"
          min="0"
          step="0.1"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="選填"
          aria-label={`${label}（${unit}）`}
          className="h-full w-full min-w-0 flex-1 bg-transparent text-right font-num text-[17px] font-bold text-ink outline-none placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:text-ink-3"
        />
        <span className="flex-none font-num text-xs text-ink-3">{unit}</span>
      </span>
      {hasBaseline && <span className="text-[11px] font-normal text-ink-3">{previous == null ? '還沒量過' : `上次 ${previous}`}</span>}
      {hint && <span className="text-[11px] font-normal leading-4 text-mist-deep">{hint}</span>}
    </label>
  )
}

/** 新增量測（BM18：design/mobile/B-M-Body.dc.html）；編輯時更新指定快照 */
export function MeasurementFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [records, setRecords] = useState<BodyMeasurement[]>([])
  const [draft, setDraft] = useState<MeasurementDraft>(blankMeasurementDraft)
  const [baseline, setBaseline] = useState<BodyMeasurement | null>(null)
  const [footTab, setFootTab] = useState<(typeof FOOT_TABS)[number]['id']>('sock')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const editing = id ? records.find((record) => record.id === id) ?? null : null

  useEffect(() => {
    let alive = true
    fetchProfileData()
      .then(({ measurements }) => {
        if (!alive) return
        const sorted = [...measurements].sort((a, b) => b.measuredOn.localeCompare(a.measuredOn) || b.createdAt.localeCompare(a.createdAt))
        setRecords(sorted)
        if (id) {
          const index = sorted.findIndex((record) => record.id === id)
          if (index >= 0) {
            setDraft(measurementToDraft(sorted[index]))
            setBaseline(sorted[index + 1] ?? null)
          }
        } else if (sorted[0]) {
          setDraft({ ...measurementToDraft(sorted[0]), measuredOn: todayISO(), timeOfDay: 'morning_fasting', note: '' })
          setBaseline(sorted[0])
        }
      })
      .catch((cause: Error) => alive && setError(cause.message || '量測紀錄讀取失敗。'))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [id])

  const summary = useMemo(() => {
    let changed = 0
    let added = 0
    let filled = 0
    for (const key of METRIC_KEYS) {
      if (!draft[key].trim()) continue
      filled += 1
      const before = baseline?.[key]
      if (before == null) added += 1
      else if (!sameValue(draft[key], before)) changed += 1
    }
    return { changed, added, filled }
  }, [draft, baseline])

  const setValue = (key: MeasurementKey, value: string) => setDraft((current) => ({ ...current, [key]: value }))
  const backTo = id ? `/me/measurements/${id}` : '/me'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const problem = measurementDraftError(draft)
    if (problem) {
      setToast({ tone: 'error', text: problem })
      return
    }
    setSaving(true)
    try {
      const result = await saveBodyMeasurement(toMeasurementInput(draft, editing?.id))
      navigate(`/me/measurements/${result.measurement.id}`, { replace: true })
    } catch (cause) {
      setToast({ tone: 'error', text: cause instanceof Error ? cause.message : '量測紀錄儲存失敗。' })
      setSaving(false)
    }
  }

  if (loading) return <main className="mx-auto max-w-2xl px-4 py-8"><LoadingState label="正在帶入上次的數字…" /></main>
  if (error) return <main className="mx-auto max-w-2xl px-4 py-8"><PageState icon="alert" tone="rose" title="量測紀錄暫時打不開" description={error} action={<Button variant="secondary" onClick={() => window.location.reload()}>重新載入</Button>} /></main>
  if (id && !editing) return <main className="mx-auto max-w-2xl px-4 py-8"><PageState icon="search" tone="mist" title="找不到這筆量測" description="紀錄可能已刪除，或網址中的識別碼不正確。" action={<ButtonLink to="/me/measurements" variant="secondary">回量測紀錄</ButtonLink>} /></main>

  const hasBaseline = Boolean(baseline)
  const footPrefix = FOOT_TABS.find((tab) => tab.id === footTab)!.prefix

  return (
    <main className="mx-auto max-w-2xl md:px-8 md:py-8">
      <header className="flex items-center gap-1 border-b-[1.5px] border-dashed border-line-strong py-2 pl-1 pr-2 md:border-0 md:p-0 md:pb-4">
        <Link to={backTo} aria-label={id ? '返回這筆紀錄' : '返回我的'} className="flex size-11 items-center justify-center text-ink"><Icon name="back" size={22} /></Link>
        <h1 className="m-0 font-hd text-xl md:text-[28px]">{id ? '編輯量測' : '新增量測'}</h1>
      </header>

      <form id="measurement-form" onSubmit={handleSubmit} className="flex flex-col gap-3.5 px-3 pb-44 pt-3.5 md:px-0 md:pb-6">
        <section aria-label="這次量測" className="flex flex-col gap-3 rounded-[16px] bg-oat-soft p-3.5">
          <DatePicker label="這次量測日期" value={draft.measuredOn || null} onChange={(value) => setDraft((current) => ({ ...current, measuredOn: value ?? '' }))} max={todayISO()} required />
          <fieldset className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
            <legend className="mb-1.5 p-0 text-[13px] font-medium text-ink">量測時段</legend>
            <div role="radiogroup" aria-label="量測時段" className="grid grid-cols-3 rounded-btn bg-card/55 p-[3px]">
              {TIME_OF_DAY_OPTIONS.map(([value, label]) => (
                <button key={value} type="button" role="radio" aria-checked={draft.timeOfDay === value} onClick={() => setDraft((current) => ({ ...current, timeOfDay: value }))} className={`min-h-11 rounded-sm px-1 text-[13px] ${draft.timeOfDay === value ? 'bg-ink font-medium text-paper' : 'text-ink'}`}>{label}</button>
              ))}
            </div>
          </fieldset>
          <p className="m-0 text-xs leading-5 text-oat-ink">
            {editing ? `正在編輯 ${shortDate(editing.measuredOn)} 的紀錄；「上次」是指再前一筆。` : baseline ? `已帶入上次（${shortDate(baseline.measuredOn)}）的數字，只改有變的就好。` : '第一次記錄，填幾項都可以，之後再補。'}
            圍度建議早上空腹量；腳建議下午或晚上量。
          </p>
        </section>

        {MEASUREMENT_GROUPS.map((group) => (
          <section key={group.title} aria-label={group.title} className="flex flex-col gap-3 rounded-card bg-card p-3.5 shadow-paper">
            <h2 className="m-0 flex items-center gap-2 text-xs font-normal text-ink-2">
              <span aria-hidden="true" className={`size-3 rounded-[4px] ${ACCENT_DOT[group.accent]}`} />
              <span className="font-hd text-[19px] text-ink">{group.title}</span>
              {group.fields.length > 3 && `${group.fields.length} 項`}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {group.fields.map((field) => <Field key={field.key} label={field.label} unit={field.unit} hint={field.hint} value={draft[field.key]} previous={baseline?.[field.key]} hasBaseline={hasBaseline} onChange={(value) => setValue(field.key, value)} />)}
            </div>
          </section>
        ))}

        <section aria-labelledby="foot-title" className="flex flex-col gap-3 rounded-card bg-card p-3.5 shadow-paper">
          <h2 className="m-0 flex items-center gap-2 text-xs font-normal text-ink-2">
            <span aria-hidden="true" className="size-3 rounded-[4px] bg-rose" />
            <span id="foot-title" className="font-hd text-[19px] text-ink">腳</span>
            量比較大的那隻
          </h2>
          <div role="tablist" aria-label="襪子" className="grid grid-cols-3 gap-1.5">
            {FOOT_TABS.map((tab) => (
              <button key={tab.id} type="button" role="tab" aria-selected={footTab === tab.id} onClick={() => setFootTab(tab.id)} className={`min-h-11 rounded-full border-[1.5px] text-[13px] font-medium ${footTab === tab.id ? 'border-ink bg-ink text-paper' : 'border-line bg-card text-ink'}`}>{tab.short}</button>
            ))}
          </div>
          <div role="tabpanel" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {FOOT_FIELDS.filter((field) => field.key.startsWith(footPrefix)).map((field) => <Field key={field.key} label={field.label} unit="cm" value={draft[field.key]} previous={baseline?.[field.key]} hasBaseline={false} onChange={(value) => setValue(field.key, value)} />)}
          </div>
          <p className="m-0 text-[11px] leading-5 text-ink-2">左右腳寬不同、腳跟寬，記在「我的 › 固定資料」。</p>
        </section>

        <label className="flex flex-col gap-1.5 px-0.5 text-[13px] font-medium text-ink">
          <span>這次量測備註 <span className="text-[11px] font-normal text-ink-3">選填</span></span>
          <MarkdownNoteField id="measurement-form-note" value={draft.note} onChange={(value) => setDraft((current) => ({ ...current, note: value }))} rows={2} placeholder="例如：早上起床後量，穿薄內衣" className="w-full resize-none rounded-tile border-[1.5px] border-line bg-card px-3 py-2.5 text-sm font-normal leading-7 outline-none placeholder:text-ink-3 focus:border-mist-deep" />
        </label>
      </form>

      <footer className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-20 flex flex-col gap-1.5 border-t-[1.5px] border-dashed border-line-strong bg-paper px-3 pb-3 pt-2.5 md:static md:border-0 md:px-0 md:pt-0">
        <span className="text-center text-xs text-ink-2 md:text-right">
          {hasBaseline
            ? <>改了 <b className="font-num text-ink">{summary.changed}</b> 項・新記 <b className="font-num text-ink">{summary.added}</b> 項</>
            : <>記了 <b className="font-num text-ink">{summary.filled}</b> 項</>}
        </span>
        <Button type="submit" form="measurement-form" variant="primary" size="lg" disabled={saving} className="w-full md:ml-auto md:w-auto">
          {saving ? '儲存中…' : editing ? '更新這筆紀錄' : `儲存為 ${shortDate(draft.measuredOn || todayISO())} 的紀錄`}
        </Button>
      </footer>
      <Toast message={toast} onClose={() => setToast(null)} />
    </main>
  )
}
