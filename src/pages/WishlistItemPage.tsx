import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ItemImage } from '@/components/closet/ItemImage'
import { DestructiveActionDialog } from '@/components/ui/B10States'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { MarkdownNote } from '@/components/ui/MarkdownNote'
import { MaterialMix } from '@/components/ui/MaterialMix'
import { LoadingState, PageState } from '@/components/ui/PageState'
import { PhotoColorDot, PhotoColorTag } from '@/components/ui/PhotoColorTag'
import { StickyNote } from '@/components/ui/StickyNote'
import { Toast, type ToastMessage } from '@/components/ui/Toast'
import { BoughtDialog } from '@/components/wishlist/BoughtDialog'
import { BuyPickerEditor, BuyPickerPopover, BuyPickerSheet, BuySummary } from '@/components/wishlist/BuyPicker'
import { WishItemMoreMenu } from '@/components/wishlist/WishItemMoreMenu'
import { WishlistCompareMenu } from '@/components/wishlist/WishlistCompareMenu'
import { WishlistForm } from '@/components/wishlist/WishlistForm'
import {
  addWishlistItemsToCompare,
  createCompareWithItems,
  deleteWishlistItem,
  fetchAllWishlist,
  fetchClosetItems,
  fetchCompareGroupItems,
  fetchCompareGroups,
  fetchCompareMemberships,
  fetchProfileData,
  markWishlistBought,
  removeWishlistItemFromCompare,
  saveWishlistAiReview,
  setWishlistStatus,
  updateWishlistItem,
} from '@/lib/data'
import { materialMix } from '@/lib/materialMix'
import { buyQty, chosenSizeFor, effectiveBuyLines } from '@/lib/basket'
import { buildSizeRows, FLAT_LABELS, judgeLabel } from '@/lib/review'
import { SLOT_META } from '@/lib/slots'
import { elasticFiberPercent, formatStretch } from '@/lib/stretch'
import { useBasket } from '@/lib/useBasket'
import { useIsMobile } from '@/lib/useIsMobile'
import { colorFromName, photoColorLabel } from '@/lib/wishColors'
import { formatAddedDate, formatNT, garmentLengthName, garmentTypeOf, isActiveWish, PRIORITY_LABEL, wishAsClosetItem, wishInsights } from '@/lib/wishlist'
import { buildAiText, defaultAiIncludes, flatMeasurementEntries } from '@/lib/wishlistAi'
import type { BodyMeasurement, BodyProfile, BuyLine, ClosetItem, CompareGroup, CompareGroupItem, WishlistColor, WishlistInput, WishlistItem, WishStatus } from '@/types'

type Dialog = { kind: 'edit' } | { kind: 'delete' } | { kind: 'bought' } | { kind: 'aiPaste' } | { kind: 'leaveBasket'; next: 'considering' | 'dropped' } | null
type Slide = { id: string; url: string; label?: string; hex?: string }

/** 狀態膠囊（B7.3）：顏色跟著狀態變；小說明寫在選單每一項旁邊 */
const STATUS_PILL: Record<WishStatus, { label: string; note: string; pill: string; dot: string }> = {
  considering: { label: '考慮中', note: '', pill: 'border-line-strong bg-tile text-ink-2', dot: 'bg-ink-2' },
  ready: { label: '準備購買', note: '進採購籃', pill: 'border-sage bg-sage-soft text-status-ok-fg', dot: 'bg-status-ok-fg' },
  bought: { label: '已購買', note: '會開移至衣櫃', pill: 'border-mist bg-mist-soft text-mist-ink', dot: 'bg-mist-ink' },
  dropped: { label: '已放棄', note: '可再改回', pill: 'border-rose bg-rose-soft text-rose-deep', dot: 'bg-rose-deep' },
}
const STATUS_ORDER: WishStatus[] = ['considering', 'ready', 'bought', 'dropped']

const demoSuffix = (demo: boolean) => (demo ? '（示範模式，重新整理後會還原）' : '')
const EMPTY_CLOSET: ClosetItem[] = []
const CONCLUSION: Record<string, { label: string; className: string }> = {
  very: { label: '很像', className: 'bg-rose-soft text-rose-ink' },
  some: { label: '有點像', className: 'bg-oat-soft text-oat-ink' },
  not: { label: '不太像', className: 'bg-sage-soft text-sage-ink' },
  few: { label: '依據較少', className: 'bg-tile text-ink-2' },
}

/**
 * 選購商品完整頁面（B7.3／BM19.2）：/wishlist/:id。
 * 照片放大是重點；1440 × 900 一個畫面內要看得到照片和全部細項，方便截圖。
 * 從清單預覽面板、比較頁預覽抽屜以新分頁打開。
 */
