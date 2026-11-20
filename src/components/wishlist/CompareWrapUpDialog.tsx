import { useEffect, useId, useRef, useState, type PointerEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Icon } from '@/components/ui/Icon'
import type { WishlistItem } from '@/types'

interface CompareWrapUpDialogProps {
  /** 這個比較裡沒開「準備購買」、也還沒買的商品 */
  others: WishlistItem[]
  readyCount: number
  groupName: string
  saving: boolean
  onCancel: () => void
  onConfirm: (input: { dropIds: string[]; archive: boolean }) => void
}

/** 收尾這個比較（B23.3）：沒開準備購買的商品預設勾選「改成已放棄」，再選比較要封存或先留著。 */
export function CompareWrapUpDialog({ others, readyCount, groupName, saving, onCancel, onConfirm }: CompareWrapUpDialogProps) {
  const id = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [dropIds, setDropIds] = useState<Set<string>>(() => new Set(others.filter((other) => other.status !== 'dropped').map((other) => other.id)))
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
      className="compare-buy-dialog fixed inset-x-0 top-auto bottom-0 m-0 hidden max-h-[88dvh] w-full max-w-none flex-col gap-4 overflow-y-auto rounded-t-block border-0 bg-card p-5 pb-[calc(20px+env(safe-area-inset-bottom))] text-ink shadow-sheet backdrop:bg-scrim sm:inset-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:max-h-[min(84dvh,720px)] sm:w-[min(520px,calc(100vw-32px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card sm:pb-5 sm:shadow-float"
    >
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-title`} className="m-0 font-hd text-2xl">收尾「{groupName}」</h2>
          <p className="m-0 mt-1 text-xs text-ink-2">{readyCount ? `已有 ${readyCount} 件準備購買，會留在採購籃。` : '這個比較還沒有準備購買的商品。'}</p>
        </div>
        <button type="button" onClick={closeDialog} disabled={saving} aria-label="關閉確認" className="flex size-11 flex-none items-center justify-center rounded-btn text-ink"><Icon name="x" /></button>
      </header>


      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="mb-1 text-sm font-medium">沒準備購買的，要改成「已放棄」嗎？</legend>
        {others.length ? <div className="max-h-44 overflow-y-auto overscroll-contain">
          {others.map((other) => <div key={other.id} className="flex min-w-0 items-center gap-2 border-b border-dashed border-line py-1.5">
            <Checkbox checked={dropIds.has(other.id)} disabled={saving} label={`將「${other.name}」改為已放棄`} onCheckedChange={(checked) => setDropIds((current) => { const next = new Set(current); if (checked) next.add(other.id); else next.delete(other.id); return next })} />
            <span className="min-w-0 flex-1 truncate text-sm">{other.name}</span>
            {other.status === 'dropped' && <span className="shrink-0 text-[11px] text-ink-3">目前已放棄</span>}
          </div>)}
        </div> : <p className="m-0 py-2 text-xs text-ink-2">每件都準備購買了，沒有要放棄的。</p>}
        <p className="m-0 mt-1 text-xs leading-5 text-ink-2">沒勾選的商品維持原狀；若它也在其他比較裡，關聯會保留，只會因狀態呈現淡化。</p>
      </fieldset>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1 text-sm font-medium">「{groupName}」這個比較</legend>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"><input type="radio" name={`${id}-archive`} checked={archive} onChange={() => setArchive(true)} className="size-4 accent-[var(--color-mist-deep)]" />封存（之後還能在「已封存」翻到）</label>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"><input type="radio" name={`${id}-archive`} checked={!archive} onChange={() => setArchive(false)} className="size-4 accent-[var(--color-mist-deep)]" />先留著</label>
      </fieldset>

      <div className="flex justify-end gap-2 border-t border-dashed border-line-strong pt-3">
        <Button type="button" variant="secondary" disabled={saving} onClick={closeDialog}>取消</Button>
        <Button type="button" variant="primary" disabled={saving} aria-busy={saving} onClick={confirm}>{saving ? '處理中…' : '完成'}</Button>
      </div>
    </dialog>
  )
}
