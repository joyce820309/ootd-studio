import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ProfileBreadcrumb } from '@/components/layout/ProfileNav'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { LoadingState, PageState } from '@/components/ui/PageState'
import { PaperCard, Tape, WashBlob } from '@/components/ui/Paper'
import { Select } from '@/components/ui/Select'
import { Toast, type ToastMessage } from '@/components/ui/Toast'
import { BRAND_SORTS, brandDateLabel, brandTotal, findDuplicateGroups, findExactBrand, findSimilarBrand, normalizeBrand, sortBrands, type BrandSort, type DuplicateGroup } from '@/lib/brands'
import { createBrand, fetchBrands, markBrandsDistinct, replaceBrands, restoreBrands } from '@/lib/data'
import { useProfileNav } from '@/lib/profileNav'
import type { BrandChange, BrandSummary } from '@/types'

type Panel =
  | { kind: 'merge'; seq: number; names: string[]; keep?: string }
  | { kind: 'delete'; seq: number; names: string[] }
  | { kind: 'actions'; seq: number; name: string; renaming: boolean }

interface Undo {
  id: number
  label: string
  changes: BrandChange[]
}

const NEW_NAME = '__new__'
const closetLink = (name: string) => `/closet?brand=${encodeURIComponent(name)}`
function errorText(cause: unknown) {
  const err = (cause ?? {}) as { message?: unknown; code?: unknown }
  // 0011_brands.sql 還沒執行：找不到資料表或函式
  if (['42P01', 'PGRST205', 'PGRST202', '42883'].includes(String(err.code))) return '品牌資料表還沒建立，請先在 Supabase 執行 supabase/migrations/0011_brands.sql。'
  return typeof err.message === 'string' && err.message ? err.message : '操作沒有完成，請稍後再試。'
}
const quoteList = (names: string[]) => names.map((name) => `「${name}」`).join('')

