import { useEffect, useId, useRef, useState } from 'react'
import { ItemImage } from '@/components/closet/ItemImage'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { DatePicker } from '@/components/ui/DatePicker'
import { Icon } from '@/components/ui/Icon'
import { BuyPickerEditor } from '@/components/wishlist/BuyPicker'
import { basketText, buyLinesText, targetProgress, type BasketRow, type BasketSummary } from '@/lib/basket'
import { todayISO } from '@/lib/date'
import { formatNT } from '@/lib/wishlist'
import type { BuyLine, WishlistItem } from '@/types'
import './ShoppingBasket.css'

interface ShoppingBasketProps {
  basket: BasketSummary
  target: number | null
  mobile: boolean
  saving: boolean
  onClose: () => void
  onTarget: (target: number | null) => void
  /** 列上的「調整」按確定後：寫入新的明細 */
  onAdjust: (item: WishlistItem, lines: BuyLine[]) => Promise<boolean>
  /** 列上的「移出」：狀態回考慮中，跳「已移出・復原」 */
  onRemove: (item: WishlistItem) => void
  onBought: (input: { purchaseDate: string; rows: BasketRow[] }) => void
  onCopied: (ok: boolean) => void
}

/**
 * 採購籃（B23.3／BM20.3）：所有「準備購買」依比較分組。桌機右側抽屜寬 470；手機 Bottom Sheet。
 * 每一列右邊「調整｜移出」；「調整」在那一列下方展開購買明細選擇器（B28 D，一次只展開一列），按確定才寫入。
 */
export function ShoppingBasket({ basket, target, mobile, saving, onClose, onTarget, onAdjust, onRemove, onBought, onCopied }: ShoppingBasketProps) {
  const panelRef = useRef<HTMLElement>(null)
  const [boughtOpen, setBoughtOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const progress = targetProgress(basket.total, target)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.focus({ preventScroll: true })
    return () => { if (previous && document.contains(previous)) previous.focus({ preventScroll: true }) }
  }, [])
  useEffect(() => {
    if (boughtOpen) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); onClose() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [boughtOpen, onClose])
  useEffect(() => {
    if (!mobile) return
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = overflow }
  }, [mobile])

  async function copy() {
    try {
      await navigator.clipboard.writeText(basketText(basket))
      onCopied(true)
    } catch {
      onCopied(false)
    }
  }

  return <>
    <div aria-hidden="true" onClick={onClose} className={`shopping-basket__scrim ${mobile ? 'is-mobile' : ''}`} />
    <aside ref={panelRef} tabIndex={-1} role="dialog" aria-modal={mobile || undefined} aria-labelledby="shopping-basket-title" className={`shopping-basket ${mobile ? 'is-mobile' : ''}`}>
      {mobile && <span aria-hidden="true" className="shopping-basket__grip" />}
      <div className="shopping-basket__head">
        <h2 id="shopping-basket-title" className="m-0 whitespace-nowrap font-hd text-[21px] md:text-2xl">採購籃</h2>
        <span className="min-w-0 truncate text-xs text-ink-2">所有「準備購買」・依比較分組</span>
        <button type="button" onClick={onClose} aria-label="關閉採購籃" className="shopping-basket__icon-btn ml-auto"><Icon name="x" size={20} /></button>
      </div>
      <TargetField target={target} onTarget={onTarget} />

      <div className="shopping-basket__body">
        {basket.groups.map((group) => <section key={group.id} aria-label={group.name} className="flex flex-col">
          <h3 className="mt-3 mb-0.5 flex items-baseline gap-2 text-[13px] font-normal"><span className="font-hd text-[17px]">{group.name}</span><span className="text-ink-2">{group.id === 'other' ? '' : '比較・'}{group.qty} 件</span></h3>
          {group.rows.map((row) => {
            const editing = editingId === row.item.id
            return <div key={row.item.id} className="shopping-basket__row">
              <span className="shopping-basket__thumb" style={{ backgroundColor: row.item.colorHex + '26' }}><ItemImage name={row.item.name} cutoutUrl={row.item.cutoutUrl} shape={row.item.shape} colorHex={row.item.colorHex} className="h-[80%] w-[72%]" /></span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[13px] font-medium" title={row.item.name}>{row.item.name}</span>
                {!editing && <span className="text-xs text-ink-2">{buyLinesText(row.lines)}</span>}
              </span>
              {editing ? <span className="text-xs text-ink-2">調整中</span> : <span className="flex flex-col items-end">
                <b className="font-num text-sm tabular">{formatNT(row.total)}</b>
                <span className="flex">
                  <button type="button" disabled={saving} onClick={() => setEditingId(row.item.id)} aria-label={`調整：${row.item.name}`} className="buy-summary__link min-h-8 px-1 text-xs">調整</button>
                  <button type="button" disabled={saving} onClick={() => onRemove(row.item)} aria-label={`移出：${row.item.name}`} className="buy-summary__link is-remove min-h-8 px-1 text-xs">移出</button>
                </span>
              </span>}
              {editing && <div className="shopping-basket__editor buy-picker__mini-box">
                <BuyPickerEditor item={row.item} variant="mini" saving={saving} onCancel={() => setEditingId(null)} onConfirm={(lines) => void onAdjust(row.item, lines).then((ok) => { if (ok) setEditingId(null) })} />
              </div>}
            </div>
          })}
        </section>)}
      </div>

      <div className="shopping-basket__foot">
        <div className="flex items-baseline"><span className="text-sm">共 <b className="font-num tabular">{basket.kinds}</b> 款・<b className="font-num tabular">{basket.qty}</b> 件</span><b className="ml-auto font-num text-[22px] tabular md:text-[26px]">{formatNT(basket.total)}</b></div>
        {progress && <div className="flex items-center gap-2 text-[13px] text-oat-ink">
          <span className="shopping-basket__track" role="progressbar" aria-label="目標進度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}><span style={{ width: `${progress.percent}%` }} /></span>{progress.text}
        </div>}
        <div className="flex gap-2">
          <Button variant="secondary" className={mobile ? 'h-12' : ''} onClick={() => void copy()}><Icon name="copy" size={16} />複製清單</Button>
          <Button variant="primary" className={mobile ? 'h-12 flex-1' : 'ml-auto'} disabled={saving} onClick={() => setBoughtOpen(true)}>買好了，移到已購買…</Button>
        </div>
      </div>
    </aside>
    {boughtOpen && <BasketBoughtDialog rows={basket.groups.flatMap((group) => group.rows)} saving={saving} onCancel={() => setBoughtOpen(false)} onConfirm={(input) => { setBoughtOpen(false); onBought(input) }} />}
  </>
}

