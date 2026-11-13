import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ItemImage } from '@/components/closet/ItemImage'
import { DiaryEntryDialog } from '@/components/diary/DiaryEntryDialog'
import { FeelChip, MiniCollage, OccasionChip, RatingMarks } from '@/components/diary/DiaryParts'
import { OutfitBoard } from '@/components/outfit/OutfitBoard'
import { DestructiveActionDialog } from '@/components/ui/B10States'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { LoadingState, PageState } from '@/components/ui/PageState'
import { TiltLabel } from '@/components/ui/Paper'
import { Toast, type ToastMessage } from '@/components/ui/Toast'
import { createDiaryEntry, deleteDiaryEntry, fetchClosetItems, fetchDiaryEntries, updateDiaryEntry } from '@/lib/data'
import { parseISODate, todayISO, toISODate, WEEKDAYS } from '@/lib/date'
import {
  closetIdsOf,
  currentMonthKey,
  entryItems,
  entryPieces,
  diaryMonthGrid,
  FEEL_LABEL,
  formatDiaryDate,
  monthKey,
  monthStats,
  OCCASION_LEGEND,
  OCCASIONS,
  occasionTone,
  parseMonthKey,
  readTodayPicks,
  rewearState,
  shortDate,
  TONE_CLASS,
  toMonthKey,
  unavailablePieces,
  unwornLabel,
  weatherText,
  weekdayOf,
} from '@/lib/diary'
import type { ClosetItem, DiaryEntry, DiaryEntryInput, DiaryPhotoChange } from '@/types'

const demoSuffix = (demo: boolean) => (demo ? '（示範模式，重新整理後會還原）' : '')

interface Ctx {
  entries: DiaryEntry[]
  closet: ClosetItem[]
  closetById: Map<string, ClosetItem>
  onRewear: (entry: DiaryEntry) => void
  onEdit: (entry: DiaryEntry) => void
  onDelete: (entry: DiaryEntry) => void
  onNew: (date?: string) => void
}