export function WishlistItemPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const [items, setItems] = useState<WishlistItem[] | null>(null)
  const [closet, setCloset] = useState<ClosetItem[]>([])
  const [groups, setGroups] = useState<CompareGroup[]>([])
  const [links, setLinks] = useState<CompareGroupItem[]>([])
  const [memberships, setMemberships] = useState<Record<string, { groupId: string; groupName: string }[]>>({})
  const [body, setBody] = useState<{ body: BodyMeasurement | null; profile: BodyProfile | null }>({ body: null, profile: null })
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  // 點顏色只看那個顏色的照片（照片有標顏色時才有作用）；null＝全部
  const [photoColor, setPhotoColor] = useState<string | null>(null)
  // 點了沒有標記照片的顏色：提示「X 還沒有標記照片」
  const [photoHint, setPhotoHint] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // 購買明細選擇器（B28）：桌機是狀態按鈕下方的彈出面板，手機是 Bottom Sheet
  const [picking, setPicking] = useState(false)
  const closePicker = useCallback(() => setPicking(false), [])
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const closeToast = useCallback(() => setToast(null), [])

  const load = useCallback(() => Promise.all([
    fetchAllWishlist(),
    fetchClosetItems().catch(() => []),
    fetchCompareGroups().catch(() => []),
    fetchCompareGroupItems().catch(() => []),
    fetchCompareMemberships().catch(() => ({})),
    fetchProfileData().catch(() => null),
  ]).then(([wish, closetItems, compareGroups, compareLinks, compareMemberships, profileData]) => {
    setItems(wish)
    setCloset(closetItems)
    setGroups(compareGroups)
    setLinks(compareLinks)
    setMemberships(compareMemberships)
    if (profileData) {
      const latest = [...profileData.measurements].sort((a, b) => b.measuredOn.localeCompare(a.measuredOn))[0] ?? null
      setBody({ body: latest, profile: profileData.bodyProfile })
    }
  }).catch((error: unknown) => setLoadError(error instanceof Error ? error : new Error(String(error)))), [])

  useEffect(() => { void load() }, [load])

  const item = items?.find((entry) => entry.id === id) ?? null
  useEffect(() => {
    if (item) document.title = `${item.name}・選購清單`
  }, [item])

  const basketItems = useMemo(() => items ?? [], [items])
  const setBasketItems: Dispatch<SetStateAction<WishlistItem[]>> = useCallback((update) => setItems((current) => (current ? (typeof update === 'function' ? update(current) : update) : current)), [])
  const shopping = useBasket({ items: basketItems, setItems: setBasketItems, groups, links, setToast, reload: load })

  const replaceItem = (next: WishlistItem) => setItems((list) => (list ?? []).map((entry) => (entry.id === next.id ? next : entry)))
  const run = async (action: () => Promise<void>) => {
    setSaving(true)
    try {
      await action()
    } catch (error) {
      setToast({ tone: 'error', text: error instanceof Error ? `沒有儲存成功：${error.message}` : '沒有儲存成功，請稍後再試。' })
    } finally {
      setSaving(false)
    }
  }

  if (loadError) {
    return <main className="mx-auto max-w-[720px] px-4 pt-10" role="alert">
      <PageState icon="alert" tone="rose" compact title="這件商品暫時打不開" description="資料讀取沒有成功，內容不會被更動。確認連線後可以再試一次。" action={<Button variant="secondary" onClick={() => { setLoadError(null); void load() }}>重新載入</Button>} />
    </main>
  }
  if (!items) return <main className="px-4 pt-10"><LoadingState label="正在打開商品…" /></main>
  if (!item) {
    return <main className="mx-auto max-w-[720px] px-4 pt-10">
      <PageState icon="wish" tone="oat" compact title="找不到這件商品" description="可能已經刪除，或網址不完整。" action={<ButtonLink to="/wishlist" variant="secondary">回選購清單</ButtonLink>} />
    </main>
  }

  const current = item
  const groupIds = (memberships[current.id] ?? []).map((entry) => entry.groupId)

  const onStatus = (status: WishlistInput['status']) => run(async () => {
    const { demo } = await setWishlistStatus(current.id, status)
    replaceItem({ ...current, status })
    setToast({ tone: 'success', text: `改為${STATUS_PILL[status].label}${demoSuffix(demo)}` })
  })
  // 狀態膠囊：隨時可以改。選「準備購買」打開購買明細選擇器（按確定才寫入）；已購買開「移至已購買」流程；
  // 還在採購籃裡卻改成考慮中／已放棄，先問要不要移出
  const onChangeStatus = (next: WishStatus) => {
    if (next === current.status) return
    if (next === 'bought') { setDialog({ kind: 'bought' }); return }
    if (next === 'ready') { setPicking(true); return }
    if (current.status === 'ready') { setDialog({ kind: 'leaveBasket', next }); return }
    void onStatus(next)
  }
  const onPutInBasket = async (lines: BuyLine[]) => {
    if (await shopping.putInBasket(current, lines)) setPicking(false)
  }
  const onBought = (purchase: { purchaseDate: string; paidPrice: number | null; colorFamilies: string[] }) => run(async () => {
    const { itemIds, demo } = await markWishlistBought(current.id, purchase)
    replaceItem({ ...current, status: 'bought', boughtItemId: itemIds[0], boughtItemIds: itemIds })
    setDialog(null)
    setCloset((await fetchClosetItems().catch(() => null)) ?? closet)
    setToast({ tone: 'success', text: `已建立 ${itemIds.length} 件衣物，選購紀錄保留在「已購買」${demoSuffix(demo)}` })
  })
  // AI 看過的提醒：平台不呼叫 AI，只整理文字給使用者複製，再把回覆貼回來
  const onCopyAi = async () => {
    const text = `${buildAiText({ items: [current], closet, body: body.body, bodyProfile: body.profile, include: defaultAiIncludes() })}\n\n回覆請用「- 」開頭的條列，列出下單前要跟店家確認、或可能踩雷的地方。`
    try {
      await navigator.clipboard.writeText(text)
      setToast({ tone: 'success', text: '已複製這件的資料，貼到你常用的 AI，再把回覆貼回來。' })
    } catch {
      setToast({ tone: 'error', text: '無法複製，請再試一次。' })
    }
  }
  const onSaveAi = (text: string) => run(async () => {
    const { aiReview, aiReviewedAt, demo } = await saveWishlistAiReview(current.id, text)
    replaceItem({ ...current, aiReview, aiReviewedAt })
    setDialog(null)
    setToast({ tone: 'success', text: `${aiReview ? '已貼上 AI 的回覆' : '已清除 AI 的提醒'}${demoSuffix(demo)}` })
  })
  const pickPhotoColor = (color: string | null, hint: string | null = null) => {
    setPhotoColor(color)
    setPhotoHint(hint)
  }
  const onUpdate = (input: WishlistInput) => run(async () => {
    const { item: next, demo } = await updateWishlistItem(current.id, input)
    replaceItem(next)
    setDialog(null)
    setToast({ tone: 'success', text: `已儲存變更${demoSuffix(demo)}` })
  })
  const onDelete = () => run(async () => {
    const { demo } = await deleteWishlistItem(current.id)
    setDialog(null)
    setToast({ tone: 'success', text: `已刪除「${current.name}」${demoSuffix(demo)}` })
    navigate('/wishlist', { replace: true })
  })
  const onCompareToggle = (groupId: string, included: boolean) => run(async () => {
    if (included) await addWishlistItemsToCompare(groupId, [current.id])
    else await removeWishlistItemFromCompare(groupId, current.id)
    const group = groups.find((entry) => entry.id === groupId)
    setMemberships((all) => {
      const list = (all[current.id] ?? []).filter((entry) => entry.groupId !== groupId)
      return { ...all, [current.id]: included ? [...list, { groupId, groupName: group?.name ?? '' }] : list }
    })
    setToast({ tone: 'success', text: included ? `已加入「${group?.name ?? '比較'}」` : `已從「${group?.name ?? '比較'}」移除` })
  })
  const onNewCompare = () => run(async () => {
    const type = garmentTypeOf(current)
    const label = type ? garmentLengthName(type.id, current.garmentLength) ?? type.label : SLOT_META[current.primaryPart ?? current.slot].label
    const { group, demo } = await createCompareWithItems(`${label} 1 件`, [current.id])
    setToast({ tone: 'success', text: `已建立「${group.name}」${demoSuffix(demo)}` })
    navigate(`/wishlist/compare/${group.id}`)
  })

  const compareMenu = <WishlistCompareMenu item={current} groups={groups} groupIds={groupIds} disabled={saving} onToggle={(groupId, included) => void onCompareToggle(groupId, included)} onCreate={() => void onNewCompare()} />
  const moreMenu = (tone: 'plain' | 'overlay') => <WishItemMoreMenu item={current} tone={tone} disabled={saving} onDrop={() => onChangeStatus('dropped')} onReconsider={() => void onStatus('considering')} onDelete={() => setDialog({ kind: 'delete' })} />
  const pickerTitleId = `buy-picker-${current.id}`
  const preferredSize = chosenSizeFor(current.id, groups, links)
  const pickerEditor = picking && <BuyPickerEditor key={current.id} item={current} variant={isMobile ? 'sheet' : 'panel'} preferredSize={preferredSize} titleId={pickerTitleId} onCancel={closePicker} onConfirm={(lines) => void onPutInBasket(lines)} />
  const basketSummary = current.status === 'ready' && <BuySummary item={current} lines={effectiveBuyLines(current, preferredSize)} variant="bar" disabled={picking} onAdjust={() => setPicking(true)} onRemove={() => void shopping.takeOutOfBasket(current)} />
  const backTo = `/wishlist?item=${encodeURIComponent(current.id)}`

  return (
    <main className={`mx-auto flex max-w-[1360px] flex-col gap-3.5 md:px-8 md:pt-4 md:pb-12 ${isMobile ? 'pb-[calc(150px+env(safe-area-inset-bottom))]' : ''}`}>
      {!isMobile && (
        <div className="flex flex-wrap items-center gap-2.5">
          <Link to={backTo} className="inline-flex h-10 items-center gap-1 rounded-btn px-2.5 text-sm font-medium text-mist-deep no-underline hover:bg-tile"><Icon name="back" size={18} />選購清單</Link>
          <span className="text-xs text-ink-3">／ {breadcrumb(current)}</span>
          <div className="ml-auto flex items-center gap-2">
            {current.status !== 'bought' && compareMenu}
            {current.status !== 'bought' && <Button variant="secondary" className="h-10" disabled={saving} onClick={() => setDialog({ kind: 'edit' })}><Icon name="edit" size={16} />編輯</Button>}
            {current.status === 'bought' && <ButtonLink to={current.boughtItemId ? `/closet/${current.boughtItemId}` : '/closet'} variant="secondary" className="h-10">到衣櫃查看</ButtonLink>}
            {moreMenu('plain')}
          </div>
        </div>
      )}

      <div className="grid items-start md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:gap-10 xl:grid-cols-[minmax(0,640px)_minmax(0,1fr)]">
        <ItemPhotos
          key={photoColor ?? 'all'}
          item={current}
          color={photoColor}
          colors={itemColors(current)}
          onClearColor={() => pickPhotoColor(null)}
          mobile={isMobile}
          overlay={isMobile ? <>
            <Link to={backTo} aria-label="回選購清單" className="flex size-11 items-center justify-center rounded-full bg-card/90 text-ink shadow-sticker"><Icon name="back" /></Link>
            {current.status !== 'bought' && <button type="button" disabled={saving} onClick={() => setDialog({ kind: 'edit' })} aria-label={`編輯「${current.name}」`} className="ml-auto flex size-11 items-center justify-center rounded-full bg-card/90 text-ink shadow-sticker"><Icon name="edit" size={18} /></button>}
            <span className={current.status === 'bought' ? 'ml-auto' : ''}>{moreMenu('overlay')}</span>
          </> : null}
        />
        <ItemDetails
          item={current}
          photoColor={photoColor}
          photoHint={photoHint}
          onPhotoColor={pickPhotoColor}
          statusControl={<StatusMenu status={current.status} disabled={saving || shopping.saving} onChange={onChangeStatus} />}
          picker={!isMobile && pickerEditor && <BuyPickerPopover labelledBy={pickerTitleId} onCancel={closePicker}>{pickerEditor}</BuyPickerPopover>}
          basketSummary={basketSummary}
          onCopyAi={() => void onCopyAi()}
          onPasteAi={() => setDialog({ kind: 'aiPaste' })}
          closet={closet}
          body={body.body}
          profile={body.profile}
          memberships={memberships[current.id] ?? []}
          mobile={isMobile}
        />
      </div>

      {isMobile && (
        <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-20 flex gap-2 border-t-[1.5px] border-dashed border-line-strong bg-card px-3 py-2.5">
          {current.status === 'bought'
            ? <ButtonLink to={current.boughtItemId ? `/closet/${current.boughtItemId}` : '/closet'} variant="primary" className="h-12 flex-1">到衣櫃查看</ButtonLink>
            : current.status === 'dropped'
              ? <Button variant="primary" className="h-12 flex-1" disabled={saving} onClick={() => void onStatus('considering')}>重新考慮</Button>
              : <>
                <div className="flex-1 [&_summary]:h-12 [&_summary]:w-full [&_summary]:justify-center [&>details]:w-full">{compareMenu}</div>
                {current.status === 'ready'
                  ? <Button variant="secondary" className="h-12 flex-1" onClick={() => setPicking(true)}>✓ 在採購籃・調整</Button>
                  : <Button variant="oat" className="h-12 flex-1" onClick={() => setPicking(true)}>＋ 準備購買</Button>}
              </>}
        </div>
      )}

      {dialog?.kind === 'edit' && <WishlistForm key={current.id} item={current} saving={saving} onCancel={() => setDialog(null)} onSubmit={(input) => void onUpdate(input)} onDelete={() => setDialog({ kind: 'delete' })} />}
      {isMobile && pickerEditor && <BuyPickerSheet labelledBy={pickerTitleId} onCancel={closePicker}>{pickerEditor}</BuyPickerSheet>}
      {dialog?.kind === 'leaveBasket' && (
        <DestructiveActionDialog
          title="要把它移出採購籃嗎？"
          description={`「${current.name}」目前在採購籃裡（${buyQty(effectiveBuyLines(current))} 件）。移出後件數和顏色會清空，狀態改為${STATUS_PILL[dialog.next].label}。`}
          confirmLabel="移出採購籃"
          cancelLabel="先不要"
          onCancel={() => setDialog(null)}
          onConfirm={() => { const next = dialog.next; setDialog(null); void shopping.takeOutOfBasket(current, next) }}
        />
      )}
      {dialog?.kind === 'bought' && <BoughtDialog key={current.id} item={current} saving={saving} onCancel={() => setDialog(null)} onConfirm={(purchase) => void onBought(purchase)} />}
      {dialog?.kind === 'aiPaste' && <AiPasteDialog value={current.aiReview ?? ''} saving={saving} onCancel={() => setDialog(null)} onSave={(text) => void onSaveAi(text)} />}
      {dialog?.kind === 'delete' && (
        <DestructiveActionDialog
          title={`永久刪除「${current.name}」？`}
          description={current.status === 'bought' ? '只會刪除這筆選購紀錄與它的照片，已放進衣櫃的衣物不受影響。刪除後無法復原。' : '商品資料與照片會一起刪除。只是暫時不想買的話，可以改成「放棄購買」，資料會保留。'}
          confirmLabel="永久刪除"
          secondaryAction={isActiveWish(current) ? { label: '改成放棄購買', onClick: () => { setDialog(null); void onStatus('dropped') } } : undefined}
          onCancel={() => setDialog(null)}
          onConfirm={() => void onDelete()}
        />
      )}
      <Toast message={toast} onClose={closeToast} />
    </main>
  )
}

