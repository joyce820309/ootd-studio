import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toPng } from 'html-to-image'
import { ItemImage } from '@/components/closet/ItemImage'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { PaperCard, TiltLabel } from '@/components/ui/Paper'
import { LoadingState, PageState } from '@/components/ui/PageState'
import { Toast, type ToastMessage } from '@/components/ui/Toast'
import { StudioCanvas, type StudioPiece } from '@/components/outfit/StudioCanvas'
import { isWearable, SLOT_META } from '@/lib/slots'
import { fetchClosetItems, fetchWishlist, saveStudioOutfit } from '@/lib/data'
import type { ClosetItem, Placement, Slot, StudioCanvasItem, WishlistItem } from '@/types'

const DRAFT_KEY = 'ootd-studio-canvas-draft-v1'
const PAPER_IDS = ['apricot', 'mist', 'rose', 'card'] as const
type Paper = (typeof PAPER_IDS)[number]
type Source = 'closet' | 'wishlist'
type Filter = 'all' | 'top' | 'bottom' | 'outer' | 'shoes'
type StudioDraft = { id?: string; name: string; paper: Paper; pieces: StudioCanvasItem[] }
type CatalogRecord =
  | { source: 'closet'; item: ClosetItem; slot: Slot }
  | { source: 'wishlist'; item: WishlistItem; slot: Slot }

const FILTERS: { id: Filter; label: string; slots?: Slot[]; dot?: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'top', label: '上衣', slots: ['top'], dot: 'bg-oat' },
  { id: 'bottom', label: '下身', slots: ['bottom'], dot: 'bg-sage' },
  { id: 'outer', label: '外套', slots: ['outer'], dot: 'bg-mist' },
  { id: 'shoes', label: '鞋包', slots: ['shoes', 'bag', 'acc'], dot: 'bg-rose' },
]
const STATUS: Record<ClosetItem['status'], string> = { ok: '可穿', not_arrived: '未到貨', cleaning: '送洗中', repair: '維修中', lent: '借出', stored: '收納中', retired: '已淘汰' }

function defaultDraft(): StudioDraft {
  return { name: '今天想穿什麼？', paper: 'apricot', pieces: [] }
}

function readDraft(): StudioDraft {
  if (typeof window === 'undefined') return defaultDraft()
  try {
    const parsed = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Partial<StudioDraft> | null
    if (!parsed || !Array.isArray(parsed.pieces)) return defaultDraft()
    return {
      ...(typeof parsed.id === 'string' ? { id: parsed.id } : {}),
      name: typeof parsed.name === 'string' ? parsed.name : '未命名搭配',
      paper: PAPER_IDS.includes(parsed.paper as Paper) ? parsed.paper as Paper : 'apricot',
      pieces: parsed.pieces.filter((piece): piece is StudioCanvasItem => Boolean(piece && typeof piece.key === 'string' && (piece.source === 'closet' || piece.source === 'wishlist') && typeof piece.itemId === 'string' && piece.placement)),
    }
  } catch {
    return defaultDraft()
  }
}

function positionFor(index: number, pieces: StudioCanvasItem[]): Placement {
  const positions = [
    { x: 42, y: 25, w: 31, rot: 1 }, { x: 26, y: 34, w: 34, rot: -6 },
    { x: 47, y: 60, w: 28, rot: 3 }, { x: 76, y: 42, w: 23, rot: 6 },
    { x: 60, y: 82, w: 22, rot: -8 }, { x: 83, y: 19, w: 17, rot: -3 },
  ]
  const value = positions[index % positions.length]
  return { ...value, z: Math.max(0, ...pieces.map((piece) => piece.placement.z)) + 1 }
}

function entryKey(source: Source, id: string) {
  return `${source}:${id}`
}

function itemSlot(item: ClosetItem | WishlistItem): Slot {
  return item.slot
}

function amount(item: WishlistItem) {
  return item.price + (item.shipping ?? 0)
}