/** 目標金額：選填，存在使用者設定；離開欄位或按 Enter 才存，清空＝不設目標 */
function TargetField({ target, onTarget }: { target: number | null; onTarget: (target: number | null) => void }) {
  const id = useId()
  const [draft, setDraft] = useState(target == null ? '' : String(target))
  const [synced, setSynced] = useState(target)
  if (synced !== target) {
    setSynced(target)
    setDraft(target == null ? '' : String(target))
  }
  const commit = () => {
    const cleaned = draft.replace(/[,\s$]/g, '').replace(/^NT/i, '')
    if (!cleaned) return target == null ? undefined : onTarget(null)
    const value = Number(cleaned)
    if (!Number.isFinite(value) || value < 0) return setDraft(target == null ? '' : String(target))
    if (Math.round(value) !== target) onTarget(Math.round(value))
  }
  return <div className="shopping-basket__target">
    <label htmlFor={id} className="text-[13px]">目標金額</label>
    <span className="shopping-basket__target-input"><span aria-hidden="true">NT$</span><input id={id} inputMode="numeric" placeholder="不設" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit() } }} aria-describedby={`${id}-hint`} className="font-num tabular" /></span>
    <span id={`${id}-hint`} className="text-xs text-ink-2">選填，只用來算「還差多少」</span>
  </div>
}

/** 買好了：勾選要移到已購買的商品；每件依明細建立衣物，帶入件數與單價 */
function BasketBoughtDialog({ rows, saving, onCancel, onConfirm }: { rows: BasketRow[]; saving: boolean; onCancel: () => void; onConfirm: (input: { purchaseDate: string; rows: BasketRow[] }) => void }) {
  const id = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [picked, setPicked] = useState<Set<string>>(() => new Set(rows.map((row) => row.item.id)))
  const [date, setDate] = useState<string | null>(todayISO())
  const chosen = rows.filter((row) => picked.has(row.item.id))
  const pieces = chosen.reduce((sum, row) => sum + row.qty, 0)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [])

  return <dialog ref={dialogRef} aria-labelledby={`${id}-title`} onClose={onCancel} className="fixed inset-x-0 top-auto bottom-0 z-50 m-0 hidden max-h-[88dvh] open:flex w-full max-w-none flex-col gap-4 overflow-y-auto rounded-t-block border-0 bg-card p-5 pb-[calc(20px+env(safe-area-inset-bottom))] text-ink shadow-sheet backdrop:bg-scrim sm:inset-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[min(520px,calc(100vw-32px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card sm:pb-5 sm:shadow-float">
    <header>
      <h2 id={`${id}-title`} className="m-0 font-hd text-2xl">買好了，移到已購買</h2>
      <p className="m-0 mt-1 text-xs leading-5 text-ink-2">每一件會依顏色 × 件數建立衣物，單價記為實付價格。沒勾的維持「準備購買」。</p>
    </header>
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-1 text-sm font-medium">要移哪幾件？</legend>
      <div className="max-h-64 overflow-y-auto overscroll-contain">
        {rows.map((row) => <div key={row.item.id} className="flex min-w-0 items-center gap-2 border-b border-dashed border-line py-1.5">
          <Checkbox checked={picked.has(row.item.id)} disabled={saving} label={`移到已購買：${row.item.name}`} onCheckedChange={(checked) => setPicked((current) => { const next = new Set(current); if (checked) next.add(row.item.id); else next.delete(row.item.id); return next })} />
          <span className="flex min-w-0 flex-1 flex-col"><span className="truncate text-sm">{row.item.name}</span><span className="text-xs text-ink-2">{buyLinesText(row.lines)}</span></span>
          <b className="font-num text-sm tabular">{formatNT(row.total)}</b>
        </div>)}
      </div>
    </fieldset>
    <DatePicker label="購買日期" value={date} onChange={setDate} max={todayISO()} required />
    <div className="flex justify-end gap-2 border-t border-dashed border-line-strong pt-3">
      <Button variant="secondary" disabled={saving} onClick={() => dialogRef.current?.close()}>取消</Button>
      <Button variant="sage" disabled={saving || !chosen.length || !date} aria-busy={saving} onClick={() => date && onConfirm({ purchaseDate: date, rows: chosen })}>{saving ? '移動中…' : `建立 ${pieces} 件衣物`}</Button>
    </div>
  </dialog>
}
