import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ItemImage } from '@/components/closet/ItemImage'
import { DestructiveActionDialog } from '@/components/ui/B10States'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Icon } from '@/components/ui/Icon'
import { MarkdownNote } from '@/components/ui/MarkdownNote'
import { LoadingState, PageState } from '@/components/ui/PageState'
import { TiltLabel } from '@/components/ui/Paper'
import { Toast, type ToastMessage } from '@/components/ui/Toast'
import { BoughtDialog } from '@/components/wishlist/BoughtDialog'
import { WishlistForm } from '@/components/wishlist/WishlistForm'
import { WishlistTabs } from '@/components/wishlist/WishlistTabs'
import {
  createWishlistItem,
  deleteWishlistItem,
  fetchAllWishlist,
  fetchClosetItems,
  markWishlistBought,
  setWishlistStatus,
  updateWishlistItem,
} from '@/lib/data'
import { SLOT_META } from '@/lib/slots'
import {
  ACTIVE_STATUSES,
  formatAddedDate,
  formatNT,
  isActiveWish,
  OVERLAP_LABEL,
  PRIORITY_LABEL,
  totalPrice,
  WISH_STATUS,
  WISH_TABS,
  wishInsights,
  type LookCell,
} from '@/lib/wishlist'
import type { ClosetItem, WishlistInput, WishlistItem, WishStatus } from '@/types'

type TabKey = WishStatus | 'all'
type Dialog = { kind: 'create' } | { kind: 'edit'; item: WishlistItem } | { kind: 'bought'; item: WishlistItem } | { kind: 'delete'; item: WishlistItem } | null

const demoSuffix = (demo: boolean) => (demo ? '（示範模式，重新整理後會還原）' : '')

const isTabKey = (value: string | null): value is TabKey => !!value && WISH_TABS.some((t) => t.key === value)

const matchesTab = (item: WishlistItem, tab: TabKey) => (tab === 'all' ? item.status !== 'bought' : item.status === tab)

