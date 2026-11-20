import { useEffect, useRef, useState } from 'react'
import { ItemImage } from '@/components/closet/ItemImage'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { MarkdownNote } from '@/components/ui/MarkdownNote'
import { MaterialMix } from '@/components/ui/MaterialMix'
import { BuyPickerEditor, BuySummary } from '@/components/wishlist/BuyPicker'
import { OpenFullPageLink } from '@/components/wishlist/OpenFullPageLink'
import { effectiveBuyLines } from '@/lib/basket'
import { materialMix } from '@/lib/materialMix'
import { FLAT_LABELS } from '@/lib/review'
import { formatStretch } from '@/lib/stretch'
import { photoColorLabel } from '@/lib/wishColors'
import { formatAddedDate, formatNT, WISH_STATUS } from '@/lib/wishlist'
import { flatMeasurementEntries } from '@/lib/wishlistAi'
import type { BuyLine, WishlistItem } from '@/types'
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
  /** 購買明細選擇器（B28 B）按確定：放進採購籃或更新明細 */
  onPutInBasket: (item: WishlistItem, lines: BuyLine[]) => Promise<boolean>
  /** 摘要上的「移出」 */
  onTakeOut: (item: WishlistItem) => void
  studioUrl: (item: WishlistItem) => string
  /** 每件在這個比較的欄頂封面（storage_path） */
  coverPaths: Record<string, string | undefined>
  /** 每件在這個比較「比的尺碼」，當購買明細的預設尺碼 */
  chosenSizes?: Record<string, string | undefined>
  onSetCover: (item: WishlistItem, path: string | null) => void
}

/**
 * B23.2／BM20.2 比較・快速預覽：不換頁看商品細節。
 * 桌機是貼右邊的抽屜（寬 520、不蓋灰底，比較表照樣能捲能點；視窗小於 1200 加淡灰底）；手機是 top 40px 的 Bottom Sheet。
 * ← → 循環切換、Esc 關閉。
 */
export function ComparePreview({ items, currentId, mobile, keyboard, onSelect, onClose, onEdit, onRemove, onPutInBasket, onTakeOut, studioUrl, coverPaths, chosenSizes = {}, onSetCover }: ComparePreviewProps) {
  const panelRef = useRef<HTMLElement>(null)
  // 按「＋ 準備購買」或「調整」後，底部往上展開編輯區；換商品就收起（不寫入）
  const [pickingId, setPickingId] = useState<string | null>(null)
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
  const colors = item.colors?.length ? item.colors.map((color) => `${color.name}${color.favorite ? '（最想要）' : ''}`).join('、') : item.colorName
  const facts = [item.shop || item.brand, added ? `加入於 ${added}` : null].filter(Boolean).join('・')
  const flat = flatMeasurementEntries(item)
  const bought = item.status === 'bought'

  const pager = <div className="compare-preview__pager">
    <button type="button" className="compare-preview__icon-btn" disabled={total < 2} onClick={() => move(-1)} aria-label="上一件"><Icon name="back" size={20} /></button>
    <span className="font-num text-sm font-bold tabular" aria-live="polite"><span className="sr-only">第 </span>{index + 1} / {total}<span className="sr-only"> 件</span></span>
    <button type="button" className="compare-preview__icon-btn" disabled={total < 2} onClick={() => move(1)} aria-label="下一件"><Icon name="next" size={20} /></button>
  </div>
  const editBtn = !bought && (mobile
    ? <button type="button" className="compare-preview__icon-btn" onClick={() => onEdit(item)} aria-label={`編輯「${item.name}」`}><Icon name="edit" size={20} /></button>
    : <Button variant="secondary" className="h-10 px-3 text-[13px]" onClick={() => onEdit(item)}><Icon name="edit" size={16} />編輯</Button>)
  const closeBtn = <button type="button" className="compare-preview__icon-btn" onClick={onClose} aria-label="關閉預覽"><Icon name="x" size={20} /></button>

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
        {/* 開完整頁面：新分頁打開 /wishlist/:id，比較頁不動；手機只留 ↗ 圖示 */}
        <OpenFullPageLink itemId={item.id} iconOnly={mobile} className="ml-auto" />
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
          <PreviewPhotos key={item.id} item={item} mobile={mobile} coverPath={coverPaths[item.id]} onSetCover={(path) => onSetCover(item, path)} />
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

        {materialMix(item).parts.length > 0 && <section aria-label="材質" className="rounded-btn bg-card px-3 py-2.5 shadow-[inset_0_0_0_1.5px_var(--color-line)]">
          <span className="mb-1.5 block text-xs text-ink-2">材質・依比例</span>
          <MaterialMix material={item.material} materialComposition={item.materialComposition} materialPercentages={item.materialPercentages} />
        </section>}

        {item.reason?.trim() && <section aria-label="我的筆記" className="compare-preview__note">
          <span aria-hidden="true" className="compare-preview__tape" />
          <MarkdownNote value={item.reason.trim()} />
        </section>}
      </div>

      {pickingId === item.id && !bought ? (
        <div className="flex-none border-t-2 border-ink bg-card px-4 pt-3.5 pb-4 shadow-[0_-14px_24px_-18px_rgb(59_47_37/0.5)]">
          <BuyPickerEditor key={item.id} item={item} variant="strip" preferredSize={chosenSizes[item.id]} onCancel={() => setPickingId(null)} onConfirm={(lines) => void onPutInBasket(item, lines).then((ok) => { if (ok) setPickingId(null) })} />
        </div>
      ) : (
        <div className={`compare-preview__foot ${item.status === 'ready' ? 'flex-wrap' : ''}`}>
          {item.status === 'ready' && <div className="w-full"><BuySummary item={item} lines={effectiveBuyLines(item, chosenSizes[item.id])} variant="strip" onAdjust={() => setPickingId(item.id)} onRemove={() => onTakeOut(item)} /></div>}
          {!mobile && <Button variant="ghost" className="text-rose-ink" onClick={() => onRemove(item)}>從這個比較移除</Button>}
          <ButtonLink to={studioUrl(item)} variant="secondary" className={mobile ? 'h-12 flex-1' : 'ml-auto'}>拿去試搭</ButtonLink>
          {bought
            ? <span className="inline-flex h-11 items-center px-3 text-sm text-ink-2">已購買</span>
            : item.status !== 'ready' && <Button variant="oat" className={mobile ? 'h-12 flex-1' : ''} onClick={() => setPickingId(item.id)}>＋ 準備購買</Button>}
        </div>
      )}
    </aside>
  </>
}

