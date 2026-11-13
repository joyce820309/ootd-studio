import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  WEEKDAYS,
  addDays,
  addMonths,
  clampOutOfRange,
  formatLongDate,
  isSameDay,
  monthGrid,
  parseISODate,
  toISODate,
} from '@/lib/date'
import { Icon } from './Icon'
import { Tape } from './Paper'

/**
 * 手帳風日期選擇器（取代瀏覽器原生 <input type="date">）
 *
 * - 值一律是 'YYYY-MM-DD' 字串或 null，可直接存進 Supabase 的 date 欄位。
 * - 桌面（≥ 640px）：在欄位下方展開紙卡；手機：從底部滑出 bottom sheet。
 * - 鍵盤：方向鍵移動日期、PageUp/PageDown 換月（加 Shift 換年）、Home/End 到週首週尾、
 *   Enter/空白鍵選取、Esc 關閉並把焦點還給欄位。
 *
 * 用法：
 *   const [date, setDate] = useState<string | null>(todayISO())
 *   <DatePicker label="量測日期" value={date} onChange={setDate} max={todayISO()} required />
 */
export interface DatePickerProps {
  label: string
  value: string | null
  onChange: (value: string | null) => void
  /** 可選的最早日期 'YYYY-MM-DD' */
  min?: string
  /** 可選的最晚日期 'YYYY-MM-DD'（例如量測日期不可選未來：max={todayISO()}） */
  max?: string
  placeholder?: string
  hint?: ReactNode
  error?: ReactNode
  required?: boolean
  /** 顯示「清除」按鈕，讓欄位可以回到未填 */
  clearable?: boolean
  disabled?: boolean
  /** 給原生 <form> 送出用的隱藏欄位名稱 */
  name?: string
  id?: string
  className?: string
}

type View = 'days' | 'months'

/** 今天 00:00，和 min / max 比較時才不會因為時間差而判定超出範圍 */
const startOfToday = () => {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate())
}

