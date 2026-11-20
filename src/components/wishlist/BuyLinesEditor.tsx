import { useEffect, useId, useRef, useState } from 'react'
import { buyColorOptions, buyQty, buyTotal } from '@/lib/basket'
import { formatNT } from '@/lib/wishlist'
import type { BuyLine, WishlistItem } from '@/types'
import './ShoppingBasket.css'

interface BuyLinesEditorProps {
  item: WishlistItem
  lines: BuyLine[]
  onChange: (lines: BuyLine[]) => void
  disabled?: boolean
  /** 採購籃裡的精簡版：不顯示標題與小計 */
  compact?: boolean
}

/**
 * 準備購買明細（B23.3）：每色一行，件數 stepper（最小 1）＋單價輸入；「＋ 加一色」只列這件還沒加的顏色。
 * 單價可直接填活動後的價格，平台不計算任何滿額規則。
 */
export function BuyLinesEditor({ item, lines, onChange, disabled = false, compact = false }: BuyLinesEditorProps) {
  const options = buyColorOptions(item)
  const remaining = options.filter((option) => !lines.some((line) => line.colorName === option.name))
  const update = (index: number, patch: Partial<BuyLine>) => onChange(lines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)))

  return <div className={`buy-lines ${compact ? 'is-compact' : ''}`}>
    {!compact && <span className="text-[11.5px] text-ink-2">顏色 × 件數 × 單價</span>}
    {lines.map((line, index) => <div key={line.colorName} className="buy-lines__row">
      <span className="buy-lines__color">
        <span aria-hidden="true" className="buy-lines__dot" style={{ backgroundColor: line.hex ?? item.colorHex }} />
        <span className="min-w-0 truncate">{line.colorName}</span>
        <button type="button" disabled={disabled || lines.length < 2} onClick={() => onChange(lines.filter((_, lineIndex) => lineIndex !== index))} aria-label={`移除顏色：${line.colorName}`} title={lines.length < 2 ? '至少留一個顏色；不買了請關掉「準備購買」' : '移除這個顏色'} className="buy-lines__remove">×</button>
      </span>
      <span className="buy-lines__controls">
        <span className="buy-lines__stepper" role="group" aria-label={`${line.colorName}件數`}>
          <button type="button" disabled={disabled || line.qty <= 1} onClick={() => update(index, { qty: line.qty - 1 })} aria-label={`${line.colorName}減一件`}>−</button>
          <span aria-live="polite" className="font-num tabular">{line.qty}</span>
          <button type="button" disabled={disabled} onClick={() => update(index, { qty: line.qty + 1 })} aria-label={`${line.colorName}加一件`}>＋</button>
        </span>
        <PriceInput label={`${line.colorName}單價`} value={line.unitPrice} disabled={disabled} onCommit={(unitPrice) => update(index, { unitPrice })} />
      </span>
    </div>)}
    {remaining.length > 0 && <AddColorMenu options={remaining} disabled={disabled} onPick={(option) => onChange([...lines, { colorName: option.name, hex: option.hex, qty: 1, unitPrice: lines[lines.length - 1]?.unitPrice ?? item.price }])} />}
    {!compact && <span className="flex justify-between text-[13px]"><span>小計 <b className="font-num tabular">{buyQty(lines)}</b> 件</span><b className="font-num tabular">{formatNT(buyTotal(lines))}</b></span>}
  </div>
}

/** 單價：輸入時只改草稿，離開或按 Enter 才存 */
function PriceInput({ label, value, disabled, onCommit }: { label: string; value: number; disabled: boolean; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value))
  // 外部的值改了（存檔、切換商品）就同步草稿
  const [synced, setSynced] = useState(value)
  if (synced !== value) {
    setSynced(value)
    setDraft(String(value))
  }
  const commit = () => {
    const parsed = Number(draft.replace(/[,\s$]/g, ''))
    if (!Number.isFinite(parsed) || parsed < 0 || draft.trim() === '') return setDraft(String(value))
    if (Math.round(parsed) !== value) onCommit(Math.round(parsed))
    else setDraft(String(value))
  }
  return <label className="buy-lines__price">
    <span aria-hidden="true">$</span>
    <span className="sr-only">{label}</span>
    <input inputMode="numeric" value={draft} disabled={disabled} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit() } }} className="font-num tabular" />
  </label>
}

function AddColorMenu({ options, disabled, onPick }: { options: { name: string; hex?: string }[]; disabled: boolean; onPick: (option: { name: string; hex?: string }) => void }) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  return <div ref={rootRef} className="relative self-start" onKeyDown={(event) => { if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false) } }}>
    <button type="button" disabled={disabled} aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((value) => !value)} className="buy-lines__add">＋ 加一色</button>
    {open && <div id={menuId} role="group" aria-label="選擇要加的顏色" className="buy-lines__menu">
      {options.map((option) => <button key={option.name} type="button" onClick={() => { setOpen(false); onPick(option) }}><span aria-hidden="true" className="buy-lines__dot" style={{ backgroundColor: option.hex }} />{option.name}</button>)}
    </div>}
  </div>
}