export function WishlistPage() {
  const [params, setParams] = useSearchParams()
  const tab: TabKey = isTabKey(params.get('status')) ? (params.get('status') as TabKey) : 'all'
  const selectedParam = params.get('item')

  const [items, setItems] = useState<WishlistItem[] | null>(null)
  const [closet, setCloset] = useState<ClosetItem[]>([])
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const closeToast = useCallback(() => setToast(null), [])

  const load = useCallback(() => {
    Promise.all([fetchAllWishlist(), fetchClosetItems()])
      .then(([wish, closetItems]) => {
        setItems(wish)
        setCloset(closetItems)
      })
      .catch((error: unknown) => setLoadError(error instanceof Error ? error : new Error(String(error))))
  }, [])

  useEffect(load, [load])

  const retry = () => {
    setLoadError(null)
    load()
  }

  const updateParams = (next: { status?: TabKey; item?: string | null }, replace = false) => {
    const p = new URLSearchParams(params)
    if (next.status !== undefined) {
      if (next.status === 'all') p.delete('status')
      else p.set('status', next.status)
    }
    if (next.item !== undefined) {
      if (next.item) p.set('item', next.item)
      else p.delete('item')
    }
    setParams(p, { replace })
  }

  const counts = useMemo(() => {
    const result = Object.fromEntries(WISH_TABS.map((t) => [t.key, 0])) as Record<TabKey, number>
    for (const item of items ?? []) {
      result[item.status] += 1
      if (item.status !== 'bought') result.all += 1
    }
    return result
  }, [items])

  const active = useMemo(() => (items ?? []).filter(isActiveWish), [items])
  const activeTotal = active.reduce((sum, item) => sum + totalPrice(item), 0)
  const visible = useMemo(() => (items ?? []).filter((item) => matchesTab(item, tab)), [items, tab])

  // 桌面版沒有指定時預設選第一件；手機版只在有 ?item= 時顯示詳細。
  const selected = (items ?? []).find((item) => item.id === selectedParam) ?? visible[0] ?? null
  const insights = useMemo(() => (selected ? wishInsights(selected, closet) : null), [selected, closet])
  const insightsById = useMemo(() => Object.fromEntries(visible.map((item) => [item.id, wishInsights(item, closet)])), [visible, closet])

  const replaceItem = (item: WishlistItem) => setItems((list) => (list ?? []).map((entry) => (entry.id === item.id ? item : entry)))

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

  const onCreate = (input: WishlistInput) =>
    run(async () => {
      const { item, demo } = await createWishlistItem(input)
      setItems((list) => [item, ...(list ?? [])])
      setDialog(null)
      updateParams({ status: matchesTab(item, tab) ? tab : 'all', item: item.id })
      setToast({ tone: 'success', text: `已加入選購清單${demoSuffix(demo)}` })
    })

  const onUpdate = (id: string, input: WishlistInput) =>
    run(async () => {
      const { item, demo } = await updateWishlistItem(id, input)
      replaceItem(item)
      setDialog(null)
      setToast({ tone: 'success', text: `已儲存變更${demoSuffix(demo)}` })
    })

  const onStatus = (item: WishlistItem, status: WishlistInput['status']) =>
    run(async () => {
      const { demo } = await setWishlistStatus(item.id, status)
      replaceItem({ ...item, status })
      setToast({ tone: 'success', text: `「${item.name}」改為${WISH_STATUS[status].label}${demoSuffix(demo)}` })
    })

  const onBought = (item: WishlistItem, purchase: { purchaseDate: string; paidPrice: number | null }) =>
    run(async () => {
      const { itemId, demo } = await markWishlistBought(item.id, purchase)
      replaceItem({ ...item, status: 'bought', boughtItemId: itemId })
      setDialog(null)
      setCloset((await fetchClosetItems().catch(() => null)) ?? closet)
      setToast({ tone: 'success', text: `已放進衣櫃，選購紀錄保留在「已購買」${demoSuffix(demo)}` })
    })

  const onDelete = (item: WishlistItem) =>
    run(async () => {
      const { demo } = await deleteWishlistItem(item.id)
      setItems((list) => (list ?? []).filter((entry) => entry.id !== item.id))
      setDialog(null)
      if (selectedParam === item.id) updateParams({ item: null }, true)
      setToast({ tone: 'success', text: `已刪除「${item.name}」${demoSuffix(demo)}` })
    })

  const showDetailOnMobile = !!selectedParam && !!selected

  return (
    <main className="mx-auto flex max-w-[1320px] flex-col gap-5 px-[clamp(16px,3vw,40px)] pt-7 pb-24 md:pb-14">
      <div className={`${showDetailOnMobile ? 'hidden md:flex' : 'flex'} flex-wrap items-center gap-3.5`}>
        <TiltLabel accent="rose" as="h1">選購清單</TiltLabel>
        <WishlistTabs />
        {items && (
          <span className="font-num text-sm text-ink-2 tabular">
            進行中 {active.length} 件・預估合計 {formatNT(activeTotal)}
          </span>
        )}
        <Button variant="oat" className="ml-auto hidden md:inline-flex" onClick={() => setDialog({ kind: 'create' })}>
          <Icon name="link" />
          貼上商品網址
        </Button>
      </div>

      {items && items.length > 0 && (
        <div role="group" aria-label="依狀態篩選" className={`${showDetailOnMobile ? 'hidden md:flex' : 'flex'} -mx-4 gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0`}>
          {WISH_TABS.map((t) => (
            <Chip key={t.key} selected={tab === t.key} onClick={() => updateParams({ status: t.key, item: null }, true)} className="h-10 flex-none">
              {t.label}
              <span className="font-num tabular opacity-75">{counts[t.key]}</span>
            </Chip>
          ))}
        </div>
      )}

      {!items && !loadError && <LoadingState label="正在整理選購清單…" />}
      {loadError && (
        <div role="alert">
          <PageState icon="alert" tone="rose" compact title="選購清單暫時打不開" description="資料讀取沒有成功，清單內容不會被更動。確認連線後可以再試一次。" action={<Button variant="secondary" onClick={retry}>重新載入</Button>} />
        </div>
      )}

      {items && items.length === 0 && (
        <PageState
          icon="wish"
          tone="rose"
          title="還沒有想買的東西"
          description="逛網拍看到猶豫的衣服，先貼上網址存起來，再和衣櫃裡的單品比比看。"
          action={<Button variant="primary" onClick={() => setDialog({ kind: 'create' })}><Icon name="link" />貼上第一個商品網址</Button>}
        />
      )}

      {items && items.length > 0 && (
        <div className="flex flex-wrap items-start gap-6">
          <section aria-label="商品列表" className={`${showDetailOnMobile ? 'hidden md:flex' : 'flex'} min-w-0 flex-[1_1_360px] flex-col gap-3 md:max-w-[500px]`}>
            {visible.length === 0 && (
              <PageState icon="wish" tone="oat" compact title={`沒有「${WISH_TABS.find((t) => t.key === tab)?.label}」的商品`} description="換個狀態看看，或把新的候選加進來。" action={<Button variant="secondary" onClick={() => updateParams({ status: 'all' }, true)}>看全部</Button>} />
            )}
            {visible.map((item) => (
              <WishCard
                key={item.id}
                item={item}
                current={selected?.id === item.id}
                similar={insightsById[item.id]?.overlap === 'high'}
                onSelect={() => updateParams({ item: item.id }, !!selectedParam)}
              />
            ))}
          </section>

          {selected && insights && (
            <WishDetail
              item={selected}
              insights={insights}
              busy={saving}
              className={showDetailOnMobile ? 'flex' : 'hidden md:flex'}
              onBack={() => updateParams({ item: null })}
              onEdit={() => setDialog({ kind: 'edit', item: selected })}
              onBought={() => setDialog({ kind: 'bought', item: selected })}
              onDelete={() => setDialog({ kind: 'delete', item: selected })}
              onStatus={(status) => void onStatus(selected, status)}
            />
          )}
        </div>
      )}

      {/* 手機：底部固定主要按鈕 */}
      {items && !showDetailOnMobile && (
        <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-20 border-t-[1.5px] border-dashed border-line-strong bg-paper p-3 md:hidden">
          <Button variant="oat" className="w-full" onClick={() => setDialog({ kind: 'create' })}>
            <Icon name="link" />
            貼上商品網址
          </Button>
        </div>
      )}

      {(dialog?.kind === 'create' || dialog?.kind === 'edit') && (
        <WishlistForm
          key={dialog.kind === 'edit' ? dialog.item.id : 'new'}
          item={dialog.kind === 'edit' ? dialog.item : undefined}
          saving={saving}
          onCancel={() => setDialog(null)}
          onSubmit={(input) => void (dialog.kind === 'edit' ? onUpdate(dialog.item.id, input) : onCreate(input))}
          onDelete={dialog.kind === 'edit' ? () => setDialog({ kind: 'delete', item: dialog.item }) : undefined}
        />
      )}
      {dialog?.kind === 'bought' && <BoughtDialog item={dialog.item} saving={saving} onCancel={() => setDialog(null)} onConfirm={(purchase) => void onBought(dialog.item, purchase)} />}
      {dialog?.kind === 'delete' && (
        <DestructiveActionDialog
          title={`永久刪除「${dialog.item.name}」？`}
          description={
            dialog.item.status === 'bought'
              ? '只會刪除這筆選購紀錄與它的照片，已放進衣櫃的衣物不受影響。刪除後無法復原。'
              : '商品資料與照片會一起刪除，用到它的搭配會少一件。只是暫時不想買的話，可以改成「放棄購買」，資料會保留。'
          }
          confirmLabel="永久刪除"
          secondaryAction={isActiveWish(dialog.item) ? { label: '改成放棄購買', onClick: () => { const item = dialog.item; setDialog(null); void onStatus(item, 'dropped') } } : undefined}
          onCancel={() => setDialog(null)}
          onConfirm={() => void onDelete(dialog.item)}
        />
      )}
      <Toast message={toast} onClose={closeToast} />
    </main>
  )
}