export function DiaryPage() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const isNew = location.pathname === '/diary/new'
  const isEdit = location.pathname.endsWith('/edit')
  const routeEntryId = isNew ? undefined : id

  const [entries, setEntries] = useState<DiaryEntry[] | null>(null)
  const [closet, setCloset] = useState<ClosetItem[]>([])
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<DiaryEntry | null>(null)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const closeToast = useCallback(() => setToast(null), [])

  const load = useCallback(
    () =>
      Promise.all([fetchDiaryEntries(), fetchClosetItems()])
        .then(([e, c]) => {
          setEntries(e)
          setCloset(c)
        })
        .catch((error: unknown) => setLoadError(error instanceof Error ? error : new Error(String(error)))),
    [],
  )
  useEffect(() => {
    void load()
  }, [load])
  const retry = () => {
    setLoadError(null)
    void load()
  }

  const closetById = useMemo(() => new Map(closet.map((c) => [c.id, c])), [closet])
  const routeEntry = entries?.find((e) => e.id === routeEntryId) ?? null
  const view = params.get('view') === 'list' ? 'list' : 'calendar'

  const keep = (extra: Record<string, string | null>) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(extra)) {
      if (v === null) p.delete(k)
      else p.set(k, v)
    }
    const qs = p.toString()
    return qs ? `?${qs}` : ''
  }

  const goEntry = (entry: DiaryEntry) => navigate(`/diary/${entry.id}${keep({ month: monthKey(entry.date), date: entry.date })}`)

  const ctx: Ctx = {
    entries: entries ?? [],
    closet,
    closetById,
    onRewear: (entry) => navigate('/outfit', { state: rewearState(entry) }),
    onEdit: (entry) => navigate(`/diary/${entry.id}/edit${keep({})}`),
    onDelete: (entry) => setDeleting(entry),
    onNew: (date) => navigate(`/diary/new${keep({ date: date ?? null })}`),
  }

  const closeDialog = () => {
    if (isEdit && routeEntryId) navigate(`/diary/${routeEntryId}${keep({})}`, { replace: true })
    else navigate(`/diary${keep({})}`, { replace: true })
  }

  const run = async (action: () => Promise<void>) => {
    setSaving(true)
    try {
      await action()
    } catch (error) {
      setToast({ tone: 'error', text: error instanceof Error ? `沒有存成功：${error.message}` : '沒有存成功，內容還在，請稍後再試。' })
    } finally {
      setSaving(false)
    }
  }

  const onSubmit = (input: DiaryEntryInput, photo: DiaryPhotoChange) =>
    run(async () => {
      if (isEdit && routeEntryId) {
        const { demo } = await updateDiaryEntry(routeEntryId, input, photo)
        await load()
        navigate(`/diary/${routeEntryId}${keep({ month: monthKey(input.date), date: input.date })}`, { replace: true })
        setToast({ tone: 'success', text: `已儲存變更${demoSuffix(demo)}` })
      } else {
        const { id: newId, demo } = await createDiaryEntry(input, photo ?? null)
        await load()
        navigate(`/diary/${newId}${keep({ month: monthKey(input.date), date: input.date })}`, { replace: true })
        setToast({ tone: 'success', text: `已存進日記${demoSuffix(demo)}` })
      }
    })

  const confirmDelete = (entry: DiaryEntry) =>
    run(async () => {
      const { demo } = await deleteDiaryEntry(entry.id)
      setDeleting(null)
      await load()
      navigate(`/diary${keep({ month: monthKey(entry.date), date: entry.date })}`, { replace: true })
      setToast({ tone: 'success', text: `已刪除「${entry.name}」${demoSuffix(demo)}` })
    })

  const requestedDate = params.get('date')
  const newDate = requestedDate && parseISODate(requestedDate) && requestedDate <= todayISO() ? requestedDate : todayISO()

  if (!entries) {
    return (
      <main className="mx-auto max-w-[1320px] px-[clamp(16px,3vw,48px)] pt-7 pb-16">
        {loadError ? (
          <div role="alert"><PageState icon="alert" tone="rose" title="日記暫時打不開" description="資料讀取沒有成功，紀錄不會被更動。確認連線後可以再試一次。" action={<Button variant="secondary" onClick={retry}>重新載入</Button>} /></div>
        ) : (
          <LoadingState label="正在翻開穿搭日記…" />
        )}
      </main>
    )
  }

  const showDayOnMobile = !!routeEntry && !isEdit

  return (
    <>
      {routeEntryId && !routeEntry && (
        <main className="mx-auto max-w-[1320px] px-[clamp(16px,3vw,48px)] pt-7">
          <PageState icon="diary" tone="mist" compact title="找不到這筆紀錄" description="可能已經被刪除了。回到日記看看其他天吧。" action={<ButtonLink to="/diary" variant="secondary">回到穿搭日記</ButtonLink>} />
        </main>
      )}

      {/* 手機：單日紀錄獨立頁 */}
      {showDayOnMobile && <MobileDay entry={routeEntry} ctx={ctx} />}

      <main className={`${showDayOnMobile ? 'hidden md:flex' : 'flex'} mx-auto max-w-[1320px] flex-col gap-[22px] px-4 pt-0 pb-28 md:px-[clamp(16px,3vw,48px)] md:pt-7 md:pb-16`}>
        <DiaryHeader view={view} onNew={() => ctx.onNew(view === 'calendar' ? params.get('date') ?? undefined : undefined)} viewHref={(v) => `/diary${keep({ view: v === 'list' ? 'list' : null })}`} />
        {view === 'calendar' ? (
          <CalendarView ctx={ctx} selectedEntryId={routeEntry?.id} onPickEntry={goEntry} />
        ) : (
          <ListView ctx={ctx} />
        )}
      </main>

      {/* 手機：記一筆浮動按鈕 */}
      {!showDayOnMobile && (
        <button
          type="button"
          aria-label="記一筆"
          onClick={() => ctx.onNew(view === 'calendar' ? params.get('date') ?? undefined : undefined)}
          className="fixed right-4 bottom-[calc(96px+env(safe-area-inset-bottom))] z-20 flex size-14 items-center justify-center rounded-[18px] bg-ink text-paper shadow-float md:hidden"
          style={{ rotate: '-4deg' }}
        >
          <Icon name="plus" size={24} />
        </button>
      )}

      {(isNew || (isEdit && routeEntry)) && (
        <DiaryEntryDialog
          key={isEdit ? routeEntryId : 'new'}
          entry={isEdit ? routeEntry ?? undefined : undefined}
          initialDate={newDate}
          closet={closet}
          pastEntries={entries.filter((e) => e.id !== routeEntryId)}
          todayPicks={readTodayPicks()}
          saving={saving}
          onCancel={closeDialog}
          onSubmit={(input, photo) => void onSubmit(input, photo)}
        />
      )}
      {deleting && (
        <DestructiveActionDialog
          title={`刪除「${deleting.name}」？`}
          description={`${formatDiaryDate(deleting.date)}的這筆紀錄和照片會一起刪除，這幾件衣物的穿過次數各減 1。刪除後無法復原。`}
          confirmLabel="刪除紀錄"
          onCancel={() => setDeleting(null)}
          onConfirm={() => void confirmDelete(deleting)}
        />
      )}
      <Toast message={toast} onClose={closeToast} />
    </>
  )
}

