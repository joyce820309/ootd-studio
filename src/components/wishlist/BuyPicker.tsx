import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { buyColorOptions, buyDraftLines, buyQty, buyTotal, sameBuyLines } from '@/lib/basket'
import { formatNT } from '@/lib/wishlist'
import type { BuyLine, WishlistItem } from '@/types'
import './BuyPicker.css'

/**
 * 購買明細選擇器 BuyPicker（B28：design/general/B-BuyPicker.dc.html）
 *
 * 共通規則：
 * 1. 選顏色＝點色塊，可複選；預設勾「最想要」那色。商品沒有顏色時只有「不指定顏色」。
 * 2. 每個勾選的顏色一行：件數 − ＋（最少 1）、單價（預設原價，點虛線數字才變輸入框）。
 * 3. 草稿制：編輯中的內容只在元件裡；按「放進採購籃／確定」才寫入。取消、關閉、Esc 一律放棄。
 * 4. 放進去之後收成摘要（BuySummary）；「移出」是獨立的按鈕。
 *
 * 長相依頁面：panel＝完整頁面彈出面板（色塊三欄）；sheet＝手機 Bottom Sheet（兩欄、按鈕 48px）；
 * strip＝預覽抽屜底部展開（小膠囊一排）；mini＝比較欄、採購籃列的小編輯區。
 */

export type BuyPickerVariant = 'panel' | 'sheet' | 'strip' | 'mini'

interface BuyPickerEditorProps {
  item: WishlistItem
  variant: BuyPickerVariant
  saving?: boolean
  onCancel: () => void
  onConfirm: (lines: BuyLine[]) => void
  /** 草稿和原本不同時通知（比較欄切換前要問「要放棄修改嗎？」） */
  onDirtyChange?: (dirty: boolean) => void
  /** 標題 id（panel／sheet 由外層 dialog 引用） */
  titleId?: string
}

