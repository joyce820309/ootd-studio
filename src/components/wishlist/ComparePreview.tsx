import { useEffect, useRef, useState } from 'react'
import { ItemImage } from '@/components/closet/ItemImage'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { MarkdownNote } from '@/components/ui/MarkdownNote'
import { FLAT_LABELS } from '@/lib/review'
import { formatStretch } from '@/lib/stretch'
import { formatAddedDate, formatNT, WISH_STATUS } from '@/lib/wishlist'
import { flatMeasurementEntries } from '@/lib/wishlistAi'
import type { WishlistItem } from '@/types'
import './ComparePreview.css'

interface ComparePreviewProps {
  /** 依比較表欄位順序 */
  items: WishlistItem[]
  currentId: string
  mobile: boolean
  /** 有其他對話框開著時不接鍵盤 */
  keyboard: boolean
  onSelect: (id: string) => void
  onClose: () => void
  onEdit: (item: WishlistItem) => void
  onRemove: (item: WishlistItem) => void
  onBuy: (item: WishlistItem) => void
  studioUrl: (item: WishlistItem) => string
}

/**
 * B23.2／BM20.2 比較・快速預覽：不換頁看商品細節。
 * 桌機是貼右邊的抽屜（寬 520、不蓋灰底，比較表照樣能捲能點；視窗小於 1200 加淡灰底）；手機是 top 40px 的 Bottom Sheet。
 * ← → 循環切換、Esc 關閉。
 */
export function ComparePreview({ items, currentId, mobile, keyboard, onSelect, onClose, onEdit, onRemove, onBuy, studioUrl }: ComparePreviewProps) {
  const panelRef = useRef<HTMLElement>(null)
  const index = Math.max(0, items.findIndex((item) => item.id === currentId))
  const item = items[index]
  const total = items.length
  const move = (direction: -1 | 1) => onSelect(items[(index + direction + total) % total].id)

  useEffect(() => {
    if (!keyboard) return
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target as HTMLElement | null
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.closest('[role="listbox"],[role="menu"],[role="slider"]'))) return
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
      else if (total > 1 && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        // 欄頂的排序鈕也用左右鍵，焦點在那裡時讓它處理
        if (target?.closest('.compare-head__drag')) return
        event.preventDefault()
        onSelect(items[(index + (event.key === 'ArrowLeft' ? -1 : 1) + total) % total].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [keyboard, items, index, total, onClose, onSelect])

  // 打開時把焦點移進抽屜，關閉時還給原本的元素
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.focus({ preventScroll: true })
    return () => { if (previous && document.contains(previous)) previous.focus({ preventScroll: true }) }
  }, [])

  // 手機版是 modal，背景不捲
  useEffect(() => {
    if (!mobile) return
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = overflow }
  }, [mobile])

  if (!item) return null
  const status = WISH_STATUS[item.status]
  const added = formatAddedDate(item.createdAt)
  const colors = item.colors?.length ? item.colors.map((color) => `${color.family}${color.favorite ? '（最想要）' : ''}`).join('、') : item.colorName
  const facts = [item.shop || item.brand, added ? `加入於 ${added}` : null].filter(Boolean).join('・')
  const flat = flatMeasurementEntries(item)
  const bought = item.status === 'bought'

  const pager = <div className="compare-preview__pager">
    <button type="button" className="compare-preview__icon-btn" disabled={total < 2} onClick={() => move(-1)} aria-label="上一件"><Icon name="back" size={20} /></button>
    <span className="font-num text-sm font-bold tabular" aria-live="polite"><span className="sr-only">第 </span>{index + 1} / {total}<span className="sr-only"> 件</span></span>
    <button type="button" className="compare-preview__icon-btn" disabled={total < 2} onClick={() => move(1)} aria-label="下一件"><Icon name="next" size={20} /></button>
  </div>
  const editBtn = !bought && (mobile
    ? <button type="button" className="compare-preview__icon-btn ml-auto" onClick={() => onEdit(item)} aria-label={`編輯「${item.name}」`}><Icon name="edit" size={20} /></button>
    : <Button variant="secondary" className="h-10 px-3 text-[13px]" onClick={() => onEdit(item)}><Icon name="edit" size={16} />編輯</Button>)
  const closeBtn = <button type="button" className={`compare-preview__icon-btn ${mobile && bought ? 'ml-auto' : ''}`} onClick={onClose} aria-label="關閉預覽"><Icon name="x" size={20} /></button>

  return <>
    <div aria-hidden="true" onClick={onClose} className={`compare-preview__scrim ${mobile ? 'is-mobile' : ''}`} />
    <aside
      ref={panelRef}
      tabIndex={-1}
      role={mobile ? 'dialog' : 'complementary'}
      aria-modal={mobile || undefined}
      aria-labelledby="compare-preview-title"
      className={`compare-preview ${mobile ? 'is-mobile' : ''}`}
    >
      {mobile && <span aria-hidden="true" className="compare-preview__grip" />}
      <div className="compare-preview__top">
        {!mobile && <span className="text-xs text-ink-2">預覽</span>}
        {pager}
        {!mobile && <a href={`/wishlist?item=${encodeURIComponent(item.id)}`} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex h-10 items-center gap-1 rounded-btn px-2.5 text-[13px] text-mist-deep no-underline hover:bg-tile">開完整頁面<span className="sr-only">（另開新分頁）</span><svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-none stroke-current" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M14 5h5v5M19 5l-8 8M18 14v5H5V6h5" /></svg></a>}
        {editBtn}
        {closeBtn}
      </div>

      <div role="group" aria-label="切換商品" className="compare-preview__thumbs">
        {items.map((entry, entryIndex) => <button key={entry.id} type="button" aria-pressed={entry.id === item.id} aria-label={`第 ${entryIndex + 1} 件：${entry.name}`} onClick={() => onSelect(entry.id)} className="compare-preview__thumb" style={{ backgroundColor: entry.colorHex + '26' }}>
          <ItemImage name={entry.name} cutoutUrl={entry.cutoutUrl} shape={entry.shape} colorHex={entry.colorHex} className="h-[80%] w-[70%]" />
        </button>)}
        {!mobile && <span className="ml-auto self-center text-right text-[11px] leading-[1.6] text-ink-3">鍵盤 <kbd>←</kbd> <kbd>→</kbd> 切換<br /><kbd>Esc</kbd> 關閉</span>}
      </div>

      <div className="compare-preview__body">
        <div className={mobile ? 'flex flex-col gap-3' : 'flex gap-3.5'}>
          <PreviewPhotos key={item.id} item={item} mobile={mobile} />
          <div className="flex min-w-0 flex-col gap-2">
            <span className={`inline-flex h-[22px] items-center gap-1.5 self-start rounded-full px-2.5 text-[11px] font-medium ${status.className}`}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{status.label}</span>
            <h2 id="compare-preview-title" className="m-0 font-hd text-[19px] leading-[1.4] md:text-[22px] md:leading-[1.35]">{item.name}</h2>
            <b className="font-num text-xl tabular md:text-2xl">{formatNT(item.price)}</b>
            {facts && <span className="text-[12.5px] text-ink-2">{facts}</span>}
            {colors && <span className="text-[12.5px] text-ink-2">顏色：{colors}</span>}
          </div>
        </div>

        {item.sizeNote?.trim() && <section aria-label="商品頁尺寸表" className="rounded-btn bg-mist-soft px-3 py-2.5 text-[13px] leading-[1.75] text-ink">
          <span className="block text-xs text-mist-ink">商品頁尺寸表</span>
          <MarkdownNote value={item.sizeNote.trim()} />
        </section>}

        {flat.length > 0 && <section aria-label="平放尺寸" className="rounded-btn bg-sage-soft px-3 py-2.5 text-sage-ink">
          <span className="block text-xs">平放尺寸{item.flatMeasurementsSize ? `（${item.flatMeasurementsSize}）` : ''}・cm</span>
          <p className="m-0 mt-1 font-num text-[13px] leading-[1.75] text-ink tabular">{flat.map(([key, value]) => `${FLAT_LABELS[key] ?? key} ${formatStretch(value, item.flatStretch?.[key])}`).join('・')}</p>
        </section>}

        {item.reason?.trim() && <section aria-label="我的筆記" className="compare-preview__note">
          <span aria-hidden="true" className="compare-preview__tape" />
          <MarkdownNote value={item.reason.trim()} />
        </section>}
      </div>

      <div className="compare-preview__foot">
        {!mobile && <Button variant="ghost" className="text-rose-ink" onClick={() => onRemove(item)}>從這個比較移除</Button>}
        <ButtonLink to={studioUrl(item)} variant="secondary" className={mobile ? 'h-12 flex-1' : 'ml-auto'}>拿去試搭</ButtonLink>
        <Button variant="primary" disabled={bought} className={mobile ? 'h-12 flex-1' : ''} onClick={() => onBuy(item)}>{bought ? '已購買' : '就買這件'}</Button>
      </div>
    </aside>
  </>
}

