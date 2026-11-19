import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Switch } from '@/components/ui/Switch'
import { LoadingState } from '@/components/ui/PageState'
import { Toast, type ToastMessage } from '@/components/ui/Toast'
import { fetchTrendPrefs, resetTrendPrefs, saveTrendPrefs } from '@/lib/data'
import {
  DEFAULT_TREND_PREFS,
  SERIES_TONES,
  TREND_METRICS,
  TREND_RANGES,
  canPlot,
  countFor,
  dayLabel,
  formatTrendNumber,
  linePath,
  maxSeries,
  monthLabel,
  previousValue,
  sparkPath,
  toggleTrendMetric,
  trendChange,
  trendMetric,
  trendRecords,
  yScale,
  type TrendRecord,
} from '@/lib/measurementTrend'
import { useIsMobile } from '@/lib/useIsMobile'
import type { BodyMeasurement, MeasurementTrendPrefs, TrendMetricKey } from '@/types'

const timeLabel = (record: TrendRecord) => (record.morning ? '早上空腹' : record.timeOfDay === 'afternoon_evening' ? '下午・晚上' : '其他時段')

function RangeSeg({ value, onChange, compact }: { value: MeasurementTrendPrefs['range']; onChange: (range: MeasurementTrendPrefs['range']) => void; compact: boolean }) {
  return (
    <div role="group" aria-label="時間範圍" className={`inline-grid grid-flow-col rounded-btn bg-tile ${compact ? 'p-0.5' : 'p-[3px]'}`}>
      {TREND_RANGES.map((option) => (
        <button key={option.id} type="button" aria-pressed={value === option.id} onClick={() => onChange(option.id)} className={`flex items-center justify-center rounded-sm ${compact ? 'min-h-11 px-2 text-xs' : 'h-10 px-4 text-sm'} ${value === option.id ? 'bg-card font-bold text-ink shadow-paper' : 'font-medium text-ink-2'}`}>{option.label}</button>
      ))}
    </div>
  )
}