function breadcrumb(item: WishlistItem) {
  const part = SLOT_META[item.primaryPart ?? item.slot].label
  const type = garmentTypeOf(item)
  const length = type && item.garmentLength ? ({ short: '短', mid: '中', long: '長' } as const)[item.garmentLength] : null
  return [part, type?.label, length].filter(Boolean).join(' ・ ')
}

/* ── 狀態 ─────────────────────────────────────────── */

/** 標題上方的狀態膠囊「● 狀態 ▾」：點開直接切換四種狀態（menuitemradio）。已購買後衣物已建立，不再提供改回 */
function StatusMenu({ status, disabled, onChange }: { status: WishStatus; disabled: boolean; onChange: (status: WishStatus) => void }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const meta = STATUS_PILL[status]

  useEffect(() => {
    if (!open) return
    rootRef.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]')?.focus()
    const onPointer = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  const pillClass = `inline-flex items-center gap-1.5 rounded-full border-[1.5px] text-[13px] font-medium ${meta.pill}`
  if (status === 'bought') {
    return <span className={`${pillClass} h-9 px-3`} title="已建立衣物，狀態不再更改"><span aria-hidden="true" className="size-[7px] rounded-full bg-current" />{meta.label}</span>
  }

  const close = () => { setOpen(false); buttonRef.current?.focus() }
  return (
    <span
      ref={rootRef}
      className="relative inline-flex"
      onKeyDown={(event) => {
        if (!open) return
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          const items = [...(rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])]
          const index = items.indexOf(document.activeElement as HTMLButtonElement)
          items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
        }
      }}
    >
      <button ref={buttonRef} type="button" disabled={disabled} aria-haspopup="menu" aria-expanded={open} aria-label={`狀態：${meta.label}，點了可以改`} onClick={() => setOpen((value) => !value)} className={`${pillClass} h-9 pr-2.5 pl-3 disabled:opacity-60`}>
        <span aria-hidden="true" className="size-[7px] rounded-full bg-current" />{meta.label}<Icon name="down" size={15} />
      </button>
      {open && (
        <div role="menu" aria-label="改狀態" className="absolute top-[42px] left-0 z-40 flex w-[250px] flex-col rounded-card bg-card p-1.5 shadow-float ring-[1.5px] ring-line">
          {STATUS_ORDER.map((key) => {
            const option = STATUS_PILL[key]
            const checked = key === status
            return (
              <button key={key} type="button" role="menuitemradio" aria-checked={checked} onClick={() => { setOpen(false); buttonRef.current?.focus(); onChange(key) }} className={`flex min-h-11 items-center gap-2.5 rounded-btn px-2.5 text-left text-sm font-medium text-ink hover:bg-paper focus-visible:bg-paper ${checked ? 'bg-paper' : ''}`}>
                <span aria-hidden="true" className={`size-2.5 flex-none rounded-full ${option.dot}`} />
                <span className="flex-1">{option.label}</span>
                {option.note && <span className="text-[11.5px] font-normal text-ink-3">{option.note}</span>}
              </button>
            )
          })}
        </div>
      )}
    </span>
  )
}