function WishCard({ item, current, similar, onSelect }: { item: WishlistItem; current: boolean; similar: boolean; onSelect: () => void }) {
  const status = WISH_STATUS[item.status]
  const meta = [item.brand ?? item.shop, item.size, item.priority ? `優先 ${PRIORITY_LABEL[item.priority]}` : null].filter(Boolean).join(' · ')
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={current ? 'true' : undefined}
      className={`relative flex w-full gap-3.5 overflow-hidden rounded-card bg-card p-3 text-left text-ink ${
        current ? 'border-2 border-ink' : 'border-[1.5px] border-dashed border-line-strong hover:border-ink-3'
      } ${item.status === 'dropped' ? 'opacity-70' : ''}`}
    >
      <span aria-hidden="true" className="absolute -right-[18px] -bottom-[18px] size-16 rounded-[16px] mix-blend-multiply" style={{ background: SLOT_META[item.slot].wash, rotate: '12deg' }} />
      <span className="flex aspect-[4/5] w-[88px] flex-none items-center justify-center rounded-btn bg-rose-soft">
        <ItemImage name={item.name} cutoutUrl={item.cutoutUrl} shape={item.shape} colorHex={item.colorHex} className="h-[78%] w-[78%]" />
      </span>
      <span className="relative flex min-w-0 flex-1 flex-col justify-center gap-1.5">
        <span className="flex justify-between gap-2.5">
          <span className="min-w-0 text-[15px] font-medium">{item.name}</span>
          <span className="flex-none font-num text-[15px] font-bold tabular">{formatNT(item.price)}</span>
        </span>
        {meta && <span className="truncate text-xs text-ink-2">{meta}</span>}
        <span className="flex flex-wrap gap-1.5">
          <span className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ${status.className}`}>
            <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
            {status.label}
          </span>
          {similar && isActiveWish(item) && <span className="inline-flex h-6 items-center rounded-full bg-rose-soft px-2.5 text-xs font-medium text-rose-ink">與現有單品相似</span>}
        </span>
      </span>
    </button>
  )
}

function WishDetail({
  item,
  insights,
  busy,
  className,
  onBack,
  onEdit,
  onBought,
  onDelete,
  onStatus,
}: {
  item: WishlistItem
  insights: ReturnType<typeof wishInsights>
  busy: boolean
  className: string
  onBack: () => void
  onEdit: () => void
  onBought: () => void
  onDelete: () => void
  onStatus: (status: WishlistInput['status']) => void
}) {
  const status = WISH_STATUS[item.status]
  const activeItem = isActiveWish(item)
  const added = formatAddedDate(item.createdAt)
  const priceGap = item.targetPrice !== undefined ? item.price - item.targetPrice : null
  const facts = [item.brand ?? item.shop, item.size ? `預計尺寸 ${item.size}` : null, added ? `加入於 ${added}` : null].filter(Boolean).join('・')
  const extra = [
    item.shipping !== undefined ? ['運費', item.shipping === 0 ? '免運' : formatNT(item.shipping)] : null,
    item.brand && item.shop !== item.brand ? ['店家', item.shop] : null,
    item.returnPolicy ? ['退換貨', item.returnPolicy] : null,
    item.material ? ['材質', item.material] : null,
    item.colorName ? ['顏色', item.colorName] : null,
  ].filter((entry): entry is [string, string] => !!entry)

  return (
    <section aria-label="商品詳細" className={`${className} relative min-w-0 flex-[1.4_1_520px] flex-col gap-5`}>
      {/* 手機返回列 */}
      <div className="-mx-4 -mt-7 flex items-center gap-2 border-b-[1.5px] border-dashed border-line-strong px-2 py-2.5 md:hidden">
        <button type="button" onClick={onBack} aria-label="返回選購清單" className="flex size-11 items-center justify-center rounded-btn bg-transparent text-ink">
          <Icon name="back" />
        </button>
        <span className="min-w-0 truncate font-hd text-lg">{item.name}</span>
      </div>

      <div className="relative flex flex-col gap-5 rounded-[18px] bg-card p-4 shadow-paper sm:p-[22px]">
        <span aria-hidden="true" className="absolute -top-2.5 left-10 h-[22px] w-[84px] rounded-[2px] bg-rose-wash mix-blend-multiply" style={{ rotate: '-4deg' }} />

        <div className="flex flex-wrap gap-[22px]">
          <div className="mx-auto flex aspect-[4/5] w-[200px] flex-none items-center justify-center rounded-card border-[1.5px] border-dashed border-rose-edge bg-rose-soft sm:mx-0">
            <ItemImage name={item.name} cutoutUrl={item.cutoutUrl} shape={item.shape} colorHex={item.colorHex} className="h-[74%] w-[74%]" />
          </div>
          <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-2.5">
            <span className={`inline-flex h-6 items-center gap-1.5 self-start rounded-full px-2.5 text-xs font-medium ${status.className}`}>
              <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
              {status.label}
            </span>
            <h2 className="m-0 font-hd text-[28px] leading-[1.3]">{item.name}</h2>
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="font-num text-[26px] font-bold tabular">{formatNT(item.price)}</span>
              {item.targetPrice !== undefined && priceGap !== null && (
                <span className="font-num text-[13px] text-ink-2 tabular">
                  目標 {formatNT(item.targetPrice)}・{priceGap > 0 ? `差 ${formatNT(priceGap)}` : '已到目標價'}
                </span>
              )}
            </div>
            {facts && <span className="text-[13px] text-ink-2">{facts}</span>}
            {item.url && (
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1 self-start text-[13px]">
                前往商品頁
                <span className="sr-only">（另開新視窗）</span>
                <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3.5 fill-none stroke-current" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M9 7h8v8" /></svg>
              </a>
            )}
            {item.sizeNote && <div className="rounded-btn bg-mist-soft px-3.5 py-2.5 text-sm leading-[1.7] text-ink"><span className="mb-1 block text-xs font-medium text-ink-2">尺寸備註</span><MarkdownNote value={item.sizeNote} /></div>}
            {item.reason && <div className="mt-1 rounded-btn bg-paper px-3.5 py-2.5 text-sm leading-[1.7] text-ink"><MarkdownNote value={item.reason} /></div>}
            {extra.length > 0 && (
              <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
                {extra.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-ink-2">{k}</dt>
                    <dd className="m-0 min-w-0 text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>

        {activeItem && (
          <div role="group" aria-label="變更狀態" className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-ink-2">狀態</span>
            {ACTIVE_STATUSES.map((s) => (
              <Chip key={s} selected={item.status === s} disabled={busy} onClick={() => item.status !== s && onStatus(s as WishlistInput['status'])} className="h-11 md:h-9">
                {WISH_STATUS[s].label}
              </Chip>
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-tile bg-sage-soft p-3.5 text-sage-ink">
            <span className="block font-num text-[28px] font-bold tabular">{insights.matchCount}</span>
            <span className="text-xs">件現有衣物能搭</span>
          </div>
          <div className="flex min-w-0 flex-col gap-1.5 rounded-tile bg-mist-soft p-3.5 text-mist-ink">
            <span className="text-[15px] font-bold sm:text-[17px]">{OVERLAP_LABEL[insights.overlap]}</span>
            <span aria-hidden="true" className="flex gap-[3px]">
              {[0, 1, 2].map((i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-[2px] ${i <= ['low', 'mid', 'high'].indexOf(insights.overlap) ? 'bg-mist-deep' : 'bg-mist'}`} />
              ))}
            </span>
            <span className="text-xs">{insights.closest ? `最接近：${insights.closest.name}` : '衣櫃裡沒有同部位單品'}</span>
          </div>
          <div className="rounded-tile bg-oat-soft p-3.5 text-oat-ink">
            <span className="block font-num text-[28px] font-bold tabular">{insights.lookCount}</span>
            <span className="text-xs">套新穿搭可能</span>
          </div>
        </div>

        {insights.looks.length > 0 && item.status !== 'bought' && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="m-0 font-hd text-[19px]">如果買了，可以這樣穿</h3>
              <span className="text-xs text-ink-2">依衣櫃自動配對・參考用</span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-3">
              {insights.looks.map((cells, index) => (
                <LookPreview key={index} cells={cells} title={`搭配 ${index + 1}`} />
              ))}
            </div>
          </div>
        )}

        {/* 桌面動作列 */}
        <div className="hidden flex-wrap items-center gap-2 border-t-[1.5px] border-dashed border-line-strong pt-4 md:flex">
          <DetailActions item={item} busy={busy} onEdit={onEdit} onBought={onBought} onDelete={onDelete} onStatus={onStatus} />
        </div>
        {activeItem && <span className="-mt-3.5 hidden text-xs text-ink-2 md:block">移至已購買時，名稱、圖片、品牌與尺寸都會帶過去，只需補購買日期與實付價格。</span>}

        {/* 手機：次要動作放內容底部 */}
        <div className="flex flex-col gap-2 border-t-[1.5px] border-dashed border-line-strong pt-4 md:hidden">
          {activeItem && <ButtonLink to="/wishlist/compare" variant="secondary">到比較試搭台混搭</ButtonLink>}
          {activeItem && <Button variant="ghost" disabled={busy} onClick={() => onStatus('dropped')}>放棄購買</Button>}
          <Button variant="ghost" className="text-rose-deep" disabled={busy} onClick={onDelete}>永久刪除</Button>
        </div>
      </div>

      {/* 手機：底部固定主要按鈕 */}
      <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-20 grid grid-cols-[1fr_2fr] gap-2 border-t-[1.5px] border-dashed border-line-strong bg-paper p-3 md:hidden">
        {item.status === 'bought' ? (
          <>
            <span />
            {item.boughtItemId ? <ButtonLink to={`/closet/${item.boughtItemId}`} variant="primary">到衣櫃查看</ButtonLink> : <ButtonLink to="/closet" variant="primary">到衣櫃查看</ButtonLink>}
          </>
        ) : (
          <>
            <Button variant="secondary" disabled={busy} onClick={onEdit}>編輯</Button>
            {item.status === 'dropped' ? (
              <Button variant="primary" disabled={busy} onClick={() => onStatus('considering')}>重新考慮</Button>
            ) : (
              <Button variant="primary" disabled={busy} onClick={onBought}><Icon name="check" />移至已購買</Button>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function DetailActions({ item, busy, onEdit, onBought, onDelete, onStatus }: { item: WishlistItem; busy: boolean; onEdit: () => void; onBought: () => void; onDelete: () => void; onStatus: (status: WishlistInput['status']) => void }) {
  if (item.status === 'bought') {
    return (
      <>
        <ButtonLink to={item.boughtItemId ? `/closet/${item.boughtItemId}` : '/closet'} variant="primary">到衣櫃查看</ButtonLink>
        <span className="text-xs text-ink-2">已購買的紀錄只保留查看，不能再編輯。</span>
        <Button variant="ghost" className="ml-auto text-[13px] font-normal text-rose-deep" disabled={busy} onClick={onDelete}>刪除紀錄</Button>
      </>
    )
  }
  if (item.status === 'dropped') {
    return (
      <>
        <Button variant="primary" disabled={busy} onClick={() => onStatus('considering')}>重新考慮</Button>
        <Button variant="secondary" disabled={busy} onClick={onEdit}>編輯</Button>
        <Button variant="ghost" className="ml-auto text-[13px] font-normal text-rose-deep" disabled={busy} onClick={onDelete}>永久刪除</Button>
      </>
    )
  }
  return (
    <>
      <Button variant="primary" disabled={busy} onClick={onBought}><Icon name="check" />移至已購買</Button>
      <ButtonLink to="/wishlist/compare" variant="secondary">到比較試搭台混搭</ButtonLink>
      <Button variant="secondary" disabled={busy} onClick={onEdit}>編輯</Button>
      <Button variant="ghost" className="ml-auto text-[13px] font-normal" disabled={busy} onClick={() => onStatus('dropped')}>放棄購買</Button>
      <Button variant="ghost" aria-label={`永久刪除「${item.name}」`} className="w-11 px-0 text-rose-deep" disabled={busy} onClick={onDelete}><Icon name="x" /></Button>
    </>
  )
}

const AREA_BY_SLOT: Record<string, string> = { outer: 'side', bag: 'side', acc: 'side', top: 'top', bottom: 'bottom', shoes: 'shoes' }

function LookPreview({ cells, title }: { cells: LookCell[]; title: string }) {
  const hasSide = cells.some((cell) => AREA_BY_SLOT[cell.slot] === 'side')
  return (
    <div className="flex flex-col gap-2.5 rounded-card border-[1.5px] border-line p-3">
      <div
        className="grid h-[220px] gap-1.5"
        style={
          hasSide
            ? { gridTemplateColumns: '1fr 1.2fr', gridTemplateRows: '1fr 1fr .7fr', gridTemplateAreas: "'side top' 'side bottom' '. shoes'" }
            : { gridTemplateColumns: '1fr', gridTemplateRows: '1fr 1fr .7fr', gridTemplateAreas: "'top' 'bottom' 'shoes'" }
        }
      >
        {cells.map((cell) => (
          <div
            key={cell.slot}
            className={`relative flex items-center justify-center overflow-hidden rounded-btn bg-paper ${cell.isWish ? 'outline-2 -outline-offset-2 outline-dashed outline-rose-deep' : ''}`}
            style={{ gridArea: AREA_BY_SLOT[cell.slot] }}
          >
            <span aria-hidden="true" className="absolute inset-[12%] rounded-tile mix-blend-multiply" style={{ background: SLOT_META[cell.slot].wash }} />
            <ItemImage name={cell.name} cutoutUrl={cell.cutoutUrl} shape={cell.shape} colorHex={cell.colorHex} className="relative aspect-square h-[82%]" />
          </div>
        ))}
      </div>
      <span className="text-[13px] font-medium">{title}</span>
      <span className="-mt-1.5 text-xs text-ink-2">{cells.filter((c) => !c.isWish).map((c) => c.name).join('、')}</span>
    </div>
  )
}