export function StudioPage() {
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([])
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([])
  const [source, setSource] = useState<Source>('closet')
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<StudioDraft>(readDraft)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [history, setHistory] = useState<StudioDraft[]>(() => [readDraft()])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [draftSaved, setDraftSaved] = useState(false)
  const [materialsOpen, setMaterialsOpen] = useState(false)
  const [replaceKey, setReplaceKey] = useState<string | null>(null)
  const [clearConfirm, setClearConfirm] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [advice, setAdvice] = useState('把不同部位放上畫布，試試重疊與比例；所有位置會自動保留成草稿。')
  const canvasRef = useRef<HTMLDivElement>(null)
  const draftRef = useRef(draft)
  const historyRef = useRef(history)
  const historyIndexRef = useRef(historyIndex)
  const loadData = useCallback(async () => Promise.all([fetchClosetItems(), fetchWishlist()]), [])

  useEffect(() => {
    let alive = true
    loadData()
      .then(([closet, wishlist]) => {
        if (!alive) return
        setClosetItems(closet)
        setWishlistItems(wishlist)
        setLoadError(null)
      })
      .catch((cause: Error) => alive && setLoadError(cause.message || '衣物素材載入失敗。'))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [loadData])

  useEffect(() => {
    draftRef.current = draft
    if (!loading) {
      const timeout = window.setTimeout(() => {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
        setDraftSaved(true)
      }, 350)
      return () => window.clearTimeout(timeout)
    }
  }, [draft, loading])

  const catalog = useMemo<CatalogRecord[]>(() => [
    ...closetItems.map((item) => ({ source: 'closet' as const, item, slot: itemSlot(item) })),
    ...wishlistItems.filter((item) => !['bought', 'dropped'].includes(item.status)).map((item) => ({ source: 'wishlist' as const, item, slot: itemSlot(item) })),
  ], [closetItems, wishlistItems])

  const selectedCatalog = useMemo(() => new Map(catalog.map((entry) => [entryKey(entry.source, entry.item.id), entry])), [catalog])
  const pieces = useMemo<StudioPiece[]>(() => draft.pieces.flatMap((entry) => {
    const match = selectedCatalog.get(entry.key)
    return match ? [{ key: entry.key, source: entry.source, item: match.item, placement: entry.placement }] : []
  }), [draft.pieces, selectedCatalog])
  const selectedPiece = pieces.find((piece) => piece.key === selectedKey) ?? null
  const displayedCatalog = catalog.filter((entry) => {
    if (entry.source !== source) return false
    const filterOption = FILTERS.find((option) => option.id === filter)
    if (filterOption?.slots && !filterOption.slots.includes(entry.slot)) return false
    return entry.item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  })

  function updateDraft(patch: Partial<StudioDraft>) {
    const next = { ...draftRef.current, ...patch }
    draftRef.current = next
    setDraft(next)
    setDraftSaved(false)
  }

  function pushHistory(next: StudioDraft) {
    draftRef.current = next
    setDraft(next)
    setDraftSaved(false)
    const nextHistory = [...historyRef.current.slice(0, historyIndexRef.current + 1), next].slice(-50)
    const nextIndex = nextHistory.length - 1
    historyRef.current = nextHistory
    historyIndexRef.current = nextIndex
    setHistory(nextHistory)
    setHistoryIndex(nextIndex)
  }

  function recordCurrentHistory() {
    const current = draftRef.current
    const existing = historyRef.current[historyIndexRef.current]
    if (JSON.stringify(existing) === JSON.stringify(current)) return
    const nextHistory = [...historyRef.current.slice(0, historyIndexRef.current + 1), current].slice(-50)
    historyRef.current = nextHistory
    historyIndexRef.current = nextHistory.length - 1
    setHistory(nextHistory)
    setHistoryIndex(nextHistory.length - 1)
  }

  function undo() {
    const index = Math.max(0, historyIndexRef.current - 1)
    historyIndexRef.current = index
    setHistoryIndex(index)
    const previous = historyRef.current[index]
    draftRef.current = previous
    setDraft(previous)
    setSelectedKey(null)
  }

  function redo() {
    const index = Math.min(historyRef.current.length - 1, historyIndexRef.current + 1)
    historyIndexRef.current = index
    setHistoryIndex(index)
    const next = historyRef.current[index]
    draftRef.current = next
    setDraft(next)
    setSelectedKey(null)
  }

  function toggleCatalogEntry(entry: CatalogRecord) {
    if (entry.source === 'closet' && !isWearable(entry.item.status)) return
    const key = entryKey(entry.source, entry.item.id)
    const current = draftRef.current
    if (replaceKey) {
      const previous = current.pieces.find((piece) => piece.key === replaceKey)
      const result = current.pieces.filter((piece) => piece.key !== replaceKey && piece.key !== key)
      const nextItem: StudioCanvasItem = {
        key,
        source: entry.source,
        itemId: entry.item.id,
        placement: previous?.placement ?? positionFor(result.length, result),
      }
      pushHistory({ ...current, pieces: [...result, nextItem] })
      setSelectedKey(key)
      setReplaceKey(null)
      setMaterialsOpen(false)
      return
    }
    const exists = current.pieces.some((piece) => piece.key === key)
    const next = exists
      ? { ...current, pieces: current.pieces.filter((piece) => piece.key !== key) }
      : { ...current, pieces: [...current.pieces, { key, source: entry.source, itemId: entry.item.id, placement: positionFor(current.pieces.length, current.pieces) }] }
    pushHistory(next)
    setSelectedKey(exists ? null : key)
  }

  function placePiece(key: string, placement: Placement, record = true) {
    const next = { ...draftRef.current, pieces: draftRef.current.pieces.map((piece) => piece.key === key ? { ...piece, placement } : piece) }
    if (record) pushHistory(next)
    else updateDraft({ pieces: next.pieces })
  }

  function moveLayer(key: string, direction: 1 | -1) {
    const sorted = [...draftRef.current.pieces].sort((a, b) => a.placement.z - b.placement.z)
    const index = sorted.findIndex((piece) => piece.key === key)
    const other = sorted[index + direction]
    if (index < 0 || !other) return
    const current = draftRef.current
    pushHistory({ ...current, pieces: current.pieces.map((piece) => piece.key === key
      ? { ...piece, placement: { ...piece.placement, z: other.placement.z } }
      : piece.key === other.key ? { ...piece, placement: { ...piece.placement, z: sorted[index].placement.z } } : piece) })
  }

  function removePiece(key: string) {
    pushHistory({ ...draftRef.current, pieces: draftRef.current.pieces.filter((piece) => piece.key !== key) })
    setSelectedKey(null)
  }

  async function saveOutfit() {
    if (saving) return
    setSaving(true)
    try {
      const result = await saveStudioOutfit({ id: draftRef.current.id, name: draftRef.current.name, items: draftRef.current.pieces })
      updateDraft({ id: result.id })
      setToast({ tone: 'success', text: result.demo ? '搭配已保存在這部裝置的示範草稿中。' : '搭配已儲存到穿搭日記。' })
    } catch (cause) {
      setToast({ tone: 'error', text: cause instanceof Error ? cause.message : '儲存失敗，草稿仍保留。請稍後重試。' })
    } finally {
      setSaving(false)
    }
  }

  async function exportImage() {
    if (!canvasRef.current) return
    try {
      const dataUrl = await toPng(canvasRef.current, { cacheBust: true, pixelRatio: 2 })
      const link = document.createElement('a')
      link.download = `${draft.name || '穿搭'}.png`
      link.href = dataUrl
      link.click()
    } catch {
      setToast({ tone: 'error', text: '圖片匯出失敗，草稿仍保留。請稍後重試。' })
    }
  }

  async function retryData() {
    setLoading(true)
    setLoadError(null)
    try {
      const [closet, wishlist] = await loadData()
      setClosetItems(closet)
      setWishlistItems(wishlist)
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : '衣物素材載入失敗。')
    } finally {
      setLoading(false)
    }
  }

  function runAdvice() {
    if (!pieces.length) {
      setAdvice('先加入幾件衣物，再看看顏色與比例怎麼組合。')
    } else if (pieces.some((piece) => piece.source === 'wishlist')) {
      setAdvice(`目前試搭 ${pieces.length} 件單品，其中包含選購中的候選。先看比例與色彩是否適合，再決定要不要買。這是本機整理提示，尚未連接 AI。`)
    } else {
      setAdvice(`目前畫布有 ${pieces.length} 件衣物。可以移動單品改變視覺重心，也能切換背景紙比較配色。這是本機整理提示，尚未連接 AI。`)
    }
  }

  function openMaterials(replacing = false) {
    if (replacing && selectedKey) setReplaceKey(selectedKey)
    else setReplaceKey(null)
    setMaterialsOpen(true)
  }

  function renderMaterials() {
    return (
      <div className="flex min-h-0 flex-col gap-3">
        <div role="tablist" aria-label="素材來源" className="grid grid-cols-2 rounded-btn bg-tile p-1">
          {(['closet', 'wishlist'] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={source === value} onClick={() => setSource(value)} className={`h-10 rounded-sm text-[13px] ${source === value ? 'bg-card font-bold text-ink shadow-paper' : 'text-ink-2'}`}>{value === 'closet' ? '我的衣櫃' : '選購清單'}</button>)}
        </div>
        <label className="relative block">
          <Icon name="search" size={18} className="absolute left-3 top-3 text-ink-3" />
          <span className="sr-only">搜尋素材</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋衣物" className="h-11 w-full rounded-btn border-[1.5px] border-line bg-paper pl-10 pr-3 text-sm text-ink outline-none focus:border-mist-deep" />
        </label>
        <div className="flex flex-wrap gap-1.5" aria-label="依類別篩選">
          {FILTERS.map((option) => <button key={option.id} type="button" aria-pressed={filter === option.id} onClick={() => setFilter(option.id)} className={`inline-flex h-8 items-center gap-1.5 rounded-full border-[1.5px] px-2.5 text-xs ${filter === option.id ? 'border-ink bg-ink text-paper' : 'border-line bg-card text-ink'}`}>{option.dot && <span className={`size-2 rounded-full ${option.dot}`} />}{option.label}</button>)}
        </div>
        <p className="m-0 text-xs leading-5 text-ink-2">{replaceKey ? '點選單品即可替換目前選取的衣物。' : '點一下加入畫布，再點一次移除。'}</p>
        {loading ? <LoadingState label="正在載入衣物素材…" rows={2} /> : loadError ? (
          <div role="alert" className="rounded-tile border border-rose bg-rose-soft p-3 text-xs leading-5 text-rose-ink">素材載入失敗，畫布草稿仍會保留。<button type="button" onClick={() => void retryData()} className="ml-2 min-h-9 underline">重試</button></div>
        ) : displayedCatalog.length === 0 ? (
          <div className="rounded-tile border border-dashed border-line-strong bg-paper p-4 text-center text-xs leading-5 text-ink-2" role="status">{query ? '找不到符合的素材，試試其他搜尋字。' : source === 'wishlist' ? '選購清單目前沒有可試搭商品。' : '這個分類還沒有衣物。'}</div>
        ) : (
          <div className="grid grid-cols-2 gap-x-2.5 gap-y-3 overflow-y-auto pb-2">
            {displayedCatalog.map((entry) => {
              const key = entryKey(entry.source, entry.item.id)
              const onCanvas = draft.pieces.some((piece) => piece.key === key)
              const unavailable = entry.source === 'closet' && !isWearable(entry.item.status)
              const meta = SLOT_META[entry.slot]
              const wish = entry.source === 'wishlist' ? entry.item as WishlistItem : null
              return (
                <button key={key} type="button" aria-pressed={onCanvas} disabled={unavailable} onClick={() => toggleCatalogEntry(entry)} className={`group flex min-w-0 flex-col gap-1.5 text-left disabled:cursor-not-allowed disabled:opacity-55 ${onCanvas ? 'text-mist-deep' : 'text-ink'}`}>
                  <span className={`relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-tile bg-tile p-2 ${onCanvas ? 'ring-2 ring-inset ring-mist-deep' : ''}`}>
                    <ItemImage name={entry.item.name} cutoutUrl={entry.item.cutoutUrl} shape={entry.item.shape} colorHex={entry.item.colorHex} className="size-[78%]" />
                    <span className={`absolute left-2 top-2 size-2.5 rounded-full ${meta.slot === 'outer' ? 'bg-mist' : meta.slot === 'top' ? 'bg-oat' : meta.slot === 'bottom' ? 'bg-sage' : 'bg-rose'}`} />
                    {onCanvas && <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-mist-deep text-white"><Icon name="check" size={13} /></span>}
                    {unavailable && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-rose-soft px-1.5 py-0.5 text-[10px] text-rose-ink">{STATUS[entry.item.status]}</span>}
                    {wish && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-rose-deep px-1.5 py-0.5 text-[10px] text-white">選購中・NT${amount(wish).toLocaleString()}</span>}
                  </span>
                  <span className="line-clamp-2 min-h-8 text-xs leading-4">{entry.item.name}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <main className="flex min-h-[calc(100dvh-84px)] flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-dashed border-line-strong px-4 py-3 sm:px-6 lg:px-8">
        <TiltLabel accent="rose" className="!h-8 !text-[15px]">搭配工作台</TiltLabel>
        <label className="sr-only" htmlFor="studio-outfit-name">穿搭名稱</label>
        <input id="studio-outfit-name" value={draft.name} onChange={(event) => updateDraft({ name: event.target.value })} className="h-11 min-w-0 flex-1 border-0 border-b-[1.5px] border-dashed border-line-strong bg-transparent px-1 font-hd text-xl text-ink outline-none focus:border-mist-deep sm:min-w-[220px] sm:flex-none" />
        <span className="hidden items-center gap-1.5 text-xs text-ink-2 sm:inline-flex"><Icon name={draftSaved ? 'check' : 'reset'} size={15} />{draftSaved ? '草稿已自動儲存' : '草稿變更中…'}</span>
        <div className="ml-auto hidden items-center gap-1 sm:flex">
          <button type="button" aria-label="復原" title="復原" disabled={historyIndex === 0} onClick={undo} className="flex size-10 items-center justify-center rounded-sm text-ink disabled:opacity-35"><Icon name="back" /></button>
          <button type="button" aria-label="重做" title="重做" disabled={historyIndex >= history.length - 1} onClick={redo} className="flex size-10 items-center justify-center rounded-sm text-ink disabled:opacity-35"><Icon name="next" /></button>
          {clearConfirm ? <><span className="text-xs text-rose-ink">清空畫布？</span><Button variant="ghost" onClick={() => setClearConfirm(false)}>取消</Button><Button variant="danger" onClick={() => { pushHistory({ ...draftRef.current, pieces: [] }); setSelectedKey(null); setClearConfirm(false) }}>清空</Button></> : <Button variant="ghost" onClick={() => setClearConfirm(true)}>清空畫布</Button>}
          <Button variant="secondary" onClick={() => void exportImage()}><Icon name="outfit" size={17} />另存為圖片</Button>
          <Button variant="primary" disabled={saving} onClick={() => void saveOutfit()}><Icon name="check" size={17} />{saving ? '儲存中…' : '儲存穿搭'}</Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 px-3 py-3 pb-36 sm:px-5 lg:grid-cols-[minmax(240px,300px)_minmax(380px,1fr)_minmax(250px,320px)] lg:gap-5 lg:px-8 lg:pb-6">
        <aside aria-label="衣物素材" className="hidden min-h-0 lg:flex"><PaperCard className="flex min-h-0 w-full flex-col gap-3 p-4">{renderMaterials()}</PaperCard></aside>

        <section aria-label="搭配畫布" className="flex min-w-0 flex-col gap-2">
          {loadError && <div role="alert"><PageState icon="alert" tone="rose" compact title="素材載入失敗" description="你的草稿仍保留在這部裝置，可以重試讀取衣物清單。" action={<Button variant="secondary" onClick={() => void retryData()}>重試</Button>} /></div>}
          <StudioCanvas
            pieces={pieces}
            selectedKey={selectedKey}
            onSelect={setSelectedKey}
            onPlace={(key, placement) => placePiece(key, placement, false)}
            onInteractionEnd={recordCurrentHistory}
            onRemove={removePiece}
            onReplace={() => openMaterials(true)}
            onExport={() => void exportImage()}
            onLayer={moveLayer}
            paper={draft.paper}
            onPaperChange={(paper) => pushHistory({ ...draftRef.current, paper })}
            canvasRef={canvasRef}
            className="min-h-[520px] lg:min-h-[640px]"
          />
        </section>

        <aside aria-label="屬性與搭配建議" className="hidden min-h-0 flex-col gap-4 lg:flex">
          <PaperCard className="p-4">
            <div className="mb-2 flex items-baseline justify-between"><h2 className="m-0 font-hd text-xl">屬性</h2><span className="max-w-[65%] truncate text-xs text-ink-2">{selectedPiece?.item.name ?? '尚未選取'}</span></div>
            {selectedPiece ? <>
              <Property label="縮放"><button type="button" aria-label="縮小" onClick={() => placePiece(selectedPiece.key, { ...selectedPiece.placement, w: selectedPiece.placement.w - 3 })}>−</button><span className="font-num font-bold">{Math.round(selectedPiece.placement.w)}%</span><button type="button" aria-label="放大" onClick={() => placePiece(selectedPiece.key, { ...selectedPiece.placement, w: selectedPiece.placement.w + 3 })}>＋</button></Property>
              <Property label="旋轉"><button type="button" aria-label="向左旋轉" onClick={() => placePiece(selectedPiece.key, { ...selectedPiece.placement, rot: selectedPiece.placement.rot - 15 })}>−</button><span className="font-num font-bold">{Math.round(selectedPiece.placement.rot)}°</span><button type="button" aria-label="向右旋轉" onClick={() => placePiece(selectedPiece.key, { ...selectedPiece.placement, rot: selectedPiece.placement.rot + 15 })}>＋</button></Property>
              <div className="flex min-h-11 items-center justify-between border-b border-line text-[13px]"><span>圖層</span><span className="font-num font-bold">{selectedPiece.placement.z}</span></div>
            </> : <p className="text-xs text-ink-2">選取畫布上的單品即可調整。</p>}
            <p className="mb-1 mt-3 text-xs font-medium">圖層順序（上 → 下）</p>
            <ol className="m-0 max-h-56 list-none space-y-1 overflow-y-auto p-0">
              {[...pieces].sort((a, b) => b.placement.z - a.placement.z).map((piece) => <li key={piece.key}><button type="button" aria-current={piece.key === selectedKey} onClick={() => setSelectedKey(piece.key)} className={`flex min-h-11 w-full items-center gap-2 rounded-sm border px-2 text-left text-xs ${piece.key === selectedKey ? 'border-mist-deep bg-mist-soft' : 'border-transparent hover:bg-paper'}`}><span className="flex size-8 flex-none items-center justify-center rounded-sm bg-tile"><ItemImage name={piece.item.name} colorHex={piece.item.colorHex} shape={piece.item.shape} cutoutUrl={piece.item.cutoutUrl} className="size-7" /></span><span className="min-w-0 flex-1 truncate">{piece.item.name}</span><Icon name="outfit" size={15} className="text-ink-3" /></button></li>)}
            </ol>
          </PaperCard>
          <section className="relative overflow-hidden rounded-card bg-sage-soft p-4 text-sage-ink">
            <span className="absolute -right-7 -top-7 size-24 rotate-12 rounded-block bg-oat-wash mix-blend-multiply" aria-hidden="true" />
            <div className="relative flex items-center justify-between"><h2 className="m-0 font-hd text-xl">搭配小提醒</h2><span className="font-num text-[10px] font-bold tracking-widest">參考用</span></div>
            <p className="relative my-3 text-[13px] leading-6">{advice}</p>
            <p className="relative mb-3 text-[11px] leading-5 text-sage-deep">目前為本機整理提示，未連接生成式 AI；不會送出你的個人資料。</p>
            <div className="relative flex flex-wrap gap-1.5">{['更正式', '更休閒', '更保暖'].map((mood) => <button key={mood} type="button" onClick={() => setAdvice(`「${mood}」：可在畫布加入合適的單品，再拖曳調整比例。`)} className="min-h-9 rounded-full border border-sage-deep/30 bg-card px-3 text-xs text-ink">{mood}</button>)}</div>
            <Button variant="sage" className="relative mt-3 w-full" onClick={runAdvice}>重新整理建議</Button>
          </section>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-20 grid grid-cols-[3fr_2fr] gap-2 border-t border-dashed border-line-strong bg-paper/95 p-3 backdrop-blur lg:hidden">
        <Button variant="oat" size="lg" onClick={() => openMaterials(false)}><Icon name="plus" />加入單品</Button>
        <Button variant="sage" size="lg" onClick={runAdvice}><Icon name="chat" />搭配小提醒</Button>
      </div>

      {materialsOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-scrim lg:hidden" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) { setMaterialsOpen(false); setReplaceKey(null) } }}>
          <section role="dialog" aria-modal="true" aria-label="選擇衣物素材" className="flex max-h-[82dvh] w-full flex-col gap-3 rounded-t-block bg-card p-4 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-sheet">
            <div className="flex items-center justify-between"><h2 className="m-0 font-hd text-xl">{replaceKey ? '替換單品' : '加入單品'}</h2><button type="button" aria-label="關閉素材選單" onClick={() => { setMaterialsOpen(false); setReplaceKey(null) }} className="flex size-11 items-center justify-center rounded-btn"><Icon name="x" /></button></div>
            <div className="min-h-0 overflow-y-auto">{renderMaterials()}</div>
          </section>
        </div>
      )}

      <Toast message={toast} onClose={() => setToast(null)} />
    </main>
  )
}

function Property({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex min-h-11 items-center justify-between border-b border-line text-[13px]"><span>{label}</span><span className="flex items-center gap-2">{children}</span></div>
}
