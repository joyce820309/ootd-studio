import { useCallback, useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ItemImage } from '@/components/closet/ItemImage'
import { OutfitBoard, type BoardPiece } from '@/components/outfit/OutfitBoard'
import { DestructiveActionDialog } from '@/components/ui/B10States'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Icon } from '@/components/ui/Icon'
import { LoadingState, PageState } from '@/components/ui/PageState'
import { TiltLabel } from '@/components/ui/Paper'
import { Toast, type ToastMessage } from '@/components/ui/Toast'
import { BoughtDialog } from '@/components/wishlist/BoughtDialog'
import { CompareGroupDialog } from '@/components/wishlist/CompareGroupDialog'
import { WishlistForm } from '@/components/wishlist/WishlistForm'
import { WishlistTabs } from '@/components/wishlist/WishlistTabs'
import {
  createCompareGroup,
  createWishlistItem,
  deleteCompareGroup,
  fetchCompareClosetItems,
  fetchClosetItems,
  fetchCompareGroups,
  fetchWishlist,
  markWishlistBought,
  saveOutfit,
  setWishlistGroup,
  setCompareClosetItem,
  setWishlistStatus,
  updateCompareGroup,
} from '@/lib/data'
import { todayISO } from '@/lib/date'
import { isWearable, REQUIRED_SLOTS, SLOT_META, SLOTS } from '@/lib/slots'
import { colorsGoTogether, formatNT, OVERLAP_LABEL, totalPrice, WISH_STATUS, wishInsights, type WishInsights } from '@/lib/wishlist'
import type { ClosetItem, CompareGroup, CompareGroupInput, OutfitPick, Slot, WishlistInput, WishlistItem } from '@/types'

type BoardPick = { kind: 'closet'; id: string } | { kind: 'wish'; id: string }

type Dialog =
  | { kind: 'add'; url: string }
  | { kind: 'pick' }
  | { kind: 'pick-closet' }
  | { kind: 'group-new' }
  | { kind: 'group-edit'; group: CompareGroup }
  | { kind: 'group-delete'; group: CompareGroup }
  | { kind: 'bought'; item: WishlistItem }
  | { kind: 'mix' }
  | null

type SizeTone = 'ok' | 'warn' | 'plain'

interface Candidate {
  item: WishlistItem
  source: 'wishlist' | 'closet'
  key: string
  total: number
  insights: WishInsights
  sizeText: string
  sizeTone: SizeTone
  overBudget: boolean
  cheapest: boolean
  mostMatch: boolean
}

const demoSuffix = (demo: boolean) => (demo ? '（示範模式，重新整理後會還原）' : '')

function sizeInfo(item: WishlistItem): { text: string; tone: SizeTone } {
  const text = item.sizeNote ?? item.size ?? '未填'
  if (/只剩|缺|無貨|售完|調貨|預購|沒有/.test(text)) return { text, tone: 'warn' }
  if (/有貨|現貨/.test(text)) return { text, tone: 'ok' }
  return { text, tone: 'plain' }
}

const SIZE_CLASS: Record<SizeTone, string> = { ok: 'text-sage-deep', warn: 'text-rose-deep', plain: 'text-ink' }
const EMPTY_CLOSET_CANDIDATE_IDS: string[] = []

function overlapText(insights: WishInsights) {
  const short = OVERLAP_LABEL[insights.overlap].replace('重複度', '')
  return insights.overlap !== 'low' && insights.closest ? `${short}・像${insights.closest.name}` : short
}

/** 只有在候選之間真的有差別時才標「最省」「最多」。 */
function buildCandidates(items: WishlistItem[], closet: ClosetItem[], closetItemIds: string[], budget?: number): Candidate[] {
  const base = items.map((item) => {
    const size = sizeInfo(item)
    const total = totalPrice(item)
    return { item, source: 'wishlist' as const, key: `wish:${item.id}`, total, insights: wishInsights(item, closet), sizeText: size.text, sizeTone: size.tone, overBudget: budget !== undefined && total > budget }
  })
  const closetCandidates = closet.filter((item) => closetItemIds.includes(item.id)).map((closetItem) => {
    const item: WishlistItem = {
      id: closetItem.id,
      name: closetItem.name,
      slot: closetItem.slot,
      colorHex: closetItem.colorHex,
      colorName: closetItem.colorName,
      shop: closetItem.store || '我的衣櫃',
      url: closetItem.productUrl,
      price: closetItem.purchasePrice ?? 0,
      size: closetItem.size,
      sizeNote: closetItem.size,
      brand: closetItem.brand,
      material: closetItem.material,
      status: 'bought',
      cutoutUrl: closetItem.cutoutUrl,
      shape: closetItem.shape,
    }
    const size = sizeInfo(item)
    return {
      item,
      source: 'closet' as const,
      key: `closet:${closetItem.id}`,
      total: 0,
      insights: wishInsights(item, closet.filter((candidate) => candidate.id !== closetItem.id)),
      sizeText: size.text,
      sizeTone: size.tone,
      overBudget: false,
    }
  })
  const all = [...base, ...closetCandidates]
  const totals = base.map((c) => c.total)
  const matches = all.map((c) => c.insights.matchCount)
  const minTotal = Math.min(...totals)
  const maxMatch = Math.max(...matches)
  const totalsDiffer = new Set(totals).size > 1
  const matchesDiffer = new Set(matches).size > 1
  return all.map((c) => ({
    ...c,
    cheapest: c.source === 'wishlist' && totalsDiffer && c.total === minTotal,
    mostMatch: matchesDiffer && c.insights.matchCount === maxMatch,
  }))
}

