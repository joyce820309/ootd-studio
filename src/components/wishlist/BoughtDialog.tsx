import { useId, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { DatePicker } from '@/components/ui/DatePicker'
import { todayISO } from '@/lib/date'
import { formatNT, totalPrice } from '@/lib/wishlist'
import type { WishlistItem } from '@/types'

/** 移至已購買：只需補購買日期與實付價格，其他資料自動帶進衣櫃。 */
export function BoughtDialog({
  item,
  saving,
  onCancel,
  onConfirm,
}: {
  item: WishlistItem
  saving: boolean
  onCancel: () => void
  onConfirm: (purchase: { purchaseDate: string; paidPrice: number | null; colorFamilies: string[] }) => void
}) {
  const uid = useId()
  const [date, setDate] = useState<string | null>(todayISO())
  const [paid, setPaid] = useState(String(totalPrice(item)))
  const colors = item.colors?.length ? item.colors : [{ family: item.colorName || '未標色', hex: item.colorHex }]
  const [selectedColors, setSelectedColors] = useState<string[]>(() => colors.map((color) => color.family))
  const [error, setError] = useState<{ date?: string; paid?: string }>({})

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = paid.replace(/[,\s]/g, '')
    const next: typeof error = {}
    if (!date) next.date = '請選擇購買日期。'
    if (trimmed && !/^\d+$/.test(trimmed)) next.paid = '實付價格請填整數。'
    if (!selectedColors.length) next.paid = '請至少選擇一個購買顏色。'
    setError(next)
    if (next.date || next.paid || !date) return
    onConfirm({ purchaseDate: date, paidPrice: trimmed ? Number(trimmed) : null, colorFamilies: selectedColors })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-scrim sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onCancel()
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        aria-describedby={`${uid}-desc`}
        noValidate
        onSubmit={submit}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !saving) onCancel()
        }}
        className="flex w-full flex-col gap-4 rounded-t-block bg-card p-5 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-sheet sm:max-w-md sm:rounded-block sm:pb-5 sm:shadow-float"
      >
        <div className="space-y-1.5">
          <h2 id={`${uid}-title`} className="m-0 font-hd text-xl">移至已購買</h2>
          <p id={`${uid}-desc`} className="m-0 text-sm leading-6 text-ink-2">
            「{item.name}」會依所選顏色建立衣物；圖片會依標記顏色帶入，未標記的圖片會附在每一色。
          </p>
        </div>
        {colors.length > 0 && <fieldset className="m-0 space-y-2 border-0 p-0">
          <legend className="mb-1 text-[13px] font-medium text-ink">這次買了哪些顏色？</legend>
          <div className="flex flex-wrap gap-2">{colors.map((color) => <label key={color.family} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-line bg-paper px-3 text-sm text-ink">
            <input type="checkbox" checked={selectedColors.includes(color.family)} onChange={(event) => setSelectedColors((current) => event.target.checked ? [...current, color.family] : current.filter((family) => family !== color.family))} className="size-4 accent-[var(--color-sage-deep)]" />
            <span aria-hidden="true" className="size-5 rounded-[5px] border border-ink/15" style={{ background: color.hex ?? item.colorHex }} />
            {color.family}
          </label>)}</div>
          {error.paid === '請至少選擇一個購買顏色。' && <p role="alert" className="m-0 text-xs text-rose-deep">{error.paid}</p>}
        </fieldset>}
        <DatePicker label="購買日期" value={date} onChange={setDate} max={todayISO()} required error={error.date} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-paid`} className="text-[13px] font-medium text-ink">每件實付價格</label>
          <input
            id={`${uid}-paid`}
            inputMode="numeric"
            value={paid}
            onChange={(e) => setPaid(e.target.value)}
            aria-invalid={!!error.paid}
            aria-describedby={`${uid}-paid-note`}
            className="h-11 w-full rounded-btn border-[1.5px] border-line bg-card px-3 font-num text-sm text-ink tabular aria-invalid:border-rose-deep"
          />
          <span id={`${uid}-paid-note`} className={`text-xs ${error.paid ? 'text-rose-deep' : 'text-ink-2'}`}>
            {error.paid === '請至少選擇一個購買顏色。' ? `預設為含運價格 ${formatNT(totalPrice(item))}，有折扣可以改。` : error.paid ?? `預設為含運價格 ${formatNT(totalPrice(item))}，多色會以每件金額記錄。`}
          </span>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={saving}>取消</Button>
          <Button type="submit" variant="sage" disabled={saving} aria-busy={saving}>{saving ? '移動中…' : selectedColors.length > 1 ? `建立 ${selectedColors.length} 件衣物` : '放進衣櫃'}</Button>
        </div>
      </form>
    </div>
  )
}