/** 量測趨勢（設計稿 B-History-Trend／B-M-History-Trend） */
export function MeasurementTrend({ records }: { records: BodyMeasurement[] }) {
  const mobile = useIsMobile()
  const [prefs, setPrefs] = useState<MeasurementTrendPrefs>(DEFAULT_TREND_PREFS)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<number | null>(null)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const saveSeq = useRef(0)

  useEffect(() => {
    let alive = true
    fetchTrendPrefs()
      .then((result) => { if (alive) { setPrefs(result.prefs); setSaved(result.saved) } })
      .catch(() => alive && setToast({ tone: 'error', text: '趨勢設定讀取失敗，先用預設檢視。' }))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  function update(patch: Partial<MeasurementTrendPrefs>) {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    setActive(null)
    const seq = ++saveSeq.current
    saveTrendPrefs(next)
      .then((result) => { if (seq === saveSeq.current) setSaved(true); void result })
      .catch((cause: unknown) => setToast({ tone: 'error', text: cause instanceof Error ? `設定沒有存起來：${cause.message}` : '設定沒有存起來，重新整理後會還原。' }))
  }

  async function reset() {
    saveSeq.current += 1
    try {
      const result = await resetTrendPrefs()
      setPrefs(result.prefs)
      setSaved(false)
      setActive(null)
      setToast({ tone: 'success', text: '已還原預設檢視。' })
    } catch (cause) {
      setToast({ tone: 'error', text: cause instanceof Error ? cause.message : '還原失敗，請稍後再試。' })
    }
  }

  const { domain, list } = useMemo(() => trendRecords(records, prefs), [records, prefs])
  const metrics = TREND_METRICS.filter((metric) => prefs.showWeight || metric.key !== 'weightKg')
  const max = maxSeries(mobile)

  // 實際畫在主圖的部位：設定裡的、這段時間畫得出線的；都不行時改用第一個畫得出線的
  const selected = useMemo<TrendMetricKey[]>(() => {
    const chosen = prefs.metrics.filter((key) => (prefs.showWeight || key !== 'weightKg') && canPlot(list, key)).slice(0, max)
    if (chosen.length) return chosen
    const preferred = (['waistCm', ...metrics.map((metric) => metric.key)] as TrendMetricKey[]).find((key) => metrics.some((metric) => metric.key === key) && canPlot(list, key))
    return preferred ? [preferred] : []
  }, [prefs, list, max, metrics])

  if (loading) return <LoadingState label="正在把數字連成線…" rows={2} />

  const unit = selected[0] ? trendMetric(selected[0]).unit : 'cm'
  const shown = list.map((record, index) => ({ record, index })).filter(({ record }) => selected.some((key) => record.values[key] != null))
  const scale = yScale(shown.flatMap(({ record }) => selected.map((key) => record.values[key]).filter((value): value is number => value != null)), unit)
  const activeIndex = active != null && shown.some(({ index }) => index === active) ? active : shown[shown.length - 1]?.index ?? null
  const activeRecord = activeIndex != null ? list[activeIndex] : null
  const series = selected.map((key, order) => {
    const points = list.flatMap((record) => (record.values[key] != null ? [{ x: record.x, y: scale.y(record.values[key]!), value: record.values[key]!, morning: record.morning }] : []))
    return { key, metric: trendMetric(key), tone: SERIES_TONES[order], points, last: points[points.length - 1] }
  })
  // 兩條線的結尾標籤太近時錯開
  const endY = series.map((line) => line.last?.y ?? 0)
  if (endY.length === 2 && Math.abs(endY[0] - endY[1]) < 8) {
    const mid = (endY[0] + endY[1]) / 2
    const [upper, lower] = endY[0] <= endY[1] ? [0, 1] : [1, 0]
    endY[upper] = mid - 4
    endY[lower] = mid + 4
  }
  const months = [...new Set(shown.map(({ record }) => record.date.slice(0, 7)))]
  const monthTicks = mobile
    ? [shown[0], shown[shown.length - 1]].filter((item, i, arr) => item && arr.indexOf(item) === i).map((item) => ({ x: item!.record.x, label: monthLabel(item!.record.date) }))
    : months.filter((_, i) => months.length <= 6 || i % Math.ceil(months.length / 6) === 0 || i === months.length - 1)
      .map((month) => { const first = shown.find(({ record }) => record.date.startsWith(month))!; return { x: first.record.x, label: monthLabel(first.record.date) } })
  const summary = series.map((line) => `${line.metric.label}從 ${formatTrendNumber(line.points[0].value)} 到 ${formatTrendNumber(line.last.value)} ${line.metric.unit}`).join('，')
  const rangeText = mobile ? TREND_RANGES.find((option) => option.id === prefs.range)!.label : `${monthLabel(domain.start)} – ${monthLabel(domain.end)}`
  const tooltipLeft = activeRecord ? activeRecord.x : 0

  function onChartKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const at = shown.findIndex(({ index }) => index === activeIndex)
    const next = shown[Math.min(shown.length - 1, Math.max(0, at + (event.key === 'ArrowRight' ? 1 : -1)))]
    if (next) {
      setActive(next.index)
      document.getElementById(`trend-date-${next.index}`)?.focus()
    }
  }

  function pickCard(key: TrendMetricKey) {
    if (selected.includes(key)) return
    update({ metrics: toggleTrendMetric(selected, key, max) })
  }

  const values = activeRecord ? series.map((line) => ({ line, value: activeRecord.values[line.key] ?? null, before: previousValue(list, activeIndex!, line.key) })) : []

  return (
    <div className="flex flex-col gap-3 md:gap-[22px]">
      {/* 桌面：範圍與開關在圖上方；手機收在圖卡內 */}
      <div className="hidden flex-wrap items-center gap-3.5 md:flex">
        <RangeSeg value={prefs.range} onChange={(range) => update({ range })} compact={false} />
        <Switch checked={prefs.morningOnly} label="只看「早上空腹」的紀錄" onChange={() => update({ morningOnly: !prefs.morningOnly })} />
        <Switch checked={prefs.showWeight} label="顯示體重" onChange={() => update({ showWeight: !prefs.showWeight })} />
        {saved && <button type="button" onClick={() => void reset()} className="ml-auto min-h-11 px-2 text-[13px] text-mist-deep">還原預設檢視</button>}
      </div>

      <section aria-labelledby="trend-title" className="flex flex-col gap-3 rounded-card bg-card px-3 pb-4 pt-3.5 shadow-paper md:gap-4 md:px-[22px] md:pb-[22px] md:pt-5">
        <div className="flex flex-wrap items-baseline gap-2 md:gap-3">
          <h2 id="trend-title" className="m-0 font-hd text-xl md:text-[22px]">{selected.length ? selected.map((key) => trendMetric(key).label).join('、') : '趨勢'}</h2>
          <span className="text-[11px] text-ink-2 md:text-xs">{unit}・{rangeText}・<span className="font-num tabular">{shown.length}</span> 筆</span>
          <span className="ml-auto md:hidden"><RangeSeg value={prefs.range} onChange={(range) => update({ range })} compact /></span>
          <span className="ml-auto hidden flex-wrap items-center gap-3.5 text-xs text-ink-2 md:flex">
            {series.map((line) => <span key={line.key} className="inline-flex items-center gap-1.5"><span className="h-0.5 w-[18px]" style={{ background: line.tone.stroke }} />{line.metric.label}</span>)}
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-ink-2" />早上空腹</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full shadow-[inset_0_0_0_2px_var(--color-ink-2)]" />其他時段</span>
          </span>
        </div>

        <div role="group" aria-label={`選擇部位（最多 ${max} 項，單位相同）`} className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
          {metrics.map((metric) => {
            const order = selected.indexOf(metric.key)
            const on = order >= 0
            const plottable = canPlot(list, metric.key)
            return (
              <button
                key={metric.key}
                type="button"
                aria-pressed={on}
                disabled={!plottable}
                title={plottable ? undefined : `這段時間只有 ${countFor(list, metric.key)} 筆，畫不出線`}
                onClick={() => update({ metrics: toggleTrendMetric(selected, metric.key, max) })}
                className={`inline-flex min-h-11 flex-none items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-3 text-[13px] font-medium text-ink disabled:opacity-50 md:min-h-9 ${on ? 'bg-card' : 'border-line bg-paper'}`}
                style={on ? { borderColor: SERIES_TONES[order].stroke } : undefined}
              >
                <span aria-hidden="true" className={`size-2.5 rounded-full ${on ? '' : 'bg-line-strong'}`} style={on ? { background: SERIES_TONES[order].stroke } : undefined} />
                {metric.label}
              </button>
            )
          })}
          <span className="hidden self-center text-xs text-ink-3 md:ml-1 md:inline">最多同時看 2 項；體重單位不同，選了會單獨顯示</span>
        </div>

        {selected.length === 0 ? (
          <p className="m-0 rounded-tile bg-paper px-4 py-8 text-center text-sm leading-6 text-ink-2">
            這段時間每個部位都只有 1 筆以下，還畫不出線。{prefs.range !== 'all' ? '切到「全部」看看，' : ''}{prefs.morningOnly ? '或關掉「只看早上空腹」，' : ''}多量幾次就會出現。
          </p>
        ) : (
          <figure className="m-0 pb-6 pl-8 pr-11 pt-1.5 md:pb-8 md:pl-[52px] md:pr-24 md:pt-2.5">
            <div className="relative h-[200px] md:h-[300px]" onKeyDown={onChartKey}>
              <div role="img" aria-label={`${summary}，${rangeText} 共 ${shown.length} 筆`} className="absolute inset-0">
                {scale.ticks.map((tick) => (
                  <span key={tick} aria-hidden="true">
                    <span className="absolute inset-x-0 h-px bg-chart-grid" style={{ top: `${scale.y(tick)}%` }} />
                    <span className="absolute -left-[30px] w-6 -translate-y-1/2 text-right font-num text-[10px] font-semibold text-ink-3 md:-left-11 md:w-9 md:text-[11px]" style={{ top: `${scale.y(tick)}%` }}>{formatTrendNumber(tick)}</span>
                  </span>
                ))}
                <svg viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 size-full overflow-visible">
                  {series.map((line) => <path key={line.key} d={linePath(line.points)} fill="none" stroke={line.tone.stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />)}
                </svg>
                {activeRecord && <span aria-hidden="true" className="absolute inset-y-0 w-px bg-ink opacity-35" style={{ left: `${activeRecord.x}%` }} />}
                {series.flatMap((line) => line.points.map((point, i) => (
                  <span
                    key={`${line.key}-${i}`}
                    aria-hidden="true"
                    className="pointer-events-none absolute -ml-1.5 -mt-1.5 size-3 rounded-full"
                    style={{ left: `${point.x}%`, top: `${point.y}%`, background: point.morning ? line.tone.stroke : 'var(--color-card)', boxShadow: point.morning ? '0 0 0 2px var(--color-card)' : `inset 0 0 0 2.5px ${line.tone.stroke}, 0 0 0 2px var(--color-card)` }}
                  />
                )))}
                {monthTicks.map((tick) => <span key={`${tick.label}-${tick.x}`} aria-hidden="true" className="absolute top-full mt-1.5 -translate-x-1/2 whitespace-nowrap font-num text-[10px] font-semibold text-ink-3 md:mt-2 md:text-[11px]" style={{ left: `${tick.x}%` }}>{tick.label}</span>)}
                {series.map((line, i) => line.last && (
                  <span key={line.key} aria-hidden="true" className="absolute left-full ml-2 -translate-y-1/2 whitespace-nowrap font-num text-xs font-bold md:ml-2.5" style={{ top: `${endY[i]}%` }}>
                    <span className="hidden md:inline">{line.metric.label} </span>{formatTrendNumber(line.last.value)}
                  </span>
                ))}
              </div>
              {/* 每個日期一個可點、可聚焦的區塊；左右鍵切換 */}
              {shown.map(({ record, index }, i) => {
                const prev = shown[i - 1]?.record.x ?? 0
                const next = shown[i + 1]?.record.x ?? 100
                const left = i === 0 ? 0 : (prev + record.x) / 2
                const right = i === shown.length - 1 ? 100 : (record.x + next) / 2
                return (
                  <button
                    key={record.id}
                    id={`trend-date-${index}`}
                    type="button"
                    tabIndex={index === activeIndex ? 0 : -1}
                    aria-label={`${dayLabel(record.date)}，${timeLabel(record)}，${series.map((line) => `${line.metric.label} ${record.values[line.key] != null ? `${formatTrendNumber(record.values[line.key]!)} ${line.metric.unit}` : '沒量'}`).join('，')}`}
                    aria-pressed={index === activeIndex}
                    onMouseEnter={() => setActive(index)}
                    onFocus={() => setActive(index)}
                    onClick={() => setActive(index)}
                    className="absolute inset-y-0 bg-transparent focus-visible:outline-offset-0"
                    style={{ left: `${left}%`, width: `${Math.max(right - left, 0.5)}%` }}
                  />
                )
              })}
              {activeRecord && (
                <div aria-hidden="true" className="pointer-events-none absolute top-[30%] hidden min-w-[190px] rounded-tile bg-ink px-3 py-2.5 text-xs leading-[1.7] text-paper shadow-float md:block" style={{ left: `${tooltipLeft}%`, transform: tooltipLeft > 50 ? 'translateX(-108%)' : 'translateX(8%)' }}>
                  <b className="font-num text-[13px]">{dayLabel(activeRecord.date)}</b>・{timeLabel(activeRecord)}
                  {values.map(({ line, value, before }) => (
                    <span key={line.key} className="block">
                      <span className="mr-1.5 inline-block size-2 rounded-full" style={{ background: line.tone.light }} />
                      {line.metric.label} <b className="font-num">{value == null ? '—' : formatTrendNumber(value)}</b> {value == null ? '這次沒量' : line.metric.unit}
                      {value != null && before != null && <span className="opacity-75">（上次 {formatTrendNumber(before)}）</span>}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <figcaption className="mt-10 hidden text-xs leading-[1.7] text-ink-2 md:block">滑過或點一個日期，顯示那天的數字。Y 軸至少涵蓋 10 cm（體重至少 3 kg），1 公分的差異不會被畫得很誇張。空心點是不同時段量的，比較時要留意。想看精確數字，切到「對照表」。</figcaption>
          </figure>
        )}

        {/* 手機：選中日期的數字顯示在圖下方 */}
        {activeRecord && selected.length > 0 && (
          <div role="status" className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-btn bg-ink px-3 py-2.5 text-xs text-paper md:hidden">
            <b className="font-num text-[13px]">{dayLabel(activeRecord.date)}</b>{timeLabel(activeRecord)}
            {values.map(({ line, value, before }) => (
              <span key={line.key} className="ml-auto">{line.metric.label} <b className="font-num">{value == null ? '—' : formatTrendNumber(value)}</b> {value == null ? '這次沒量' : line.metric.unit}{value != null && before != null && <span className="opacity-75">（上次 {formatTrendNumber(before)}）</span>}</span>
            ))}
          </div>
        )}
        <p className="m-0 text-[11px] leading-[1.6] text-ink-2 md:hidden">點圖上的點，下方顯示那天的數字。空心點是其他時段量的。Y 軸至少 {unit === 'kg' ? '3 kg' : '10 cm'}。</p>
        <div className="flex flex-col border-t-[1.5px] border-dashed border-line pt-1.5 md:hidden">
          <Switch checked={prefs.morningOnly} label="只看「早上空腹」的紀錄" onChange={() => update({ morningOnly: !prefs.morningOnly })} className="flex-row-reverse" />
          <Switch checked={prefs.showWeight} label="顯示體重" onChange={() => update({ showWeight: !prefs.showWeight })} className="flex-row-reverse" />
          {saved && <button type="button" onClick={() => void reset()} className="min-h-11 self-start text-[13px] text-mist-deep">還原預設檢視</button>}
        </div>
      </section>

      <section aria-labelledby="trend-all" className="flex flex-col gap-2 md:gap-3">
        <div className="flex flex-wrap items-baseline gap-2.5 px-0.5"><h2 id="trend-all" className="m-0 font-hd text-[19px] md:text-xl">所有部位</h2><span className="hidden text-xs text-ink-2 md:inline">點一格放到上面的大圖。每格的比例尺一樣，小線只看方向。</span></div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-[repeat(auto-fill,minmax(210px,1fr))] md:gap-3">
          {metrics.map((metric) => {
            const count = countFor(list, metric.key)
            const last = [...list].reverse().find((record) => record.values[metric.key] != null)?.values[metric.key]
            const path = sparkPath(list, metric.key)
            const change = trendChange(list, metric.key)
            const order = selected.indexOf(metric.key)
            const tone = order >= 0 ? SERIES_TONES[order] : null
            const body = (
              <>
                <span className="flex items-center gap-1.5">
                  <span className="text-xs font-medium md:text-[13px]">{metric.label}</span>
                  {tone && <span aria-hidden="true" className="hidden size-2 rounded-full md:inline-block" style={{ background: tone.stroke }} />}
                  <span className="ml-auto font-num text-[11px] text-ink-2 md:hidden">{change}</span>
                  <span className="ml-auto hidden text-[11px] text-ink-3 md:inline">{count} 筆</span>
                </span>
                <span className="flex items-baseline gap-1">
                  <span className="font-num text-[19px] font-bold md:text-[22px]">{last != null ? formatTrendNumber(last) : '沒記'}</span>
                  {last != null && <span className="text-[11px] text-ink-3 md:text-xs">{metric.unit}</span>}
                  {change && <span className="ml-auto hidden font-num text-xs text-ink-2 md:inline">{change === '沒變' ? change : `${change} ${metric.unit}`}</span>}
                </span>
                {path ? (
                  <svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true" className="h-6 w-full overflow-visible md:h-[34px]">
                    <path d={path} fill="none" stroke={tone?.stroke ?? 'var(--color-ink-2)'} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                  </svg>
                ) : (
                  <span className="flex h-6 items-center text-[10px] text-ink-3 md:h-[34px] md:text-[11px]">{count === 1 ? '只有 1 筆，還畫不出線' : '這段時間還沒量過'}</span>
                )}
              </>
            )
            const className = 'flex flex-col gap-1 rounded-tile bg-card px-3 py-2.5 text-left text-ink md:gap-1.5 md:rounded-card md:px-3.5 md:py-3'
            const style = tone ? { boxShadow: `inset 0 0 0 2px ${tone.stroke}` } : undefined
            return path ? (
              <button key={metric.key} type="button" aria-pressed={order >= 0} aria-label={`${metric.label}，最近 ${last != null ? formatTrendNumber(last) : '—'} ${metric.unit}，${count} 筆；放到上面的大圖`} onClick={() => { pickCard(metric.key); document.getElementById('trend-title')?.scrollIntoView({ block: 'center' }) }} className={`${className} ${tone ? '' : 'shadow-paper'}`} style={style}>{body}</button>
            ) : (
              <div key={metric.key} className={`${className} shadow-paper`}>{body}</div>
            )
          })}
        </div>
      </section>
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  )
}