function DiaryHeader({ view, onNew, viewHref }: { view: 'calendar' | 'list'; onNew: () => void; viewHref: (v: 'calendar' | 'list') => string }) {
  const seg = (v: 'calendar' | 'list', label: string, icon: 'calendar' | 'diary') => (
    <Link
      to={viewHref(v)}
      replace
      aria-current={view === v ? 'page' : undefined}
      className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-sm px-3.5 text-sm no-underline md:h-10 ${view === v ? 'bg-card font-bold text-ink shadow-sticker' : 'font-medium text-ink-2'}`}
    >
      <span className="hidden md:inline-flex"><Icon name={icon} size={18} /></span>
      {label}
    </Link>
  )
  return (
    <>
      {/* 手機 */}
      <div className="-mx-4 flex items-center gap-2 border-b-[1.5px] border-dashed border-line-strong py-2.5 pr-3 pl-4 md:hidden">
        <h1 className="m-0 font-hd text-[22px]">穿搭日記</h1>
        <nav aria-label="檢視方式" className="ml-auto inline-grid grid-cols-2 rounded-btn bg-tile p-[3px]">
          {seg('calendar', '月曆', 'calendar')}
          {seg('list', '列表', 'diary')}
        </nav>
      </div>
      {/* 桌面 */}
      <div className="hidden flex-wrap items-end gap-4 md:flex">
        <div className="mr-auto flex flex-col gap-2.5">
          <TiltLabel accent="mist">穿搭手帳</TiltLabel>
          <h1 className="m-0 font-hd text-[34px]">穿搭日記</h1>
          <p className="m-0 text-sm leading-[1.8] text-ink-2">
            {view === 'list' ? '用場合、評分和穿起來的感受篩一篩，找出真正好穿的那幾套。' : '記下每天穿了什麼、穿起來感覺如何。好穿的那套，下次一鍵就能再穿。'}
          </p>
        </div>
        <nav aria-label="檢視方式" className="inline-grid grid-cols-2 rounded-btn bg-tile p-[3px]">
          {seg('calendar', '月曆', 'calendar')}
          {seg('list', '列表', 'diary')}
        </nav>
        <Button variant="primary" onClick={onNew}><Icon name="plus" />記一筆</Button>
      </div>
    </>
  )
}

// ---------- 月曆 ----------

function CalendarView({ ctx, selectedEntryId, onPickEntry }: { ctx: Ctx; selectedEntryId?: string; onPickEntry: (entry: DiaryEntry) => void }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const today = todayISO()
  const selectedEntry = ctx.entries.find((e) => e.id === selectedEntryId)
  const selectedDate = selectedEntry?.date ?? (parseISODate(params.get('date')) ? params.get('date')! : today)
  const ym = parseMonthKey(params.get('month')) ?? parseMonthKey(monthKey(selectedDate)) ?? parseMonthKey(currentMonthKey())!
  const key = toMonthKey(ym.year, ym.month)

  const byDate = useMemo(() => {
    const map = new Map<string, DiaryEntry[]>()
    for (const e of ctx.entries) map.set(e.date, [...(map.get(e.date) ?? []), e])
    for (const list of map.values()) list.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return map
  }, [ctx.entries])
  const monthEntries = ctx.entries.filter((e) => monthKey(e.date) === key)
  const stats = useMemo(() => monthStats(monthEntries, ctx.closet), [monthEntries, ctx.closet])
  const cells = diaryMonthGrid(ym.year, ym.month)

  const dayEntries = byDate.get(selectedDate) ?? []
  const current = selectedEntry ?? dayEntries[0] ?? null

  const go = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) {
      if (v === null) p.delete(k)
      else p.set(k, v)
    }
    // 換月或換日時離開 /diary/:id
    navigate(`/diary?${p.toString()}`, { replace: true })
  }
  const shiftMonth = (n: number) => {
    const d = new Date(ym.year, ym.month + n, 1)
    go({ month: toMonthKey(d.getFullYear(), d.getMonth()) })
  }
  const selectDay = (iso: string) => {
    const list = byDate.get(iso)
    if (list?.length) onPickEntry(list[0])
    else go({ date: iso, month: monthKey(iso) })
  }

  return (
    <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section aria-labelledby="cal-title" className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" aria-label="上個月" onClick={() => shiftMonth(-1)} className="flex size-11 items-center justify-center rounded-btn bg-transparent text-ink-2 hover:bg-tile">
            <Icon name="back" />
          </button>
          <h2 id="cal-title" className="m-0 font-hd text-xl md:text-2xl" aria-live="polite">
            <span className="font-num text-[19px] font-bold md:text-[23px]">{ym.year}</span> 年 <span className="font-num text-[19px] font-bold md:text-[23px]">{ym.month + 1}</span> 月
          </h2>
          <button type="button" aria-label="下個月" onClick={() => shiftMonth(1)} className="flex size-11 items-center justify-center rounded-btn bg-transparent text-ink-2 hover:bg-tile">
            <Icon name="next" />
          </button>
          <Button variant="secondary" className="ml-1.5 hidden h-9 px-3 text-[13px] md:inline-flex" onClick={() => go({ month: currentMonthKey(), date: today })}>回到今天</Button>
          <span className="ml-auto text-xs text-ink-2 md:hidden">記了 <b className="font-num text-ink tabular">{stats.days}</b> 天</span>
          <span className="ml-auto hidden gap-3 text-xs text-ink-2 md:flex">
            {OCCASION_LEGEND.map((o) => (
              <span key={o} className="flex items-center gap-[5px]"><span aria-hidden="true" className={`size-2.5 rounded-[3px] ${TONE_CLASS[occasionTone(o)].dot}`} />{o}</span>
            ))}
          </span>
        </div>

        <div className="grid grid-cols-7 gap-0.5 md:gap-1.5">
          {WEEKDAYS.map((w, i) => (
            <span key={w} aria-hidden="true" className={`flex h-6 items-center justify-center text-[11px] font-medium md:h-7 md:text-xs ${i === 0 || i === 6 ? 'text-rose-deep' : 'text-ink-3'}`}>{w}</span>
          ))}
          {cells.map((d) => {
            const iso = toISODate(d)
            const inMonth = d.getMonth() === ym.month
            const list = byDate.get(iso) ?? []
            const first = list[0]
            const isToday = iso === today
            const future = iso > today
            const selected = inMonth && iso === selectedDate
            const tone = first ? TONE_CLASS[occasionTone(first.occasions[0])] : null
            const pieces = first ? entryPieces(first, ctx.closetById) : {}
            const label = `${d.getMonth() + 1} 月 ${d.getDate()} 日（${WEEKDAYS[d.getDay()]}）${isToday ? '，今天' : ''}${first ? `，${first.name}${list.length > 1 ? `等 ${list.length} 筆` : ''}` : future ? '' : '，沒有紀錄'}`
            if (!inMonth) {
              return (
                <span key={iso} aria-hidden="true" className="flex h-14 flex-col items-center rounded-tile p-1 opacity-40 md:h-[124px] md:items-start md:p-1.5">
                  <span className="font-num text-[13px] font-bold text-ink-3">{d.getDate()}</span>
                </span>
              )
            }
            const colors = Object.values(pieces).slice(0, 2).map((p) => p!.colorHex)
            return (
              <button
                key={iso}
                type="button"
                disabled={future}
                aria-label={label}
                aria-pressed={selected}
                onClick={() => selectDay(iso)}
                className={`relative flex h-14 flex-col items-center gap-0.5 overflow-hidden rounded-tile p-1 text-left text-ink md:h-[124px] md:items-stretch md:p-1.5 ${
                  selected ? 'border-2 border-ink shadow-paper' : first ? 'border-[1.5px] border-transparent bg-card shadow-paper' : 'border-[1.5px] border-dashed border-line bg-transparent'
                } ${future ? 'cursor-default opacity-55' : ''}`}
              >
                <span className="flex h-5 items-center justify-between md:h-[22px]">
                  <span className={`inline-flex h-5 min-w-6 items-center justify-center rounded-[7px] px-1 font-num text-[13px] font-bold md:h-[22px] ${isToday ? 'border-[1.5px] border-dashed border-mist-deep text-mist-ink' : ''}`}>{d.getDate()}</span>
                  {tone && <span aria-hidden="true" className={`hidden size-2.5 rounded-[3px] md:block ${tone.dot}`} />}
                </span>
                {first && (
                  <>
                    {/* 手機：兩片色塊 */}
                    <span aria-hidden="true" className="relative h-6 w-7 md:hidden">
                      {colors[0] && <span className="absolute top-0 left-0 h-4 w-[18px] rounded-[5px] shadow-sticker" style={{ background: colors[0], rotate: '-8deg' }} />}
                      {colors[1] && <span className="absolute right-0 bottom-0 size-4 rounded-[5px] shadow-sticker" style={{ background: colors[1], rotate: '7deg' }} />}
                    </span>
                    <MiniCollage pieces={pieces} className={`hidden flex-1 md:block ${tone?.wash ?? ''}`} />
                    <span className="hidden truncate text-[11px] leading-[1.3] md:block">{first.name}</span>
                    {list.length > 1 && <span className="absolute top-1 right-1 rounded-full bg-ink px-1 font-num text-[10px] text-paper md:top-auto md:right-1.5 md:bottom-6">+{list.length - 1}</span>}
                  </>
                )}
              </button>
            )
          })}
        </div>

        {/* 這個月（桌面） */}
        <div className="mt-2.5 hidden grid-cols-3 gap-3.5 md:grid">
          <section className="relative flex flex-col gap-1.5 overflow-hidden rounded-[16px] bg-card px-[18px] py-4 shadow-paper">
            <span aria-hidden="true" className="absolute -top-4 -right-3.5 size-16 rounded-[16px] bg-mist-wash mix-blend-multiply" style={{ rotate: '12deg' }} />
            <span className="relative text-xs text-ink-2">{ym.month + 1} 月記了</span>
            <span className="relative"><span className="font-num text-[30px] font-bold tabular">{stats.days}</span> <span className="text-[13px]">天</span></span>
            <span className="relative text-xs text-ink-2">
              {stats.avgRating !== null ? <>平均評分 <span className="font-num font-bold text-ink tabular">{stats.avgRating.toFixed(1)}</span>・</> : null}
              {stats.comfyDays} 天覺得舒服
            </span>
          </section>
          <section className="flex flex-col gap-2 rounded-[16px] bg-card px-[18px] py-4 shadow-paper">
            <span className="text-xs text-ink-2">這個月最常穿</span>
            {stats.top.length === 0 && <span className="text-[13px] text-ink-2">還沒有紀錄</span>}
            {stats.top.map(({ item, count }) => (
              <Link key={item.id} to={`/closet/${item.id}`} className="flex min-h-8 items-center gap-2 text-[13px] text-ink no-underline">
                <span className="flex size-[30px] flex-none items-center justify-center rounded-sm bg-tile"><ItemImage name="" cutoutUrl={item.cutoutUrl} shape={item.shape} colorHex={item.colorHex} className="size-[80%]" /></span>
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <span className="font-num text-xs text-ink-2 tabular">{count} 次</span>
              </Link>
            ))}
          </section>
          <section className="flex flex-col gap-2 rounded-[16px] bg-card px-[18px] py-4 shadow-paper">
            <span className="text-xs text-ink-2">這個月還沒穿到</span>
            <div className="flex flex-wrap gap-1.5">
              {stats.unworn.map((item) => (
                <span key={item.id} className="inline-flex h-[26px] items-center rounded-full bg-tile px-2.5 text-xs text-ink">{unwornLabel(item)}</span>
              ))}
              {stats.unworn.length === 0 && <span className="text-[13px] text-ink-2">衣櫃每一件都穿到了</span>}
            </div>
            <span className="text-xs leading-[1.6] text-ink-2">只是提醒，不用勉強穿。</span>
            <Link to="/closet" className="mt-auto inline-flex min-h-8 items-center gap-1 text-[13px] font-medium">到衣櫃看看<Icon name="next" size={16} /></Link>
          </section>
        </div>
      </section>

      {/* 單日：桌面側欄 */}
      <aside aria-label={`${formatDiaryDate(selectedDate)}的紀錄`} className="relative hidden flex-col gap-3.5 rounded-[16px] bg-card px-5 pt-[22px] pb-5 shadow-paper md:flex lg:sticky lg:top-4">
        <span aria-hidden="true" className="absolute -top-2.5 left-1/2 -ml-[42px] h-[22px] w-[84px] rounded-[2px] bg-mist-wash mix-blend-multiply" style={{ rotate: '-3deg' }} />
        <div className="flex items-center gap-2">
          <span className="font-hd text-[22px]">{formatDiaryDate(selectedDate)}</span>
          {current && weatherText(current) && <span className="ml-auto inline-flex h-[26px] items-center rounded-full bg-mist-soft px-2.5 text-xs text-mist-ink">{weatherText(current)}</span>}
        </div>
        {dayEntries.length > 1 && (
          <div role="group" aria-label="這天的紀錄" className="flex flex-wrap gap-1.5">
            {dayEntries.map((e, i) => (
              <button key={e.id} type="button" aria-pressed={current?.id === e.id} onClick={() => onPickEntry(e)} className={`inline-flex h-9 items-center rounded-full border-[1.5px] px-3 text-xs font-medium ${current?.id === e.id ? 'border-ink bg-ink text-paper' : 'border-line bg-card text-ink'}`}>
                第 {i + 1} 筆
              </button>
            ))}
          </div>
        )}
        {current ? (
          <EntryDetail entry={current} ctx={ctx} />
        ) : (
          <div className="flex flex-col items-start gap-3 py-6">
            <p className="m-0 text-sm leading-6 text-ink-2">{selectedDate > todayISO() ? '還沒到這一天。' : ctx.entries.length ? '這天沒有紀錄。' : '日記還是空的。記下今天穿了什麼，之後就能回頭找好穿的那套。'}</p>
            {selectedDate <= todayISO() && <Button variant="primary" onClick={() => ctx.onNew(selectedDate)}><Icon name="plus" />記這一天</Button>}
          </div>
        )}
      </aside>

      {/* 單日：手機卡片 */}
      <div className="md:hidden">
        {current ? (
          <MobileDayCard entry={current} ctx={ctx} />
        ) : (
          <div className="flex items-center gap-3 rounded-[16px] border-[1.5px] border-dashed border-line-strong p-4">
            <span className="flex-1 text-[13px] text-ink-2">{formatDiaryDate(selectedDate)}{selectedDate > todayISO() ? '還沒到' : '沒有紀錄'}</span>
            {selectedDate <= todayISO() && <Button variant="secondary" onClick={() => ctx.onNew(selectedDate)}>記這一天</Button>}
          </div>
        )}
      </div>
    </div>
  )
}

/** 桌面側欄：完整單日紀錄 */
function EntryDetail({ entry, ctx }: { entry: DiaryEntry; ctx: Ctx }) {
  const items = entryItems(entry, ctx.closetById)
  const blocked = unavailablePieces(entry, ctx.closet)
  return (
    <>
      <div className="rounded-card bg-apricot p-2.5">
        <OutfitBoard template="full" pieces={entryPieces(entry, ctx.closetById)} compact className="h-[236px]" />
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="m-0 font-hd text-[21px]">{entry.name}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <OccasionChip occasions={entry.occasions} />
          <FeelChip feel={entry.feel} prefix />
          <span className="ml-auto"><RatingMarks value={entry.rating} /></span>
        </div>
        {entry.note && <p className="m-0 rounded-btn bg-paper px-3 py-2.5 text-[13px] leading-[1.75] text-ink">{entry.note}</p>}
        {entry.photoUrl && <img src={entry.photoUrl} alt={`${entry.name}的鏡子自拍`} className="max-h-60 w-full rounded-tile object-cover" />}
      </div>
      <ItemList items={items} />
      <div className="flex items-center gap-2 pt-1">
        <Button variant="oat" className="flex-1" onClick={() => ctx.onRewear(entry)}><Icon name="reset" />再穿一次</Button>
        <Button variant="secondary" onClick={() => ctx.onEdit(entry)} aria-label="編輯這筆紀錄">編輯</Button>
        <Button variant="ghost" className="w-11 px-0 text-rose-deep" aria-label="刪除這筆紀錄" onClick={() => ctx.onDelete(entry)}><Icon name="x" /></Button>
      </div>
      <span className="text-[11px] leading-[1.6] text-ink-2">
        {blocked.length ? `${blocked.join('、')}，再穿時那格會先空著，讓你換一件。` : `「再穿一次」會把這 ${items.length} 件帶回今日搭配。`}
      </span>
    </>
  )
}

function ItemList({ items, large = false }: { items: ClosetItem[]; large?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className={`pb-1 ${large ? 'pt-2.5 text-[13px] font-medium text-ink-2' : 'text-xs text-ink-2'}`}>這天穿的 {items.length} 件</span>
      {items.map((item) => (
        <Link key={item.id} to={`/closet/${item.id}`} className={`flex items-center gap-2.5 border-t-[1.5px] border-dashed border-line text-ink no-underline ${large ? 'min-h-[54px] text-sm' : 'min-h-[46px] text-[13px]'}`}>
          <span className={`flex flex-none items-center justify-center rounded-sm bg-tile ${large ? 'size-[38px]' : 'size-8'}`}>
            <ItemImage name="" cutoutUrl={item.cutoutUrl} shape={item.shape} colorHex={item.colorHex} className="size-[80%]" />
          </span>
          <span className="min-w-0 flex-1">{item.name}</span>
          <span className="font-num text-xs text-ink-2 tabular">穿過 {item.wearCount ?? 0} 次</span>
        </Link>
      ))}
    </div>
  )
}

/** 手機月曆下方的選取日卡片 */
function MobileDayCard({ entry, ctx }: { entry: DiaryEntry; ctx: Ctx }) {
  const pieces = entryPieces(entry, ctx.closetById)
  const tone = TONE_CLASS[occasionTone(entry.occasions[0])]
  const wx = weatherText(entry)
  return (
    <article aria-labelledby="sel-t" className="relative flex gap-3 rounded-[16px] bg-card p-3 shadow-paper">
      <span aria-hidden="true" className="absolute -top-[9px] left-1/2 -ml-[35px] h-[18px] w-[70px] rounded-[2px] bg-mist-wash mix-blend-multiply" style={{ rotate: '-3deg' }} />
      <Link to={`/diary/${entry.id}`} aria-label={`查看${formatDiaryDate(entry.date)}的完整紀錄`} className={`relative h-32 w-[104px] flex-none overflow-hidden rounded-tile ${tone.wash}`}>
        <MiniCollage pieces={pieces} className="absolute inset-1.5" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-[11px] text-ink-2">{formatDiaryDate(entry.date)}{wx ? `・${wx}` : ''}</span>
        <h3 id="sel-t" className="m-0 truncate font-hd text-lg">{entry.name}</h3>
        <div className="flex flex-wrap items-center gap-[5px]">
          <OccasionChip occasions={entry.occasions} withDot={false} />
          <FeelChip feel={entry.feel} />
          <span className="ml-auto"><RatingMarks value={entry.rating} size={10} /></span>
        </div>
        {entry.note && <p className="m-0 line-clamp-2 text-xs leading-[1.55] text-ink-2">{entry.note}</p>}
        <div className="mt-auto flex gap-1.5">
          <Button variant="oat" className="h-11 flex-1 px-2 text-[13px]" onClick={() => ctx.onRewear(entry)}><Icon name="reset" size={16} />再穿一次</Button>
          <ButtonLink to={`/diary/${entry.id}`} variant="secondary" className="h-11 px-3 text-[13px]">查看</ButtonLink>
        </div>
      </div>
    </article>
  )
}

/** 手機單日紀錄頁（/diary/:id） */
function MobileDay({ entry, ctx }: { entry: DiaryEntry; ctx: Ctx }) {
  const [menu, setMenu] = useState(false)
  const items = entryItems(entry, ctx.closetById)
  const blocked = unavailablePieces(entry, ctx.closet)
  const sameDay = ctx.entries.filter((e) => e.date === entry.date && e.id !== entry.id)
  const wx = weatherText(entry)
  return (
    <main className="md:hidden">
      <header className="flex items-center gap-1 border-b-[1.5px] border-dashed border-line-strong py-2 pr-2 pl-1">
        <Link to={`/diary?month=${monthKey(entry.date)}&date=${entry.date}`} aria-label="返回穿搭日記" className="flex size-11 items-center justify-center text-ink">
          <Icon name="back" />
        </Link>
        <span className="font-hd text-[19px]">{formatDiaryDate(entry.date)}</span>
        {wx && <span className="ml-auto inline-flex h-[26px] items-center rounded-full bg-mist-soft px-2.5 text-xs text-mist-ink">{wx}</span>}
        <div className={`relative ${wx ? '' : 'ml-auto'}`}>
          <button type="button" aria-label="更多：編輯、刪除" aria-expanded={menu} onClick={() => setMenu((m) => !m)} className="flex size-11 items-center justify-center rounded-btn bg-transparent text-ink">
            <Icon name="more" />
          </button>
          {menu && (
            <div role="menu" className="absolute top-12 right-0 z-30 flex w-40 flex-col rounded-tile bg-card p-1.5 shadow-float">
              <button type="button" role="menuitem" onClick={() => ctx.onEdit(entry)} className="min-h-11 rounded-sm bg-transparent px-3 text-left text-sm text-ink hover:bg-tile">編輯紀錄</button>
              <button type="button" role="menuitem" onClick={() => { setMenu(false); ctx.onDelete(entry) }} className="min-h-11 rounded-sm bg-transparent px-3 text-left text-sm text-rose-deep hover:bg-rose-soft">刪除紀錄</button>
            </div>
          )}
        </div>
      </header>
      <div className="flex flex-col gap-3.5 px-4 pt-4 pb-44">
        <div className="relative rounded-[16px] bg-apricot p-2.5">
          <span aria-hidden="true" className="absolute -top-2 left-1/2 z-[1] -ml-[38px] h-[18px] w-[76px] rounded-[2px] bg-mist-wash mix-blend-multiply" style={{ rotate: '-3deg' }} />
          <OutfitBoard template="full" pieces={entryPieces(entry, ctx.closetById)} compact className="h-[300px]" />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="m-0 font-hd text-2xl">{entry.name}</h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <OccasionChip occasions={entry.occasions} />
            <FeelChip feel={entry.feel} prefix />
            <span className="ml-auto"><RatingMarks value={entry.rating} /></span>
          </div>
          {entry.note && <p className="m-0 rounded-tile bg-card px-3.5 py-3 text-sm leading-[1.75]">{entry.note}</p>}
          {entry.photoUrl && <img src={entry.photoUrl} alt={`${entry.name}的鏡子自拍`} className="w-full rounded-tile object-cover" />}
        </div>
        <section className="rounded-card bg-card px-3.5 py-1 shadow-paper">
          <ItemList items={items} large />
        </section>
        <section aria-label="同一天的其他紀錄" className="flex flex-col gap-1 rounded-card border-[1.5px] border-dashed border-line-strong px-3.5 py-3">
          {sameDay.map((e) => (
            <Link key={e.id} to={`/diary/${e.id}`} className="flex min-h-11 items-center text-[13px] font-medium">{e.name}<Icon name="next" size={16} /></Link>
          ))}
          <div className="flex items-center gap-2.5">
            <span className="text-[13px] text-ink-2">{sameDay.length ? `這天還有 ${sameDay.length} 筆` : '這天只有這一筆'}</span>
            <button type="button" onClick={() => ctx.onNew(entry.date)} className="ml-auto inline-flex min-h-11 items-center gap-1 bg-transparent text-[13px] font-medium text-mist-deep">
              <Icon name="plus" size={16} />同一天再記一筆
            </button>
          </div>
        </section>
      </div>
      <footer className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-20 flex flex-col gap-2 border-t-[1.5px] border-dashed border-line-strong bg-paper px-4 py-3">
        {blocked.length > 0 && (
          <div role="note" className="flex items-center gap-2 rounded-btn bg-rose-soft px-3 py-2 text-xs text-rose-ink">
            <Icon name="alert" size={16} />
            {blocked.join('、')}，再穿時那格會先空著，讓你換一件。
          </div>
        )}
        <Button variant="oat" size="lg" onClick={() => ctx.onRewear(entry)}><Icon name="reset" />再穿一次</Button>
      </footer>
    </main>
  )
}

// ---------- 列表與篩選 ----------

type FeelFilter = 'comfy' | 'uncomfy' | null

function ListView({ ctx }: { ctx: Ctx }) {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [occ, setOcc] = useState<string | null>(null)
  const [high, setHigh] = useState(false)
  const [feel, setFeel] = useState<FeelFilter>(null)
  const [sort, setSort] = useState<'new' | 'old'>('new')
  const itemFilter = params.get('item')
  const filterItem = itemFilter ? ctx.closetById.get(itemFilter) : undefined

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase()
    const list = ctx.entries.filter((e) => {
      if (occ && !e.occasions.includes(occ)) return false
      if (high && (e.rating ?? 0) < 4) return false
      if (feel && e.feel !== feel) return false
      if (itemFilter && !closetIdsOf(e).includes(itemFilter)) return false
      if (kw) {
        const names = closetIdsOf(e).map((id) => ctx.closetById.get(id)?.name ?? '').join(' ')
        if (!`${e.name} ${e.note} ${names}`.toLowerCase().includes(kw)) return false
      }
      return true
    })
    return sort === 'new' ? list : [...list].reverse()
  }, [ctx.entries, ctx.closetById, q, occ, high, feel, itemFilter, sort])

  const months = useMemo(() => {
    const groups: { key: string; items: DiaryEntry[] }[] = []
    for (const e of filtered) {
      const k = monthKey(e.date)
      const g = groups[groups.length - 1]
      if (g?.key === k) g.items.push(e)
      else groups.push({ key: k, items: [e] })
    }
    return groups
  }, [filtered])

  const anyFilter = !!(q.trim() || occ || high || feel || itemFilter)
  const clearAll = () => {
    setQ('')
    setOcc(null)
    setHigh(false)
    setFeel(null)
    if (itemFilter) {
      const p = new URLSearchParams(params)
      p.delete('item')
      setParams(p, { replace: true })
    }
  }

  if (ctx.entries.length === 0) {
    return <PageState icon="diary" tone="mist" title="日記還是空的" description="記下今天穿了什麼、穿起來感覺如何。好穿的那套，下次一鍵就能再穿。" action={<Button variant="primary" onClick={() => ctx.onNew()}><Icon name="plus" />記第一筆</Button>} />
  }

  const fchip = (on: boolean) =>
    `inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-3 text-[13px] font-medium md:h-9 ${on ? 'border-ink bg-ink text-paper' : 'border-line bg-card text-ink hover:border-line-strong'}`

  return (
    <>
      <section aria-label="篩選" className="flex flex-col gap-3 rounded-[16px] bg-card px-4 py-3.5 shadow-paper">
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex h-11 min-w-0 flex-[1_1_280px] items-center gap-2 rounded-tile border-[1.5px] border-line-strong bg-paper px-3.5 text-ink-2">
            <Icon name="search" size={18} />
            <span className="sr-only">搜尋</span>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋穿搭名稱、備註或單品" className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm text-ink" />
          </label>
          {filterItem && (
            <span className={`${fchip(false)} border-mist-deep`}>
              包含單品：{filterItem.name}
              <button
                type="button"
                aria-label="移除這個篩選"
                onClick={() => {
                  const p = new URLSearchParams(params)
                  p.delete('item')
                  setParams(p, { replace: true })
                }}
                className="-mr-1 flex size-8 items-center justify-center rounded-full bg-transparent text-rose-deep"
              >
                <Icon name="x" size={14} />
              </button>
            </span>
          )}
          <label className="ml-auto flex items-center gap-2 text-[13px] text-ink-2">
            排序
            <select value={sort} onChange={(e) => setSort(e.target.value as 'new' | 'old')} className="h-11 rounded-btn border-[1.5px] border-line-strong bg-card px-3 text-[13px] text-ink md:h-10">
              <option value="new">新到舊</option>
              <option value="old">舊到新</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-11 text-xs text-ink-3">場合</span>
          <button type="button" aria-pressed={!occ} onClick={() => setOcc(null)} className={fchip(!occ)}>全部</button>
          {OCCASIONS.map((o) => (
            <button key={o.label} type="button" aria-pressed={occ === o.label} onClick={() => setOcc(occ === o.label ? null : o.label)} className={fchip(occ === o.label)}>
              <span aria-hidden="true" className={`size-2.5 rounded-[3px] ${TONE_CLASS[o.tone].dot}`} />
              {o.label}
            </button>
          ))}
          <span aria-hidden="true" className="mx-1.5 hidden h-6 w-[1.5px] bg-line md:block" />
          <span className="text-xs text-ink-3">評分</span>
          <button type="button" aria-pressed={high} onClick={() => setHigh(!high)} className={fchip(high)}>4 分以上</button>
          <span className="ml-1.5 text-xs text-ink-3">穿起來</span>
          <button type="button" aria-pressed={feel === 'comfy'} onClick={() => setFeel(feel === 'comfy' ? null : 'comfy')} className={fchip(feel === 'comfy')}>{FEEL_LABEL.comfy}</button>
          <button type="button" aria-pressed={feel === 'uncomfy'} onClick={() => setFeel(feel === 'uncomfy' ? null : 'uncomfy')} className={fchip(feel === 'uncomfy')}>{FEEL_LABEL.uncomfy}</button>
        </div>
      </section>

      <div role="status" className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
        找到 <b className="font-num text-ink tabular">{filtered.length}</b> 筆{filterItem ? `含「${filterItem.name}」的` : ''}紀錄
        {anyFilter && <button type="button" onClick={clearAll} className="min-h-8 bg-transparent text-[13px] font-medium text-mist-deep underline">清除篩選</button>}
      </div>

      {filtered.length === 0 ? (
        <section className="flex flex-wrap items-center gap-5 rounded-[16px] border-[1.5px] border-dashed border-line-strong p-6 md:p-7">
          <span aria-hidden="true" className="relative h-20 w-24 flex-none">
            <span className="absolute top-2.5 left-0 size-[60px] rounded-[14px] bg-mist-wash mix-blend-multiply" style={{ rotate: '-8deg' }} />
            <span className="absolute top-0 left-[30px] size-[60px] rounded-[14px] bg-oat-wash mix-blend-multiply" style={{ rotate: '6deg' }} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <h2 className="m-0 font-hd text-[19px]">沒有符合的紀錄</h2>
            <span className="text-[13px] text-ink-2">試著放寬條件，例如拿掉「4 分以上」，或換一個場合。</span>
          </div>
          <Button variant="secondary" onClick={clearAll}>清除篩選</Button>
        </section>
      ) : (
        months.map((m) => {
          const ym = parseMonthKey(m.key)!
          return (
            <section key={m.key} aria-label={`${ym.year} 年 ${ym.month + 1} 月`} className="flex flex-col gap-3.5">
              <h2 className="m-0 mt-1.5 flex items-baseline gap-2.5">
                <span className="font-hd text-[22px]">{ym.year} 年 {ym.month + 1} 月</span>
                <span className="font-num text-xs text-ink-3 tabular">{m.items.length} 筆</span>
              </h2>
              <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {m.items.map((e) => <ListCard key={e.id} entry={e} ctx={ctx} />)}
              </div>
            </section>
          )
        })
      )}
    </>
  )
}

function ListCard({ entry, ctx }: { entry: DiaryEntry; ctx: Ctx }) {
  const tone = TONE_CLASS[occasionTone(entry.occasions[0])]
  return (
    <article className="flex flex-col gap-2.5 rounded-[16px] bg-card p-3 shadow-paper">
      <Link to={`/diary/${entry.id}?month=${monthKey(entry.date)}&date=${entry.date}`} aria-label={`${shortDate(entry.date)} ${entry.name}`} className={`block rounded-tile p-2 ${tone.wash}`}>
        <OutfitBoard template="full" pieces={entryPieces(entry, ctx.closetById)} compact className="h-[168px]" />
      </Link>
      <div className="flex items-baseline gap-2">
        <h3 className="m-0 min-w-0 flex-1 truncate font-hd text-lg">{entry.name}</h3>
        <span className="font-num text-xs whitespace-nowrap text-ink-2 tabular">{shortDate(entry.date)}（{weekdayOf(entry.date)}）</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <OccasionChip occasions={entry.occasions} />
        <FeelChip feel={entry.feel} />
        <span className="ml-auto"><RatingMarks value={entry.rating} size={11} /></span>
      </div>
      <p className="m-0 line-clamp-2 min-h-10 text-xs leading-[1.65] text-ink-2">{entry.note || '沒有備註'}</p>
      <Button variant="oat" className="h-11 bg-oat-soft text-[13px] md:h-10" onClick={() => ctx.onRewear(entry)}><Icon name="reset" size={16} />再穿一次</Button>
    </article>
  )
}