/* ── 照片 ─────────────────────────────────────────── */

function itemColors(item: WishlistItem): WishlistColor[] {
  if (item.colors?.length) return item.colors
  return item.colorName ? [{ ...colorFromName(item.colorName, item.colorHex), id: 'legacy' }] : []
}

function photoSlides(item: WishlistItem, colors: WishlistColor[]): Slide[] {
  const photos = (item.photos ?? []).filter((photo) => photo.url).sort((a, b) => Number(b.isCover) - Number(a.isCover) || a.sortOrder - b.sortOrder)
  const slides: Slide[] = photos.map((photo) => {
    const label = photoColorLabel(photo.colorFamily)
    return { id: photo.id, url: photo.url!, label, hex: label ? colors.find((color) => color.name === label)?.hex ?? colorFromName(label).hex : undefined }
  })
  if (!slides.length && item.cutoutUrl) slides.push({ id: 'cutout', url: item.cutoutUrl })
  return slides
}

/**
 * 桌機：左側直排縮圖 76 × 96＋主圖 4:5（sticky）；手機：滿版 4:5 可左右滑，下面一排縮圖。點主圖或放大鏡開全螢幕。
 * 有標顏色的照片貼 B27 紙膠帶（一半在照片外，所以外框不裁切），縮圖改成右下角色點。
 */
