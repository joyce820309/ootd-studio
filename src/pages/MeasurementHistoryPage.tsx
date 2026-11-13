import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ProfileBreadcrumb } from '@/components/layout/ProfileNav'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { LoadingState, PageState } from '@/components/ui/PageState'
import { TiltLabel, WashBlob } from '@/components/ui/Paper'
import { Toast, type ToastMessage } from '@/components/ui/Toast'
import { deleteBodyMeasurement, fetchProfileData } from '@/lib/data'
import { formatLongDate, parseISODate } from '@/lib/date'
import type { BodyMeasurement } from '@/types'

type MetricKey = Exclude<keyof BodyMeasurement, 'id' | 'measuredOn' | 'note' | 'createdAt' | 'updatedAt'>
type DiffKind = 'missing' | 'first' | 'new' | 'same' | 'changed'
type Metric = { key: MetricKey; label: string; unit: string }
type MeasurementGroup = { label: string; color: string; metrics: Metric[] }

const GROUPS: MeasurementGroup[] = [
  { label: '基本', color: 'bg-oat', metrics: [{ key: 'heightCm', label: '身高', unit: 'cm' }, { key: 'weightKg', label: '體重', unit: 'kg' }] },
  { label: '上半身', color: 'bg-mist', metrics: [{ key: 'shoulderCm', label: '肩寬', unit: 'cm' }, { key: 'upperBustCm', label: '上胸圍', unit: 'cm' }, { key: 'underBustCm', label: '下胸圍', unit: 'cm' }, { key: 'armCm', label: '手臂長', unit: 'cm' }] },
  { label: '下半身', color: 'bg-sage', metrics: [{ key: 'waistCm', label: '腰圍', unit: 'cm' }, { key: 'navelCm', label: '肚臍圍', unit: 'cm' }, { key: 'hipCm', label: '臀圍', unit: 'cm' }, { key: 'inseamCm', label: '腿長（內側）', unit: 'cm' }, { key: 'thighCm', label: '大腿圍', unit: 'cm' }] },
]
const FEET = [
  { id: 'toe', label: '穿五指襪', color: 'bg-oat', keys: ['footToeLengthCm', 'footToeWidthCm', 'footToeBallCm', 'footToeInstepCm'] as MetricKey[] },
  { id: 'sock', label: '穿一般襪', color: 'bg-mist', keys: ['footSockLengthCm', 'footSockWidthCm', 'footSockBallCm', 'footSockInstepCm'] as MetricKey[] },
  { id: 'bare', label: '裸腳', color: 'bg-rose', keys: ['footBareLengthCm', 'footBareWidthCm', 'footBareBallCm', 'footBareInstepCm'] as MetricKey[] },
]
const FOOT_LABELS = ['腳長', '腳寬', '前掌圍', '腳背圍']
const ALL_METRICS = [...GROUPS.flatMap((group) => group.metrics), ...FEET.flatMap((foot) => foot.keys.map((key, index) => ({ key, label: `${foot.label}・${FOOT_LABELS[index]}`, unit: 'cm' })))]

function metricValue(record: BodyMeasurement | null | undefined, key: MetricKey) {
  return record?.[key] ?? null
}