function useMediaQuery(query: string) {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatch(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return match
}

let panelSeq = 0
const nextSeq = () => (panelSeq += 1)

export function BrandsPage() {
  const desktop = useMediaQuery('(min-width: 1024px)')
  const [data, setData] = useState<{ brands: BrandSummary[]; distinctGroups: string[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [query, setQuery] = useState('')
  const [unusedOnly, setUnusedOnly] = useState(false)
  const [sort, setSort] = useState<BrandSort>('count-desc')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [renaming, setRenaming] = useState<{ name: string; value: string } | null>(null)
  const [adding, setAdding] = useState<{ value: string; error: string | null } | null>(null)
  const [panel, setPanel] = useState<Panel | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [undo, setUndo] = useState<Undo | null>(null)

  useEffect(() => {
    let alive = true
    fetchBrands()
      .then((next) => {
        if (!alive) return
        setData(next)
        setLoadError(null)
      })
      .catch((cause) => alive && setLoadError(errorText(cause)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [reloadKey])

  const reload = () => setReloadKey((key) => key + 1)
  const retry = () => {
    setLoading(true)
    setLoadError(null)
    reload()
  }

  const brands = useMemo(() => data?.brands ?? [], [data])
  const profileNav = useProfileNav()
  useEffect(() => {
    if (data) profileNav?.setNavCount('/me/brands', data.brands.length)
  }, [data, profileNav])
  const byName = useMemo(() => new Map(brands.map((brand) => [brand.name, brand])), [brands])
  const duplicates = useMemo(() => findDuplicateGroups(brands, data?.distinctGroups ?? []), [brands, data])
  const dupNames = useMemo(() => new Set(duplicates.flatMap((group) => group.brands.map((brand) => brand.name))), [duplicates])
  const unusedCount = brands.filter((brand) => brandTotal(brand) === 0).length
  const visible = useMemo(() => {
    const key = normalizeBrand(query)
    return sortBrands(
      brands.filter((brand) => (!key || normalizeBrand(brand.name).includes(key)) && (!unusedOnly || brandTotal(brand) === 0)),
      sort,
    )
  }, [brands, query, unusedOnly, sort])
  const selectedNames = brands.filter((brand) => selected.has(brand.name)).map((brand) => brand.name)

  async function run(action: () => Promise<unknown>, success?: string) {
    setBusy(true)
    try {
      await action()
      if (success) setToast({ tone: 'success', text: success })
      setSelected(new Set())
      setSelectMode(false)
      reload()
      return true
    } catch (cause) {
      setToast({ tone: 'error', text: errorText(cause) })
      return false
    } finally {
      setBusy(false)
    }
  }

  function toggle(name: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function openMerge(names: string[], keep?: string) {
    setPanel({ kind: 'merge', seq: nextSeq(), names, keep })
  }

  function requestDelete(names: string[]) {
    const used = names.some((name) => {
      const brand = byName.get(name)
      return brand ? brandTotal(brand) > 0 : false
    })
    if (used) {
      setPanel({ kind: 'delete', seq: nextSeq(), names })
      return
    }
    void doDelete(names, null)
  }

  async function doDelete(names: string[], to: string | null) {
    let changes: BrandChange[] = []
    const ok = await run(async () => {
      changes = await replaceBrands(names, to)
    })
    if (!ok) return
    setPanel(null)
    setUndo({ id: Date.now(), label: names.length === 1 ? `已刪除「${names[0]}」` : `已刪除 ${names.length} 個品牌`, changes })
  }

  async function doMerge(names: string[], keep: string) {
    const ok = await run(() => replaceBrands(names, keep), `已合併成「${keep}」`)
    if (ok) setPanel(null)
  }

  async function doUndo(target: Undo) {
    setUndo(null)
    await run(() => restoreBrands(target.changes), `已復原${quoteList(target.changes.map((change) => change.name))}`)
  }

  /** 改名：改成已經有的名稱時，改開合併。回傳 true 代表可以關閉輸入框。 */
  async function submitRename(oldName: string, value: string) {
    const next = value.trim()
    if (!next) {
      setToast({ tone: 'error', text: '品牌名稱不能空白。' })
      return false
    }
    if (next === oldName) return true
    const exact = findExactBrand(brands, next)
    if (exact) {
      openMerge([oldName, exact.name], exact.name)
      return true
    }
    const brand = byName.get(oldName)
    const count = brand ? brandTotal(brand) : 0
    return run(() => replaceBrands([oldName], next), count ? `已改名為「${next}」，${count} 件一起更新` : `已改名為「${next}」`)
  }

  async function submitAdd(event: FormEvent) {
    event.preventDefault()
    if (!adding) return
    const name = adding.value.trim()
    if (!name) return setAdding({ ...adding, error: '請輸入品牌名稱。' })
    const existing = findSimilarBrand(brands, name)
    if (existing) return setAdding({ ...adding, error: `已經有「${existing.name}」了。` })
    const ok = await run(() => createBrand(name), `已新增「${name}」`)
    if (ok) setAdding(null)
  }

  async function dismissDuplicate(group: DuplicateGroup) {
    await run(() => markBrandsDistinct(group.key), '好，之後不會再把它們列在一起。')
  }

  const startAdding = () => {
    setAdding({ value: '', error: null })
    setPanel(null)
  }

  // ---------- 畫面 ----------

  const panelNode = panel && (
    panel.kind === 'merge' ? (
      <MergePanel
        key={panel.seq}
        desktop={desktop}
        brands={brands}
        initialNames={panel.names}
        initialKeep={panel.keep}
        busy={busy}
        onCancel={() => setPanel(null)}
        onConfirm={doMerge}
      />
    ) : panel.kind === 'delete' ? (
      <DeletePanel key={panel.seq} desktop={desktop} brands={brands} names={panel.names} busy={busy} onCancel={() => setPanel(null)} onConfirm={doDelete} />
    ) : !desktop && byName.get(panel.name) ? (
      <ActionsSheet
        key={panel.seq}
        brand={byName.get(panel.name)!}
        renaming={panel.renaming}
        busy={busy}
        onToggleRename={() => setPanel({ ...panel, renaming: !panel.renaming })}
        onRename={async (value) => {
          const done = await submitRename(panel.name, value)
          if (done) setPanel((current) => (current?.kind === 'actions' ? null : current))
        }}
        onMerge={() => openMerge([panel.name])}
        onDelete={() => {
          setPanel(null)
          requestDelete([panel.name])
        }}
        onClose={() => setPanel(null)}
      />
    ) : null
  )

  const sortSelect = (compact: boolean) => (
    <Select
      label="排序"
      value={sort}
      options={BRAND_SORTS.map((option) => ({ value: option.id, label: option.label }))}
      onChange={(next: BrandSort) => setSort(next)}
      display={BRAND_SORTS.find((option) => option.id === sort)?.[compact ? 'short' : 'label']}
      align="right"
      className="flex-none"
      triggerClassName={`h-11 rounded-btn border-[1.5px] border-line-strong bg-card text-ink md:h-10 ${compact ? 'px-2.5 text-xs font-medium' : 'px-3 text-[13px]'}`}
    />
  )

  const addForm = adding && (
    <form onSubmit={submitAdd} className="mx-1.5 mb-2 flex flex-col gap-1.5 rounded-tile bg-paper p-3 md:mx-1.5">
      <label htmlFor="new-brand" className="text-xs text-ink-2">新增品牌</label>
      <div className="flex gap-1.5">
        <input
          id="new-brand"
          autoFocus
          value={adding.value}
          maxLength={60}
          onChange={(event) => setAdding({ value: event.target.value, error: null })}
          onKeyDown={(event) => event.key === 'Escape' && setAdding(null)}
          placeholder="例：Arket"
          aria-invalid={!!adding.error}
          aria-describedby={adding.error ? 'new-brand-error' : undefined}
          className="h-11 min-w-0 flex-1 rounded-btn border-[1.5px] border-mist-deep bg-card px-3 text-base text-ink outline-none md:text-sm"
        />
        <Button type="submit" variant="primary" disabled={busy} className="h-11 px-4">新增</Button>
        <Button variant="ghost" onClick={() => setAdding(null)} className="h-11 px-3">取消</Button>
      </div>
      {adding.error ? <span id="new-brand-error" role="alert" className="text-xs text-rose-deep">{adding.error}</span> : <span className="text-[11px] text-ink-3">還沒有衣物在用也可以先加，新增衣物時就能直接選。</span>}
    </form>
  )

  let content: ReactNode
  if (loading && !data) {
    content = <LoadingState label="正在整理品牌…" rows={5} />
  } else if (loadError && !data) {
    content = <PageState icon="alert" tone="rose" title="品牌清單暫時載入失敗" description={loadError} action={<Button variant="secondary" onClick={retry}>重新載入</Button>} />
  } else if (brands.length === 0) {
    content = (
      <>
        {addForm && <PaperCard className="py-3">{addForm}</PaperCard>}
        <PageState icon="closet" title="還沒有任何品牌" description="新增衣物或選購清單時填的品牌都會出現在這裡，也可以先手動新增常買的品牌。" action={<Button variant="primary" onClick={startAdding}><Icon name="plus" size={16} />新增品牌</Button>} />
      </>
    )
  } else {
    content = (
      <>
        {duplicates.length > 0 && <DuplicateSection groups={duplicates} busy={busy} onDismiss={dismissDuplicate} onMerge={(group) => openMerge(group.brands.map((brand) => brand.name), group.suggested)} />}

        {/* 手機：搜尋＋排序在清單外 */}
        <div className="flex items-center gap-2 md:hidden">
          <SearchField value={query} onChange={setQuery} />
          {sortSelect(true)}
        </div>
        {unusedCount > 0 && (
          <div className="-mt-1 flex md:hidden">
            <UnusedChip active={unusedOnly} count={unusedCount} onToggle={() => setUnusedOnly((value) => !value)} />
          </div>
        )}

        <section aria-label="品牌清單" className="rounded-card bg-card px-1 shadow-paper md:px-1.5 md:pb-1.5 md:pt-3">
          <div className="hidden flex-wrap items-center gap-2.5 px-3 pb-2.5 md:flex">
            <SearchField value={query} onChange={setQuery} />
            {unusedCount > 0 && <UnusedChip active={unusedOnly} count={unusedCount} onToggle={() => setUnusedOnly((value) => !value)} />}
            {sortSelect(false)}
          </div>
          {addForm && <div className="pt-3 md:pt-0">{addForm}</div>}

          {selectedNames.length > 0 && (
            <div role="toolbar" aria-label="已選取的品牌" className="mx-1.5 mb-2 hidden items-center gap-2.5 rounded-tile bg-ink px-3 py-2 text-[13px] text-paper md:flex">
              <span className="min-w-0 truncate">已選 <b className="font-num">{selectedNames.length}</b> 個：{selectedNames.join('、')}</span>
              <span className="ml-auto flex flex-none gap-1.5">
                <button type="button" disabled={selectedNames.length < 2 || busy} onClick={() => openMerge(selectedNames)} title={selectedNames.length < 2 ? '至少選兩個才能合併' : undefined} className="h-[34px] rounded-btn bg-oat px-3.5 font-medium text-ink disabled:opacity-50">合併…</button>
                <button type="button" disabled={busy} onClick={() => requestDelete(selectedNames)} className="h-[34px] rounded-btn border-[1.5px] border-rose-soft/40 bg-transparent px-3.5 font-medium text-rose-soft">刪除</button>
                <button type="button" onClick={() => setSelected(new Set())} className="h-[34px] rounded-btn bg-transparent px-3.5 font-medium text-paper">取消選取</button>
              </span>
            </div>
          )}

          {visible.length === 0 ? (
            <p className="m-0 px-4 py-8 text-center text-sm text-ink-2">{query ? `找不到「${query.trim()}」，可以按「新增品牌」加進來。` : '沒有符合條件的品牌。'}</p>
          ) : (
            <>
              <BrandTable
                rows={visible}
                selected={selected}
                dupNames={dupNames}
                renaming={renaming}
                busy={busy}
                onToggle={toggle}
                onToggleAll={(checked) => setSelected(checked ? new Set(visible.map((brand) => brand.name)) : new Set())}
                onStartRename={(name) => setRenaming({ name, value: name })}
                onRenameChange={(value) => setRenaming((current) => current && { ...current, value })}
                onRenameCancel={() => setRenaming(null)}
                onRenameSave={async () => {
                  if (!renaming) return
                  if (await submitRename(renaming.name, renaming.value)) setRenaming(null)
                }}
                onMerge={(name) => openMerge([name])}
                onDelete={(name) => requestDelete([name])}
              />
              <BrandList rows={visible} dupNames={dupNames} selectMode={selectMode} selected={selected} onToggle={toggle} onOpen={(name) => setPanel({ kind: 'actions', seq: nextSeq(), name, renaming: false })} />
            </>
          )}
        </section>
        <p className="m-0 px-1 text-[11px] leading-5 text-ink-3 md:hidden">點一列打開動作：看衣物、改名、合併、刪除。右上「選取」可以一次選多個合併。</p>
      </>
    )
  }

  return (
    <main className="mx-auto grid max-w-[1320px] items-start gap-3 px-3 pb-36 pt-0 md:gap-[18px] md:px-8 md:pb-14 md:pt-7 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-7">
      <section className="flex min-w-0 flex-col gap-3 md:gap-[18px]">
        {/* 手機頂部 */}
        <header className="-mx-3 flex items-center gap-1 border-b-[1.5px] border-dashed border-line-strong py-2 pl-1 pr-2 md:hidden">
          <Link to="/me" aria-label="返回個人資料" className="flex size-11 items-center justify-center text-ink"><Icon name="back" size={22} /></Link>
          <h1 className="m-0 font-hd text-xl">品牌</h1>
          {data && <span className="ml-1 font-num text-xs text-ink-3 tabular">{brands.length}</span>}
          <button type="button" aria-label="新增品牌" onClick={startAdding} className="ml-auto flex size-11 items-center justify-center rounded-btn bg-transparent text-ink"><Icon name="plus" size={22} /></button>
          {brands.length > 1 && (
            <button type="button" aria-pressed={selectMode} onClick={() => { setSelectMode((value) => !value); setSelected(new Set()) }} className="h-11 bg-transparent px-2.5 text-sm font-medium text-mist-deep">
              {selectMode ? '完成' : '選取'}
            </button>
          )}
        </header>

        {/* 桌面標題 */}
        <div className="hidden flex-wrap items-end gap-3 md:flex">
          <div className="mr-auto flex flex-col gap-1.5">
            <ProfileBreadcrumb current="品牌" className="-mt-2" />
            <h1 className="m-0 font-hd text-[32px]">品牌</h1>
            <p className="m-0 text-[13px] text-ink-2">新增衣物時輸入過的品牌都在這裡。改名、合併會一起更新所有衣物。</p>
          </div>
          <Button variant="secondary" onClick={startAdding} className="h-10 px-3.5 text-[13px]"><Icon name="plus" size={16} />新增品牌</Button>
        </div>

        {content}
      </section>

      {desktop && (
        <aside className="sticky top-4 flex flex-col gap-[18px]">
          {panelNode && panel?.kind !== 'actions' ? panelNode : <TipsCard />}
        </aside>
      )}
      {!desktop && panelNode}

      {/* 手機：選取模式的底部動作列 */}
      {selectMode && (
        <div role="toolbar" aria-label="已選取的品牌" className="fixed inset-x-3 bottom-[calc(80px+env(safe-area-inset-bottom))] z-30 flex items-center gap-2 rounded-tile bg-ink py-2 pl-3.5 pr-2 text-[13px] text-paper shadow-float md:hidden">
          <span className="min-w-0 flex-1 truncate">已選 <b className="font-num">{selectedNames.length}</b> 個</span>
          <button type="button" disabled={selectedNames.length < 2 || busy} onClick={() => openMerge(selectedNames)} className="h-11 rounded-btn bg-oat px-3.5 font-medium text-ink disabled:opacity-50">合併…</button>
          <button type="button" disabled={!selectedNames.length || busy} onClick={() => requestDelete(selectedNames)} className="h-11 rounded-btn border-[1.5px] border-rose-soft/40 bg-transparent px-3.5 font-medium text-rose-soft disabled:opacity-50">刪除</button>
        </div>
      )}

      {undo && <UndoToast key={undo.id} undo={undo} onUndo={() => doUndo(undo)} onDone={() => setUndo(null)} />}
      <Toast message={toast} onClose={() => setToast(null)} />
    </main>
  )
}

// ---------- 區塊 ----------

function SearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex h-11 min-w-0 flex-[1_1_220px] items-center gap-2 rounded-btn border-[1.5px] border-line-strong bg-card px-3 text-ink-2 md:h-10 md:bg-paper">
      <Icon name="search" size={16} />
      <input type="search" aria-label="搜尋品牌" placeholder="搜尋品牌" value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3 md:text-sm" />
    </label>
  )
}

function UnusedChip({ active, count, onToggle }: { active: boolean; count: number; onToggle: () => void }) {
  return (
    <button type="button" aria-pressed={active} onClick={onToggle} className={`inline-flex h-11 items-center gap-1 rounded-full border-[1.5px] px-3 text-xs md:h-9 ${active ? 'border-ink bg-ink text-paper' : 'border-line bg-card text-ink'}`}>
      沒用到的 <span className="font-num tabular">{count}</span>
    </button>
  )
}

function DuplicateSection({ groups, busy, onDismiss, onMerge }: { groups: DuplicateGroup[]; busy: boolean; onDismiss: (group: DuplicateGroup) => void; onMerge: (group: DuplicateGroup) => void }) {
  return (
    <section aria-labelledby="dup-title" className="relative flex flex-col gap-2 overflow-hidden rounded-card bg-oat-soft/45 p-3 shadow-paper md:gap-2.5 md:px-[18px] md:py-4">
      <WashBlob accent="oat" className="-right-4 -top-[18px] size-16 rounded-[16px] md:-right-5 md:-top-[22px] md:size-[90px]" tilt={14} />
      <h2 id="dup-title" className="relative m-0 flex items-center gap-2 text-sm font-medium md:text-[15px]">
        <Icon name="alert" size={18} className="text-oat-ink" />可能是同一個品牌<span className="hidden md:inline">（{groups.length} 組）</span>
      </h2>
      {groups.map((group) => (
        <div key={group.key} className="relative flex flex-col gap-2 rounded-tile bg-card p-2.5 md:flex-row md:flex-wrap md:items-center md:px-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {group.brands.map((brand) => (
              <span key={brand.name} className="inline-flex h-7 items-center gap-1 rounded-full bg-tile px-2.5 text-xs">
                {brand.name}<span className="font-num text-ink-3 tabular">{brandTotal(brand)}</span>
              </span>
            ))}
            <Icon name="arrowRight" size={16} className="hidden text-ink-3 md:block" />
            <span className="hidden text-[13px] md:inline">合併成 <b className="font-bold">{group.suggested}</b></span>
          </div>
          <div className="flex items-center gap-1.5 md:ml-auto">
            <span className="text-xs text-ink-2 md:hidden">→ 合併成 <b className="text-ink">{group.suggested}</b></span>
            <button type="button" disabled={busy} onClick={() => onDismiss(group)} className="ml-auto h-11 rounded-btn border-[1.5px] border-line-strong bg-card px-2.5 text-xs font-medium text-ink md:ml-0 md:h-9 md:px-3.5 md:text-[13px]">
              <span className="md:hidden">不是</span><span className="hidden md:inline">不是同一個</span>
            </button>
            <button type="button" disabled={busy} onClick={() => onMerge(group)} className="h-11 rounded-btn border-[1.5px] border-oat-edge bg-oat px-3 text-xs font-medium text-ink md:h-9 md:px-3.5 md:text-[13px]">合併…</button>
          </div>
        </div>
      ))}
    </section>
  )
}

function Checkbox({ checked, onChange, label, mixed = false }: { checked: boolean; onChange: (checked: boolean) => void; label: string; mixed?: boolean }) {
  return (
    <label className="-ml-2 flex size-11 cursor-pointer items-center justify-center">
      <input type="checkbox" checked={checked} aria-label={label} ref={(el) => { if (el) el.indeterminate = mixed }} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" />
      <span aria-hidden="true" className={`flex size-5 items-center justify-center rounded-[6px] border-[1.5px] peer-focus-visible:outline-[2.5px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-mist-deep ${checked || mixed ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-card'}`}>
        {checked ? <Icon name="check" size={14} /> : mixed ? <Icon name="minus" size={14} /> : null}
      </span>
    </label>
  )
}

const TABLE_COLS = 'grid grid-cols-[40px_minmax(0,1fr)_64px_64px_96px_168px] items-center px-3'

function BrandTable({
  rows, selected, dupNames, renaming, busy, onToggle, onToggleAll, onStartRename, onRenameChange, onRenameCancel, onRenameSave, onMerge, onDelete,
}: {
  rows: BrandSummary[]
  selected: Set<string>
  dupNames: Set<string>
  renaming: { name: string; value: string } | null
  busy: boolean
  onToggle: (name: string) => void
  onToggleAll: (checked: boolean) => void
  onStartRename: (name: string) => void
  onRenameChange: (value: string) => void
  onRenameCancel: () => void
  onRenameSave: () => void
  onMerge: (name: string) => void
  onDelete: (name: string) => void
}) {
  const selectedVisible = rows.filter((row) => selected.has(row.name)).length
  const all = selectedVisible === rows.length
  return (
    <div role="table" aria-label="品牌" className="hidden md:block">
      <div role="row" className={`${TABLE_COLS} min-h-10 text-xs text-ink-3`}>
        <span role="columnheader"><Checkbox checked={all} mixed={!all && selectedVisible > 0} label="全選" onChange={onToggleAll} /></span>
        <span role="columnheader">名稱</span>
        <span role="columnheader" className="text-right">衣櫃</span>
        <span role="columnheader" className="text-right">選購</span>
        <span role="columnheader" className="pl-3.5">最後使用</span>
        <span role="columnheader" className="text-right">動作</span>
      </div>
      {rows.map((row) => {
        const on = selected.has(row.name)
        const editing = renaming?.name === row.name
        return (
          <div key={row.name} role="row" className={`${TABLE_COLS} min-h-14 border-t-[1.5px] border-dashed border-line text-sm ${on ? 'bg-oat-soft/60' : editing ? 'bg-paper' : ''}`}>
            <span role="cell"><Checkbox checked={on} label={`選取 ${row.name}`} onChange={() => onToggle(row.name)} /></span>
            <span role="cell" className="flex min-w-0 items-center gap-2 pr-2">
              {editing ? (
                <form className="flex min-w-0 flex-1 items-center gap-1" onSubmit={(event) => { event.preventDefault(); onRenameSave() }}>
                  <input
                    aria-label="品牌名稱"
                    autoFocus
                    maxLength={60}
                    value={renaming.value}
                    onChange={(event) => onRenameChange(event.target.value)}
                    onKeyDown={(event) => event.key === 'Escape' && onRenameCancel()}
                    className="h-[38px] min-w-0 flex-1 rounded-sm border-[1.5px] border-mist-deep bg-card px-2.5 text-sm font-medium text-ink outline-none"
                  />
                  <button type="submit" disabled={busy} aria-label="儲存名稱" className="flex size-10 flex-none items-center justify-center rounded-sm bg-ink text-paper"><Icon name="check" size={16} /></button>
                  <button type="button" aria-label="取消改名" onClick={onRenameCancel} className="flex size-10 flex-none items-center justify-center rounded-sm bg-transparent text-ink-2"><Icon name="x" size={16} /></button>
                </form>
              ) : (
                <>
                  <span className="truncate font-medium">{row.name}</span>
                  {dupNames.has(row.name) && <span className="inline-flex h-[22px] flex-none items-center rounded-full bg-oat-soft px-2 text-[11px] text-oat-ink">可能重複</span>}
                </>
              )}
            </span>
            <span role="cell" className={`text-right font-num tabular ${row.closetCount ? 'text-ink' : 'text-ink-3'}`}>{row.closetCount}</span>
            <span role="cell" className={`text-right font-num tabular ${row.wishCount ? 'text-ink' : 'text-ink-3'}`}>{row.wishCount}</span>
            <span role="cell" className="pl-3.5 font-num text-[13px] text-ink-2 tabular">{brandDateLabel(row.lastUsed)}</span>
            <span role="cell" className="flex justify-end gap-0.5">
              <Link to={closetLink(row.name)} aria-label={`看 ${row.name} 的衣物`} className="flex size-10 items-center justify-center rounded-sm text-ink-2 hover:bg-tile"><Icon name="eye" size={18} /></Link>
              <button type="button" aria-label={`改名 ${row.name}`} onClick={() => onStartRename(row.name)} className="flex size-10 items-center justify-center rounded-sm bg-transparent text-ink-2 hover:bg-tile"><Icon name="edit" size={18} /></button>
              <button type="button" aria-label={`把 ${row.name} 合併到其他品牌`} onClick={() => onMerge(row.name)} className="flex size-10 items-center justify-center rounded-sm bg-transparent text-ink-2 hover:bg-tile"><Icon name="merge" size={18} /></button>
              <button type="button" aria-label={`刪除 ${row.name}`} disabled={busy} onClick={() => onDelete(row.name)} className="flex size-10 items-center justify-center rounded-sm bg-transparent text-rose-deep hover:bg-rose-soft"><Icon name="trash" size={18} /></button>
            </span>
          </div>
        )
      })}
    </div>
  )
}

function BrandList({ rows, dupNames, selectMode, selected, onToggle, onOpen }: { rows: BrandSummary[]; dupNames: Set<string>; selectMode: boolean; selected: Set<string>; onToggle: (name: string) => void; onOpen: (name: string) => void }) {
  return (
    <ul className="m-0 list-none p-0 md:hidden">
      {rows.map((row, index) => {
        const on = selected.has(row.name)
        const total = brandTotal(row)
        return (
          <li key={row.name} className={index ? 'border-t-[1.5px] border-dashed border-line' : ''}>
            <button
              type="button"
              aria-pressed={selectMode ? on : undefined}
              onClick={() => (selectMode ? onToggle(row.name) : onOpen(row.name))}
              className={`flex min-h-[60px] w-full items-center gap-2.5 rounded-sm bg-transparent py-2 pl-3 pr-1 text-left text-ink ${on ? 'bg-oat-soft/60' : ''}`}
            >
              {selectMode && (
                <span aria-hidden="true" className={`flex size-5 flex-none items-center justify-center rounded-[6px] border-[1.5px] ${on ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-card'}`}>{on && <Icon name="check" size={14} />}</span>
              )}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex min-w-0 items-center gap-1.5 text-[15px] font-medium">
                  <span className="truncate">{row.name}</span>
                  {dupNames.has(row.name) && <span className="inline-flex h-5 flex-none items-center rounded-full bg-oat-soft px-2 text-[10px] text-oat-ink">可能重複</span>}
                </span>
                <span className="text-[11px] text-ink-3">衣櫃 <span className="font-num tabular">{row.closetCount}</span>・選購 <span className="font-num tabular">{row.wishCount}</span>・最後用 <span className="font-num tabular">{brandDateLabel(row.lastUsed)}</span></span>
              </span>
              <span className={`font-num text-sm font-bold tabular ${total ? 'text-ink' : 'text-ink-3'}`}>{total}</span>
              {!selectMode && <Icon name="next" size={18} className="text-ink-3" />}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function TipsCard() {
  return (
    <PaperCard className="relative flex flex-col gap-2.5 p-[18px]">
      <Tape accent="oat" />
      <h2 className="m-0 font-hd text-[21px]">整理品牌</h2>
      <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[13px] leading-6 text-ink-2">
        <li>勾選兩個以上的品牌，可以一次合併成同一個名稱。</li>
        <li>改名、合併會一起更新衣櫃和選購清單裡的品牌。</li>
        <li>刪除後 10 秒內可以復原。</li>
      </ul>
    </PaperCard>
  )
}

// ---------- 合併／刪除／動作面板 ----------

/** 桌面：右側紙卡；手機與平板：bottom sheet */
function PanelShell({ desktop, alert = false, tall = false, onClose, children }: { desktop: boolean; alert?: boolean; tall?: boolean; onClose: () => void; children: (titleId: string) => ReactNode }) {
  const titleId = useId()
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') onClose()
  }
  if (desktop) {
    return (
      <section ref={ref} tabIndex={-1} role={alert ? 'alertdialog' : 'dialog'} aria-labelledby={titleId} onKeyDown={onKeyDown} className="relative flex flex-col gap-3 rounded-card bg-card p-[18px] shadow-paper outline-none">
        <Tape accent={alert ? 'rose' : 'oat'} />
        {children(titleId)}
      </section>
    )
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-scrim md:items-center md:justify-center md:p-6" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section
        ref={ref}
        tabIndex={-1}
        role={alert ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className={`flex w-full flex-col gap-3.5 overflow-y-auto rounded-t-block bg-card px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-2 shadow-sheet outline-none md:max-w-lg md:rounded-block md:p-6 ${tall ? 'h-[calc(100dvh-96px)] md:h-auto md:max-h-[85dvh]' : 'max-h-[90dvh]'}`}
      >
        <span aria-hidden="true" className="h-1 w-10 flex-none self-center rounded-sm bg-line-strong md:hidden" />
        {children(titleId)}
      </section>
    </div>
  )
}

function RadioRow({ name, checked, onChange, dashed = false, children }: { name: string; checked: boolean; onChange: () => void; dashed?: boolean; children: ReactNode }) {
  return (
    <label className={`flex min-h-[54px] cursor-pointer items-center gap-3 rounded-tile px-3.5 text-[15px] lg:min-h-[46px] lg:gap-2.5 lg:rounded-btn lg:px-3 lg:text-sm ${checked ? 'border-2 border-ink bg-oat-soft/45' : `border-[1.5px] ${dashed ? 'border-dashed border-line-strong text-ink-2' : 'border-line'} bg-card`}`}>
      <input type="radio" name={name} checked={checked} onChange={onChange} className="m-0 size-5 flex-none accent-ink lg:size-[18px]" />
      {children}
    </label>
  )
}

function MergePanel({ desktop, brands, initialNames, initialKeep, busy, onCancel, onConfirm }: { desktop: boolean; brands: BrandSummary[]; initialNames: string[]; initialKeep?: string; busy: boolean; onCancel: () => void; onConfirm: (names: string[], keep: string) => void }) {
  const byName = new Map(brands.map((brand) => [brand.name, brand]))
  const [names, setNames] = useState(initialNames)
  const members = names.map((name) => byName.get(name)).filter((brand): brand is BrandSummary => !!brand)
  const fallbackKeep = [...members].sort((a, b) => brandTotal(b) - brandTotal(a))[0]?.name ?? NEW_NAME
  const [keep, setKeep] = useState(initialKeep ?? fallbackKeep)
  const [newName, setNewName] = useState('')
  const [picking, setPicking] = useState(initialNames.length < 2)
  const radioName = useId()
  const others = brands.filter((brand) => !names.includes(brand.name)).sort((a, b) => a.name.localeCompare(b.name, 'zh-TW', { sensitivity: 'base' }))

  const keepName = keep === NEW_NAME ? newName.trim() : keep
  const closetSum = members.reduce((sum, brand) => sum + brand.closetCount, 0)
  const wishSum = members.reduce((sum, brand) => sum + brand.wishCount, 0)
  const removed = names.filter((name) => name !== keepName)
  const ready = names.length >= 2 && !!keepName

  const removeName = (name: string) => {
    setNames((current) => current.filter((item) => item !== name))
    if (keep === name) setKeep(NEW_NAME)
  }

  return (
    <PanelShell desktop={desktop} tall onClose={onCancel}>
      {(titleId) => (
        <>
          <div className="flex items-center">
            <h2 id={titleId} className="m-0 font-hd text-[22px] lg:text-[21px]">合併品牌</h2>
            {!desktop && <button type="button" aria-label="關閉" onClick={onCancel} className="ml-auto flex size-11 items-center justify-center bg-transparent text-ink"><Icon name="x" size={22} /></button>}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-ink-2">要合併的</span>
            <div className="flex flex-wrap gap-1.5">
              {members.map((brand) => (
                <span key={brand.name} className="inline-flex h-8 items-center gap-1 rounded-full bg-tile pl-2.5 pr-1 text-[13px]">
                  {brand.name}<span className="font-num text-ink-3 tabular">{brandTotal(brand)}</span>
                  <button type="button" aria-label={`不要合併 ${brand.name}`} onClick={() => removeName(brand.name)} className="flex size-7 items-center justify-center rounded-full bg-transparent text-ink-3 hover:bg-line"><Icon name="x" size={13} /></button>
                </span>
              ))}
              {!picking && others.length > 0 && (
                <button type="button" onClick={() => setPicking(true)} className="inline-flex h-8 items-center rounded-full border-[1.5px] border-dashed border-line-strong bg-card px-2.5 text-[13px] text-mist-deep">＋ 再加一個</button>
              )}
            </div>
            {picking && others.length > 0 && (
              <Select
                label="選一個要一起合併的品牌"
                value=""
                options={others.map((brand) => ({ value: brand.name, label: brand.name, hint: `${brandTotal(brand)} 件` }))}
                onChange={(value) => {
                  setNames((current) => [...current, value])
                  setPicking(false)
                  if (keep === NEW_NAME && !newName) setKeep(value)
                }}
                display={<span className="flex items-center gap-2 text-ink-2"><Icon name="plus" size={16} />選一個要一起合併的品牌</span>}
                className="mt-1"
                triggerClassName="h-11 w-full rounded-btn border-[1.5px] border-mist-deep bg-card px-3 text-sm"
              />
            )}
          </div>

          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0 lg:gap-1.5">
            <legend className="mb-2 p-0 text-[13px] font-medium lg:font-normal lg:text-ink-2">要保留哪一個名稱？</legend>
            {members.map((brand) => (
              <RadioRow key={brand.name} name={radioName} checked={keep === brand.name} onChange={() => setKeep(brand.name)}>
                {brand.name}<span className="ml-auto font-num text-xs text-ink-2 tabular">{brandTotal(brand)} 件</span>
              </RadioRow>
            ))}
            <RadioRow name={radioName} checked={keep === NEW_NAME} onChange={() => setKeep(NEW_NAME)} dashed>取一個新名稱…</RadioRow>
            {keep === NEW_NAME && (
              <input
                aria-label="新的品牌名稱"
                autoFocus
                maxLength={60}
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="輸入合併後的名稱"
                className="h-11 rounded-btn border-[1.5px] border-mist-deep bg-card px-3 text-base text-ink outline-none lg:text-sm"
              />
            )}
          </fieldset>

          {ready ? (
            <p className="m-0 rounded-tile bg-sage-soft px-3.5 py-3 text-[13px] leading-[1.7] text-sage-ink lg:rounded-btn lg:px-3 lg:py-2.5">
              <b className="font-num">{closetSum}</b> 件衣物{wishSum > 0 && <>和 <b className="font-num">{wishSum}</b> 件選購</>}的品牌會改成 <b>{keepName}</b>
              {removed.length > 0 && <>；{quoteList(removed)}會從清單移除</>}。
            </p>
          ) : (
            <p className="m-0 rounded-tile bg-tile px-3.5 py-3 text-[13px] leading-6 text-ink-2">{names.length < 2 ? '再加一個要合併的品牌。' : '請輸入合併後的名稱。'}</p>
          )}

          <div className={desktop ? 'flex justify-end gap-2' : 'mt-auto grid grid-cols-[1fr_1.6fr] gap-2'}>
            <Button variant="secondary" onClick={onCancel} className={desktop ? 'h-10 px-3.5 text-[13px]' : 'h-[52px] rounded-tile text-[15px]'}>取消</Button>
            <Button variant="primary" disabled={!ready || busy} onClick={() => onConfirm(names, keepName)} className={desktop ? 'h-10 px-3.5 text-[13px]' : 'h-[52px] min-w-0 rounded-tile text-[15px]'}>
              {busy ? '合併中…' : desktop ? '合併' : <span className="truncate">合併成 {keepName || '…'}</span>}
            </Button>
          </div>
        </>
      )}
    </PanelShell>
  )
}

function DeletePanel({ desktop, brands, names, busy, onCancel, onConfirm }: { desktop: boolean; brands: BrandSummary[]; names: string[]; busy: boolean; onCancel: () => void; onConfirm: (names: string[], to: string | null) => void }) {
  const [mode, setMode] = useState<'clear' | 'move'>('clear')
  const [target, setTarget] = useState('')
  const radioName = useId()
  const members = brands.filter((brand) => names.includes(brand.name))
  const closetSum = members.reduce((sum, brand) => sum + brand.closetCount, 0)
  const wishSum = members.reduce((sum, brand) => sum + brand.wishCount, 0)
  const others = brands.filter((brand) => !names.includes(brand.name)).sort((a, b) => a.name.localeCompare(b.name, 'zh-TW', { sensitivity: 'base' }))
  const title = names.length === 1 ? `刪除「${names[0]}」？` : `刪除 ${names.length} 個品牌？`
  const ready = mode === 'clear' || !!target

  return (
    <PanelShell desktop={desktop} alert onClose={onCancel}>
      {(titleId) => (
        <>
          {desktop && <span className="text-[11px] text-ink-3">刪除還有衣物在用的品牌時</span>}
          <h2 id={titleId} className="m-0 mt-1 font-hd text-[22px] lg:mt-0 lg:text-[21px]">{title}</h2>
          <p className="m-0 text-sm leading-[1.7] text-ink-2 lg:text-[13px]">
            還有 <b className="font-num text-ink">{closetSum}</b> 件衣物{wishSum > 0 && <>和 <b className="font-num text-ink">{wishSum}</b> 件選購</>}用{names.length === 1 ? '這個品牌' : '這些品牌'}。要怎麼處理它們？
          </p>
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0 lg:gap-1.5">
            <legend className="sr-only">衣物的品牌要怎麼處理</legend>
            <RadioRow name={radioName} checked={mode === 'clear'} onChange={() => setMode('clear')}>品牌欄位清空</RadioRow>
            <RadioRow name={radioName} checked={mode === 'move'} onChange={() => setMode('move')}>改成另一個品牌…</RadioRow>
            {mode === 'move' && (
              others.length ? (
                <Select
                  label="改成哪一個品牌"
                  value={target}
                  options={others.map((brand) => ({ value: brand.name, label: brand.name, hint: `${brandTotal(brand)} 件` }))}
                  onChange={setTarget}
                  placeholder="選擇品牌"
                  triggerClassName="h-11 w-full rounded-btn border-[1.5px] border-mist-deep bg-card px-3 text-sm text-ink"
                />
              ) : <span className="text-xs text-ink-2">沒有其他品牌可以選。</span>
            )}
          </fieldset>
          <span className="text-xs leading-5 text-ink-3">沒有衣物在用的品牌會直接刪除，不跳這個確認。刪除後 10 秒內可以復原。</span>
          <div className={desktop ? 'flex justify-end gap-2' : 'grid grid-cols-2 gap-2'}>
            <Button variant="secondary" onClick={onCancel} className={desktop ? 'h-10 px-3.5 text-[13px]' : 'h-[52px] rounded-tile text-[15px]'}>取消</Button>
            <Button variant="danger" disabled={!ready || busy} onClick={() => onConfirm(names, mode === 'clear' ? null : target)} className={desktop ? 'h-10 px-3.5 text-[13px]' : 'h-[52px] rounded-tile text-[15px]'}>
              {busy ? '刪除中…' : '刪除'}
            </Button>
          </div>
        </>
      )}
    </PanelShell>
  )
}

function ActionsSheet({ brand, renaming, busy, onToggleRename, onRename, onMerge, onDelete, onClose }: { brand: BrandSummary; renaming: boolean; busy: boolean; onToggleRename: () => void; onRename: (value: string) => void; onMerge: () => void; onDelete: () => void; onClose: () => void }) {
  const [value, setValue] = useState(brand.name)
  const inputId = useId()
  const total = brandTotal(brand)
  const actionClass = 'flex min-h-14 w-full items-center gap-3 border-0 border-t-[1.5px] border-dashed border-line bg-transparent px-1 text-left text-[15px] font-medium text-ink no-underline'
  return (
    <PanelShell desktop={false} onClose={onClose}>
      {(titleId) => (
        <div className="flex flex-col">
          <div className="flex items-baseline gap-2 px-1 pb-3 pt-2.5">
            <h2 id={titleId} className="m-0 min-w-0 truncate font-hd text-[22px]">{brand.name}</h2>
            <span className="flex-none text-xs text-ink-3">衣櫃 <span className="font-num tabular">{brand.closetCount}</span>・選購 <span className="font-num tabular">{brand.wishCount}</span></span>
          </div>
          {renaming && (
            <form
              className="mb-2 flex flex-col gap-1.5 rounded-tile bg-paper px-3 py-2.5"
              onSubmit={(event) => {
                event.preventDefault()
                onRename(value)
              }}
            >
              <label htmlFor={inputId} className="text-xs text-ink-2">新的名稱</label>
              <div className="flex gap-1.5">
                <input id={inputId} autoFocus maxLength={60} value={value} onChange={(event) => setValue(event.target.value)} className="h-[46px] min-w-0 flex-1 rounded-btn border-[1.5px] border-mist-deep bg-card px-3 text-base font-medium text-ink outline-none" />
                <Button type="submit" variant="primary" disabled={busy} className="h-[46px] px-3.5">儲存</Button>
              </div>
              <span className="text-[11px] leading-5 text-ink-3">{total ? `會一起更新 ${total} 件。` : ''}改成已經有的名稱時，會改問要不要合併。</span>
            </form>
          )}
          <Link to={closetLink(brand.name)} className={`${actionClass} border-t-0`}>
            <Icon name="eye" size={22} />看這個品牌的衣物<small className="ml-auto font-num text-xs font-normal text-ink-3">{brand.closetCount} 件</small>
          </Link>
          <button type="button" aria-expanded={renaming} onClick={onToggleRename} className={actionClass}><Icon name="edit" size={22} />改名</button>
          <button type="button" onClick={onMerge} className={actionClass}><Icon name="merge" size={22} />合併到其他品牌…</button>
          <button type="button" onClick={onDelete} disabled={busy} className={`${actionClass} text-rose-deep`}><Icon name="trash" size={22} />刪除…</button>
          <Button variant="secondary" onClick={onClose} className="mt-2.5 h-[50px] rounded-tile text-[15px]">關閉</Button>
        </div>
      )}
    </PanelShell>
  )
}

function UndoToast({ undo, onUndo, onDone }: { undo: Undo; onUndo: () => void; onDone: () => void }) {
  const [left, setLeft] = useState(10)
  useEffect(() => {
    const timer = window.setInterval(() => setLeft((value) => value - 1), 1000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    if (left <= 0) onDone()
  }, [left, onDone])
  return (
    <div role="status" className="fixed inset-x-4 top-4 z-[60] mx-auto flex max-w-md items-center gap-2.5 rounded-card bg-ink py-2.5 pl-3.5 pr-2.5 text-[13px] text-paper shadow-float md:bottom-8 md:top-auto">
      <span className="min-w-0 flex-1 truncate">{undo.label}</span>
      <span className="font-num text-[11px] text-line-strong tabular" aria-hidden="true">{Math.max(left, 0)} 秒</span>
      <button type="button" onClick={onUndo} className="h-11 rounded-sm bg-oat px-3 font-medium text-ink md:h-9">復原</button>
    </div>
  )
}