function useMediaQuery(query: string) {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatch(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return match
}

export function DatePicker({
  label,
  value,
  onChange,
  min,
  max,
  placeholder = '選擇日期',
  hint,
  error,
  required,
  clearable,
  disabled,
  name,
  id: idProp,
  className = '',
}: DatePickerProps) {
  const autoId = useId()
  const id = idProp ?? `date-${autoId}`
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const titleId = `${id}-title`

  const selected = parseISODate(value)
  const minD = parseISODate(min)
  const maxD = parseISODate(max)
  // 每次開啟時更新，跨午夜也正確
  const [today, setToday] = useState(startOfToday)

  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('days')
  const [cursor, setCursor] = useState<Date>(() => selected ?? today)
  const [desktopPosition, setDesktopPosition] = useState({ left: 0, top: 0 })
  const isMobile = useMediaQuery('(max-width: 639px)')

  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  /** 只有開啟或用鍵盤操作時才把焦點移到日期格，避免點「下個月」時焦點被搶走 */
  const focusCursor = useRef(false)

  const isOut = (d: Date) => (!!minD && d < minD) || (!!maxD && d > maxD)

  const updateDesktopPosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const panelWidth = 328
    const estimatedPanelHeight = 480
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - panelWidth - 8))
    const below = rect.bottom + 8
    const top = below + estimatedPanelHeight <= window.innerHeight
      ? below
      : Math.max(14, rect.top - estimatedPanelHeight - 8)
    setDesktopPosition({ left, top })
  }

  const openPicker = () => {
    if (disabled) return
    if (!isMobile) updateDesktopPosition()
    const now = startOfToday()
    setToday(now)
    setCursor(clampOutOfRange(selected ?? now, minD, maxD))
    setView('days')
    focusCursor.current = true
    setOpen(true)
  }

  const close = (restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }

  const pick = (d: Date) => {
    if (isOut(d)) return
    onChange(toISODate(d))
    close()
  }

  // 桌面：點外面關閉
  useEffect(() => {
    if (!open || isMobile) return
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (!wrapRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open, isMobile])

  // 桌面面板以 Portal 脫離 overflow:hidden 容器；捲動或改變視窗尺寸時仍錨定欄位。
  useEffect(() => {
    if (!open || isMobile) return
    const reposition = () => updateDesktopPosition()
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open, isMobile])

  // 手機：開啟 sheet 時鎖住背景捲動
  useEffect(() => {
    if (!open || !isMobile) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open, isMobile])

  // 焦點跟著游標日期（或月份）走
  useEffect(() => {
    if (!open || !focusCursor.current) return
    focusCursor.current = false
    const selector = view === 'days' ? `[data-iso="${toISODate(cursor)}"]` : `[data-month="${cursor.getMonth()}"]`
    panelRef.current?.querySelector<HTMLButtonElement>(selector)?.focus()
  }, [open, view, cursor])

  const moveCursor = (next: Date) => {
    focusCursor.current = true
    setCursor(next)
  }

  const onGridKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, () => Date> = {
      ArrowLeft: () => addDays(cursor, -1),
      ArrowRight: () => addDays(cursor, 1),
      ArrowUp: () => addDays(cursor, -7),
      ArrowDown: () => addDays(cursor, 7),
      Home: () => addDays(cursor, -cursor.getDay()),
      End: () => addDays(cursor, 6 - cursor.getDay()),
      PageUp: () => addMonths(cursor, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(cursor, e.shiftKey ? 12 : 1),
    }
    const fn = keys[e.key]
    if (!fn) return
    e.preventDefault()
    moveCursor(fn())
  }

  const onMonthsKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const delta: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }
    const d = delta[e.key]
    if (d === undefined) return
    e.preventDefault()
    moveCursor(new Date(cursor.getFullYear(), cursor.getMonth() + d, 1))
  }

  const onPanelKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Escape') return
    e.stopPropagation()
    if (view === 'months') {
      focusCursor.current = true
      setView('days')
    } else {
      close()
    }
  }

  // ---------- 面板內容 ----------

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const step = view === 'days' ? 'month' : 'year'
  const shift = (n: number) => setCursor(view === 'days' ? addMonths(cursor, n) : addMonths(cursor, n * 12))

  const header = (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => shift(-1)}
        aria-label={step === 'month' ? '上個月' : '上一年'}
        className="flex size-11 items-center justify-center rounded-btn text-ink-2 hover:bg-tile"
      >
        <Icon name="back" />
      </button>
      <button
        type="button"
        onClick={() => {
          focusCursor.current = true
          setView(view === 'days' ? 'months' : 'days')
        }}
        aria-label={view === 'days' ? `${year} 年 ${month + 1} 月，切換成選月份` : `${year} 年，回到選日期`}
        className="mx-auto flex h-11 items-center gap-1.5 rounded-btn px-3 hover:bg-tile"
      >
        <span id={titleId} aria-live="polite" className="font-hd text-[20px] leading-none text-ink">
          {view === 'days' ? (
            <>
              <span className="font-num text-[19px] font-bold">{year}</span> 年 <span className="font-num text-[19px] font-bold">{month + 1}</span> 月
            </>
          ) : (
            <>
              <span className="font-num text-[19px] font-bold">{year}</span> 年
            </>
          )}
        </span>
        <Icon name="down" size={16} className={`text-ink-3 transition-transform ${view === 'months' ? 'rotate-180' : ''}`} />
      </button>
      <button
        type="button"
        onClick={() => shift(1)}
        aria-label={step === 'month' ? '下個月' : '下一年'}
        className="flex size-11 items-center justify-center rounded-btn text-ink-2 hover:bg-tile"
      >
        <Icon name="next" />
      </button>
    </div>
  )

  const days = monthGrid(year, month)
  const dayGrid = (
    <div role="grid" aria-labelledby={titleId} onKeyDown={onGridKeyDown} className="mt-2">
      <div role="row" className="grid grid-cols-7">
        {WEEKDAYS.map((w, i) => (
          <span
            key={w}
            role="columnheader"
            aria-label={`星期${w}`}
            className={`flex h-8 items-center justify-center text-xs font-medium ${i === 0 || i === 6 ? 'text-rose-deep' : 'text-ink-3'}`}
          >
            {w}
          </span>
        ))}
      </div>
      {Array.from({ length: 6 }, (_, row) => (
        <div role="row" key={row} className="grid grid-cols-7 gap-y-1">
          {days.slice(row * 7, row * 7 + 7).map((d) => {
            const iso = toISODate(d)
            const inMonth = d.getMonth() === month
            const isSel = isSameDay(d, selected)
            const isToday = isSameDay(d, today)
            const out = isOut(d)
            const tone = isSel
              ? 'bg-oat border-oat-edge text-ink font-bold shadow-sticker -rotate-3'
              : isToday
                ? 'border-dashed border-mist-deep text-mist-ink font-bold'
                : `border-transparent ${inMonth ? 'text-ink' : 'text-ink-3/70'} ${out ? '' : 'hover:bg-tile'}`
            return (
              <div role="gridcell" key={iso} aria-selected={isSel} className="flex justify-center">
                <button
                  type="button"
                  data-iso={iso}
                  tabIndex={isSameDay(d, cursor) ? 0 : -1}
                  aria-label={`${formatLongDate(d)}${isToday ? '，今天' : ''}`}
                  aria-disabled={out || undefined}
                  onClick={() => pick(d)}
                  className={`flex h-11 w-11 items-center justify-center rounded-sm border-[1.5px] font-num text-[15px] transition-colors sm:h-10 sm:w-10 ${tone} ${out ? 'cursor-not-allowed opacity-35' : ''}`}
                >
                  {d.getDate()}
                </button>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )

  const monthGridView = (
    <div role="group" aria-labelledby={titleId} onKeyDown={onMonthsKeyDown} className="mt-3 grid grid-cols-3 gap-2">
      {Array.from({ length: 12 }, (_, m) => {
        const start = new Date(year, m, 1)
        const end = new Date(year, m + 1, 0)
        const out = (!!minD && end < minD) || (!!maxD && start > maxD)
        const isSel = !!selected && selected.getFullYear() === year && selected.getMonth() === m
        const isNow = today.getFullYear() === year && today.getMonth() === m
        return (
          <button
            key={m}
            type="button"
            data-month={m}
            tabIndex={m === month ? 0 : -1}
            aria-pressed={isSel}
            aria-disabled={out || undefined}
            onClick={() => {
              if (out) return
              focusCursor.current = true
              setCursor(clampOutOfRange(addMonths(cursor, m - month), minD, maxD))
              setView('days')
            }}
            className={`h-12 rounded-tile border-[1.5px] text-[15px] transition-colors ${
              isSel
                ? 'border-oat-edge bg-oat font-bold text-ink shadow-sticker'
                : isNow
                  ? 'border-dashed border-mist-deep text-mist-ink'
                  : 'border-line bg-card text-ink hover:bg-tile'
            } ${out ? 'cursor-not-allowed opacity-35' : ''}`}
          >
            <span className="font-num">{m + 1}</span> 月
          </button>
        )
      })}
    </div>
  )

  const todayOut = isOut(today)
  const footer = (
    <div className="mt-3 flex items-center gap-2 border-t-[1.5px] border-dashed border-line-strong pt-3">
      <button
        type="button"
        onClick={() => pick(today)}
        disabled={todayOut}
        className="h-10 rounded-btn border-[1.5px] border-line-strong bg-card px-4 text-sm font-medium text-ink hover:border-ink-3 disabled:cursor-not-allowed disabled:opacity-50"
      >
        今天
      </button>
      {clearable && value && (
        <button
          type="button"
          onClick={() => {
            onChange(null)
            close()
          }}
          className="h-10 rounded-btn px-3 text-sm font-medium text-rose-deep hover:bg-rose-soft"
        >
          清除
        </button>
      )}
      <span className="ml-auto text-xs text-ink-3">
        {selected ? `已選 ${selected.getMonth() + 1}/${selected.getDate()}` : '尚未選擇'}
      </span>
    </div>
  )

  const body = (
    <>
      {header}
      {view === 'days' ? dayGrid : monthGridView}
      {footer}
    </>
  )

  const panel = isMobile ? (
    createPortal(
      <div className="fixed inset-0 z-50" onKeyDown={onPanelKeyDown}>
        <div aria-hidden="true" className="absolute inset-0 bg-scrim" onClick={() => close()} />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={`選擇${label}`}
          className="absolute inset-x-0 bottom-0 rounded-t-block bg-card px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-2 shadow-sheet"
        >
          <div className="flex justify-center pb-1" aria-hidden="true">
            <span className="h-1 w-10 rounded-full bg-line-strong" />
          </div>
          <div className="flex items-center pb-1">
            <h2 className="m-0 font-hd text-[20px] font-normal text-ink">{label}</h2>
            <button
              type="button"
              onClick={() => close()}
              aria-label="關閉"
              className="ml-auto flex size-11 items-center justify-center rounded-btn text-ink hover:bg-tile"
            >
              <Icon name="x" />
            </button>
          </div>
          {body}
        </div>
      </div>,
      document.body,
    )
  ) : createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`選擇${label}`}
      onKeyDown={onPanelKeyDown}
      style={{ left: desktopPosition.left, top: desktopPosition.top }}
      className="fixed z-50 w-[328px] overflow-visible rounded-card bg-card p-3 pt-4 shadow-float"
    >
      <Tape accent="mist" />
      <div className="max-h-[min(440px,calc(100dvh-48px))] overflow-y-auto">{body}</div>
    </div>,
    document.body,
  )

  const describedBy = [hint && !error ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined

  return (
    <div ref={wrapRef} className={`relative flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
        {required && <span className="ml-1 text-rose-deep">*</span>}
      </label>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onClick={() => (open ? close() : openPicker())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault()
            openPicker()
          }
        }}
        className={`flex h-[50px] w-full items-center gap-2.5 rounded-tile border-[1.5px] bg-card px-3.5 text-left text-[15px] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          error ? 'border-rose-deep' : open ? 'border-mist-deep' : 'border-line-strong hover:border-ink-3'
        }`}
      >
        <Icon name="calendar" className="text-ink-2" />
        <span className={`min-w-0 flex-1 truncate ${selected ? 'text-ink' : 'text-ink-3'}`}>
          {selected ? formatLongDate(selected) : placeholder}
        </span>
        <Icon name="down" size={18} className={`text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {name && <input type="hidden" name={name} value={value ?? ''} />}
      {hint && !error && (
        <p id={hintId} className="m-0 text-xs text-ink-2">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="m-0 text-xs text-rose-deep">
          {error}
        </p>
      )}
      {open && panel}
    </div>
  )
}