export function BuyPickerEditor({ item, variant, saving = false, onCancel, onConfirm, onDirtyChange, titleId }: BuyPickerEditorProps) {
  const options = buyColorOptions(item)
  const [initial] = useState(() => buyDraftLines(item))
  const [lines, setLines] = useState<BuyLine[]>(initial)
  const inBasket = item.status === 'ready'
  const dirty = !inBasket || !sameBuyLines(lines, initial)

  useEffect(() => { onDirtyChange?.(!sameBuyLines(lines, initial)) }, [lines, initial, onDirtyChange])

  const selected = (name: string) => lines.some((line) => line.colorName === name)
  const toggle = (option: (typeof options)[number]) => setLines((current) => {
    if (current.some((line) => line.colorName === option.name)) return current.filter((line) => line.colorName !== option.name)
    const next = [...current, { colorName: option.name, hex: option.hex, qty: 1, unitPrice: item.price }]
    // 照商品的顏色順序排
    return next.sort((a, b) => options.findIndex((entry) => entry.name === a.colorName) - options.findIndex((entry) => entry.name === b.colorName))
  })
  const update = (name: string, patch: Partial<BuyLine>) => setLines((current) => current.map((line) => (line.colorName === name ? { ...line, ...patch } : line)))

  const big = variant === 'panel' || variant === 'sheet'
  const confirmLabel = inBasket ? '確定' : big ? '放進採購籃' : '確定'
  const qty = buyQty(lines)
  const total = buyTotal(lines)
  const canConfirm = lines.length > 0 && !saving && dirty

  const colorPicker = big ? (
    <div role="group" aria-label="要買哪幾色" className={`grid gap-2.5 ${variant === 'panel' ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {options.map((option) => (
        <button key={option.name} type="button" aria-pressed={selected(option.name)} onClick={() => toggle(option)} className="buy-picker__tile">
          <span aria-hidden="true" className="buy-picker__swatch" style={{ background: option.hex }} />
          <span>{option.name}{option.favorite && options.length > 1 ? ' ★' : ''}</span>
        </button>
      ))}
    </div>
  ) : (
    <div role="group" aria-label="要買哪幾色" className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button key={option.name} type="button" aria-pressed={selected(option.name)} onClick={() => toggle(option)} className="buy-picker__pill">
          <span aria-hidden="true" className="buy-picker__swatch" style={{ background: option.hex }} />
          {option.name}
        </button>
      ))}
    </div>
  )

  const lineRows = lines.length > 0 && (
    <div>
      {lines.map((line) => (
        <div key={line.colorName} className="buy-picker__line">
          <span className="buy-picker__name"><span aria-hidden="true" className="buy-picker__dot" style={{ background: line.hex ?? item.colorHex }} /><span>{line.colorName}</span></span>
          <span className="buy-picker__stepper" role="group" aria-label={`${line.colorName}件數`}>
            <button type="button" disabled={line.qty <= 1} onClick={() => update(line.colorName, { qty: line.qty - 1 })} aria-label={`${line.colorName}減一件`}>−</button>
            <span aria-live="polite">{line.qty}</span>
            <button type="button" onClick={() => update(line.colorName, { qty: line.qty + 1 })} aria-label={`${line.colorName}加一件`}>＋</button>
          </span>
          <PriceField label={line.colorName} value={line.unitPrice} short={variant === 'mini'} onCommit={(unitPrice) => update(line.colorName, { unitPrice })} />
        </div>
      ))}
    </div>
  )
  const empty = lines.length === 0 && <span className="text-xs text-ink-2">至少選一個顏色</span>

  const cancel = <Button variant={variant === 'sheet' ? 'secondary' : 'ghost'} disabled={saving} onClick={onCancel} className={variant === 'sheet' ? 'h-12 flex-1' : variant === 'mini' ? 'h-9 flex-1 px-0' : 'h-10'}>取消</Button>
  const confirm = <Button variant="oat" disabled={!canConfirm} onClick={() => onConfirm(lines)} className={variant === 'sheet' ? 'h-12 flex-[2]' : variant === 'mini' ? 'h-9 flex-1 px-0' : 'h-10'}>{saving ? '儲存中…' : confirmLabel}</Button>
  const totalText = <><b className="font-num tabular">{qty}</b> 件</>

  return (
    <div
      className={`buy-picker is-${variant} flex flex-col ${big ? 'gap-3' : 'gap-2.5'}`}
      onKeyDown={(event) => { if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); onCancel() } }}
    >
      {big && <>
        <div className="flex items-baseline gap-2">
          <h3 id={titleId} className="m-0 font-hd text-[21px] font-normal">{inBasket ? '調整採購籃' : '放進採購籃'}</h3>
          {variant === 'panel' && <span className="min-w-0 truncate text-xs text-ink-2">{item.name}・{formatNT(item.price)}</span>}
        </div>
        <span className="-mb-0.5 text-[12.5px] text-ink-2">要買哪幾色？（可以複選）</span>
      </>}
      {variant === 'strip' && <div className="flex items-center"><b id={titleId} className="text-[15px]">{inBasket ? '調整採購籃' : '放進採購籃'}</b><button type="button" onClick={onCancel} aria-label="收起，不變更" className="ml-auto flex size-11 items-center justify-center rounded-btn text-ink-2 hover:bg-tile"><Icon name="down" /></button></div>}
      {colorPicker}
      {lineRows}
      {empty}
      {big ? <>
        <div className="flex items-baseline border-t-2 border-ink pt-2"><span className="text-[13px]">共 {totalText}</span><b className={`ml-auto font-num tabular ${variant === 'sheet' ? 'text-[19px]' : 'text-xl'}`}>{formatNT(total)}</b></div>
        <div className={`flex gap-2 ${variant === 'panel' ? 'justify-end' : ''}`}>{cancel}{confirm}</div>
      </> : variant === 'strip' ? (
        <div className="flex items-center gap-2"><span className="text-[13px]">共 {totalText}・<b className="font-num tabular">{formatNT(total)}</b></span><span className="ml-auto flex gap-2">{cancel}{confirm}</span></div>
      ) : <>
        <span className="text-[12.5px]">{totalText}・<b className="font-num tabular">{formatNT(total)}</b></span>
        <div className="flex gap-1.5">{cancel}{confirm}</div>
      </>}
    </div>
  )
}

/** 單價：平常是虛線底線的數字，點了才變輸入框；Enter／離開欄位確定，Esc 還原 */
function PriceField({ label, value, short, onCommit }: { label: string; value: number; short: boolean; onCommit: (value: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])
  const commit = () => {
    const parsed = Number(draft.replace(/[,\s$]/g, ''))
    if (draft.trim() !== '' && Number.isFinite(parsed) && parsed >= 0) onCommit(Math.round(parsed))
    setEditing(false)
  }
  if (editing) {
    return (
      <span className="buy-picker__price-input">
        <span aria-hidden="true" className="text-[11px] text-ink-3">$</span>
        <input
          ref={inputRef}
          inputMode="numeric"
          aria-label={`${label}單價`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') { event.preventDefault(); commit() }
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setDraft(String(value)); setEditing(false) }
          }}
        />
      </span>
    )
  }
  return (
    <button type="button" className="buy-picker__price" aria-label={`${label}單價 ${value}，點了可以改`} onClick={() => { setDraft(String(value)); setEditing(true) }}>
      {short ? <>$<u>{value.toLocaleString('en-US')}</u></> : <>單價 <u>${value.toLocaleString('en-US')}</u></>}
    </button>
  )
}

/* ── 摘要 ─────────────────────────────────────────── */

const LineList = ({ lines, item }: { lines: BuyLine[]; item: WishlistItem }) => (
  <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
    {lines.map((line, index) => (
      <span key={line.colorName} className="inline-flex items-center gap-1.5">
        {index > 0 && <span aria-hidden="true">・</span>}
        <span aria-hidden="true" className="buy-picker__dot" style={{ background: line.hex ?? item.colorHex }} />
        {line.colorName} × <span className="font-num tabular">{line.qty}</span>
      </span>
    ))}
  </span>
)

/**
 * 放進採購籃後的摘要：顏色 × 件數、小計、「調整」「移出」。
 * bar＝完整頁面價格下方一行；strip＝預覽抽屜底部第一行；card＝比較欄收合的摘要卡。
 */
export function BuySummary({ item, lines, variant, disabled = false, onAdjust, onRemove }: { item: WishlistItem; lines: BuyLine[]; variant: 'bar' | 'strip' | 'card'; disabled?: boolean; onAdjust: () => void; onRemove: () => void }) {
  const total = formatNT(buyTotal(lines))
  const adjust = <button type="button" disabled={disabled} onClick={onAdjust} aria-label={`調整採購籃：${item.name}`} className="buy-summary__link">調整</button>
  const remove = <button type="button" disabled={disabled} onClick={onRemove} aria-label={`移出採購籃：${item.name}`} className="buy-summary__link is-remove">移出</button>
  if (variant === 'card') {
    return (
      <div className="buy-summary is-card" role="group" aria-label="在採購籃">
        <b className="text-[13px] text-status-ok-fg">✓ 在採購籃</b>
        <span className="flex items-start gap-1.5"><LineList lines={lines} item={item} /><b className="ml-auto font-num tabular">{total}</b></span>
        <span className="flex justify-between">{adjust}{remove}</span>
      </div>
    )
  }
  return (
    <div className="buy-summary" role="group" aria-label="在採購籃">
      {variant === 'bar'
        ? <><Icon name="wish" size={18} /><span className="flex min-w-0 flex-wrap items-center gap-1.5">採購籃裡：<LineList lines={lines} item={item} /></span></>
        : <><b className="text-status-ok-fg">✓ 準備購買</b><LineList lines={lines} item={item} /></>}
      <b className="ml-auto font-num tabular">{total}</b>
      <span className="flex">{adjust}{remove}</span>
    </div>
  )
}

/* ── 容器 ─────────────────────────────────────────── */

/** A：完整頁面，貼在狀態按鈕下面的彈出面板（寬 420）。點外面＝取消 */
export function BuyPickerPopover({ children, onCancel, labelledBy }: { children: ReactNode; onCancel: () => void; labelledBy: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"], button')?.focus()
    const onPointer = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) onCancel() }
    // 下一輪再掛：避免打開它的那一下點擊立刻被當成「點外面」
    const timer = window.setTimeout(() => document.addEventListener('pointerdown', onPointer))
    return () => { window.clearTimeout(timer); document.removeEventListener('pointerdown', onPointer) }
  }, [onCancel])
  return (
    <div ref={ref} role="dialog" aria-labelledby={labelledBy} className="absolute top-[42px] left-0 z-40 w-[min(420px,calc(100vw-2rem))] rounded-card bg-card p-[18px] shadow-float ring-[1.5px] ring-line">
      {children}
    </div>
  )
}

/** E：手機 Bottom Sheet。點背景、Esc＝取消 */
export function BuyPickerSheet({ children, onCancel, labelledBy }: { children: ReactNode; onCancel: () => void; labelledBy: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onCancel={(event) => { event.preventDefault(); onCancel() }}
      onClick={(event) => { if (event.target === event.currentTarget) onCancel() }}
      className="buy-picker__sheet hidden flex-col gap-2.5 open:flex"
    >
      <span aria-hidden="true" className="h-1 w-10 flex-none self-center rounded-sm bg-line-strong" />
      {children}
    </dialog>
  )
}
