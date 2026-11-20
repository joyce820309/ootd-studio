import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { buyColorOptions, buyDraftLines, buyLineKey, buyLineLabel, buyQty, buySizeOptions, buyTotal, defaultBuySize, sameBuyLines } from '@/lib/basket'
import { formatNT } from '@/lib/wishlist'
import type { BuyLine, WishlistItem } from '@/types'
import './BuyPicker.css'

/**
 * 購買明細選擇器 BuyPicker（B28：design/general/B-BuyPicker.dc.html）
 *
 * 共通規則：
 * 1. 選顏色＝點色塊，可複選；預設勾「最想要」那色。商品沒有顏色時只有「不指定顏色」。
 * 2. 每個勾選的顏色一行：尺碼、件數 − ＋（最少 1）、單價（預設原價，點虛線數字才變輸入框）。
 *    尺碼：寬版面一排小按鈕、窄版面（mini）小下拉、只有一個尺碼直接顯示文字；同色可「＋ 加一個尺碼」。
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
  /** 比較裡選的「比的尺碼」，當預設尺碼的第一順位 */
  preferredSize?: string
}

export function BuyPickerEditor({ item, variant, saving = false, onCancel, onConfirm, onDirtyChange, titleId, preferredSize }: BuyPickerEditorProps) {
  const options = buyColorOptions(item)
  const sizes = buySizeOptions(item)
  const sizeGroupName = useId()
  const [initial] = useState(() => buyDraftLines(item, preferredSize))
  const [lines, setLines] = useState<BuyLine[]>(initial)
  const inBasket = item.status === 'ready'
  const dirty = !inBasket || !sameBuyLines(lines, initial)

  useEffect(() => { onDirtyChange?.(!sameBuyLines(lines, initial)) }, [lines, initial, onDirtyChange])

  const colorOrder = (name: string) => options.findIndex((entry) => entry.name === name)
  const sortLines = (list: BuyLine[]) => [...list].sort((a, b) => colorOrder(a.colorName) - colorOrder(b.colorName) || sizes.indexOf(a.size ?? '') - sizes.indexOf(b.size ?? ''))
  const selected = (name: string) => lines.some((line) => line.colorName === name)
  const toggle = (option: (typeof options)[number]) => setLines((current) => current.some((line) => line.colorName === option.name)
    ? current.filter((line) => line.colorName !== option.name)
    : sortLines([...current, { colorName: option.name, hex: option.hex, size: defaultBuySize(item, preferredSize), qty: 1, unitPrice: item.price }]))
  const update = (key: string, patch: Partial<BuyLine>) => setLines((current) => current.map((line) => (buyLineKey(line) === key ? { ...line, ...patch } : line)))
  const usedSizes = (color: string) => lines.filter((line) => line.colorName === color).map((line) => line.size)
  const addSize = (line: BuyLine) => {
    const next = sizes.find((size) => !usedSizes(line.colorName).includes(size))
    if (next) setLines((current) => sortLines([...current, { ...line, size: next, qty: 1 }]))
  }
  const removeLine = (key: string) => setLines((current) => current.filter((line) => buyLineKey(line) !== key))

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

  const sizeControl = (line: BuyLine, groupName: string) => {
    if (!sizes.length) return null
    if (sizes.length === 1) return <span className="buy-picker__size-fixed" title={`這件只有 ${sizes[0]}`}>{sizes[0]}</span>
    const taken = usedSizes(line.colorName)
    if (variant === 'mini') {
      return (
        <select aria-label={`${line.colorName}尺碼`} value={line.size ?? ''} onChange={(event) => update(buyLineKey(line), { size: event.target.value })} className="buy-picker__size-select">
          {sizes.map((size) => <option key={size} value={size} disabled={size !== line.size && taken.includes(size)}>{size}</option>)}
        </select>
      )
    }
    return (
      <span role="radiogroup" aria-label={`${line.colorName}尺碼`} className="buy-picker__sizes">
        {sizes.map((size) => (
          <label key={size} className="buy-picker__size">
            <input type="radio" name={groupName} value={size} checked={line.size === size} disabled={size !== line.size && taken.includes(size)} onChange={() => update(buyLineKey(line), { size })} className="sr-only" />
            <span>{size}</span>
          </label>
        ))}
      </span>
    )
  }

  const lineRows = lines.length > 0 && (
    <div>
      {lines.map((line, index) => {
        const key = buyLineKey(line)
        const label = buyLineLabel(line)
        const sameColor = lines.filter((entry) => entry.colorName === line.colorName)
        const lastOfColor = lines[index + 1]?.colorName !== line.colorName
        const extra = sameColor.length > 1 && sameColor[0] !== line
        // 商品改過顏色後，舊明細裡的顏色不在色塊裡，點不掉，只能從這一行移除
        const orphan = !options.some((option) => option.name === line.colorName)
        // 同色的第幾行：換尺碼時不重建這一行，焦點留在原地
        const rowId = `${line.colorName}#${sameColor.indexOf(line)}`
        return (
          <Fragment key={rowId}>
            <div className="buy-picker__line">
              <span className="buy-picker__name">
                <span aria-hidden="true" className="buy-picker__dot" style={{ background: line.hex ?? item.colorHex }} />
                <span>{line.colorName}</span>
                {orphan && <span className="buy-picker__orphan">已不在顏色選項</span>}
                {(extra || orphan) && <button type="button" onClick={() => removeLine(key)} aria-label={`移除${label}`} className="buy-picker__remove"><Icon name="x" size={14} /></button>}
              </span>
              {sizeControl(line, `${sizeGroupName}-${rowId}`)}
              <span className="buy-picker__stepper" role="group" aria-label={`${label}件數`}>
                <button type="button" disabled={line.qty <= 1} onClick={() => update(key, { qty: line.qty - 1 })} aria-label={`${label}減一件`}>−</button>
                <span aria-live="polite">{line.qty}</span>
                <button type="button" onClick={() => update(key, { qty: line.qty + 1 })} aria-label={`${label}加一件`}>＋</button>
              </span>
              <PriceField label={label} value={line.unitPrice} short={variant === 'mini'} onCommit={(unitPrice) => update(key, { unitPrice })} />
            </div>
            {lastOfColor && !orphan && sizes.length > sameColor.length && <button type="button" onClick={() => addSize(line)} className="buy-picker__add-size">＋ {line.colorName}加一個尺碼</button>}
          </Fragment>
        )
      })}
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
      <span key={buyLineKey(line)} className="inline-flex items-center gap-1.5">
        {index > 0 && <span aria-hidden="true">・</span>}
        <span aria-hidden="true" className="buy-picker__dot" style={{ background: line.hex ?? item.colorHex }} />
        {buyLineLabel(line)} × <span className="font-num tabular">{line.qty}</span>
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
