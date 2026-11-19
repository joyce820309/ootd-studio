import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { addWishlistItemsToCompare, createCompareWithItems, fetchCompareGroupItems, fetchCompareGroups } from '@/lib/data'
import { garmentLengthName, garmentTypeOf } from '@/lib/wishlist'
import { SLOT_META } from '@/lib/slots'
import type { CompareGroup } from '@/types'

interface CompareSelectionDialogProps {
  selectedItems: { id: string; name: string; slot: keyof typeof SLOT_META; primaryPart?: keyof typeof SLOT_META; garmentType?: string; garmentLength?: 'short' | 'mid' | 'long' }[]
  onClose: () => void
  onToast: (message: string) => void
}

/** 選購清單選取模式的比較入口：新開比較或把多件加入既有比較，完成後直達比較頁。 */
export function CompareSelectionDialog({ selectedItems, onClose, onToast }: CompareSelectionDialogProps) {
  const id = useId()
  const navigate = useNavigate()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const completed = useRef(false)
  const [groups, setGroups] = useState<CompareGroup[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [membersByGroup, setMembersByGroup] = useState<Record<string, Set<string>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const name = useMemo(() => compareName(selectedItems), [selectedItems])

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    let alive = true
    Promise.all([fetchCompareGroups(), fetchCompareGroupItems()]).then(([allGroups, entries]) => {
      if (!alive) return
      setGroups(allGroups.filter((group) => !group.archivedAt))
      setCounts(entries.reduce<Record<string, number>>((result, entry) => { result[entry.groupId] = (result[entry.groupId] ?? 0) + 1; return result }, {}))
      setMembersByGroup(entries.reduce<Record<string, Set<string>>>((result, entry) => { (result[entry.groupId] ??= new Set()).add(entry.wishlistItemId); return result }, {}))
    }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : '比較清單載入失敗。')).finally(() => alive && setLoading(false))
    return () => { alive = false; if (dialog?.open) { completed.current = true; dialog.close() } }
  }, [])

  async function createNew() {
    if (!selectedItems.length) return
    setSaving(true)
    try {
      const { group, demo } = await createCompareWithItems(name, selectedItems.map((item) => item.id))
      onToast(`已建立「${name}」比較，加入 ${selectedItems.length} 件${demo ? '（示範模式）' : ''}。`)
      completed.current = true
      dialogRef.current?.close()
      navigate(`/wishlist/compare/${group.id}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '建立比較失敗，請稍後再試。')
    } finally { setSaving(false) }
  }

  async function addTo(group: CompareGroup) {
    setSaving(true)
    try {
      await addWishlistItemsToCompare(group.id, selectedItems.map((item) => item.id))
      onToast(`已將 ${selectedItems.length} 件加入「${group.name}」。`)
      completed.current = true
      dialogRef.current?.close()
      navigate(`/wishlist/compare/${group.id}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加入比較失敗，請稍後再試。')
    } finally { setSaving(false) }
  }

  function handleBackdrop(event: PointerEvent<HTMLDialogElement>) {
    const dialog = dialogRef.current
    if (!dialog || event.target !== dialog) return
    const bounds = dialog.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeDialog()
  }

  function closeDialog() {
    if (completed.current) return
    completed.current = true
    dialogRef.current?.close()
    onClose()
  }

  return <dialog ref={dialogRef} aria-labelledby={`${id}-title`} onClose={closeDialog} onPointerUp={handleBackdrop} className="compare-selection-dialog fixed inset-x-0 top-auto bottom-0 m-0 max-h-[84dvh] w-full max-w-none flex-col gap-3 overflow-y-auto rounded-t-block border-0 bg-card p-5 pb-[calc(20px+env(safe-area-inset-bottom))] text-ink shadow-sheet backdrop:bg-scrim sm:inset-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[min(460px,calc(100vw-32px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card sm:shadow-float">
    <header className="flex items-start gap-2"><div className="min-w-0 flex-1"><h2 id={`${id}-title`} className="m-0 font-hd text-2xl">比較 {selectedItems.length} 件商品</h2><p className="m-0 mt-1 text-xs text-ink-2">選擇建立新比較，或加入現有比較。</p></div><button type="button" onClick={closeDialog} aria-label="關閉比較選單" className="flex size-11 flex-none items-center justify-center rounded-btn"><Icon name="x" /></button></header>
    <Button type="button" variant="oat" disabled={!selectedItems.length || saving} onClick={() => void createNew()} className="w-full justify-between"><span className="inline-flex items-center gap-2"><Icon name="plus" size={18} />開新的比較</span><span className="text-xs opacity-80">{name}</span></Button>
    <div className="border-t border-dashed border-line-strong pt-2"><h3 className="m-0 mb-1 font-hd text-lg">加進現有的</h3>{loading ? <p className="m-0 py-4 text-sm text-ink-2">正在讀取比較…</p> : groups.length ? <div className="flex max-h-56 flex-col gap-1 overflow-y-auto overscroll-contain">{groups.map((group) => { const count = counts[group.id] ?? 0; const known = membersByGroup[group.id] ?? new Set<string>(); const added = selectedItems.filter((item) => !known.has(item.id)).length; return <button key={group.id} type="button" disabled={!selectedItems.length || saving} onClick={() => void addTo(group)} className="flex min-h-12 items-center gap-2 rounded-tile px-3 text-left hover:bg-paper disabled:opacity-50"><span className="min-w-0 flex-1 truncate text-sm font-medium">{group.name}</span><span className="font-num text-xs text-ink-2">{count} → {count + added} 件</span><Icon name="next" size={16} className="text-ink-3" /></button>})}</div> : <p className="m-0 py-3 text-sm text-ink-2">目前沒有未封存的比較。</p>}</div>
    {error && <p role="alert" className="m-0 text-xs text-rose-deep">{error}</p>}
    <div className="flex justify-end border-t border-dashed border-line-strong pt-2"><Button variant="ghost" onClick={closeDialog}>取消</Button></div>
  </dialog>
}

function compareName(items: CompareSelectionDialogProps['selectedItems']) {
  const counts = new Map<string, number>()
  for (const item of items) {
    const type = garmentTypeOf({ ...item, slot: item.primaryPart ?? item.slot })
    const label = type ? garmentLengthName(type.id, item.garmentLength) ?? type.label : SLOT_META[item.primaryPart ?? item.slot].label
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  const most = [...counts].sort((a, b) => b[1] - a[1])[0]
  const suffix = items.length ? `${items.length} 件` : ''
  return most ? `${most[0]} ${suffix}` : '新的比較'
}