/** 主圖＋縮圖；沒有照片時用去背圖或示意圖 */
function PreviewPhotos({ item, mobile }: { item: WishlistItem; mobile: boolean }) {
  const photos = (item.photos ?? []).filter((photo) => photo.url)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = photos.find((photo) => photo.id === selectedId) ?? photos.find((photo) => photo.isCover) ?? photos[0]
  const url = selected?.url ?? item.cutoutUrl
  return <div className={`flex flex-none flex-col gap-1.5 ${mobile ? '' : 'w-[190px]'}`}>
    <span className={`flex items-center justify-center overflow-hidden rounded-[12px] ${mobile ? 'h-[260px]' : 'h-[220px]'}`} style={{ backgroundColor: item.colorHex + '26' }}>
      {url ? <img src={url} alt={`${item.name}商品圖片`} className="size-full object-contain" /> : <ItemImage name={item.name} shape={item.shape} colorHex={item.colorHex} className="h-[82%] w-[60%]" />}
    </span>
    {photos.length > 1 && <span role="group" aria-label="商品圖片" className="flex flex-wrap gap-1.5">
      {photos.map((photo, photoIndex) => <button key={photo.id} type="button" aria-pressed={selected?.id === photo.id} aria-label={`查看第 ${photoIndex + 1} 張商品圖片${photo.colorFamily ? `，${photo.colorFamily}色` : ''}`} onClick={() => setSelectedId(photo.id)} className={`size-11 overflow-hidden rounded-sm border-[1.5px] bg-paper p-0 ${selected?.id === photo.id ? 'border-ink' : 'border-line'}`}><img src={photo.url} alt="" loading="lazy" className="size-full object-cover" /></button>)}
    </span>}
  </div>
}
