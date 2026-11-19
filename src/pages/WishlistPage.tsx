import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ItemImage } from '@/components/closet/ItemImage'
import { DestructiveActionDialog } from '@/components/ui/B10States'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Checkbox, CheckboxMark } from '@/components/ui/Checkbox'
import { Icon } from '@/components/ui/Icon'
import { MarkdownNote } from '@/components/ui/MarkdownNote'
import { LoadingState, PageState } from '@/components/ui/PageState'
import { TiltLabel } from '@/components/ui/Paper'
import { Toast, type ToastMessage } from '@/components/ui/Toast'
import { BoughtDialog } from '@/components/wishlist/BoughtDialog'
import { CompareSelectionDialog } from '@/components/wishlist/CompareSelectionDialog'
import { WishlistAiPanel } from '@/components/wishlist/WishlistAiPanel'
import { WishlistCompareMenu } from '@/components/wishlist/WishlistCompareMenu'
import { WishlistFilters } from '@/components/wishlist/WishlistFilters'
import { WishlistForm } from '@/components/wishlist/WishlistForm'
import { WishlistTabs } from '@/components/wishlist/WishlistTabs'
import {
  createWishlistItem,
  createCompareWithItems,
  deleteWishlistItem,
  fetchAllWishlist,
  fetchClosetItems,
  fetchCompareGroups,
  fetchCompareMemberships,
  fetchProfileData,
  markWishlistBought,
  addWishlistItemsToCompare,
  removeWishlistItemFromCompare,
  setWishlistStatus,
  updateWishlistItem,
} from '@/lib/data'
import { SLOT_META, SLOTS } from '@/lib/slots'
import { FLAT_LABELS } from '@/lib/review'
import { formatStretch } from '@/lib/stretch'
import { useIsMobile } from '@/lib/useIsMobile'
import {
  ACTIVE_STATUSES,
  applyWishFacets,
  formatAddedDate,
  formatNT,
  garmentLengthName,
  garmentTypeOf,
  isActiveWish,
  normalizeFacets,
  OVERLAP_LABEL,
  PRIORITY_LABEL,
  totalPrice,
  typeKey,
  WISH_STATUS,
  WISH_TABS,
  wishInsights,
  type LookCell,
  type WishFacets,
} from '@/lib/wishlist'
import { defaultAiIncludes, flatMeasurementEntries, flatMeasurementText, type AiInclude } from '@/lib/wishlistAi'
import type { BodyMeasurement, BodyProfile, ClosetItem, CompareGroup, GarmentLength, Slot, WishlistInput, WishlistItem, WishStatus } from '@/types'

type TabKey = WishStatus | 'all'
type Dialog = { kind: 'create' } | { kind: 'edit'; item: WishlistItem } | { kind: 'bought'; item: WishlistItem } | { kind: 'delete'; item: WishlistItem } | null

const demoSuffix = (demo: boolean) => (demo ? '（示範模式，重新整理後會還原）' : '')

const isTabKey = (value: string | null): value is TabKey => !!value && WISH_TABS.some((t) => t.key === value)
const isPartKey = (value: string | null): value is Slot => !!value && SLOTS.some((s) => s.slot === value)
const isLengthKey = (value: string | null): value is GarmentLength => value === 'short' || value === 'mid' || value === 'long'

/** 讀網址的篩選；舊網址的單一 ?type=wide 會補上部位（只選一個部位時） */
function facetsFromParams(params: URLSearchParams): WishFacets {
  const list = (key: string) => (params.get(key) ?? '').split(',').map((value) => value.trim()).filter(Boolean)
  const parts = list('part').filter(isPartKey)
  const types = list('type').map((value) => (value.includes(':') || parts.length !== 1 ? value : typeKey(parts[0], value)))
  return normalizeFacets({ parts, types, lengths: list('length').filter(isLengthKey) })
}

const matchesTab = (item: WishlistItem, tab: TabKey) => (tab === 'all' ? item.status !== 'bought' : item.status === tab)
const partOf = (item: WishlistItem): Slot => item.primaryPart ?? item.slot