/** 依資料整理的比較重點（不是 AI）。 */
function compareNotes(candidates: Candidate[]): string[] {
  if (candidates.length < 2) return []
  const notes: string[] = []
  const most = candidates.filter((c) => c.mostMatch)
  if (most.length === 1) notes.push(`${most[0].source === 'closet' ? '衣櫃現有品項' : most[0].item.shop}的「${most[0].item.name}」衣櫃可搭件數最多（${most[0].insights.matchCount} 件）。`)
  const cheap = candidates.filter((c) => c.cheapest)
  if (cheap.length === 1) notes.push(`${cheap[0].item.shop}最省，含運 ${formatNT(cheap[0].total)}。`)
  for (const c of candidates) {
    if (c.sizeTone === 'warn') notes.push(`${c.item.shop}那件尺寸「${c.sizeText}」，下單前先問清楚。`)
    if (c.overBudget) notes.push(`${c.item.shop}含運 ${formatNT(c.total)}，超出預算。`)
    if (c.source === 'wishlist' && c.insights.overlap === 'high' && c.insights.closest) notes.push(`${c.item.shop}那件跟你的「${c.insights.closest.name}」很像，買了可能重複。`)
  }
  return notes
}

export function ComparePage() {
  const [params, setParams] = useSearchParams()
  const [groups, setGroups] = useState<CompareGroup[] | null>(null)
  const [wishes, setWishes] = useState<WishlistItem[]>([])
  const [closet, setCloset] = useState<ClosetItem[]>([])
  const [closetCandidateIdsByGroup, setClosetCandidateIdsByGroup] = useState<Record<string, string[]>>({})
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [tryIdByGroup, setTryIdByGroup] = useState<Record<string, string>>({})
  const [overrides, setOverrides] = useState<Partial<Record<Slot, BoardPick | null>>>({})
  const [urlInput, setUrlInput] = useState('')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const closeToast = useCallback(() => setToast(null), [])

  const load = useCallback(() => {
    Promise.all([fetchCompareGroups(), fetchWishlist(), fetchClosetItems(), fetchCompareClosetItems()])
      .then(([g, w, c, closetGroupItems]) => {
        setGroups(g)
        setWishes(w)
        setCloset(c)
        setClosetCandidateIdsByGroup(closetGroupItems)
      })
      .catch((error: unknown) => setLoadError(error instanceof Error ? error : new Error(String(error))))
  }, [])
  useEffect(load, [load])
  const retry = () => {
    setLoadError(null)
    load()
  }

  const group = groups?.find((g) => g.id === params.get('group')) ?? groups?.[0] ?? null
  const selectGroup = (id: string) => {
    const p = new URLSearchParams(params)
    p.set('group', id)
    setParams(p, { replace: true })
  }

  const countByGroup = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const w of wishes) if (w.compareGroupId) counts[w.compareGroupId] = (counts[w.compareGroupId] ?? 0) + 1
    for (const [groupId, itemIds] of Object.entries(closetCandidateIdsByGroup)) counts[groupId] = (counts[groupId] ?? 0) + itemIds.length
    return counts
  }, [wishes, closetCandidateIdsByGroup])

  const groupItems = useMemo(() => (group ? wishes.filter((w) => w.compareGroupId === group.id) : []), [wishes, group])
  const groupClosetItemIds = group ? closetCandidateIdsByGroup[group.id] ?? EMPTY_CLOSET_CANDIDATE_IDS : EMPTY_CLOSET_CANDIDATE_IDS
  const candidates = useMemo(() => buildCandidates(groupItems, closet, groupClosetItemIds, group?.budget), [groupItems, closet, groupClosetItemIds, group?.budget])
  const tryCand = candidates.find((c) => c.key === (group ? tryIdByGroup[group.id] : undefined)) ?? candidates[0] ?? null
  const tryItem = tryCand?.item ?? null
  const notes = useMemo(() => compareNotes(candidates), [candidates])

  const closetById = useMemo(() => new Map(closet.map((c) => [c.id, c])), [closet])
  const wishById = useMemo(() => new Map(wishes.map((w) => [w.id, w])), [wishes])

  // 預設搭配：每個部位挑配色合得來、穿最多次的可穿衣物（配件不預設）。
  const defaults = useMemo(() => {
    const out: Partial<Record<Slot, BoardPick | null>> = {}
    for (const { slot } of SLOTS) {
      if (slot === 'acc') continue
      const options = closet
        .filter((c) => c.slot === slot && isWearable(c.status))
        .sort((a, b) => {
          const fit = (c: ClosetItem) => (tryItem && colorsGoTogether(c.colorHex, tryItem.colorHex) ? 1 : 0)
          return fit(b) - fit(a) || (b.wearCount ?? 0) - (a.wearCount ?? 0)
        })
      out[slot] = options[0] ? { kind: 'closet', id: options[0].id } : null
    }
    return out
  }, [closet, tryItem])

  const pickFor = (slot: Slot): BoardPick | null => {
    if (tryItem && tryCand && slot === tryItem.slot) return tryCand.source === 'closet' ? { kind: 'closet', id: tryItem.id } : { kind: 'wish', id: tryItem.id }
    const chosen = slot in overrides ? overrides[slot] ?? null : defaults[slot] ?? null
    // 被淘汰或已購買而消失的單品就略過
    if (chosen?.kind === 'wish' && !wishById.has(chosen.id)) return null
    if (chosen?.kind === 'closet' && !closetById.has(chosen.id)) return null
    return chosen
  }
  const setPick = (slot: Slot, pick: BoardPick | null) => setOverrides((o) => ({ ...o, [slot]: pick }))

  const picks = Object.fromEntries(SLOTS.map((s) => [s.slot, pickFor(s.slot)])) as Record<Slot, BoardPick | null>
  const pieces: Partial<Record<Slot, BoardPiece>> = {}
  const unbought: WishlistItem[] = []
  for (const { slot } of SLOTS) {
    const pick = picks[slot]
    if (!pick) continue
    if (pick.kind === 'closet') {
      const c = closetById.get(pick.id)!
      pieces[slot] = { name: c.name, colorHex: c.colorHex, cutoutUrl: c.cutoutUrl, shape: c.shape }
    } else {
      const w = wishById.get(pick.id)!
      pieces[slot] = { name: w.name, colorHex: w.colorHex, cutoutUrl: w.cutoutUrl, shape: w.shape, isWish: true }
      unbought.push(w)
    }
  }
  const unboughtTotal = unbought.reduce((sum, w) => sum + totalPrice(w), 0)
  const missing = REQUIRED_SLOTS.filter((s) => !picks[s]).map((s) => SLOT_META[s].label)

  const run = async (action: () => Promise<void>) => {
    setSaving(true)
    try {
      await action()
    } catch (error) {
      setToast({ tone: 'error', text: error instanceof Error ? `沒有完成：${error.message}` : '沒有完成，請稍後再試。' })
    } finally {
      setSaving(false)
    }
  }

  const tryOn = (key: string) => group && setTryIdByGroup((m) => ({ ...m, [group.id]: key }))

  const onAddCandidate = (input: WishlistInput) =>
    run(async () => {
      if (!group) return
      const { item, demo } = await createWishlistItem({ ...input, compareGroupId: group.id })
      setWishes((list) => [item, ...list])
      tryOn(`wish:${item.id}`)
      setUrlInput('')
      setDialog(null)
      setToast({ tone: 'success', text: `已加入「${group.title}」${demoSuffix(demo)}` })
    })

  const onPickExisting = (item: WishlistItem) =>
    run(async () => {
      if (!group) return
      const { demo } = await setWishlistGroup(item.id, group.id)
      setWishes((list) => list.map((w) => (w.id === item.id ? { ...w, compareGroupId: group.id } : w)))
      tryOn(`wish:${item.id}`)
      setDialog(null)
      setToast({ tone: 'success', text: `「${item.name}」已加入比較${demoSuffix(demo)}` })
    })

  const onPickExistingCloset = (item: ClosetItem) =>
    run(async () => {
      if (!group) return
      const { demo } = await setCompareClosetItem(group.id, item.id, true)
      setClosetCandidateIdsByGroup((current) => ({ ...current, [group.id]: [...new Set([...(current[group.id] ?? []), item.id])] }))
      tryOn(`closet:${item.id}`)
      setDialog(null)
      setToast({ tone: 'success', text: `衣櫃品項「${item.name}」已加入比較${demoSuffix(demo)}` })
    })

  const onEliminate = (candidate: Candidate) =>
    run(async () => {
      if (candidate.source === 'closet') {
        if (!group) return
        const { demo } = await setCompareClosetItem(group.id, candidate.item.id, false)
        setClosetCandidateIdsByGroup((current) => ({ ...current, [group.id]: (current[group.id] ?? []).filter((id) => id !== candidate.item.id) }))
        setTryIdByGroup((current) => {
          if (current[group.id] !== candidate.key) return current
          const next = { ...current }
          delete next[group.id]
          return next
        })
        setToast({ tone: 'success', text: `已將「${candidate.item.name}」移出比較；衣櫃中的衣物保留${demoSuffix(demo)}` })
        return
      }
      const { demo } = await setWishlistStatus(candidate.item.id, 'dropped')
      setWishes((list) => list.filter((w) => w.id !== candidate.item.id))
      setToast({ tone: 'success', text: `已淘汰「${candidate.item.name}」，可在選購清單的「已放棄」找回${demoSuffix(demo)}` })
    })

  const onSaveGroup = (input: CompareGroupInput) =>
    run(async () => {
      if (dialog?.kind === 'group-edit') {
        const { group: updated, demo } = await updateCompareGroup(dialog.group.id, input)
        setGroups((list) => (list ?? []).map((g) => (g.id === updated.id ? updated : g)))
        setToast({ tone: 'success', text: `已更新群組${demoSuffix(demo)}` })
      } else {
        const { group: created, demo } = await createCompareGroup(input)
        setGroups((list) => [created, ...(list ?? [])])
        selectGroup(created.id)
        setToast({ tone: 'success', text: `已建立「${created.title}」，貼上商品網址加入候選吧${demoSuffix(demo)}` })
      }
      setDialog(null)
    })

  const onDeleteGroup = (target: CompareGroup) =>
    run(async () => {
      const { demo } = await deleteCompareGroup(target.id)
      setGroups((list) => (list ?? []).filter((g) => g.id !== target.id))
      setWishes((list) => list.map((w) => (w.compareGroupId === target.id ? { ...w, compareGroupId: undefined } : w)))
      setClosetCandidateIdsByGroup((current) => { const next = { ...current }; delete next[target.id]; return next })
      const p = new URLSearchParams(params)
      p.delete('group')
      setParams(p, { replace: true })
      setDialog(null)
      setToast({ tone: 'success', text: `已刪除群組，候選商品仍在選購清單${demoSuffix(demo)}` })
    })

  const onBought = (item: WishlistItem, purchase: { purchaseDate: string; paidPrice: number | null }) =>
    run(async () => {
      const { demo } = await markWishlistBought(item.id, purchase)
      setWishes((list) => list.filter((w) => w.id !== item.id))
      setCloset((await fetchClosetItems().catch(() => null)) ?? closet)
      setDialog(null)
      setToast({ tone: 'success', text: `「${item.name}」已放進衣櫃；其他候選仍保留，不需要的可以淘汰${demoSuffix(demo)}` })
    })

  const onSaveOutfit = () =>
    run(async () => {
      if (!group) return
      const outfitPicks: Partial<Record<Slot, OutfitPick>> = {}
      for (const { slot } of SLOTS) {
        const pick = picks[slot]
        if (pick) outfitPicks[slot] = pick.kind === 'closet' ? { kind: 'closet', itemId: pick.id } : { kind: 'wish', wishId: pick.id }
      }
      const { demo } = await saveOutfit({
        name: `${unbought.length > 0 ? '如果買了' : '試搭'}・${group.title}`,
        date: todayISO(),
        template: 'full',
        picks: outfitPicks,
        isHypothetical: unbought.length > 0,
      })
      setToast({ tone: 'success', text: demo ? '示範模式：穿搭不會真的儲存。' : unbought.length > 0 ? '已存成「如果買了」穿搭，不會計入穿著次數。' : '已存成穿搭。' })
    })

  const openAdd = (url = '') => setDialog({ kind: 'add', url: url.trim() })
  const submitUrl = (event: FormEvent) => {
    event.preventDefault()
    openAdd(urlInput)
  }

  const ungrouped = wishes.filter((w) => !w.compareGroupId)
  const availableClosetItems = closet.filter((item) => !groupClosetItemIds.includes(item.id))
  const candidateCount = groupItems.length + groupClosetItemIds.length
  const subtitle = group ? `${candidateCount} 個候選・${groupItems.length} 個網拍${groupClosetItemIds.length ? `・衣櫃 ${groupClosetItemIds.length} 件` : ''}${group.budget !== undefined ? `・預算 ${formatNT(group.budget)} 以內` : ''}` : ''
  const canSave = !!tryItem && missing.length === 0

  return (
    <main className="mx-auto flex max-w-[1360px] flex-col gap-5 px-[clamp(16px,3vw,40px)] pt-6 pb-24 md:pb-14">
      {/* 手機頁首 */}
      <div className="-mx-4 -mt-6 flex items-center gap-1 border-b-[1.5px] border-dashed border-line-strong py-2 pr-2 pl-1 md:hidden">
        <Link to="/wishlist" aria-label="返回選購清單" className="flex size-11 flex-none items-center justify-center text-ink">
          <Icon name="back" />
        </Link>
        <div className="flex min-w-0 flex-col">
          <h1 className="m-0 truncate font-hd text-lg">{group?.title ?? '比較試搭台'}</h1>
          {group && <span className="text-[11px] text-ink-2">{candidateCount} 個候選・{groupItems.length} 個網拍{groupClosetItemIds.length ? `・衣櫃 ${groupClosetItemIds.length} 件` : ''}</span>}
        </div>
        {group && (
          <>
            <button type="button" aria-label="編輯群組" onClick={() => setDialog({ kind: 'group-edit', group })} className="ml-auto flex size-11 flex-none items-center justify-center rounded-btn bg-transparent text-ink-2">
              <Icon name="more" />
            </button>
            <button type="button" aria-label="貼上網址加入候選" onClick={() => openAdd()} className="flex size-11 flex-none items-center justify-center rounded-btn bg-oat text-ink">
              <Icon name="plus" />
            </button>
          </>
        )}
      </div>

      {/* 桌面頁首 */}
      <div className="hidden flex-wrap items-center gap-3.5 md:flex">
        <WishlistTabs />
        <span className="text-[13px] text-ink-2">把不同網站的類似商品放在一起比，再和衣櫃、其他想買的單品混搭看看</span>
      </div>

      {!groups && !loadError && <LoadingState label="正在準備比較試搭台…" />}
      {loadError && (
        <div role="alert">
          <PageState icon="alert" tone="rose" compact title="比較試搭台暫時打不開" description="資料讀取沒有成功，候選與群組都不會被更動。確認連線後可以再試一次。" action={<Button variant="secondary" onClick={retry}>重新載入</Button>} />
        </div>
      )}

      {groups && (
        <div role="group" aria-label="比較群組" className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
          <span className="mr-1 hidden flex-none text-[13px] font-medium md:inline">比較群組</span>
          {groups.map((g) => (
            <Chip key={g.id} selected={group?.id === g.id} onClick={() => selectGroup(g.id)} className="h-11 flex-none md:h-[38px]">
              {g.title}
              <span className="font-num tabular opacity-75">{countByGroup[g.id] ?? 0}</span>
            </Chip>
          ))}
          <button
            type="button"
            onClick={() => setDialog({ kind: 'group-new' })}
            className="inline-flex h-11 flex-none items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-line-strong bg-card px-3.5 text-[13px] font-medium text-mist-deep md:h-[38px]"
          >
            <Icon name="plus" size={16} />
            新群組
          </button>
        </div>
      )}

      {groups && groups.length === 0 && (
        <PageState
          icon="search"
          tone="rose"
          title="還沒有比較群組"
          description="猶豫要買哪一件時，先建一個群組，例如「冬天想要一條寬褲」，再把不同網站的候選貼進來並排比較。"
          action={<Button variant="primary" onClick={() => setDialog({ kind: 'group-new' })}><Icon name="plus" />建立第一個群組</Button>}
        />
      )}

      {group && (
        <>
          {/* 桌面：群組標題與加入候選 */}
          <div className="hidden flex-wrap items-center gap-3.5 md:flex">
            <TiltLabel accent="rose" as="h1">{group.title}</TiltLabel>
            <button type="button" aria-label="編輯群組" onClick={() => setDialog({ kind: 'group-edit', group })} className="-ml-1.5 flex size-11 items-center justify-center rounded-btn bg-transparent text-ink-2 hover:bg-tile">
              <Icon name="more" />
            </button>
            <span className="font-num text-[13px] text-ink-2 tabular">{subtitle}</span>
            <form onSubmit={submitUrl} className="ml-auto flex flex-wrap gap-2">
              <label className="relative flex items-center">
                <span className="sr-only">貼上商品網址加入候選</span>
                <span className="pointer-events-none absolute left-3 text-ink-3"><Icon name="link" size={18} /></span>
                <input
                  type="url"
                  inputMode="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="貼上商品網址加入候選"
                  className="h-11 w-[280px] rounded-btn border-[1.5px] border-line-strong bg-card pr-3 pl-[38px] text-sm text-ink placeholder:text-ink-3"
                />
              </label>
              <Button type="submit" variant="oat">加入</Button>
              <Button variant="secondary" onClick={() => setDialog({ kind: 'pick' })} disabled={ungrouped.length === 0} title={ungrouped.length === 0 ? '選購清單裡沒有未分組的商品' : undefined}>
                從清單挑
              </Button>
              <Button variant="secondary" onClick={() => setDialog({ kind: 'pick-closet' })} disabled={availableClosetItems.length === 0} title={availableClosetItems.length === 0 ? '沒有其他可加入的衣櫃品項' : undefined}>
                從衣櫃挑
              </Button>
            </form>
          </div>

          {candidates.length === 0 ? (
            <PageState
              icon="wish"
              tone="oat"
              title="這個群組還沒有候選"
              description="貼上不同網站的商品網址，或從選購清單挑現有的商品加進來。兩件以上就能並排比較。"
              action={
                <>
                  <Button variant="primary" onClick={() => openAdd()}><Icon name="link" />貼上商品網址</Button>
                  {ungrouped.length > 0 && <Button variant="secondary" onClick={() => setDialog({ kind: 'pick' })}>從選購清單挑</Button>}
                  {availableClosetItems.length > 0 && <Button variant="secondary" onClick={() => setDialog({ kind: 'pick-closet' })}>從衣櫃挑</Button>}
                </>
              }
            />
          ) : (
            <div className="flex flex-wrap items-start gap-6">
              {/* 候選比較 */}
              <section aria-label="候選商品比較" className="flex min-w-0 flex-[1.5_1_640px] flex-col gap-3.5">
                <div className="hidden grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3.5 md:grid">
                  {candidates.map((c) => (
                    <CandidateCard key={c.key} c={c} on={tryCand?.key === c.key} busy={saving} onTry={() => tryOn(c.key)} onEliminate={() => void onEliminate(c)} />
                  ))}
                </div>
                <div aria-label="候選商品，可左右滑動" className="-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pt-1 pb-2 md:hidden">
                  {candidates.map((c) => (
                    <CandidateCard key={c.key} c={c} compact on={tryCand?.key === c.key} busy={saving} onTry={() => tryOn(c.key)} onEliminate={() => void onEliminate(c)} />
                  ))}
                  <button type="button" onClick={() => setDialog({ kind: 'pick' })} disabled={ungrouped.length === 0} className="flex w-[120px] flex-none snap-start flex-col items-center justify-center gap-2 rounded-card border-[1.5px] border-dashed border-line-strong bg-transparent text-[13px] text-mist-deep disabled:opacity-50">
                    <Icon name="wish" />
                    從清單挑
                  </button>
                  <button type="button" onClick={() => setDialog({ kind: 'pick-closet' })} disabled={availableClosetItems.length === 0} className="flex w-[120px] flex-none snap-start flex-col items-center justify-center gap-2 rounded-card border-[1.5px] border-dashed border-line-strong bg-transparent text-[13px] text-mist-deep disabled:opacity-50">
                    <Icon name="closet" />
                    從衣櫃挑
                  </button>
                </div>

                <NotesBox notes={notes} single={candidates.length < 2} slotLabel={tryItem ? SLOT_META[tryItem.slot].label : '件'} className="hidden md:flex" />
              </section>

              {/* 混搭試穿：桌面 */}
              {tryItem && (
                <section aria-label="混搭試穿" className="hidden min-w-0 flex-[1_1_420px] flex-col gap-3.5 rounded-[18px] bg-card p-[18px] shadow-paper md:flex">
                  <div className="flex flex-wrap items-baseline justify-between gap-2.5">
                    <h2 className="m-0 font-hd text-[21px]">混搭試穿</h2>
                    <span className="text-xs text-ink-2">虛線框＝還沒買</span>
                  </div>
                  <OutfitBoard template="full" pieces={pieces} emptyOptionalLabel="不搭配" className="h-[460px]" />
                  <MixSources tryItem={tryItem} trySource={tryCand?.source ?? 'wishlist'} closet={closet} wishes={wishes} groupId={group.id} picks={picks} onPick={setPick} />
                  <UnboughtBar count={unbought.length} total={unboughtTotal} />
                  {missing.length > 0 && <p role="status" className="m-0 text-xs text-rose-deep">還缺{missing.join('、')}，衣櫃裡沒有可穿的，所以還不能存。</p>}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="primary" className="flex-1" disabled={saving || !canSave} onClick={() => void onSaveOutfit()}>存成「如果買了」穿搭</Button>
                    {tryCand?.source === 'closet' ? <ButtonLink variant="secondary" to={`/closet/${tryItem.id}`}>查看衣物</ButtonLink> : <Button variant="secondary" disabled={saving} onClick={() => setDialog({ kind: 'bought', item: tryItem })}>決定買這件</Button>}
                  </div>
                </section>
              )}

              {/* 混搭試穿：手機 */}
              {tryItem && (
                <section aria-label="混搭試穿" className="flex w-full min-w-0 gap-2.5 rounded-card bg-card p-2.5 md:hidden">
                  <OutfitBoard template="full" pieces={pieces} compact className="h-[200px] w-[176px] flex-none" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <h2 className="m-0 font-hd text-[17px]">混搭試穿</h2>
                    <span className="text-xs leading-[1.6] text-ink-2">
                      {unbought.length > 0 ? `${unbought.map((w) => w.name).join('、')}還沒買，其餘來自衣櫃` : '全部來自衣櫃'}
                    </span>
                    <button type="button" onClick={() => setDialog({ kind: 'mix' })} className="inline-flex min-h-11 items-center gap-1 self-start rounded-full border-[1.5px] border-dashed border-rose-edge bg-card px-3 text-xs font-medium text-ink">
                      換單品
                    </button>
                    <span className="mt-auto text-xs text-rose-ink">{unbought.length} 件未購買</span>
                    <span className="font-num text-lg font-bold text-rose-ink tabular">合計 {formatNT(unboughtTotal)}</span>
                  </div>
                </section>
              )}
              <NotesBox notes={notes} single={candidates.length < 2} slotLabel={tryItem ? SLOT_META[tryItem.slot].label : '件'} className="w-full md:hidden" compact />
            </div>
          )}

          {/* 手機：底部固定主要按鈕 */}
          {tryItem && (
            <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-20 grid grid-cols-[1fr_1.4fr] gap-2 border-t-[1.5px] border-dashed border-line-strong bg-paper p-3 md:hidden">
              <Button variant="secondary" disabled={saving || !canSave} onClick={() => void onSaveOutfit()}>存成穿搭</Button>
              {tryCand?.source === 'closet' ? <ButtonLink variant="primary" to={`/closet/${tryItem.id}`} className="min-w-0"><span className="truncate">查看衣物</span></ButtonLink> : <Button variant="primary" disabled={saving} onClick={() => setDialog({ kind: 'bought', item: tryItem })} className="min-w-0"><span className="truncate">決定買{tryItem.shop}這件</span></Button>}
            </div>
          )}
        </>
      )}

      {dialog?.kind === 'add' && group && (
        <WishlistForm
          title={`加入候選・${group.title}`}
          defaults={{ url: dialog.url || undefined, slot: tryItem?.slot }}
          saving={saving}
          onCancel={() => setDialog(null)}
          onSubmit={(input) => void onAddCandidate(input)}
        />
      )}
      {dialog?.kind === 'pick' && group && <PickWishDialog items={ungrouped} saving={saving} onCancel={() => setDialog(null)} onPick={(item) => void onPickExisting(item)} />}
      {dialog?.kind === 'pick-closet' && group && <PickClosetDialog items={availableClosetItems} saving={saving} onCancel={() => setDialog(null)} onPick={(item) => void onPickExistingCloset(item)} />}
      {(dialog?.kind === 'group-new' || dialog?.kind === 'group-edit') && (
        <CompareGroupDialog
          key={dialog.kind === 'group-edit' ? dialog.group.id : 'new'}
          group={dialog.kind === 'group-edit' ? dialog.group : undefined}
          saving={saving}
          onCancel={() => setDialog(null)}
          onSubmit={(input) => void onSaveGroup(input)}
          onDelete={dialog.kind === 'group-edit' ? () => setDialog({ kind: 'group-delete', group: dialog.group }) : undefined}
        />
      )}
      {dialog?.kind === 'group-delete' && (
        <DestructiveActionDialog
          title={`刪除群組「${dialog.group.title}」？`}
          description="只會拿掉這個比較群組，裡面的候選商品都會留在選購清單，資料不會不見。"
          confirmLabel="刪除群組"
          onCancel={() => setDialog(null)}
          onConfirm={() => void onDeleteGroup(dialog.group)}
        />
      )}
      {dialog?.kind === 'bought' && <BoughtDialog item={dialog.item} saving={saving} onCancel={() => setDialog(null)} onConfirm={(purchase) => void onBought(dialog.item, purchase)} />}
      {dialog?.kind === 'mix' && tryItem && group && (
        <BottomSheet title="換單品" onClose={() => setDialog(null)}>
          <MixSources tryItem={tryItem} trySource={tryCand?.source ?? 'wishlist'} closet={closet} wishes={wishes} groupId={group.id} picks={picks} onPick={setPick} />
          <UnboughtBar count={unbought.length} total={unboughtTotal} />
          {missing.length > 0 && <p role="status" className="m-0 text-xs text-rose-deep">還缺{missing.join('、')}，衣櫃裡沒有可穿的，所以還不能存。</p>}
        </BottomSheet>
      )}
      <Toast message={toast} onClose={closeToast} />
    </main>
  )
}