function ItemPhotos({ item, color, colors, onClearColor, mobile, overlay }: { item: WishlistItem; color: string | null; colors: WishlistColor[]; onClearColor: () => void; mobile: boolean; overlay: ReactNode }) {
  // 有選顏色時只留標了那個顏色的照片；←／→、縮圖、張數、放大檢視都只在這些照片之間切換
  const slides = useMemo(() => {
    const all = photoSlides(item, colors)
    const matched = color ? all.filter((slide) => slide.label === color) : []
    return matched.length ? matched : all
  }, [item, colors, color])
  const [index, setIndex] = useState(0)
  const [zoomed, setZoomed] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)
  const total = slides.length
  const safeIndex = Math.min(index, Math.max(0, total - 1))
  const slide = slides[safeIndex]
  const filterHex = color ? colors.find((entry) => entry.name === color)?.hex : undefined

  const go = useCallback((next: number) => {
    if (!total) return
    const target = (next + total) % total
    setIndex(target)
    const track = trackRef.current
    if (track) track.scrollTo({ left: target * track.clientWidth, behavior: 'smooth' })
  }, [total])

  // ← → 鍵切換照片（輸入中、對話框或選單開著時不搶）
  useEffect(() => {
    if (zoomed || total < 2) return
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target as HTMLElement | null
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.closest('dialog,[role="menu"],[role="listbox"]'))) return
      if (document.querySelector('dialog[open]')) return
      if (event.key === 'ArrowLeft') { event.preventDefault(); go(safeIndex - 1) }
      if (event.key === 'ArrowRight') { event.preventDefault(); go(safeIndex + 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, safeIndex, total, zoomed])

  const altOf = (entry: Slide, slideIndex: number) => `${item.name}・${entry.label ? `${entry.label}・` : ''}第 ${slideIndex + 1} 張`
  const position = (total > 1 || color) && <span className={`absolute bottom-3.5 z-[3] flex h-[26px] items-center rounded-full bg-ink/70 px-2.5 font-num text-xs text-paper tabular ${mobile ? 'left-3' : 'left-3.5'}`}>{safeIndex + 1} / {total}{color ? `・${color}` : ''}</span>
  // 篩選中：主圖左上角「只看「X」×」
  const filterBar = color && (
    <span role="status" className={`absolute z-[3] flex h-9 items-center gap-2 rounded-full bg-ink pr-1.5 pl-3 text-[13px] text-paper ${mobile ? 'top-[60px] left-2' : 'top-3 left-3'}`}>
      {filterHex && <span aria-hidden="true" className="size-3.5 rounded-full shadow-[0_0_0_1.5px_var(--color-paper)]" style={{ background: filterHex }} />}
      只看「{color}」
      <button type="button" onClick={onClearColor} aria-label="取消，顯示全部照片" className="flex size-7 items-center justify-center rounded-full bg-paper/15 text-paper hover:bg-paper/25"><Icon name="x" size={16} /></button>
    </span>
  )
  const tag = slide?.label && <PhotoColorTag seed={item.id} label={slide.label} hex={slide.hex} photoIndex={safeIndex} mobile={mobile} />

  const thumbs = total > 1 && (
    <div role="group" aria-label="切換照片" className={mobile ? `flex gap-2 overflow-x-auto px-4 pb-2.5 ${tag ? 'pt-[22px]' : 'pt-2.5'}` : 'flex max-h-[calc(100dvh-140px)] flex-none flex-col gap-2 overflow-y-auto p-1'}>
      {slides.map((entry, slideIndex) => (
        <button
          key={entry.id}
          type="button"
          aria-pressed={slideIndex === safeIndex}
          aria-label={`第 ${slideIndex + 1} 張${entry.label ? `・${entry.label}` : ''}`}
          onClick={() => go(slideIndex)}
          className={`relative flex-none overflow-hidden bg-tile p-0 ${mobile ? 'h-16 w-[52px] rounded-[9px]' : 'h-24 w-[76px] rounded-btn'} ${slideIndex === safeIndex ? 'shadow-[0_0_0_2.5px_var(--color-ink)]' : 'shadow-[inset_0_0_0_1px_rgb(59_47_37/0.12)]'}`}
        >
          <img src={entry.url} alt="" loading="lazy" className="size-full object-cover" />
          {entry.hex && <PhotoColorDot hex={entry.hex} label={entry.label} />}
        </button>
      ))}
    </div>
  )

  if (mobile) {
    return (
      <section aria-label="照片">
        <div className="relative aspect-[4/5] w-full bg-rose-soft">
          {total ? (
            <div
              ref={trackRef}
              onScroll={(event) => { const el = event.currentTarget; const next = Math.round(el.scrollLeft / el.clientWidth); if (next !== safeIndex) setIndex(next) }}
              className="flex size-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {slides.map((entry, slideIndex) => (
                <button key={entry.id} type="button" onClick={() => setZoomed(true)} aria-label={`放大看第 ${slideIndex + 1} 張`} className="size-full flex-none snap-center bg-transparent p-0">
                  <img src={entry.url} alt={altOf(entry, slideIndex)} className="size-full object-contain" />
                </button>
              ))}
            </div>
          ) : <div className="flex size-full items-center justify-center"><ItemImage name={item.name} shape={item.shape} colorHex={item.colorHex} className="h-[74%] w-[64%]" /></div>}
          <div className="absolute inset-x-2 top-2 z-[3] flex items-center gap-1.5">{overlay}</div>
          {filterBar}
          {position}
          {tag}
        </div>
        {thumbs}
        {zoomed && slide && <Lightbox slides={slides} start={safeIndex} name={item.name} onClose={(last) => { setZoomed(false); go(last) }} />}
      </section>
    )
  }

  return (
    <section aria-label="照片" className="flex gap-3 md:sticky md:top-4">
      {thumbs}
      {/* 外框不裁切（膠帶要跨出去），圓角裁切放在內層 */}
      <div className="relative aspect-[4/5] min-w-0 flex-1">
        <div className="absolute inset-0 overflow-hidden rounded-[16px] bg-rose-soft shadow-paper">
          {slide ? (
            <button type="button" onClick={() => setZoomed(true)} aria-label="放大看" className="size-full cursor-zoom-in bg-transparent p-0">
              <img src={slide.url} alt={altOf(slide, safeIndex)} className="size-full object-contain" />
            </button>
          ) : <div className="flex size-full items-center justify-center"><ItemImage name={item.name} shape={item.shape} colorHex={item.colorHex} className="h-[74%] w-[64%]" /></div>}
        </div>
        {filterBar}
        {position}
        {slide && <button type="button" onClick={() => setZoomed(true)} aria-label="放大看" className="absolute top-3 right-3 z-[3] flex size-11 items-center justify-center rounded-btn bg-card/90 text-ink"><Icon name="search" size={20} /></button>}
        {total > 1 && <>
          <button type="button" onClick={() => go(safeIndex - 1)} aria-label="上一張" className="absolute top-1/2 left-2.5 z-[3] flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-card/85 text-ink"><Icon name="back" /></button>
          <button type="button" onClick={() => go(safeIndex + 1)} aria-label="下一張" className="absolute top-1/2 right-2.5 z-[3] flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-card/85 text-ink"><Icon name="next" /></button>
        </>}
        {tag}
      </div>
      {zoomed && slide && <Lightbox slides={slides} start={safeIndex} name={item.name} onClose={(last) => { setZoomed(false); go(last) }} />}
    </section>
  )
}