export function WishlistPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const tab: TabKey = isTabKey(params.get('status')) ? (params.get('status') as TabKey) : 'all'
  // 部位／類型／長度可多選，網址以逗號分隔：?part=bottom,top&type=bottom:wide&length=short,long
  const facets = useMemo(() => facetsFromParams(params), [params])
  const selectedParam = params.get('item')
  const isMobile = useIsMobile()

  const [items, setItems] = useState<WishlistItem[] | null>(null)
  const [closet, setCloset] = useState<ClosetItem[]>([])
  const [compareGroups, setCompareGroups] = useState<CompareGroup[]>([])
  const [compareMemberships, setCompareMemberships] = useState<Record<string, { groupId: string; groupName: string }[]>>({})
  const [bodyData, setBodyData] = useState<{ body: BodyMeasurement | null; bodyProfile: BodyProfile | null; allowBody: boolean }>({ body: null, bodyProfile: null, allowBody: true })
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [selecting, setSelecting] = useState(() => params.get('select') === '1')
  const [selectedForAi, setSelectedForAi] = useState<Set<string>>(() => new Set())
  const [compareDialogOpen, setCompareDialogOpen] = useState(false)
  const [aiInclude, setAiInclude] = useState<Set<AiInclude>>(defaultAiIncludes)
  const [aiSheetOpen, setAiSheetOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const closeToast = useCallback(() => setToast(null), [])

  const load = useCallback(() => {
    Promise.all([fetchAllWishlist(), fetchClosetItems(), fetchProfileData().catch(() => null), fetchCompareGroups().catch(() => []), fetchCompareMemberships().catch(() => ({}))])
      .then(([wish, closetItems, profileData, groups, memberships]) => {
        setItems(wish)
        setCloset(closetItems)
        setCompareGroups(groups)
        setCompareMemberships(memberships)
        if (profileData) {
          const latest = [...profileData.measurements].sort((a, b) => b.measuredOn.localeCompare(a.measuredOn))[0] ?? null
          setBodyData({ body: latest, bodyProfile: profileData.bodyProfile, allowBody: profileData.profile.aiUseBodyData })
        }
      })
      .catch((error: unknown) => setLoadError(error instanceof Error ? error : new Error(String(error))))
  }, [])

  useEffect(load, [load])

  const retry = () => {
    setLoadError(null)
    load()
  }

  const updateParams = (next: { status?: TabKey; facets?: WishFacets; item?: string | null }, replace = false) => {
    const p = new URLSearchParams(params)
    if (next.status !== undefined) {
      if (next.status === 'all') p.delete('status')
      else p.set('status', next.status)
    }
    if (next.facets) {
      const entries: [string, string[]][] = [['part', next.facets.parts], ['type', next.facets.types], ['length', next.facets.lengths]]
      for (const [key, values] of entries) {
        if (values.length) p.set(key, values.join(','))
        else p.delete(key)
      }
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

  // 篩選由上往下縮小：狀態 → 部位 → 類型；每一層的件數都以上一層的結果計算。
  const byStatus = useMemo(() => (items ?? []).filter((item) => matchesTab(item, tab)), [items, tab])
  const { partCounts, typeCounts, lengthCounts, visible } = useMemo(() => applyWishFacets(byStatus, facets), [byStatus, facets])

  const selectedAiItems = useMemo(() => (items ?? []).filter((item) => selectedForAi.has(item.id) && item.status !== 'bought'), [items, selectedForAi])
  const selectedVisibleCount = visible.filter((item) => selectedForAi.has(item.id)).length
  const allVisibleSelected = visible.length > 0 && selectedVisibleCount === visible.length
  const hiddenSelectedCount = selectedAiItems.length - selectedVisibleCount

  const toggleSelected = (id: string, on: boolean) =>
    setSelectedForAi((current) => {
      const next = new Set(current)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  // 只作用在目前篩選出來的商品；部分選取時先全選，再點一次才全部取消。
  const toggleAllVisible = () =>
    setSelectedForAi((current) => {
      const next = new Set(current)
      for (const item of visible) {
        if (allVisibleSelected) next.delete(item.id)
        else next.add(item.id)
      }
      return next
    })

  const finishSelecting = () => {
    setSelecting(false)
    setAiSheetOpen(false)
    setCompareDialogOpen(false)
    const next = new URLSearchParams(params)
    next.delete('select')
    next.delete('action')
    setParams(next, { replace: true })
  }

  const startSelecting = () => {
    setSelecting(true)
    const next = new URLSearchParams(params)
    next.set('select', '1')
    setParams(next, { replace: true })
  }

  const onAiCopied = ({ ok, count }: { ok: boolean; count: number }) =>
    setToast(ok ? { tone: 'success', text: `已複製 ${count} 件商品的整理文字，可以貼到 AI。` } : { tone: 'error', text: '瀏覽器沒有允許自動複製，請在預覽文字上全選後手動複製。' })

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

  const onCompareMembership = (item: WishlistItem, groupId: string, included: boolean) =>
    run(async () => {
      const currentMemberships = compareMemberships[item.id] ?? []
      const alreadyIncluded = currentMemberships.some((entry) => entry.groupId === groupId)
      if (included) await addWishlistItemsToCompare(groupId, [item.id])
      else await removeWishlistItemFromCompare(groupId, item.id)
      const group = compareGroups.find((entry) => entry.id === groupId)
      setCompareMemberships((current) => {
        const next = { ...current }
        const membership = current[item.id] ?? []
        next[item.id] = included
          ? [...membership.filter((entry) => entry.groupId !== groupId), { groupId, groupName: group?.name ?? '' }]
          : membership.filter((entry) => entry.groupId !== groupId)
        return next
      })
      const count = currentMemberships.length + (included && !alreadyIncluded ? 1 : !included && alreadyIncluded ? -1 : 0)
      setToast({ tone: 'success', text: included ? `已加入 ${count} 個比較。` : `已從比較移除，目前在 ${Math.max(0, count)} 個比較中。` })
    })

  const onCreateCompareFromItem = (item: WishlistItem) =>
    run(async () => {
      const part = item.primaryPart ?? item.slot
      const type = garmentTypeOf(item)
      const label = type ? garmentLengthName(type.id, item.garmentLength) ?? type.label : SLOT_META[part].label
      const { group, demo } = await createCompareWithItems(`${label} 1 件`, [item.id])
      setToast({ tone: 'success', text: `已建立「${group.name}」${demoSuffix(demo)}` })
      navigate(`/wishlist/compare/${group.id}`)
    })

  const onBought = (item: WishlistItem, purchase: { purchaseDate: string; paidPrice: number | null; colorFamilies: string[] }) =>
    run(async () => {
      const { itemIds, demo } = await markWishlistBought(item.id, purchase)
      replaceItem({ ...item, status: 'bought', boughtItemId: itemIds[0], boughtItemIds: itemIds })
        setSelectedForAi((current) => { const next = new Set(current); next.delete(item.id); return next })
      setDialog(null)
      setCloset((await fetchClosetItems().catch(() => null)) ?? closet)
      setToast({ tone: 'success', text: `已建立 ${itemIds.length} 件衣物，選購紀錄保留在「已購買」${demoSuffix(demo)}` })
    })

  const onDelete = (item: WishlistItem) =>
    run(async () => {
      const { demo } = await deleteWishlistItem(item.id)
      setItems((list) => (list ?? []).filter((entry) => entry.id !== item.id))
      setDialog(null)
      if (selectedParam === item.id) updateParams({ item: null }, true)
      setToast({ tone: 'success', text: `已刪除「${item.name}」${demoSuffix(demo)}` })
    })

  // 選取模式時手機不顯示詳細，只留列表、工具列與整理面板。
  const showDetailOnMobile = !selecting && !!selectedParam && !!selected
  const showAiAside = selecting && !isMobile

  return (
    <main className={`wishlist-page mx-auto flex max-w-[1320px] flex-col gap-5 px-[clamp(16px,3vw,40px)] pt-7 md:pb-14 ${selecting ? 'pb-44' : 'pb-24'}`}>
      <div className={`wishlist-page__header ${showDetailOnMobile ? 'hidden md:flex' : 'flex'} flex-wrap items-center gap-3.5`}>
        <TiltLabel accent="rose" as="h1">選購清單</TiltLabel>
        <WishlistTabs />
        {items && (
          <span className="font-num text-sm text-ink-2 tabular">
            進行中 {active.length} 件・預估合計 {formatNT(activeTotal)}
          </span>
        )}
        <div className="wishlist-page__actions ml-auto flex items-center gap-2">
          {items && items.length > 0 && (
            <Button variant={selecting ? 'ghost' : 'secondary'} aria-pressed={selecting} className={selecting ? 'md:hidden' : ''} onClick={() => (selecting ? finishSelecting() : startSelecting())}>
              {selecting ? '完成' : <><Icon name="check" size={18} />選取</>}
            </Button>
          )}
          <Button variant="oat" className="hidden md:inline-flex" onClick={() => setDialog({ kind: 'create' })}>
            <Icon name="plus" size={18} />
            加入選購
          </Button>
        </div>
      </div>

      {items && items.length > 0 && (
        <WishlistFilters
          className={showDetailOnMobile ? 'hidden md:flex' : 'flex'}
          status={tab}
          facets={facets}
          statusCounts={counts}
          partCounts={partCounts}
          typeCounts={typeCounts}
          lengthCounts={lengthCounts}
          onStatus={(status) => updateParams({ status, item: null }, true)}
          onFacets={(next) => updateParams({ facets: next, item: null }, true)}
        />
      )}

      {selecting && items && items.length > 0 && (
        <div role="toolbar" aria-label="選取" className="wishlist-select-bar fixed inset-x-3 bottom-[calc(72px+env(safe-area-inset-bottom)+12px)] z-20 flex items-center gap-1 rounded-[16px] bg-ink py-1.5 pr-1.5 pl-0.5 text-paper shadow-float md:sticky md:inset-x-auto md:top-2 md:bottom-auto md:z-10 md:rounded-card md:pr-2 md:pl-1 md:shadow-none">
          <Checkbox
            tone="dark"
            checked={allVisibleSelected}
            indeterminate={selectedVisibleCount > 0 && !allVisibleSelected}
            disabled={visible.length === 0}
            onCheckedChange={toggleAllVisible}
            label={`全選目前篩選的 ${visible.length} 件`}
          />
          <span className="min-w-0 text-[13px] leading-snug md:text-sm md:font-medium">
            全選{isMobile ? '' : '目前'} <b className="font-num tabular">{visible.length}</b> 件
            {isMobile && <span className="block text-[11px] opacity-75">已選 {selectedAiItems.length}</span>}
          </span>
          {!isMobile && (
            <>
              <span aria-hidden="true" className="mx-2.5 h-5 w-px bg-paper/30" />
              <span className="text-sm" aria-live="polite">
                已選 <b className="font-num tabular">{selectedAiItems.length}</b> 件
                {hiddenSelectedCount > 0 && <span className="text-xs opacity-75">（{hiddenSelectedCount} 件不在目前篩選中）</span>}
              </span>
              <Button type="button" variant="oat" disabled={!selectedAiItems.length} onClick={() => setCompareDialogOpen(true)}><Icon name="wish" size={17} />比較 {selectedAiItems.length} 件</Button>
              <button type="button" disabled={!selectedAiItems.length} onClick={() => setSelectedForAi(new Set())} className="h-11 rounded-btn bg-transparent px-2.5 text-[13px] font-medium text-mist-soft disabled:opacity-50">清除</button>
              <Button variant="ghost" className="ml-auto h-10 border-paper/40 text-paper hover:bg-ink-2" onClick={finishSelecting}>完成選取</Button>
            </>
          )}
          {isMobile && (
            <div className="ml-auto flex min-w-0 gap-1">
              <Button variant="secondary" className="h-10 min-w-0 px-2 text-xs" disabled={!selectedAiItems.length} onClick={() => setCompareDialogOpen(true)}>比較 {selectedAiItems.length}</Button>
              <Button variant="oat" className="h-10 min-w-0 px-2 text-xs" disabled={!selectedAiItems.length} onClick={() => setAiSheetOpen(true)}><Icon name="copy" size={16} />整理給 AI</Button>
            </div>
          )}
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
          action={<Button variant="primary" onClick={() => setDialog({ kind: 'create' })}><Icon name="plus" />加入第一件選購</Button>}
        />
      )}

      {items && items.length > 0 && (
        <div className="wishlist-page__body flex flex-wrap items-start gap-6">
          <section aria-label="商品列表" className={`wishlist-page__list ${showDetailOnMobile ? 'hidden md:flex' : 'flex'} min-w-0 flex-[1_1_360px] flex-col gap-3 md:max-w-[500px]`}>
            {visible.length === 0 && (
              <PageState icon="wish" tone="oat" compact title="沒有符合篩選的商品" description="換個狀態、部位或類型看看，或把新的候選加進來。" action={<Button variant="secondary" onClick={() => setParams(new URLSearchParams(), { replace: true })}>清除篩選</Button>} />
            )}
            {visible.map((item) => (
              <WishCard
                key={item.id}
                item={item}
                current={!selecting && selected?.id === item.id}
                similar={insightsById[item.id]?.overlap === 'high'}
                selecting={selecting}
                checked={item.status !== 'bought' && selectedForAi.has(item.id)}
                selectable={item.status !== 'bought'}
                onToggle={(on) => toggleSelected(item.id, on)}
                onSelect={() => updateParams({ item: item.id }, !!selectedParam)}
              />
            ))}
            {selecting && <p className="m-0 text-xs leading-[1.7] text-ink-2">選取模式下點整張卡片就是勾選；按「完成選取」回到一般模式，點卡片才會打開詳情。</p>}
          </section>

          {showAiAside && (
            <aside aria-labelledby="wishlist-ai-title" className="wishlist-page__ai-aside min-w-0 flex-[1_1_440px] rounded-card bg-card p-5 shadow-paper md:sticky md:top-16 md:max-w-[560px]">
              <WishlistAiPanel
                items={selectedAiItems}
                closet={closet}
                body={bodyData.body}
                bodyProfile={bodyData.bodyProfile}
                allowBody={bodyData.allowBody}
                include={aiInclude}
                onIncludeChange={setAiInclude}
                onCopied={onAiCopied}
              />
            </aside>
          )}

          {!selecting && selected && insights && (
            <WishDetail
              item={selected}
              insights={insights}
              busy={saving}
              compareGroups={compareGroups}
              compareGroupIds={(compareMemberships[selected.id] ?? []).map((entry) => entry.groupId)}
              className={showDetailOnMobile ? 'flex' : 'hidden md:flex'}
              onBack={() => updateParams({ item: null })}
              onEdit={() => setDialog({ kind: 'edit', item: selected })}
              onBought={() => setDialog({ kind: 'bought', item: selected })}
              onDelete={() => setDialog({ kind: 'delete', item: selected })}
              onStatus={(status) => void onStatus(selected, status)}
              onCompareToggle={(groupId, included) => void onCompareMembership(selected, groupId, included)}
              onNewCompare={() => void onCreateCompareFromItem(selected)}
            />
          )}
        </div>
      )}

      {/* 手機：底部固定主要按鈕（選取模式改由選取工具列取代） */}
      {items && !showDetailOnMobile && !selecting && (
        <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-20 border-t-[1.5px] border-dashed border-line-strong bg-paper p-3 md:hidden">
          <Button variant="oat" className="w-full" onClick={() => setDialog({ kind: 'create' })}>
            <Icon name="plus" />
            加入選購
          </Button>
        </div>
      )}

      {selecting && isMobile && aiSheetOpen && (
        <dialog
          ref={(element) => { if (element && !element.open) element.showModal() }}
          aria-labelledby="wishlist-ai-title"
          onClose={() => setAiSheetOpen(false)}
          onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close() }}
          className="wishlist-ai-sheet fixed inset-x-0 top-auto bottom-0 m-0 max-h-[88dvh] w-full max-w-none flex-col gap-3 overflow-y-auto rounded-t-[22px] border-0 bg-card px-4 pt-2 pb-7 text-ink shadow-sheet backdrop:bg-scrim open:flex"
        >
          <span aria-hidden="true" className="mx-auto h-1 w-10 flex-none rounded-sm bg-line-strong" />
          <WishlistAiPanel
            items={selectedAiItems}
            closet={closet}
            body={bodyData.body}
            bodyProfile={bodyData.bodyProfile}
            allowBody={bodyData.allowBody}
            include={aiInclude}
            onIncludeChange={setAiInclude}
            onCopied={(result) => { onAiCopied(result); if (result.ok) setAiSheetOpen(false) }}
            onClose={() => setAiSheetOpen(false)}
          />
        </dialog>
      )}

      {selecting && compareDialogOpen && <CompareSelectionDialog selectedItems={selectedAiItems} onClose={finishSelecting} onToast={(text) => setToast({ tone: 'success', text })} />}

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
      {dialog?.kind === 'bought' && <BoughtDialog key={dialog.item.id} item={dialog.item} saving={saving} onCancel={() => setDialog(null)} onConfirm={(purchase) => void onBought(dialog.item, purchase)} />}
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

function WishCard({
  item,
  current,
  similar,
  selecting,
  checked,
  selectable,
  onToggle,
  onSelect,
}: {
  item: WishlistItem
  current: boolean
  similar: boolean
  /** 選取模式：整張卡片就是勾選，不開詳情 */
  selecting: boolean
  checked: boolean
  selectable: boolean
  onToggle: (checked: boolean) => void
  onSelect: () => void
}) {
  const status = WISH_STATUS[item.status]
  const colorNames = item.colors?.map((color) => color.family).filter(Boolean).join('、')
  const meta = [item.brand ?? item.shop, item.size, colorNames ? `顏色 ${colorNames}` : null, item.priority ? `優先 ${PRIORITY_LABEL[item.priority]}` : null].filter(Boolean).join(' · ')
  const flatText = flatMeasurementText(item)
  const flatSummary = flatText ? `平放尺寸 ${flatText} cm` : null
  const type = garmentTypeOf(item)
  const typeLabel = type ? garmentLengthName(type.id, item.garmentLength) ?? type.label : null
  const partTag = `${SLOT_META[partOf(item)].label}${typeLabel ? `・${typeLabel}` : ''}`
  const cardBase = 'wish-card relative flex w-full gap-3.5 overflow-hidden rounded-card p-3 text-left text-ink'
  const content = (
    <>
      <span aria-hidden="true" className="wish-card__wash absolute -right-[18px] -bottom-[18px] size-16 rounded-[16px] mix-blend-multiply" style={{ background: SLOT_META[item.slot].wash, rotate: '12deg' }} />
      <span className="wish-card__thumb flex aspect-[4/5] w-[88px] flex-none items-center justify-center rounded-btn bg-rose-soft">
        <ItemImage name={item.name} cutoutUrl={item.cutoutUrl} shape={item.shape} colorHex={item.colorHex} className="h-[78%] w-[78%]" />
      </span>
      <span className="wish-card__info relative flex min-w-0 flex-1 flex-col justify-center gap-1.5">
        <span className="flex justify-between gap-2.5">
          <span className="min-w-0 text-[15px] font-medium">{item.name}</span>
          <span className="flex-none font-num text-[15px] font-bold tabular">{formatNT(item.price)}</span>
        </span>
        {meta && <span className="truncate text-xs text-ink-2">{meta}</span>}
        {flatSummary && <span className="line-clamp-2 text-[11px] leading-5 text-ink-2">{flatSummary}</span>}
        <span className="flex flex-wrap gap-1.5">
          <span className="inline-flex h-6 items-center rounded-full bg-oat-soft px-2.5 text-xs font-medium text-oat-ink">{partTag}</span>
          <span className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ${status.className}`}>
            <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
            {status.label}
          </span>
          {similar && isActiveWish(item) && <span className="inline-flex h-6 items-center rounded-full bg-rose-soft px-2.5 text-xs font-medium text-rose-ink">與現有單品相似</span>}
        </span>
      </span>
    </>
  )
  const dropped = item.status === 'dropped' ? 'opacity-70' : ''

  if (selecting) {
    return (
      <label className={`${cardBase} wish-card--select group/checkbox ${selectable ? 'cursor-pointer' : 'cursor-not-allowed opacity-65'} ${checked ? 'bg-card-selected shadow-[inset_0_0_0_2px_var(--color-ink)]' : 'bg-card shadow-paper'} ${dropped} has-[input:focus-visible]:outline-[2.5px] has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-mist-deep`}>
        <input type="checkbox" checked={checked} disabled={!selectable} onChange={(event) => onToggle(event.target.checked)} aria-label={`選取「${item.name}」`} className="sr-only" />
        <CheckboxMark checked={checked} disabled={!selectable} halo className="wish-card__check -ml-2 self-center md:absolute md:top-0 md:left-0 md:z-10 md:ml-0 md:self-auto" />
        {content}
      </label>
    )
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={current ? 'true' : undefined}
      className={`${cardBase} bg-card ${current ? 'border-2 border-ink' : 'border-[1.5px] border-dashed border-line-strong hover:border-ink-3'} ${dropped}`}
    >
      {content}
    </button>
  )
}

function WishDetail({
  item,
  insights,
  busy,
  compareGroups,
  compareGroupIds,
  className,
  onBack,
  onEdit,
  onBought,
  onDelete,
  onStatus,
  onCompareToggle,
  onNewCompare,
}: {
  item: WishlistItem
  insights: ReturnType<typeof wishInsights>
  busy: boolean
  compareGroups: CompareGroup[]
  compareGroupIds: string[]
  className: string
  onBack: () => void
  onEdit: () => void
  onBought: () => void
  onDelete: () => void
  onStatus: (status: WishlistInput['status']) => void
  onCompareToggle: (groupId: string, included: boolean) => void
  onNewCompare: () => void
}) {
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const lightboxRef = useRef<HTMLDialogElement>(null)
  const photos = item.photos ?? []
  const sizeEntries = flatMeasurementEntries(item)
  const selectedPhoto = photos.find((photo) => photo.id === selectedPhotoId) ?? photos.find((photo) => photo.isCover) ?? photos[0]
  const displayedImageUrl = selectedPhoto?.url ?? item.cutoutUrl
  const lightboxSlides = [
    ...photos.filter((photo) => photo.url).map((photo) => ({ id: photo.id, url: photo.url!, colorFamily: photo.colorFamily })),
    ...(item.cutoutUrl && !photos.some((photo) => photo.url === item.cutoutUrl) ? [{ id: `cutout-${item.id}`, url: item.cutoutUrl, colorFamily: undefined }] : []),
  ]
  const currentLightboxSlide = lightboxIndex === null ? null : lightboxSlides[lightboxIndex] ?? null

  useEffect(() => {
    const dialog = lightboxRef.current
    if (lightboxIndex !== null && dialog && !dialog.open) dialog.showModal()
  }, [lightboxIndex])

  function showLightboxImage(url: string) {
    const index = lightboxSlides.findIndex((photo) => photo.url === url)
    if (index >= 0) setLightboxIndex(index)
  }

  function moveLightboxImage(direction: -1 | 1) {
    setLightboxIndex((current) => current === null || lightboxSlides.length < 2 ? current : (current + direction + lightboxSlides.length) % lightboxSlides.length)
  }

  function handleLightboxKeyDown(event: React.KeyboardEvent<HTMLDialogElement>) {
    if (lightboxIndex === null || lightboxSlides.length < 2) return
    if (event.key === 'ArrowLeft') { event.preventDefault(); moveLightboxImage(-1) }
    else if (event.key === 'ArrowRight') { event.preventDefault(); moveLightboxImage(1) }
  }
  const status = WISH_STATUS[item.status]
  const activeItem = isActiveWish(item)
  const added = formatAddedDate(item.createdAt)
  const facts = [item.brand ?? item.shop, item.size ? `預計尺寸 ${item.size}` : null, added ? `加入於 ${added}` : null].filter(Boolean).join('・')
  const extra = [
    item.shipping !== undefined ? ['運費', item.shipping === 0 ? '免運' : formatNT(item.shipping)] : null,
    item.brand && item.shop !== item.brand ? ['店家', item.shop] : null,
    item.returnPolicy ? ['退換貨', item.returnPolicy] : null,
    item.material ? ['材質', item.material] : null,
    (item.colors?.length ? item.colors.map((color) => color.family).join('、') : item.colorName) ? ['顏色', item.colors?.map((color) => color.family).join('、') ?? item.colorName!] : null,
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
        {item.status !== 'bought' && <button type="button" disabled={busy} onClick={onEdit} aria-label={`編輯「${item.name}」`} title="編輯" className="absolute top-3 right-3 hidden size-11 items-center justify-center rounded-btn text-ink-2 hover:bg-tile hover:text-ink disabled:opacity-50 md:flex"><Icon name="edit" size={20} /></button>}

        <div className="flex flex-wrap gap-[22px]">
          <div className="mx-auto w-[200px] flex-none sm:mx-0">
            <div className="flex aspect-[4/5] items-center justify-center rounded-card border-[1.5px] border-dashed border-rose-edge bg-rose-soft">
              {displayedImageUrl ? <button type="button" onClick={() => showLightboxImage(displayedImageUrl)} aria-label="放大查看商品圖片" className="flex size-full cursor-zoom-in items-center justify-center rounded-card bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-mist-deep"><img src={displayedImageUrl} alt={`${item.name}商品圖片，點擊放大`} className="size-full rounded-card object-contain" /></button> : <ItemImage name={item.name} shape={item.shape} colorHex={item.colorHex} className="h-[74%] w-[74%]" />}
            </div>
            {photos.length > 1 && <div role="group" aria-label="商品圖片" className="mt-2 flex flex-wrap gap-2">{photos.map((photo, index) => <button key={photo.id} type="button" aria-label={`查看第 ${index + 1} 張商品圖片${photo.colorFamily ? `，${photo.colorFamily}色` : ''}`} aria-pressed={selectedPhoto?.id === photo.id} onClick={() => setSelectedPhotoId(photo.id)} className={`relative size-12 overflow-hidden rounded-sm border-[1.5px] bg-paper ${selectedPhoto?.id === photo.id ? 'border-ink' : 'border-line'}`}>{photo.url && <img src={photo.url} alt="" className="size-full object-cover" loading="lazy" />}{photo.colorFamily && <span className="absolute inset-x-0 bottom-0 truncate bg-card/90 px-0.5 text-[8px]">{photo.colorFamily}</span>}</button>)}</div>}
          </div>
          <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-2.5 md:pr-9">
            <span className={`inline-flex h-6 items-center gap-1.5 self-start rounded-full px-2.5 text-xs font-medium ${status.className}`}>
              <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
              {status.label}
            </span>
            <h2 className="m-0 font-hd text-[28px] leading-[1.3]">{item.name}</h2>
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="font-num text-[26px] font-bold tabular">{formatNT(item.price)}</span>
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
            {sizeEntries.length > 0 && <section aria-label="平放尺寸" className="space-y-2 rounded-btn bg-sage-soft p-3 text-sage-ink">
              <h3 className="m-0 text-xs font-medium">平放尺寸 <span className="font-normal">・cm・{SLOTS.find((slot) => slot.slot === (item.primaryPart ?? item.slot))?.label}</span></h3>
              <dl className="m-0 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {sizeEntries.map(([key, value]) => <div key={key} className="min-w-0 rounded-sm bg-card/75 px-2.5 py-2">
                  <dt className="truncate text-[11px] text-ink-2">{FLAT_LABELS[key] ?? key}</dt>
                  <dd className="m-0 font-num text-sm font-bold tabular text-ink">{formatStretch(value, item.flatStretch?.[key])}<span className="ml-1 text-[10px] font-normal text-ink-3">cm</span></dd>
                </div>)}
              </dl>
            </section>}
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

        <dialog
          ref={lightboxRef}
          aria-label="商品圖片放大檢視"
          onClose={() => setLightboxIndex(null)}
          onKeyDown={handleLightboxKeyDown}
          className="fixed inset-0 m-0 hidden h-dvh max-h-none w-screen max-w-none items-center justify-center border-0 bg-transparent p-4 open:flex backdrop:bg-scrim"
        >
          {currentLightboxSlide && <div className="relative flex max-h-full max-w-full items-center justify-center">
            <img src={currentLightboxSlide.url} alt={`${item.name}${currentLightboxSlide.colorFamily ? `・${currentLightboxSlide.colorFamily}` : ''}商品圖片`} className="max-h-[calc(100dvh-5rem)] max-w-[calc(100vw-2rem)] object-contain" />
            {lightboxSlides.length > 1 && <>
              <button type="button" aria-label="上一張圖片" onClick={() => moveLightboxImage(-1)} className="absolute left-2 top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-card/95 text-ink shadow-float sm:-left-16"><Icon name="back" size={24} /></button>
              <button type="button" aria-label="下一張圖片" onClick={() => moveLightboxImage(1)} className="absolute right-2 top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-card/95 text-ink shadow-float sm:-right-16"><Icon name="next" size={24} /></button>
              <p aria-live="polite" className="absolute -bottom-12 left-1/2 m-0 -translate-x-1/2 rounded-full bg-card/95 px-3 py-1 text-sm text-ink">第 {lightboxIndex! + 1} 張／共 {lightboxSlides.length} 張</p>
            </>}
            <button type="button" autoFocus aria-label="關閉圖片放大檢視" onClick={() => lightboxRef.current?.close()} className="absolute -right-2 -top-2 flex size-11 items-center justify-center rounded-full bg-card text-ink shadow-float"><Icon name="x" /></button>
          </div>}
        </dialog>

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
            <span className="text-xs">{insights.closest ? `最接近：${insights.closest.name}` : `衣櫃裡沒有${insights.compareLabel}`}</span>
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
          <DetailActions item={item} busy={busy} compareGroups={compareGroups} compareGroupIds={compareGroupIds} onBought={onBought} onDelete={onDelete} onStatus={onStatus} onCompareToggle={onCompareToggle} onNewCompare={onNewCompare} />
        </div>
        {activeItem && <span className="-mt-3.5 hidden text-xs text-ink-2 md:block">移至已購買時，名稱、圖片、品牌與尺寸都會帶過去，只需補購買日期與實付價格。</span>}

        {/* 手機：次要動作放內容底部 */}
        <div className="flex flex-col gap-2 border-t-[1.5px] border-dashed border-line-strong pt-4 md:hidden">
          {activeItem && <WishlistCompareMenu item={item} groups={compareGroups} groupIds={compareGroupIds} disabled={busy} onToggle={onCompareToggle} onCreate={onNewCompare} />}
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

function DetailActions({ item, busy, compareGroups, compareGroupIds, onBought, onDelete, onStatus, onCompareToggle, onNewCompare }: { item: WishlistItem; busy: boolean; compareGroups: CompareGroup[]; compareGroupIds: string[]; onBought: () => void; onDelete: () => void; onStatus: (status: WishlistInput['status']) => void; onCompareToggle: (groupId: string, included: boolean) => void; onNewCompare: () => void }) {
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
        <Button variant="ghost" className="ml-auto text-[13px] font-normal text-rose-deep" disabled={busy} onClick={onDelete}>永久刪除</Button>
      </>
    )
  }
  return (
    <>
      <Button variant="primary" disabled={busy} onClick={onBought}><Icon name="check" />移至已購買</Button>
      <WishlistCompareMenu item={item} groups={compareGroups} groupIds={compareGroupIds} disabled={busy} onToggle={onCompareToggle} onCreate={onNewCompare} />
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