function Best({ children }: { children: string }) {
  return <span className="ml-1.5 inline-flex h-5 items-center rounded-full bg-status-ok-bg px-[7px] text-[11px] font-medium text-status-ok-fg">{children}</span>
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[38px] items-center justify-between gap-2 border-t-[1.5px] border-dashed border-line text-[13px]">
      <dt className="flex-none text-ink-2">{label}</dt>
      <dd className="m-0 min-w-0 text-right">{children}</dd>
    </div>
  )
}

function CandidateCard({ c, on, compact = false, busy, onTry, onEliminate }: { c: Candidate; on: boolean; compact?: boolean; busy: boolean; onTry: () => void; onEliminate: () => void }) {
  const { item } = c
  const priceLabel = c.source === 'closet' ? item.price > 0 ? formatNT(item.price) : '衣櫃品項' : formatNT(item.price)
  const totalLabel = c.source === 'closet' ? item.price > 0 ? formatNT(item.price) : '已購買' : formatNT(c.total)
  return (
    <article
      aria-label={`${item.shop}・${item.name}`}
      className={`relative flex flex-col bg-card ${compact ? 'w-[210px] flex-none snap-start gap-1.5 rounded-card p-2.5' : 'gap-2.5 rounded-[16px] p-3.5 shadow-paper'} ${
        on ? 'border-2 border-ink' : 'border-[1.5px] border-dashed border-line-strong'
      }`}
    >
      {on && !compact && <span aria-hidden="true" className="absolute top-[-10px] left-1/2 -ml-[38px] h-5 w-[76px] rounded-[2px] bg-mist-wash mix-blend-multiply" style={{ rotate: '-3deg' }} />}
      <div className={`relative flex items-center justify-center overflow-hidden bg-rose-soft ${compact ? 'h-[110px] rounded-btn' : 'aspect-square rounded-tile'}`}>
        {!compact && <span aria-hidden="true" className="absolute top-[12%] left-[14%] h-[76%] w-[72%] rounded-block bg-sage-wash mix-blend-multiply" style={{ rotate: '-3deg' }} />}
        <ItemImage name={item.name} cutoutUrl={item.cutoutUrl} shape={item.shape} colorHex={item.colorHex} className={compact ? 'relative h-[88%]' : 'relative h-[74%] w-[74%]'} />
        <span className={`absolute top-1.5 left-1.5 flex items-center gap-1 rounded-full bg-card font-medium ${compact ? 'h-5 px-[7px] text-[11px]' : 'h-6 px-[9px] text-[11px]'}`}>{c.source === 'closet' ? '衣櫃' : item.shop}</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className={`font-medium leading-[1.4] ${compact ? 'text-xs' : 'text-sm'}`}>{item.name}</span>
        {!compact && <span className={`font-num text-xl font-bold tabular ${c.source === 'closet' ? 'text-ink-2' : ''}`}>{priceLabel}</span>}
        {compact && (
          <span className="font-num text-[17px] font-bold tabular">
            {totalLabel}
            {c.cheapest && <Best>最省</Best>}
          </span>
        )}
      </div>
      <dl className="m-0">
        {!compact && (
          <Row label={c.source === 'closet' ? '購買價格' : '含運總價'}>
            <span className={`font-num font-bold tabular ${c.overBudget ? 'text-rose-deep' : ''}`}>{totalLabel}</span>
            {c.cheapest && <Best>最省</Best>}
            {c.overBudget && <span className="block text-[11px] text-rose-deep">超出預算</span>}
          </Row>
        )}
        {!compact && <Row label="材質">{item.material ?? '—'}</Row>}
        <Row label="你的尺寸"><span className={`font-medium ${SIZE_CLASS[c.sizeTone]}`}>{c.sizeText}</span></Row>
        {!compact && <Row label="退換">{item.returnPolicy ?? '—'}</Row>}
        <Row label="衣櫃可搭">
          <span className="font-num font-bold tabular">{c.insights.matchCount} 件</span>
          {c.mostMatch && <Best>最多</Best>}
        </Row>
        {compact && <Row label="退換">{item.returnPolicy ?? '—'}</Row>}
        {!compact && <Row label="與現有重複">{overlapText(c.insights)}</Row>}
      </dl>
      <div className="mt-auto flex flex-col gap-1.5">
        <Button variant={on ? 'primary' : 'secondary'} aria-pressed={on} onClick={onTry} className="h-11 w-full">
          {on ? '試穿中' : '放上試穿'}
        </Button>
        <div className="flex justify-between">
          {item.url ? (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-xs">
              商品頁 ↗<span className="sr-only">（另開新視窗）</span>
            </a>
          ) : (
            <span className="inline-flex min-h-11 items-center text-xs text-ink-3">沒有網址</span>
          )}
          <button type="button" disabled={busy} onClick={onEliminate} aria-label={c.source === 'closet' ? `從比較移除「${item.name}」` : `淘汰「${item.name}」`} className="min-h-11 border-0 bg-transparent px-1 text-xs text-ink-2 hover:text-ink">
            {c.source === 'closet' ? '移出比較' : '淘汰'}
          </button>
        </div>
      </div>
    </article>
  )
}