/** 全螢幕看圖：← → 或左右滑切換，Esc 關閉；關閉時回報最後看的那張 */
function Lightbox({ slides, start, name, onClose }: { slides: Slide[]; start: number; name: string; onClose: (index: number) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [index, setIndex] = useState(start)
  const touchX = useRef<number | null>(null)
  const total = slides.length
  const slide = slides[index]
  const move = (direction: -1 | 1) => setIndex((current) => (current + direction + total) % total)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      aria-label={`${name}・照片放大檢視`}
      onClose={() => onClose(index)}
      onKeyDown={(event) => {
        if (total < 2) return
        if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1) }
        if (event.key === 'ArrowRight') { event.preventDefault(); move(1) }
      }}
      onTouchStart={(event) => { touchX.current = event.touches[0]?.clientX ?? null }}
      onTouchEnd={(event) => {
        const startX = touchX.current
        touchX.current = null
        const endX = event.changedTouches[0]?.clientX
        if (startX == null || endX == null || total < 2 || Math.abs(endX - startX) < 40) return
        move(endX < startX ? 1 : -1)
      }}
      onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close() }}
      className="fixed inset-0 m-0 hidden h-dvh max-h-none w-screen max-w-none items-center justify-center border-0 bg-transparent p-4 open:flex backdrop:bg-ink/85"
    >
      <img src={slide.url} alt={`${name}${slide.label ? `・${slide.label}` : ''}`} className="max-h-[calc(100dvh-6rem)] max-w-[calc(100vw-2rem)] object-contain" />
      <button type="button" autoFocus onClick={() => dialogRef.current?.close()} aria-label="關閉放大檢視" className="absolute top-4 right-4 flex size-11 items-center justify-center rounded-full bg-card text-ink shadow-float"><Icon name="x" /></button>
      {total > 1 && <>
        <button type="button" onClick={() => move(-1)} aria-label="上一張" className="absolute top-1/2 left-4 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-card/95 text-ink shadow-float"><Icon name="back" size={24} /></button>
        <button type="button" onClick={() => move(1)} aria-label="下一張" className="absolute top-1/2 right-4 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-card/95 text-ink shadow-float"><Icon name="next" size={24} /></button>
        <p aria-live="polite" className="absolute bottom-5 left-1/2 m-0 -translate-x-1/2 rounded-full bg-card/95 px-3 py-1 font-num text-sm text-ink tabular">{index + 1} / {total}{slide.label ? `・${slide.label}` : ''}</p>
      </>}
    </dialog>
  )
}

/* ── 細項 ─────────────────────────────────────────── */

function Section({ title, hint, tone = 'plain', className = '', children }: { title: string; hint?: string; tone?: 'plain' | 'sage'; className?: string; children: ReactNode }) {
  const toneClass = tone === 'sage' ? 'bg-sage-soft' : 'bg-card shadow-[inset_0_0_0_1.5px_var(--color-line)]'
  const titleClass = tone === 'sage' ? 'text-sage-ink' : 'text-ink'
  return (
    <section aria-label={title} className={`flex min-w-0 flex-col gap-2 rounded-card px-4 py-3.5 ${toneClass} ${className}`}>
      <h2 className={`m-0 flex items-baseline gap-2 text-[13px] font-bold ${titleClass}`}>{title}{hint && <small className="text-[11.5px] font-normal text-ink-3">{hint}</small>}</h2>
      {children}
    </section>
  )
}

const shortDate = (iso?: string) => {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : `${date.getMonth() + 1}/${date.getDate()}`
}

interface ItemDetailsProps {
  item: WishlistItem
  photoColor: string | null
  photoHint: string | null
  onPhotoColor: (color: string | null, hint?: string | null) => void
  statusControl: ReactNode
  /** 購買明細選擇器的彈出面板（桌機），貼在狀態按鈕下面 */
  picker: ReactNode
  /** 放進採購籃後，價格下方的摘要列 */
  basketSummary: ReactNode
  onCopyAi: () => void
  onPasteAi: () => void
  closet: ClosetItem[]
  body: BodyMeasurement | null
  profile: BodyProfile | null
  memberships: { groupId: string; groupName: string }[]
  mobile: boolean
}

