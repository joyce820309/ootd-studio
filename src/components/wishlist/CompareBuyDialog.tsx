import { useEffect, useId, useRef, useState, type PointerEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Icon } from '@/components/ui/Icon'
import { formatNT, totalPrice } from '@/lib/wishlist'
import type { WishlistItem } from '@/types'

interface CompareBuyDialogProps {
  item: WishlistItem
  others: WishlistItem[]
  groupName: string
  saving: boolean
  onCancel: () => void
  onConfirm: (input: { dropIds: string[]; archive: boolean }) => void
}

/** 確認「就買這件」：所選候選改為準備購買，其他勾選項改為已放棄。 */
export function CompareBuyDialog({ item, others, groupName, saving, onCancel, onConfirm }: CompareBuyDialogProps) {
  const id = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [dropIds, setDropIds] = useState<Set<string>>(() => new Set(others.map((other) => other.id)))
  const [archive, setArchive] = useState(true)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [])

  function confirm() {
    onConfirm({ dropIds: [...dropIds], archive })
  }

  function handleBackdrop(event: PointerEvent<HTMLDialogElement>) {
    const dialog = dialogRef.current
    if (!dialog || event.target !== dialog) return
    const rect = dialog.getBoundingClientRect()
    if (!saving && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) onCancel()
  }

  function closeDialog() {
    dialogRef.current?.close()
    onCancel()
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${id}-title`}
      onClose={onCancel}
      onPointerUp={handleBackdrop}
      className="compare-buy-dialog fixed inset-x-0 top-auto bottom-0 m-0 flex max-h-[88dvh] w-full max-w-none flex-col gap-4 overflow-y-auto rounded-t-block border-0 bg-card p-5 pb-[calc(20px+env(safe-area-inset-bottom))] text-ink shadow-sheet backdrop:bg-scrim sm:inset-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:max-h-[min(84dvh,720px)] sm:w-[min(520px,calc(100vw-32px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card sm:pb-5 sm:shadow-float"
    >
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-title`} className="m-0 font-hd text-2xl">就買這件？</h2>
          <p className="m-0 mt-1 text-xs text-ink-2">選中的商品會改為「準備購買」。</p>
        </div>
        <button type="button" onClick={closeDialog} disabled={saving} aria-label="關閉確認" className="flex size-11 flex-none items-center justify-center rounded-btn text-ink"><Icon name="x" /></button>
      </header>

      <div className="flex items-center gap-3 rounded-tile bg-paper p-3">
        <span aria-hidden="true" className="size-12 flex-none rounded-sm" style={{ backgroundColor: item.colorHex }} />
        <span className="min-w-0 flex-1"><b className="block line-clamp-2 text-sm">{item.name}</b><span className="mt-1 block text-xs text-ink-2">{item.size || '未填尺碼'}・{formatNT(totalPrice(item))} 含運</span></span>
        <span className="rounded-full bg-sage-soft px-2.5 py-1 text-[11px] font-medium text-sage-ink">準備購買</span>
      </div>

      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="mb-1 text-sm font-medium">其他幾件要改成「已放棄」嗎？</legend>
        {others.length ? <div className="max-h-44 overflow-y-auto overscroll-contain">
          {others.map((other) => <div key={other.id} className="flex min-w-0 items-center gap-2 border-b border-dashed border-line py-1.5">
            <Checkbox checked={dropIds.has(other.id)} disabled={saving} label={`將「${other.name}」改為已放棄`} onCheckedChange={(checked) => setDropIds((current) => { const next = new Set(current); if (checked) next.add(other.id); else next.delete(other.id); return next })} />
            <span className="min-w-0 flex-1 truncate text-sm">{other.name}</span>
            {(other.status === 'dropped' || other.status === 'ready') && <span className="shrink-0 text-[11px] text-ink-3">目前{other.status === 'dropped' ? '已放棄' : '準備購買'}</span>}
          </div>)}
        </div> : <p className="m-0 py-2 text-xs text-ink-2">這個比較沒有其他商品。</p>}
        <p className="m-0 mt-1 text-xs leading-5 text-ink-2">沒勾選的商品維持原狀；若它也在其他比較裡，關聯會保留，只會因狀態呈現淡化。</p>
      </fieldset>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1 text-sm font-medium">「{groupName}」這個比較</legend>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"><input type="radio" name={`${id}-archive`} checked={archive} onChange={() => setArchive(true)} className="size-4 accent-[var(--color-mist-deep)]" />封存（之後還能在「已封存」翻到）</label>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"><input type="radio" name={`${id}-archive`} checked={!archive} onChange={() => setArchive(false)} className="size-4 accent-[var(--color-mist-deep)]" />先留著</label>
      </fieldset>

      <div className="flex justify-end gap-2 border-t border-dashed border-line-strong pt-3">
        <Button type="button" variant="secondary" disabled={saving} onClick={closeDialog}>取消</Button>
        <Button type="button" variant="primary" disabled={saving} aria-busy={saving} onClick={confirm}>{saving ? '處理中…' : '決定買'}</Button>
      </div>
    </dialog>
  )
}