function NotesBox({ notes, single, slotLabel, className = '', compact = false }: { notes: string[]; single: boolean; slotLabel: string; className?: string; compact?: boolean }) {
  if (single) {
    return (
      <div className={`flex-col gap-1 rounded-tile bg-tile px-4 py-3 text-[13px] leading-6 text-ink-2 ${className}`}>
        再加一個候選，就能並排比較價格、尺寸與衣櫃可搭件數。
      </div>
    )
  }
  if (notes.length === 0) return null
  return (
    <div className={`relative flex-col gap-2 overflow-hidden bg-sage-soft text-sage-ink ${compact ? 'rounded-tile px-3 py-2.5' : 'rounded-[16px] px-5 py-[18px]'} ${className}`}>
      {!compact && <span aria-hidden="true" className="absolute -top-6 -right-6 size-24 rounded-[22px] bg-oat-wash mix-blend-multiply" style={{ rotate: '12deg' }} />}
      {!compact && (
        <div className="relative flex items-center justify-between">
          <h2 className="m-0 font-hd text-[19px]">如果只買一{slotLabel === '下身' ? '條' : slotLabel === '鞋子' ? '雙' : '件'}</h2>
          <span className="text-[11px] font-bold tracking-[.16em] text-sage-deep">依資料整理</span>
        </div>
      )}
      <ul className={`relative m-0 flex list-none flex-col gap-1 p-0 ${compact ? 'text-xs leading-[1.7]' : 'text-sm leading-[1.8]'}`}>
        {notes.map((n) => <li key={n}>{n}</li>)}
      </ul>
      {!compact && <span className="relative text-[11px] text-sage-deep">依據：候選的價格、尺寸備註，以及你衣櫃裡的可穿衣物</span>}
    </div>
  )
}