function compareValue(current: BodyMeasurement, previous: BodyMeasurement | undefined, key: MetricKey): { kind: DiffKind; delta: number | null } {
  const value = metricValue(current, key)
  if (value === null) return { kind: 'missing', delta: null }
  if (!previous) return { kind: 'first', delta: null }
  const old = metricValue(previous, key)
  if (old === null) return { kind: 'new', delta: null }
  if (value === old) return { kind: 'same', delta: 0 }
  return { kind: 'changed', delta: value - old }
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function formatDelta(delta: number) {
  return `${delta > 0 ? '+' : '−'}${formatNumber(Math.abs(delta))}`
}

function formatDate(date: string) {
  const parsed = parseISODate(date)
  return parsed ? formatLongDate(parsed) : date
}

function dateLabel(date: string) {
  const parsed = parseISODate(date)
  return parsed ? `${parsed.getFullYear()}/${String(parsed.getMonth() + 1).padStart(2, '0')}/${String(parsed.getDate()).padStart(2, '0')}` : date
}

function countRecorded(record: BodyMeasurement) {
  return ALL_METRICS.filter((metric) => metricValue(record, metric.key) !== null).length
}

function changeSummary(record: BodyMeasurement, previous: BodyMeasurement | undefined) {
  if (!previous) return '第一次記錄'
  const diffs = ALL_METRICS.map((metric) => compareValue(record, previous, metric.key).kind)
  const changed = diffs.filter((kind) => kind === 'changed').length
  const firsts = diffs.filter((kind) => kind === 'new').length
  return `${changed ? `改了 ${changed} 項` : '數字都沒變'}${firsts ? `・新記 ${firsts} 項` : ''}`
}

function colorByKind(kind: DiffKind) {
  if (kind === 'changed') return 'bg-oat-soft text-oat-ink'
  if (kind === 'new' || kind === 'first') return 'bg-mist-soft text-mist-ink'
  return 'text-ink-3'
}

function DiffBadge({ kind, delta, compact = false }: { kind: DiffKind; delta: number | null; compact?: boolean }) {
  if (kind === 'missing') return <span className="text-xs text-ink-3">沒記</span>
  if (kind === 'same') return <span className="text-xs text-ink-3">—</span>
  const text = kind === 'changed' && delta !== null ? formatDelta(delta) : '第一次記'
  return <span className={`inline-flex items-center rounded-full px-2 py-1 font-num text-xs ${colorByKind(kind)} ${compact ? 'px-1.5 py-0.5 text-[10px]' : ''}`}>{text}</span>
}

function MeasurementPageHeader({ view, setView }: { view: 'date' | 'table'; setView: (view: 'date' | 'table') => void }) {
  return (
    <>
      <ProfileBreadcrumb current="量測紀錄" className="-mt-2 mb-3" />
      <div className="flex flex-wrap items-end gap-4">
        <div className="mr-auto flex flex-col gap-3">
          <TiltLabel accent="mist">尺寸筆記本</TiltLabel>
          <h1 className="m-0 font-hd text-3xl text-ink sm:text-[34px]">量測紀錄</h1>
          <p className="m-0 max-w-2xl text-sm leading-6 text-ink-2">每次儲存尺寸都會留下一頁。這裡只列數字和「跟上次差多少」，不畫趨勢圖、不評價變化。</p>
        </div>
        <nav aria-label="檢視方式" className="grid grid-cols-2 rounded-btn bg-tile p-1">
          <button type="button" aria-current={view === 'date' ? 'page' : undefined} onClick={() => setView('date')} className={`flex h-10 items-center justify-center gap-1.5 rounded-sm px-3 text-sm ${view === 'date' ? 'bg-card font-medium text-ink shadow-paper' : 'text-ink-2'}`}><Icon name="diary" size={17} />依日期</button>
          <button type="button" aria-current={view === 'table' ? 'page' : undefined} onClick={() => setView('table')} className={`flex h-10 items-center justify-center gap-1.5 rounded-sm px-3 text-sm ${view === 'table' ? 'bg-card font-medium text-ink shadow-paper' : 'text-ink-2'}`}><Icon name="outfit" size={17} />對照表</button>
        </nav>
        <ButtonLink to="/me" variant="primary"><Icon name="plus" size={18} />新增量測</ButtonLink>
      </div>
    </>
  )
}

export function MeasurementHistoryPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const view = searchParams.get('view') === 'table' ? 'table' : 'date'
  const [records, setRecords] = useState<BodyMeasurement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastMessage | null>(null)

  useEffect(() => {
    let alive = true
    fetchProfileData()
      .then(({ measurements }) => alive && setRecords([...measurements].sort((a, b) => b.measuredOn.localeCompare(a.measuredOn) || b.createdAt.localeCompare(a.createdAt))))
      .catch((cause: Error) => alive && setError(cause.message || '量測紀錄讀取失敗。'))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  const selected = id ? records.find((record) => record.id === id) ?? null : records[0] ?? null
  const previous = selected ? records[records.indexOf(selected) + 1] : undefined
  const isMobileDetail = Boolean(id)

  function setView(next: 'date' | 'table') {
    setSearchParams(next === 'date' ? {} : { view: 'table' }, { replace: true })
  }

  async function handleDelete(recordId: string) {
    try {
      await deleteBodyMeasurement(recordId)
      const remaining = records.filter((record) => record.id !== recordId)
      setRecords(remaining)
      setToast({ tone: 'success', text: '量測紀錄已刪除。' })
      navigate('/me/measurements', { replace: true })
    } catch (cause) {
      setToast({ tone: 'error', text: cause instanceof Error ? cause.message : '刪除失敗，紀錄仍保留。' })
    }
  }

  if (loading) return <main className="mx-auto max-w-5xl px-4 py-8"><LoadingState label="正在整理量測紀錄…" /></main>
  if (error) return <main className="mx-auto max-w-5xl px-4 py-8"><PageState icon="alert" tone="rose" title="量測紀錄暫時打不開" description={error} action={<Button variant="secondary" onClick={() => window.location.reload()}>重新載入</Button>} /></main>

  const detail = selected ? <MeasurementDetail record={selected} previous={previous} onDelete={() => void handleDelete(selected.id)} /> : null

  return (
    <main className="mx-auto flex max-w-[1200px] flex-col gap-5 px-4 py-6 pb-28 sm:px-6 md:px-8 md:py-8 md:pb-12">
      <div className={isMobileDetail ? 'hidden md:block' : ''}><MeasurementPageHeader view={view} setView={setView} /></div>
      {records.length === 0 ? (
        <PageState icon="diary" tone="mist" title="還沒有量測紀錄" description="每次儲存一筆尺寸，就會在這裡留下日期快照。" action={<ButtonLink to="/me" variant="primary"><Icon name="plus" size={17} />新增量測</ButtonLink>} />
      ) : view === 'table' && !isMobileDetail ? (
        <ComparisonTable records={records} onSelect={(recordId) => navigate(`/me/measurements/${recordId}`)} />
      ) : (
        selected ? <>
          <div className="md:hidden">
            {isMobileDetail && selected ? <MobileDetail record={selected} previous={previous} onDelete={() => void handleDelete(selected.id)} /> : <MobileRecordList records={records} onAdd={() => navigate('/me')} />}
          </div>
          <div className="hidden items-start gap-6 md:grid md:grid-cols-[280px_minmax(0,1fr)]">
            <Timeline records={records} selectedId={selected?.id ?? null} />
            {detail}
          </div>
        </> : <PageState icon="search" tone="mist" title="找不到這筆量測" description="紀錄可能已刪除，或網址中的識別碼不正確。" action={<ButtonLink to="/me/measurements" variant="secondary">回量測紀錄</ButtonLink>} />
      )}
      <Toast message={toast} onClose={() => setToast(null)} />
    </main>
  )
}

function Timeline({ records, selectedId }: { records: BodyMeasurement[]; selectedId: string | null }) {
  return (
    <nav aria-label="量測日期" className="sticky top-4 hidden md:block">
      <ol className="relative m-0 flex list-none flex-col gap-1 p-0">
        <span aria-hidden="true" className="absolute bottom-5 left-[21px] top-5 border-l-[1.5px] border-dashed border-line-strong" />
        {records.map((record, index) => (
          <li key={record.id}>
            <Link to={`/me/measurements/${record.id}`} aria-current={record.id === selectedId ? 'page' : undefined} className={`relative flex flex-col gap-1 rounded-tile py-3.5 pl-10 pr-3 no-underline ${record.id === selectedId ? 'bg-card shadow-paper before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-oat' : 'text-ink hover:bg-card/70'}`}>
              <span aria-hidden="true" className={`absolute left-3 top-5 size-3.5 rotate-[-8deg] rounded-tag shadow-sticker ${index % 3 === 0 ? 'bg-sage' : index % 3 === 1 ? 'bg-mist' : 'bg-rose'} ring-[3px] ring-paper`} />
              <span className="flex items-center gap-1.5"><span className="font-num text-base font-bold text-ink">{dateLabel(record.measuredOn)}</span>{index === 0 && <span className="ml-auto rounded-full bg-sage-soft px-2 py-0.5 text-[11px] text-sage-ink">最新</span>}</span>
              <span className="text-xs text-ink-2">{changeSummary(record, records[index + 1])}・記了 {countRecorded(record)} 項</span>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  )
}

function MobileRecordList({ records, onAdd }: { records: BodyMeasurement[]; onAdd: () => void }) {
  return (
    <div className="space-y-3">
      <p className="m-0 text-xs leading-5 text-ink-2">每次儲存尺寸都會留下一頁。只列數字，不畫趨勢圖、不評價變化。</p>
      <ol className="relative m-0 list-none space-y-2.5 pb-3 pl-0">
        <span aria-hidden="true" className="absolute bottom-3 left-[13px] top-5 border-l-[1.5px] border-dashed border-line-strong" />
        {records.map((record, index) => {
          const previous = records[index + 1]
          const tags = previous ? ALL_METRICS.map((metric) => ({ metric, diff: compareValue(record, previous, metric.key) })).filter(({ diff }) => diff.kind === 'changed' || diff.kind === 'new') : []
          const changedTags = tags.filter(({ diff }) => diff.kind === 'changed')
          const newlyRecorded = tags.filter(({ diff }) => diff.kind === 'new').length
          return (
            <li key={record.id} className="relative pl-8">
              <span aria-hidden="true" className={`absolute left-[6px] top-5 size-3.5 rotate-[-8deg] rounded-tag ${index % 3 === 0 ? 'bg-sage' : index % 3 === 1 ? 'bg-mist' : 'bg-rose'} ring-[3px] ring-paper`} />
              <Link to={`/me/measurements/${record.id}`} className="flex flex-col gap-2 rounded-card bg-card p-3.5 text-ink no-underline shadow-paper">
                <span className="flex items-center gap-1.5"><span className="font-num text-base font-bold">{dateLabel(record.measuredOn)}</span><span className="text-xs text-ink-3">（{parseISODate(record.measuredOn)?.toLocaleDateString('zh-TW', { weekday: 'short' }).replace('週', '')}）</span>{index === 0 && <span className="rounded-full bg-sage-soft px-2 py-0.5 text-[10px] text-sage-ink">最新</span>}<Icon name="next" size={17} className="ml-auto text-ink-3" /></span>
                <span className="text-xs text-ink-2">{changeSummary(record, previous)}・共記了 {countRecorded(record)} 項</span>
                {(changedTags.length > 0 || newlyRecorded > 0) && <span className="flex flex-wrap gap-1.5">{changedTags.slice(0, 4).map(({ metric, diff }) => <span key={metric.key} className="rounded-full bg-oat-soft px-1.5 py-0.5 font-num text-[10px] text-oat-ink">{metric.label} {diff.delta === null ? '' : formatDelta(diff.delta)}</span>)}{newlyRecorded > 0 && <span className="rounded-full bg-mist-soft px-1.5 py-0.5 text-[10px] text-mist-ink">新記 {newlyRecorded} 項</span>}{changedTags.length > 4 && <span className="rounded-full bg-oat-soft px-1.5 py-0.5 text-[10px] text-oat-ink">另有 {changedTags.length - 4} 項改變</span>}</span>}
              </Link>
            </li>
          )
        })}
      </ol>
      <Button variant="primary" className="fixed inset-x-4 bottom-[calc(82px+env(safe-area-inset-bottom))] z-20 w-[calc(100%-2rem)] shadow-float" onClick={onAdd}><Icon name="plus" />新增量測</Button>
    </div>
  )
}

function MeasurementDetail({ record, previous, onDelete, hideActions = false, hideHeader = false }: { record: BodyMeasurement; previous?: BodyMeasurement; onDelete: () => void; hideActions?: boolean; hideHeader?: boolean }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [footTab, setFootTab] = useState('bare')
  const diffs = ALL_METRICS.map((metric) => compareValue(record, previous, metric.key))
  const changedCount = diffs.filter((diff) => diff.kind === 'changed').length
  const previousDate = previous ? dateLabel(previous.measuredOn) : null

  return (
    <article aria-labelledby="measurement-detail-title" className="relative min-w-0 overflow-hidden rounded-block bg-card p-4 shadow-paper sm:p-6">
      <WashBlob accent="oat" className="-right-8 -top-8 size-32" tilt={14} />
      {!hideHeader && <header className="relative flex flex-wrap items-start gap-3">
        <div className="mr-auto min-w-0"><h2 id="measurement-detail-title" className="m-0 font-hd text-2xl text-ink sm:text-[28px]">{formatDate(record.measuredOn)}</h2><p className="mb-0 mt-1 text-[13px] text-ink-2">{previous ? `和上次（${previousDate}）比，改了 ${changedCount} 項` : '第一次記錄'}・共記了 {countRecorded(record)} 項</p></div>
        {!hideActions && <><ButtonLink to={`/me?edit=${encodeURIComponent(record.id)}`} variant="secondary" className="h-10 px-3 text-xs"><Icon name="reset" size={16} />編輯</ButtonLink><Button variant="ghost" className="h-10 px-2 text-xs text-rose-deep" onClick={() => setConfirmDelete(true)}><Icon name="x" size={16} />刪除</Button></>}
      </header>}
      {record.note && <div className="relative mt-5 flex gap-2 rounded-tile bg-sage-soft px-3.5 py-3 text-[13px] leading-5 text-sage-ink"><Icon name="diary" size={17} className="mt-0.5" /><span><b className="font-medium">備註</b>　{record.note}</span></div>}
      <div className="relative mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-2"><span className="flex items-center gap-1.5"><DiffBadge kind="changed" delta={-0.5} compact />和上次不同</span><span className="flex items-center gap-1.5"><DiffBadge kind="new" delta={null} compact />上次沒有這項</span><span>— 沒有變</span></div>
      <div className="relative mt-5 space-y-5">
        {GROUPS.map((group) => <MetricGroup key={group.label} group={group} record={record} previous={previous} previousDate={previousDate} />)}
        <section aria-label="腳部量測">
          <h3 className="mb-2 flex items-center gap-2 font-hd text-xl"><span className="size-3 rounded-sm bg-rose" />腳<span className="font-sans text-xs text-ink-3">單位 cm</span></h3>
          <div className="grid grid-cols-3 gap-1 rounded-btn bg-tile p-1 md:hidden" role="tablist" aria-label="腳的狀態">
            {FEET.map((foot) => <button key={foot.id} type="button" role="tab" aria-selected={footTab === foot.id} onClick={() => setFootTab(foot.id)} className={`min-h-10 rounded-sm px-1 text-xs ${footTab === foot.id ? 'bg-card font-medium text-ink shadow-paper' : 'text-ink-2'}`}>{foot.label}</button>)}
          </div>
          <div className="hidden grid-cols-[110px_repeat(4,minmax(0,1fr))] gap-x-3 md:grid"><FootHeaders /></div>
          <div className="mt-2 space-y-2 md:mt-0">
            {FEET.map((foot) => <FootDetailRow key={foot.id} foot={foot} record={record} previous={previous} selected={foot.id === footTab} />)}
          </div>
        </section>
      </div>
      {confirmDelete && <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"><section role="alertdialog" aria-modal="true" aria-labelledby="delete-measurement-title" className="w-full max-w-md space-y-3 rounded-block bg-card p-5 shadow-float"><h2 id="delete-measurement-title" className="m-0 font-hd text-xl">刪除這筆量測紀錄？</h2><p className="m-0 text-sm leading-6 text-ink-2">{formatDate(record.measuredOn)} 的尺寸快照將被永久刪除，無法復原。</p><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setConfirmDelete(false)}>取消</Button><Button variant="danger" onClick={onDelete}>永久刪除</Button></div></section></div>}
    </article>
  )
}

function MetricGroup({ group, record, previous, previousDate }: { group: MeasurementGroup; record: BodyMeasurement; previous?: BodyMeasurement; previousDate: string | null }) {
  return (
    <section aria-label={group.label}>
      <h3 className="mb-1 flex items-center gap-2 font-hd text-xl"><span className={`size-3 rounded-sm ${group.color}`} />{group.label}</h3>
      <div role="table" aria-label={group.label}>
        <div role="row" className="hidden grid-cols-[1.2fr_0.8fr_1fr_0.8fr] items-center px-1 text-xs text-ink-3 sm:grid"><span role="columnheader">項目</span><span role="columnheader" className="text-right">這次</span><span role="columnheader" className="text-right">上次{previousDate ? `（${previousDate.slice(5)}）` : ''}</span><span role="columnheader" className="text-right">變化</span></div>
        {group.metrics.map((metric) => <MetricRow key={metric.key} metric={metric} record={record} previous={previous} />)}
      </div>
    </section>
  )
}

function MetricRow({ metric, record, previous }: { metric: Metric; record: BodyMeasurement; previous?: BodyMeasurement }) {
  const value = metricValue(record, metric.key)
  const oldValue = metricValue(previous, metric.key)
  const diff = compareValue(record, previous, metric.key)
  return <div role="row" className="grid min-h-11 grid-cols-[1fr_auto] items-center border-t border-dashed border-line px-1 sm:grid-cols-[1.2fr_0.8fr_1fr_0.8fr] sm:gap-2"><span role="rowheader" className="text-sm">{metric.label}</span><span role="cell" className="flex items-center justify-end gap-1 font-num text-base font-bold text-ink sm:text-right">{value === null ? <span className="font-sans text-xs font-normal text-ink-3">沒記</span> : <>{formatNumber(value)}<small className="text-xs font-medium text-ink-3">{metric.unit}</small></>}<span className="ml-1 sm:hidden"><DiffBadge kind={diff.kind} delta={diff.delta} compact /></span></span><span role="cell" className="hidden justify-end font-num text-sm text-ink-2 sm:flex">{oldValue === null ? '—' : `${formatNumber(oldValue)} ${metric.unit}`}</span><span role="cell" className="hidden justify-end sm:flex"><DiffBadge kind={diff.kind} delta={diff.delta} /></span></div>
}

function FootHeaders() {
  return <><span className="py-2 text-xs text-ink-3">狀態</span>{FOOT_LABELS.map((label) => <span key={label} className="py-2 text-right text-xs text-ink-3">{label}</span>)}</>
}

function FootDetailRow({ foot, record, previous, selected }: { foot: typeof FEET[number]; record: BodyMeasurement; previous?: BodyMeasurement; selected: boolean }) {
  return <div className="grid grid-cols-2 gap-2 md:grid-cols-[110px_repeat(4,minmax(0,1fr))] md:gap-x-3">
    <div className={`${selected ? 'flex' : 'hidden'} col-span-2 items-center gap-2 border-t border-dashed border-line py-2 text-sm md:col-span-1 md:flex`}><span className={`size-2.5 rounded-[3px] ${foot.color}`} />{foot.label}</div>
    {foot.keys.map((key, index) => {
      const value = metricValue(record, key)
      const diff = compareValue(record, previous, key)
      return <div key={key} className={`${selected ? 'flex' : 'hidden'} flex-col rounded-sm px-2 py-2 md:flex md:rounded-none md:border-t md:border-dashed md:border-line ${diff.kind === 'changed' ? 'bg-oat-soft/70 md:bg-transparent' : 'bg-paper md:bg-transparent'}`}><span className="block text-xs text-ink-2 md:hidden">{FOOT_LABELS[index]}</span><span className="font-num text-base font-bold">{value === null ? '—' : formatNumber(value)}</span><span className="ml-1 font-num text-[11px] text-ink-3">{value === null ? '' : 'cm'}</span><span className="block md:mt-1 md:text-right"><DiffBadge kind={diff.kind} delta={diff.delta} compact /></span></div>
    })}
  </div>
}

function ComparisonTable({ records, onSelect }: { records: BodyMeasurement[]; onSelect: (id: string) => void }) {
  const [changedOnly, setChangedOnly] = useState(false)
  const rows = [...GROUPS.map((group) => ({ group: group.label, color: group.color, metrics: group.metrics })), ...FEET.map((foot) => ({ group: `腳・${foot.label}`, color: foot.color, metrics: foot.keys.map((key, index) => ({ key, label: FOOT_LABELS[index], unit: 'cm' })) }))]
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-2"><span className="flex items-center gap-1.5"><DiffBadge kind="changed" delta={-0.5} compact />和前一次不同</span><span className="flex items-center gap-1.5"><DiffBadge kind="new" delta={null} compact />這一次第一次記</span><span>— 當時沒記</span><label className="ml-auto flex min-h-10 cursor-pointer items-center gap-2"><input type="checkbox" checked={changedOnly} onChange={(event) => setChangedOnly(event.target.checked)} className="size-4 accent-[var(--color-sage-deep)]" />只看有改過的項目</label></div>
      <div role="region" aria-label="量測對照表，可左右捲動" tabIndex={0} className="overflow-auto rounded-block bg-card shadow-paper focus-visible:outline-mist-deep">
        <div role="table" aria-label="各次量測數值對照，體重為公斤，其餘為公分" className="min-w-max">
          <div role="row" className="grid border-b border-ink" style={{ gridTemplateColumns: `190px repeat(${records.length}, minmax(150px, 1fr))` }}><span role="columnheader" className="sticky left-0 z-10 flex items-end bg-card px-4 pb-3 text-xs text-ink-3">項目</span>{records.map((record, index) => <button key={record.id} type="button" role="columnheader" onClick={() => onSelect(record.id)} className="flex min-h-20 flex-col items-end justify-end px-3 py-3 text-right hover:bg-paper"><span className="flex items-center gap-1.5 font-num text-sm font-bold text-ink">{index === 0 && <span className="rounded-full bg-sage-soft px-2 py-0.5 font-sans text-[10px] text-sage-ink">最新</span>}{dateLabel(record.measuredOn)}</span><span className="mt-1 text-[10px] text-ink-3">{changeSummary(record, records[index + 1])}</span></button>)}</div>
          {rows.map((group) => {
            const visibleMetrics = group.metrics.filter((metric) => !changedOnly || records.some((record, index) => { const diff = compareValue(record, records[index + 1], metric.key); return diff.kind === 'changed' || diff.kind === 'new' }))
            if (!visibleMetrics.length) return null
            return <section key={group.group} aria-label={group.group}>
              <div role="row" className="grid border-b border-line bg-paper" style={{ gridTemplateColumns: `190px repeat(${records.length}, minmax(150px, 1fr))` }}><span role="rowheader" className="sticky left-0 z-10 flex items-center gap-2 bg-paper px-4 py-3 font-hd text-lg"><span className={`size-3 rounded-sm ${group.color}`} />{group.group}</span></div>
              {visibleMetrics.map((metric) => <div key={metric.key} role="row" className="grid min-h-14 border-b border-dashed border-line" style={{ gridTemplateColumns: `190px repeat(${records.length}, minmax(150px, 1fr))` }}><span role="rowheader" className="sticky left-0 z-10 flex items-center gap-1 bg-card px-4 text-sm shadow-[inset_-1.5px_0_0_var(--color-line)]">{metric.label}<small className="text-[10px] text-ink-3">{metric.unit}</small></span>{records.map((record, index) => { const diff = compareValue(record, records[index + 1], metric.key); const value = metricValue(record, metric.key); return <span key={record.id} role="cell" className="flex items-center justify-end px-3"><span className={`inline-flex min-w-16 flex-col items-end rounded-sm px-2 py-1 ${diff.kind === 'changed' ? 'bg-oat-soft' : diff.kind === 'new' || diff.kind === 'first' ? 'bg-mist-soft' : ''}`}><span className="font-num text-sm font-bold">{value === null ? '—' : formatNumber(value)}</span>{diff.kind === 'changed' && diff.delta !== null && <span className="font-num text-[10px] text-oat-ink">{formatDelta(diff.delta)}</span>}{(diff.kind === 'new' || diff.kind === 'first') && <span className="text-[10px] text-mist-ink">第一次</span>}</span></span> })}</div>)}
            </section>
          })}
        </div>
      </div>
      <p className="m-0 text-xs text-ink-2">日期多於畫面寬度時可以左右捲動，「項目」欄會固定在左邊。</p>
    </>
  )
}

function MobileDetail({ record, previous, onDelete }: { record: BodyMeasurement; previous?: BodyMeasurement; onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  return <div className="md:hidden"><div className="-mx-4 -mt-6 mb-3 flex items-center gap-2 border-b border-dashed border-line-strong px-2 py-2.5"><Link to="/me/measurements" aria-label="返回量測紀錄" className="flex size-11 items-center justify-center text-ink"><Icon name="back" /></Link><div className="min-w-0"><h1 className="m-0 truncate font-hd text-lg">{formatDate(record.measuredOn)}</h1><p className="m-0 text-[11px] text-ink-3">{previous ? `和上次比，改了 ${ALL_METRICS.filter((metric) => compareValue(record, previous, metric.key).kind === 'changed').length} 項` : '第一次記錄'}</p></div><button type="button" aria-label="更多動作" onClick={() => setConfirmDelete(true)} className="ml-auto flex size-11 items-center justify-center rounded-btn"><Icon name="more" /></button></div><MeasurementDetail record={record} previous={previous} onDelete={onDelete} hideActions hideHeader /><div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-20 grid grid-cols-[1fr_2fr] gap-2 border-t border-dashed border-line-strong bg-paper p-3"><Button variant="secondary" className="text-rose-deep" onClick={() => setConfirmDelete(true)}>刪除</Button><ButtonLink to={`/me?edit=${encodeURIComponent(record.id)}`} variant="primary">編輯這筆紀錄</ButtonLink></div>{confirmDelete && <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"><section role="alertdialog" aria-modal="true" className="w-full max-w-sm space-y-3 rounded-block bg-card p-5 shadow-float"><h2 className="m-0 font-hd text-xl">刪除這筆紀錄？</h2><p className="m-0 text-sm text-ink-2">刪除後無法復原。</p><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setConfirmDelete(false)}>取消</Button><Button variant="danger" onClick={onDelete}>永久刪除</Button></div></section></div>}</div>
}
