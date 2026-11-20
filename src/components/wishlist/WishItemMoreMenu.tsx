import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { isActiveWish } from '@/lib/wishlist'
import type { WishlistItem } from '@/types'

interface WishItemMoreMenuProps {
  item: WishlistItem
  disabled?: boolean
  /** 按鈕外觀：一般圖示鈕，或手機照片上浮著的圓鈕 */
  tone?: 'plain' | 'overlay'
  onDrop: () => void
  onReconsider: () => void
  onDelete: () => void
}

/** 選購商品的「⋯」：放棄購買（或重新考慮）、刪除。用在清單預覽面板與完整頁面（B7、B7.3、BM19.2）。 */
export function WishItemMoreMenu({ item, disabled = false, tone = 'plain', onDrop, onReconsider, onDelete }: WishItemMoreMenuProps) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const firstItemRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    firstItemRef.current?.focus()
    const onPointer = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) buttonRef.current?.focus()
  }
  const choose = (action: () => void) => {
    close(false)
    action()
  }

  const bought = item.status === 'bought'
  const label = bought ? '更多：刪除紀錄' : item.status === 'dropped' ? '更多：重新考慮、刪除' : '更多：放棄購買、刪除'
  const buttonClass = tone === 'overlay'
    ? 'flex size-11 items-center justify-center rounded-full bg-card/90 text-ink shadow-sticker'
    : 'flex size-11 items-center justify-center rounded-btn text-ink-2 hover:bg-tile hover:text-ink'
  const itemClass = 'flex min-h-11 w-full items-center gap-2 rounded-sm px-3 text-left text-sm hover:bg-paper focus-visible:bg-paper'

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={(event) => {
        if (!open) return
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          const items = [...(rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])]
          const index = items.indexOf(document.activeElement as HTMLButtonElement)
          items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
        }
      }}
    >
      <button ref={buttonRef} type="button" disabled={disabled} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} aria-label={label} title="更多" onClick={() => setOpen((value) => !value)} className={`${buttonClass} disabled:opacity-50`}>
        <Icon name="more" size={22} />
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label="更多動作" className="absolute top-[calc(100%+4px)] right-0 z-40 flex w-44 flex-col rounded-tile bg-card p-1.5 shadow-float ring-[1.5px] ring-line">
          {isActiveWish(item) && <button ref={firstItemRef} type="button" role="menuitem" className={`${itemClass} text-ink`} onClick={() => choose(onDrop)}>放棄購買</button>}
          {item.status === 'dropped' && <button ref={firstItemRef} type="button" role="menuitem" className={`${itemClass} text-ink`} onClick={() => choose(onReconsider)}>重新考慮</button>}
          <button ref={bought ? firstItemRef : undefined} type="button" role="menuitem" className={`${itemClass} text-rose-deep`} onClick={() => choose(onDelete)}><Icon name="trash" size={17} />{bought ? '刪除紀錄' : '永久刪除'}</button>
        </div>
      )}
    </div>
  )
}