function ItemDetails({ item, photoColor, photoHint, onPhotoColor, statusControl, picker, basketSummary, onCopyAi, onPasteAi, closet, body, profile, memberships, mobile }: ItemDetailsProps) {
  const added = formatAddedDate(item.createdAt)
  const insights = useMemo(() => wishInsights(item, closet), [item, closet])
  const flat = flatMeasurementEntries(item)
  const sizeRows = useMemo(() => buildSizeRows(wishAsClosetItem(item), body, EMPTY_CLOSET, profile), [item, body, profile])
  // 合身判斷：沿用比較頁的 B20 判斷；沒有結論的部位不顯示
  const fitChips = sizeRows.flatMap((row) => {
    const verdict = judgeLabel(row) === '—' ? row.note : judgeLabel(row)
    return verdict ? [{ key: row.part.flatKey, text: `${row.part.label} ${verdict}`, judge: row.judge }] : []
  })
  const colors = itemColors(item)
  const elastic = elasticFiberPercent(item.materialPercentages, item.materialComposition)
  const hasMaterial = materialMix(item).parts.length > 0
  const conclusion = CONCLUSION[insights.comparison.conclusion]
  const facts = [item.shop || item.brand, item.size ? `預計尺寸 ${item.size}` : null, added ? `加入於 ${added}` : null].filter(Boolean).join('・')

  // 照片有標顏色時：有標記照片的顏色是可點的膠囊（只看那色，再點一次回到全部）；沒有標記的是純文字，點了維持全部並提示
  const labeled = new Set((item.photos ?? []).flatMap((photo) => (photo.url && photoColorLabel(photo.colorFamily) ? [photo.colorFamily!] : [])))
  const colorsClickable = labeled.size > 0
  const colorSection = colors.length > 0 && <Section title="顏色" hint={colorsClickable ? (mobile ? '有框的可以點，只看那色的照片' : '有框的可以點，只看那個顏色的照片') : colors.some((color) => color.favorite) ? '★＝最想要' : undefined}>
    <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
      {colors.map((color) => {
        const has = labeled.has(color.name)
        const active = has && photoColor === color.name
        const content = <>
          <span aria-hidden="true" className="size-6 flex-none rounded-full" style={{ background: color.hex, boxShadow: active ? '0 0 0 2px var(--color-paper)' : 'inset 0 0 0 1px rgb(59 47 37 / 0.18)' }} />
          <span>{color.name}</span>
          {color.favorite && <span aria-label="最想要">★</span>}
        </>
        const base = 'inline-flex h-[38px] items-center gap-[7px] rounded-full border-[1.5px] pr-3 pl-1.5 text-sm font-medium whitespace-nowrap'
        if (!colorsClickable) return <li key={color.id}><span className={`${base} border-transparent text-ink`}>{content}</span></li>
        return <li key={color.id}>
          {has
            ? <button type="button" aria-pressed={active} title={active ? '再點一次顯示全部照片' : `只看「${color.name}」的照片`} onClick={() => onPhotoColor(active ? null : color.name)} className={`${base} ${active ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-card text-ink hover:border-ink'}`}>{content}</button>
            : <button type="button" title="還沒有標記照片" onClick={() => onPhotoColor(null, color.name)} className={`${base} cursor-default border-transparent bg-transparent text-ink-2`}>{content}</button>}
        </li>
      })}
    </ul>
    {photoHint && <span role="status" className="text-xs text-ink-2">「{photoHint}」還沒有標記照片，顯示全部照片。</span>}
  </Section>

  const featureChips = !!item.features?.length && <span className="flex flex-wrap gap-1.5">{item.features.map((feature) => <span key={`${feature.dimension}-${feature.name}`} className="inline-flex h-[22px] items-center rounded-full bg-ink px-2 text-[11px] font-medium text-paper">{feature.name}</span>)}</span>
  // 桌機：材質卡下半部合併「特徵」；手機照 BM19.2 分開
  const materialSection = (hasMaterial || (!mobile && featureChips)) && <Section title={hasMaterial ? '材質' : '特徵'} hint={hasMaterial ? '依比例' : undefined}>
    {hasMaterial && <MaterialMix material={item.material} materialComposition={item.materialComposition} materialPercentages={item.materialPercentages} />}
    {hasMaterial && elastic != null && <span className="mt-0.5 flex flex-wrap gap-1.5"><span className="inline-flex h-[22px] items-center rounded-full bg-oat-soft px-2 text-[11px] font-medium text-oat-ink">有彈性・彈性纖維 {elastic}%</span></span>}
    {!mobile && featureChips && <>
      {hasMaterial && <h2 className="m-0 mt-1.5 border-t-[1.5px] border-dashed border-line pt-2.5 text-[13px] font-bold text-ink">特徵</h2>}
      {featureChips}
    </>}
  </Section>
  const featureSection = mobile && featureChips && <Section title="特徵">{featureChips}</Section>
  const compareSection = <Section title="比較・衣櫃">
    <span className="text-[13px] leading-6">{memberships.length ? <>在比較：{memberships.map((entry, entryIndex) => <span key={entry.groupId}>{entryIndex > 0 && '、'}<Link to={`/wishlist/compare/${entry.groupId}`}>{entry.groupName || '未命名比較'}</Link></span>)}</> : <span className="text-ink-2">還沒有加入比較</span>}</span>
    <span className="flex flex-wrap items-center gap-1.5 text-[13px]">
      <span className={`inline-flex h-[22px] items-center rounded-full px-2 text-[11px] font-medium ${conclusion.className}`}>{conclusion.label}</span>
      {insights.closest ? `像：${insights.closest.name}` : `衣櫃沒有${insights.compareLabel}`}・可以搭 <b className="font-num tabular">{insights.matchCount}</b> 件
    </span>
  </Section>
  // 三張便利貼各自不同色（B7.3）：本體不旋轉，只有膠帶和後面的墊紙有角度
  const noteProps = { variant: 'mixed', headingLevel: 'h2', titleStyle: 'label', size: 'compact', collapsible: false, className: 'mt-1.5' } as const
  const sizeNoteSection = item.sizeNote?.trim() && <StickyNote {...noteProps} id={`size-${item.id}`} tone="lavender" paper="squared" tape="peach" fold={false} title="商品頁尺寸表" titleNote="原文照抄">
    <div className="text-[13.5px] leading-[1.8] text-ink"><MarkdownNote value={item.sizeNote.trim()} /></div>
  </StickyNote>
  const flatSection = flat.length > 0 && <Section title="平放尺寸" hint={`cm${item.flatMeasurementsSize ? `・${item.flatMeasurementsSize}` : ''}`} tone="sage">
    <dl className="m-0 grid grid-cols-3 gap-1.5">
      {flat.map(([key, value]) => <div key={key} className="flex min-w-0 flex-col gap-0.5 rounded-btn bg-card px-2.5 py-2">
        <dt className="truncate text-[11px] text-ink-2">{FLAT_LABELS[key] ?? key}</dt>
        <dd className="m-0 font-num text-[15px] font-bold tabular text-ink">{formatStretch(value, item.flatStretch?.[key])}</dd>
      </div>)}
    </dl>
    {fitChips.length > 0 && <span className="flex flex-wrap gap-1.5">{fitChips.map((chip) => <span key={chip.key} className={`inline-flex h-[22px] items-center rounded-full px-2 text-[11px] font-medium ${chip.judge === 'ok' ? 'bg-sage text-sage-ink' : chip.judge === 'snug' ? 'bg-oat-soft text-oat-ink' : chip.judge === 'tight' || chip.judge === 'small' ? 'bg-rose-soft text-rose-ink' : 'bg-mist-soft text-mist-ink'}`}>{chip.text}</span>)}</span>}
  </Section>
  const noteSection = item.reason?.trim() && <StickyNote {...noteProps} id={item.id} tone="mist" tape="oat" title="我的筆記">
    <div className="text-sm leading-[1.85] text-(--note-text)"><MarkdownNote value={item.reason.trim()} /></div>
  </StickyNote>
  // AI 看過的提醒：記下單前要確認的風險（跟我的筆記記喜好不同）。已購買且沒有內容時不顯示
  const aiDate = shortDate(item.aiReviewedAt)
  const aiSection = (item.aiReview?.trim() || item.status !== 'bought') && <StickyNote {...noteProps} id={`ai-${item.id}`} tone="sage" tape="mist" title="AI 看過的提醒" titleNote={item.aiReview?.trim() && aiDate ? `${aiDate} 貼上` : undefined}>
    {item.aiReview?.trim()
      ? <div className="text-[13px] leading-[1.7] text-(--note-text)"><MarkdownNote value={item.aiReview.trim()} /></div>
      : <p className="m-0 text-[13px] leading-6 text-(--note-text)">還沒有內容。把這件的資料整理給你常用的 AI，再把下單前要確認的提醒貼回來。</p>}
    <div className="mt-2 flex flex-wrap gap-1.5">
      <button type="button" onClick={onCopyAi} className={`inline-flex items-center gap-1.5 rounded-btn border-[1.5px] border-line-strong bg-card/70 px-2.5 text-[12.5px] font-medium text-ink hover:bg-card ${mobile ? 'h-10' : 'h-9'}`}><Icon name="copy" size={15} />整理給 AI</button>
      <button type="button" onClick={onPasteAi} className={`inline-flex items-center gap-1.5 rounded-btn px-2 text-[12.5px] font-medium text-status-ok-fg hover:bg-card/60 ${mobile ? 'h-10' : 'h-9'}`}><Icon name="chat" size={15} />貼上新回覆</button>
    </div>
  </StickyNote>

  return (
    <section aria-labelledby="wish-item-title" className={`@container flex min-w-0 flex-col gap-3 ${mobile ? 'px-4 pt-1' : ''}`}>
      <div className="flex flex-col gap-1.5">
        <span className="relative flex flex-wrap items-center gap-1.5">
          {statusControl}
          {picker}
          {item.priority && <span className="inline-flex h-6 items-center rounded-full bg-tile px-2.5 text-xs font-medium text-ink-2">優先 {PRIORITY_LABEL[item.priority]}</span>}
        </span>
        <h1 id="wish-item-title" className="m-0 font-hd text-2xl leading-[1.35] md:text-[32px] md:leading-[1.3]">{item.name}</h1>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <b className="font-num text-2xl tabular md:text-[30px]">{formatNT(item.price)}</b>
          {facts && <span className="text-xs text-ink-2 md:text-[13px]">{facts}</span>}
          {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-[13px] md:min-h-8">{mobile ? '商品頁' : '前往商品頁'} ↗<span className="sr-only">（另開新視窗）</span></a>}
        </div>
        {basketSummary}
      </div>

      {mobile ? (
        <>
          {colorSection}{sizeNoteSection}{flatSection}{materialSection}{noteSection}{featureSection}{compareSection}{aiSection}
        </>
      ) : (
        <div className="grid items-start gap-3 @[560px]:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-3">{colorSection}{materialSection}{compareSection}{aiSection}</div>
          <div className="flex min-w-0 flex-col gap-3">{sizeNoteSection}{flatSection}{noteSection}</div>
        </div>
      )}
    </section>
  )
}

/** 貼上 AI 的回覆：存成「AI 看過的提醒」。「- 」開頭的行會變成清單；清空後儲存＝清除 */
function AiPasteDialog({ value, saving, onCancel, onSave }: { value: string; saving: boolean; onCancel: () => void; onSave: (text: string) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [draft, setDraft] = useState(value)
  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="ai-paste-title"
      onCancel={(event) => { event.preventDefault(); onCancel() }}
      className="m-auto hidden w-[min(560px,calc(100vw-2rem))] max-w-none flex-col gap-3 rounded-card border-0 bg-card p-5 text-ink shadow-float open:flex backdrop:bg-ink/45"
    >
      <h2 id="ai-paste-title" className="m-0 font-hd text-[22px] font-normal">貼上 AI 的回覆</h2>
      <p id="ai-paste-hint" className="m-0 text-[13px] leading-6 text-ink-2">把 AI 回覆裡下單前要確認的地方貼進來。「- 」開頭的行會變成清單；清空後儲存會移除這張便利貼的內容。</p>
      <textarea aria-labelledby="ai-paste-title" aria-describedby="ai-paste-hint" rows={8} value={draft} onChange={(event) => setDraft(event.target.value)} autoFocus className="min-h-40 w-full resize-y rounded-btn border-[1.5px] border-line-strong bg-paper px-3 py-2.5 text-sm leading-[1.7] text-ink" />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" disabled={saving} onClick={onCancel}>取消</Button>
        <Button variant="primary" disabled={saving} onClick={() => onSave(draft)}>{saving ? '儲存中…' : '儲存'}</Button>
      </div>
    </dialog>
  )
}