/**
 * 主圖＋縮圖；沒有照片時用去背圖或示意圖。
 * 可把目前看的這張設為「這個比較的封面」（只影響比較表欄頂，不改選購清單的封面）。
 */
function PreviewPhotos({ item, mobile, coverPath, onSetCover }: { item: WishlistItem; mobile: boolean; coverPath?: string; onSetCover: (path: string | null) => void }) {
  const photos = (item.photos ?? []).filter((photo) => photo.url)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = photos.find((photo) => photo.id === selectedId) ?? photos.find((photo) => photo.path === coverPath) ?? photos.find((photo) => photo.isCover) ?? photos[0]
  const url = selected?.url ?? item.cutoutUrl
  const selectedIsCover = !!selected && selected.path === coverPath
  return <div className={`flex flex-none flex-col gap-1.5 ${mobile ? '' : 'w-[190px]'}`}>
    <span className={`relative flex items-center justify-center overflow-hidden rounded-[12px] ${mobile ? 'h-[260px]' : 'h-[220px]'}`} style={{ backgroundColor: item.colorHex + '26' }}>
      {url ? <img src={url} alt={`${item.name}商品圖片`} className="size-full object-contain" /> : <ItemImage name={item.name} shape={item.shape} colorHex={item.colorHex} className="h-[82%] w-[60%]" />}
      {selectedIsCover && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-ink px-2 py-0.5 text-[10.5px] text-paper">比較封面</span>}
    </span>
    {photos.length > 1 && <span role="group" aria-label="商品圖片" className="flex flex-wrap gap-1.5">
      {photos.map((photo, photoIndex) => <button key={photo.id} type="button" aria-pressed={selected?.id === photo.id} aria-label={`查看第 ${photoIndex + 1} 張商品圖片${photoColorLabel(photo.colorFamily) ? `，${photoColorLabel(photo.colorFamily)}色` : ''}${photo.path === coverPath ? '（比較封面）' : ''}`} onClick={() => setSelectedId(photo.id)} className={`relative size-11 overflow-hidden rounded-sm border-[1.5px] bg-paper p-0 ${selected?.id === photo.id ? 'border-ink' : 'border-line'}`}><img src={photo.url} alt="" loading="lazy" className="size-full object-cover" />{photo.path === coverPath && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 bg-ink/85 text-center text-[9px] leading-[14px] text-paper">封面</span>}</button>)}
    </span>}
    {photos.length > 1 && selected && (selectedIsCover
      ? <button type="button" onClick={() => onSetCover(null)} className="min-h-9 self-start rounded-btn px-1 text-left text-xs text-ink-2 underline decoration-line-strong underline-offset-2">改回商品原本的封面</button>
      : <button type="button" onClick={() => onSetCover(selected.path)} className="min-h-9 self-start rounded-btn border-[1.5px] border-dashed border-line-strong px-3 text-xs font-medium text-mist-deep hover:bg-tile">設為比較封面</button>)}
  </div>
}