function UnboughtBar({ count, total }: { count: number; total: number }) {
  return (
    <div role="status" className="flex flex-wrap items-center gap-2.5 rounded-tile bg-rose-soft px-3.5 py-3 text-rose-ink">
      <span className="text-sm">這套有 <b className="font-num tabular">{count}</b> 件還沒買</span>
      <span className="ml-auto font-num text-lg font-bold tabular">合計 {formatNT(total)}</span>
    </div>
  )
}

/** 每個部位選來源：衣櫃單品或其他想買的單品；試穿中的候選固定在它的部位。 */
function MixSources({
  tryItem,
  trySource,
  closet,
  wishes,
  groupId,
  picks,
  onPick,
}: {
  tryItem: WishlistItem
  trySource: 'wishlist' | 'closet'
  closet: ClosetItem[]
  wishes: WishlistItem[]
  groupId: string
  picks: Record<Slot, BoardPick | null>
  onPick: (slot: Slot, pick: BoardPick | null) => void
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {SLOTS.map((meta) => {
        if (meta.slot === tryItem.slot) {
          return (
            <div key={meta.slot} className="flex items-center gap-2">
              <span className="w-9 flex-none text-xs text-ink-2">{meta.label}</span>
              <span className="min-w-0 text-xs text-ink">{trySource === 'closet' ? '衣櫃比較品項：' : '試穿中的候選：'}<b className="font-medium">{trySource === 'closet' ? tryItem.name : `${tryItem.shop}・${tryItem.name}`}</b></span>
            </div>
          )
        }
        const closetOptions = closet.filter((c) => c.slot === meta.slot && isWearable(c.status))
        const wishOptions = wishes.filter((w) => w.slot === meta.slot && w.compareGroupId !== groupId)
        const current = picks[meta.slot]
        const labelId = `mix-${meta.slot}`
        return (
          <div key={meta.slot} className="flex min-w-0 items-center gap-2">
            <span id={labelId} className="w-9 flex-none text-xs text-ink-2">{meta.label}</span>
            <div role="group" aria-labelledby={labelId} className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-0.5">
              {!meta.required && (
                <SourceChip selected={!current} onClick={() => onPick(meta.slot, null)}>不搭配</SourceChip>
              )}
              {closetOptions.map((c) => (
                <SourceChip key={c.id} selected={current?.kind === 'closet' && current.id === c.id} onClick={() => onPick(meta.slot, { kind: 'closet', id: c.id })}>
                  衣櫃：{c.name}
                </SourceChip>
              ))}
              {wishOptions.map((w) => (
                <SourceChip key={w.id} wish selected={current?.kind === 'wish' && current.id === w.id} onClick={() => onPick(meta.slot, { kind: 'wish', id: w.id })}>
                  想買：{w.name}
                </SourceChip>
              ))}
              {closetOptions.length === 0 && wishOptions.length === 0 && meta.required && <span className="text-xs text-rose-deep">衣櫃裡沒有可穿的{meta.label}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SourceChip({ selected, wish = false, onClick, children }: { selected: boolean; wish?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex h-11 flex-none items-center rounded-full border-[1.5px] px-3 text-xs font-medium whitespace-nowrap md:h-9 ${wish ? 'border-dashed' : ''} ${
        selected ? 'border-ink bg-ink text-paper' : `${wish ? 'border-rose-edge' : 'border-line'} bg-card text-ink hover:border-line-strong`
      }`}
    >
      {children}
    </button>
  )
}

function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const id = useId()
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        className="flex max-h-[85dvh] w-full flex-col gap-3 rounded-t-block bg-card p-4 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-sheet sm:max-w-lg"
      >
        <span aria-hidden="true" className="mx-auto h-1 w-10 rounded-full bg-line-strong" />
        <div className="flex items-center">
          <h2 id={id} className="m-0 font-hd text-xl">{title}</h2>
          <button type="button" autoFocus onClick={onClose} aria-label="關閉" className="ml-auto flex size-11 items-center justify-center rounded-btn bg-transparent text-ink-2">
            <Icon name="x" />
          </button>
        </div>
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">{children}</div>
        <Button variant="primary" onClick={onClose}>完成</Button>
      </section>
    </div>
  )
}

function PickWishDialog({ items, saving, onCancel, onPick }: { items: WishlistItem[]; saving: boolean; onCancel: () => void; onPick: (item: WishlistItem) => void }) {
  const id = useId()
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && !saving && onCancel()}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        onKeyDown={(e) => e.key === 'Escape' && !saving && onCancel()}
        className="flex max-h-[85dvh] w-full flex-col gap-3 rounded-t-block bg-card p-5 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-sheet sm:max-w-md sm:rounded-block sm:pb-5 sm:shadow-float"
      >
        <div className="flex items-center">
          <h2 id={id} className="m-0 font-hd text-xl">從選購清單挑</h2>
          <button type="button" autoFocus onClick={onCancel} aria-label="關閉" className="ml-auto flex size-11 items-center justify-center rounded-btn bg-transparent text-ink-2">
            <Icon name="x" />
          </button>
        </div>
        {items.length === 0 ? (
          <p className="m-0 text-sm leading-6 text-ink-2">選購清單裡沒有還沒分組的商品。可以先 <Link to="/wishlist">到選購清單新增</Link>，或直接貼上網址。</p>
        ) : (
          <ul className="m-0 flex min-h-0 list-none flex-col gap-2 overflow-y-auto p-0">
            {items.map((w) => (
              <li key={w.id}>
                <button type="button" disabled={saving} onClick={() => onPick(w)} className="flex w-full items-center gap-3 rounded-tile border-[1.5px] border-dashed border-line-strong bg-card p-2 text-left text-ink hover:border-ink-3">
                  <span className="flex size-14 flex-none items-center justify-center rounded-sm bg-rose-soft">
                    <ItemImage name={w.name} cutoutUrl={w.cutoutUrl} shape={w.shape} colorHex={w.colorHex} className="size-[80%]" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium">{w.name}</span>
                    <span className="text-xs text-ink-2">{w.shop}・{SLOT_META[w.slot].label}・{WISH_STATUS[w.status].label}</span>
                  </span>
                  <span className="flex-none font-num text-sm font-bold tabular">{formatNT(totalPrice(w))}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <ButtonLink to="/wishlist" variant="ghost">到選購清單管理</ButtonLink>
      </section>
    </div>
  )
}

function PickClosetDialog({ items, saving, onCancel, onPick }: { items: ClosetItem[]; saving: boolean; onCancel: () => void; onPick: (item: ClosetItem) => void }) {
  const id = useId()
  const [query, setQuery] = useState('')
  const visible = items.filter((item) => `${item.name} ${item.brand ?? ''} ${item.colorName}`.toLowerCase().includes(query.trim().toLowerCase()))
  return (
    <div className="compare-closet-picker fixed inset-0 z-50 flex items-end justify-center bg-scrim sm:items-center sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && !saving && onCancel()}>
      <section role="dialog" aria-modal="true" aria-labelledby={id} onKeyDown={(event) => event.key === 'Escape' && !saving && onCancel()} className="flex max-h-[85dvh] w-full flex-col gap-3 rounded-t-block bg-card p-5 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-sheet sm:max-w-lg sm:rounded-block sm:pb-5 sm:shadow-float">
        <div className="flex items-center gap-2"><div className="min-w-0"><h2 id={id} className="m-0 font-hd text-xl">從衣櫃加入比較</h2><p className="mb-0 mt-1 text-xs text-ink-2">加入後會成為這個群組的既有品項比較基準，不會複製或移動衣物。</p></div><button type="button" autoFocus onClick={onCancel} aria-label="關閉" className="ml-auto flex size-11 flex-none items-center justify-center rounded-btn text-ink-2"><Icon name="x" /></button></div>
        <label className="compare-closet-picker__search"><span className="sr-only">搜尋衣櫃品項</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋名稱、品牌或顏色" className="h-11 w-full rounded-btn border-[1.5px] border-line bg-paper px-3 text-sm text-ink" /></label>
        {items.length === 0 ? <p className="m-0 rounded-tile bg-tile p-4 text-sm leading-6 text-ink-2">沒有可加入的品項。所有目前顯示在衣櫃的單品都已加入這個比較群組。</p> : visible.length === 0 ? <p className="m-0 py-5 text-center text-sm text-ink-2">找不到符合的衣物。</p> : <ul className="m-0 flex min-h-0 list-none flex-col gap-2 overflow-y-auto p-0">{visible.map((item) => <li key={item.id}><button type="button" disabled={saving} onClick={() => onPick(item)} className="flex min-h-[68px] w-full items-center gap-3 rounded-tile border-[1.5px] border-dashed border-line-strong bg-card p-2 text-left text-ink hover:border-ink-3 disabled:opacity-50"><span className="flex size-14 flex-none items-center justify-center rounded-sm bg-tile"><ItemImage name={item.name} cutoutUrl={item.cutoutUrl} shape={item.shape} colorHex={item.colorHex} className="size-[82%]" /></span><span className="flex min-w-0 flex-1 flex-col gap-0.5"><span className="truncate text-sm font-medium">{item.name}</span><span className="truncate text-xs text-ink-2">{item.brand ?? '未填品牌'}・{item.colorName}・{SLOT_META[item.slot].label}</span></span><span className="flex-none text-xs text-mist-deep">加入比較<Icon name="plus" size={14} /></span></button></li>)}</ul>}
        <Button variant="ghost" onClick={onCancel}>完成</Button>
      </section>
    </div>
  )
}
