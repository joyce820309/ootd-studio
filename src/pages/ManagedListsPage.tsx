import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { DestructiveActionDialog } from '@/components/ui/B10States'
import { Icon } from '@/components/ui/Icon'
import { LoadingState, PageState } from '@/components/ui/PageState'
import { PaperCard } from '@/components/ui/Paper'
import { Select, type SelectOption } from '@/components/ui/Select'
import { Toast, type ToastMessage } from '@/components/ui/Toast'
import { ProfileBreadcrumb } from '@/components/layout/ProfileNav'
import { brandTotal, findDuplicateGroups, normalizeBrand, type DuplicateGroup } from '@/lib/brands'
import { useProfileNav } from '@/lib/profileNav'
import { createManagedEntry, fetchManagedList, markManagedEntriesDistinct, replaceManagedEntries, restoreManagedEntries, updateManagedEntry, type ManagedListKind, type ManagedListFields } from '@/lib/data'
import type { ManagedEntryChange, ManagedListSummary, ShopKind } from '@/types'

interface Props {
  kind: ManagedListKind
}

interface Draft extends ManagedListFields {
  originalName?: string
  isDefault?: boolean
}

type Panel = { kind: 'edit'; draft: Draft } | { kind: 'merge'; names: string[]; keep: string } | { kind: 'delete'; names: string[] }
type Filter = 'all' | 'online' | 'physical' | 'other' | 'used' | 'unused' | 'hidden'
interface UndoState { id: number; changes: ManagedEntryChange[]; hiddenMaterials?: string[]; label: string }

const SHOP_KINDS: SelectOption<ShopKind>[] = [
  { value: 'online', label: '網路' },
  { value: 'physical', label: '實體' },
  { value: 'other', label: '未分類' },
]
const SORTS: SelectOption<'order' | 'usage' | 'recent' | 'name'>[] = [
  { value: 'order', label: '自訂順序' },
  { value: 'usage', label: '使用件數' },
  { value: 'recent', label: '最近使用' },
  { value: 'name', label: '名稱 A–Z' },
]
const quote = (names: string[]) => names.map((name) => `「${name}」`).join('、')

function normalizeKey(value: string) {
  return normalizeBrand(value)
}

function errorMessage(cause: unknown) {
  const error = cause as { code?: string; message?: string }
  if (['42P01', 'PGRST205', 'PGRST202', '42883'].includes(error?.code ?? '')) return '通路與材質清單尚未建立，請先在 Supabase 執行 supabase/migrations/0012_managed_shops_materials.sql。'
  return error?.message || '操作沒有完成，請稍後再試。'
}

export function ShopsPage() {
  return <ManagedListsPage kind="shops" />
}

export function MaterialsPage() {
  return <ManagedListsPage kind="materials" />
}

function ManagedListsPage({ kind }: Props) {
  const isShop = kind === 'shops'
  const title = isShop ? '購買通路' : '材質'
  const route = isShop ? '/me/shops' : '/me/materials'
  const [entries, setEntries] = useState<ManagedListSummary[]>([])
  const [distinct, setDistinct] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<'order' | 'usage' | 'recent' | 'name'>('order')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [panel, setPanel] = useState<Panel | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [undo, setUndo] = useState<UndoState | null>(null)
  const profileNav = useProfileNav()

  useEffect(() => {
    let alive = true
    fetchManagedList(kind, true).then((data) => {
      if (!alive) return
      setEntries(data.entries)
      setDistinct(data.distinctGroups)
      setLoadError(null)
    }).catch((cause) => alive && setLoadError(errorMessage(cause))).finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [kind, reloadKey])

  useEffect(() => {
    if (!undo) return
    const timer = window.setTimeout(() => setUndo(null), 10_000)
    return () => window.clearTimeout(timer)
  }, [undo])

  useEffect(() => {
    if (entries.length || !loading) profileNav?.setNavCount(route, entries.filter((entry) => !entry.isHidden).length)
  }, [entries, loading, profileNav, route])

  const duplicateGroups = useMemo(() => findDuplicateGroups(entries as (ManagedListSummary & { lastUsed: string | null })[], distinct), [entries, distinct])
  const visible = useMemo(() => {
    const search = normalizeKey(query)
    return entries.filter((entry) => {
      if (search && !normalizeKey(`${entry.name} ${(entry.aliases ?? []).join(' ')}`).includes(search)) return false
      if (filter === 'online' || filter === 'physical' || filter === 'other') return entry.kind === filter
      if (filter === 'used') return brandTotal(entry) > 0 && !entry.isHidden
      if (filter === 'unused') return brandTotal(entry) === 0 && !entry.isHidden
      if (filter === 'hidden') return !!entry.isHidden
      return !entry.isHidden
    }).sort((a, b) => {
      if (sort === 'usage') return brandTotal(b) - brandTotal(a) || a.name.localeCompare(b.name, 'zh-TW')
      if (sort === 'recent') return (b.lastUsed ?? '').localeCompare(a.lastUsed ?? '') || a.name.localeCompare(b.name, 'zh-TW')
      if (sort === 'name') return a.name.localeCompare(b.name, 'zh-TW')
      return (a.sortOrder ?? 500) - (b.sortOrder ?? 500) || a.name.localeCompare(b.name, 'zh-TW')
    })
  }, [entries, filter, query, sort])

  function reload() {
    setLoading(true)
    setReloadKey((value) => value + 1)
  }

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true)
    try {
      await action()
      setToast({ tone: 'success', text: success })
      setSelected(new Set())
      setSelectMode(false)
      reload()
      return true
    } catch (cause) {
      setToast({ tone: 'error', text: errorMessage(cause) })
      return false
    } finally {
      setBusy(false)
    }
  }

  function openEditor(entry?: ManagedListSummary) {
    setPanel({ kind: 'edit', draft: entry ? {
      originalName: entry.name,
      name: entry.name,
      kind: entry.kind ?? 'other',
      url: entry.url ?? '',
      aliases: entry.aliases ?? [],
      sortOrder: entry.sortOrder ?? 500,
      isHidden: entry.isHidden ?? false,
      isDefault: entry.isDefault ?? false,
    } : { name: '', kind: 'other', url: '', aliases: [], sortOrder: entries.length ? Math.max(...entries.map((item) => item.sortOrder ?? 100)) + 10 : 10, isHidden: false } })
  }

  function merge(names: string[], keep?: string) {
    const defaultKeep = keep ?? names[0] ?? ''
    setPanel({ kind: 'merge', names, keep: defaultKeep })
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (panel?.kind !== 'edit') return
    const draft = panel.draft
    const name = draft.name.trim()
    if (!name) return setToast({ tone: 'error', text: `請輸入${isShop ? '通路' : '材質'}名稱。` })
    if (draft.originalName && name !== draft.originalName) {
      const existing = entries.find((entry) => normalizeKey(entry.name) === normalizeKey(name))
      if (existing) {
        setPanel({ kind: 'merge', names: [draft.originalName, existing.name], keep: existing.name })
        return
      }
    }
    setBusy(true)
    try {
      if (draft.originalName) await updateManagedEntry(kind, draft.originalName, { ...draft, name })
      else await createManagedEntry(kind, { ...draft, name })
      setPanel(null)
      setToast({ tone: 'success', text: `${isShop ? '購買通路' : '材質'}已${draft.originalName ? '更新' : '新增'}。` })
      reload()
    } catch (cause) {
      setToast({ tone: 'error', text: errorMessage(cause) })
    } finally {
      setBusy(false)
    }
  }

  async function doMerge() {
    if (panel?.kind !== 'merge') return
    if (!panel.keep) return setToast({ tone: 'error', text: '請選擇合併後保留的名稱。' })
    const names = panel.names
    const keep = panel.keep
    const success = await run(() => replaceManagedEntries(kind, names, keep), `已合併為「${keep}」，相關衣物與選購清單已更新。`)
    if (success) setPanel(null)
  }

  async function doDelete(names: string[]) {
    if (kind === 'materials' && names.some((name) => entries.find((entry) => entry.name === name)?.isDefault)) {
      const builtins = names.filter((name) => entries.find((entry) => entry.name === name)?.isDefault)
      const custom = names.filter((name) => !builtins.includes(name))
      setBusy(true)
      try {
        const changes: ManagedEntryChange[] = []
        for (const name of builtins) await updateManagedEntry('materials', name, { name, isHidden: true })
        if (custom.length) changes.push(...await replaceManagedEntries('materials', custom, null))
        setUndo({ id: Date.now(), changes, hiddenMaterials: builtins, label: '已隱藏預設材質或刪除自訂材質' })
        setToast({ tone: 'success', text: '已完成材質清單整理。' })
        setPanel(null)
        reload()
      } catch (cause) {
        setToast({ tone: 'error', text: errorMessage(cause) })
      } finally {
        setBusy(false)
      }
      return
    }
    setBusy(true)
    try {
      const changes = await replaceManagedEntries(kind, names, null)
      setSelected(new Set())
      setSelectMode(false)
      setUndo({ id: Date.now(), changes, label: names.length === 1 ? `已刪除${isShop ? '通路' : '材質'}「${names[0]}」` : `已刪除 ${names.length} 個${isShop ? '通路' : '材質'}` })
      setPanel(null)
      reload()
    } catch (cause) {
      setToast({ tone: 'error', text: errorMessage(cause) })
    } finally {
      setBusy(false)
    }
  }

  async function undoDelete() {
    if (!undo) return
    setBusy(true)
    try {
      await restoreManagedEntries(kind, undo.changes)
      if (kind === 'materials') {
        for (const name of undo.hiddenMaterials ?? []) await updateManagedEntry('materials', name, { name, isHidden: false })
      }
      setToast({ tone: 'success', text: `${undo.label}，已復原。` })
      setUndo(null)
      reload()
    } catch (cause) {
      setToast({ tone: 'error', text: errorMessage(cause) })
    } finally {
      setBusy(false)
    }
  }

  async function toggleMaterialVisibility(entry: ManagedListSummary) {
    await run(() => updateManagedEntry(kind, entry.name, { ...entry, name: entry.name, isHidden: !entry.isHidden }), entry.isHidden ? `已顯示「${entry.name}」。` : `已隱藏「${entry.name}」。`)
  }

  async function moveMaterial(entry: ManagedListSummary, offset: -1 | 1) {
    const ordered = [...entries].filter((item) => !item.isHidden).sort((a, b) => (a.sortOrder ?? 500) - (b.sortOrder ?? 500))
    const index = ordered.findIndex((item) => item.name === entry.name)
    const target = ordered[index + offset]
    if (!target) return
    const first = Math.min(index, index + offset)
    const next = [...ordered]
    ;[next[index], next[index + offset]] = [next[index + offset], next[index]]
    await run(async () => {
      await updateManagedEntry(kind, next[first].name, { ...next[first], name: next[first].name, sortOrder: next[first].sortOrder ?? first * 10 })
      await updateManagedEntry(kind, next[first + 1].name, { ...next[first + 1], name: next[first + 1].name, sortOrder: next[first + 1].sortOrder ?? (first + 1) * 10 })
      const updates = next.map((item, order) => updateManagedEntry(kind, item.name, { ...item, name: item.name, sortOrder: order * 10 }))
      await Promise.all(updates)
    }, '材質順序已更新。')
  }

  async function dismissDuplicate(group: DuplicateGroup) {
    await run(() => markManagedEntriesDistinct(kind, group.key), '已記住這些名稱不是同一項。')
  }

  function toggleSelected(name: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const panelNode = panel?.kind === 'edit' ? <EditEntryPanel key={`edit-${panel.draft.originalName ?? 'new'}`} kind={kind} draft={panel.draft} busy={busy} onChange={(draft) => setPanel({ kind: 'edit', draft })} onCancel={() => setPanel(null)} onSubmit={saveDraft} />
    : panel?.kind === 'merge' ? <MergeEntryPanel kind={kind} names={panel.names} keep={panel.keep} busy={busy} onChange={(keep) => setPanel({ kind: 'merge', names: panel.names, keep })} onCancel={() => setPanel(null)} onConfirm={() => void doMerge()} />
      : panel?.kind === 'delete' ? <DestructiveActionDialog title={`刪除${isShop ? '通路' : '材質'}？`} description={`將刪除${quote(panel.names)}${isShop ? '，衣物通路會清空、選購通路會改為「尚未決定」。' : '，並從相關衣物與選購商品中移除。'}此操作無法復原。`} onCancel={() => setPanel(null)} onConfirm={() => void doDelete(panel.names)} /> : null

  return (
    <main className="mx-auto flex max-w-[1320px] min-w-0 flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <ProfileBreadcrumb current={title} />
      <header className="flex flex-wrap items-end gap-3">
        <div className="mr-auto min-w-0 space-y-1">
          <h1 className="m-0 font-hd text-3xl text-ink">{title}</h1>
          <p className="m-0 text-sm leading-6 text-ink-2">{isShop ? '管理常用店家與網站；改名、合併時會一起更新衣物和選購清單。' : '管理新增衣物時可選的材質；比例依每件衣物的標籤分別記錄。'}</p>
        </div>
        <Button variant="oat" onClick={() => openEditor()}><Icon name="plus" />新增{isShop ? '通路' : '材質'}</Button>
      </header>
      {loading && !entries.length ? <LoadingState label={`正在載入${title}…`} /> : loadError ? <PageState icon="alert" tone="rose" title={`${title}載入失敗`} description={loadError} action={<Button variant="secondary" onClick={reload}>重新載入</Button>} /> : <>
        {duplicateGroups.length > 0 && <section aria-label="可能重複" className="space-y-2 rounded-card bg-oat-soft p-3 sm:p-4">
          <h2 className="m-0 flex items-center gap-2 text-sm font-medium"><Icon name="alert" size={17} />可能重複的名稱</h2>
          {duplicateGroups.slice(0, 3).map((group) => <div key={group.key} className="flex flex-wrap items-center gap-2 rounded-tile bg-card p-3 text-sm"><span className="min-w-0 flex-1">{group.brands.map((entry) => entry.name).join('／')}</span><Button variant="ghost" onClick={() => void dismissDuplicate(group)}>不是同一個</Button><Button variant="oat" onClick={() => merge(group.brands.map((entry) => entry.name), group.suggested)}>合併…</Button></div>)}
        </section>}
        <PaperCard className="space-y-3 p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-11 min-w-0 flex-1 basis-48 items-center gap-2 rounded-btn border-[1.5px] border-line bg-paper px-3 text-ink-2"><Icon name="search" size={17} /><input type="search" aria-label={`搜尋${title}`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`搜尋${title}`} className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
            <Select label="排序方式" value={sort} options={SORTS} onChange={setSort} className="w-40" />
            <Button variant="ghost" onClick={() => { setSelectMode((value) => !value); setSelected(new Set()) }}>{selectMode ? '完成' : '選取'}</Button>
          </div>
          <div role="group" aria-label={`${title}篩選`} className="flex flex-wrap gap-1.5">{(isShop ? [['all', '全部'], ['online', '網路'], ['physical', '實體'], ['other', '未分類']] : [['all', '全部'], ['used', '使用中'], ['unused', '未使用'], ['hidden', '已隱藏']]).map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value as Filter)} className={`min-h-9 rounded-full px-3 text-xs ${filter === value ? 'bg-ink text-paper' : 'bg-tile text-ink-2'}`}>{label}</button>)}</div>
          {selectMode && selected.size > 0 && <div className="flex flex-wrap items-center gap-2 rounded-tile bg-apricot p-2 text-sm"><span className="mr-auto">已選 {selected.size} 項</span><Button variant="secondary" onClick={() => merge([...selected])}>合併</Button><Button variant="danger" onClick={() => setPanel({ kind: 'delete', names: [...selected] })}>刪除／隱藏</Button></div>}
          {visible.length === 0 ? <div className="py-10 text-center text-sm text-ink-2">{entries.length ? '沒有符合的項目。' : `還沒有${title}，可以先新增一個。`}</div> : <div className="divide-y divide-dashed divide-line">
            {visible.map((entry, index) => <article key={entry.name} className="flex min-w-0 items-center gap-2 py-3">
              {selectMode && <input type="checkbox" aria-label={`選取${entry.name}`} checked={selected.has(entry.name)} onChange={() => toggleSelected(entry.name)} className="size-5 flex-none accent-[var(--color-ink)]" />}
              {!isShop && <span aria-hidden="true" className="text-xs text-ink-3">⋮⋮</span>}
              <div className="min-w-0 flex-1"><div className="flex min-w-0 flex-wrap items-center gap-2"><span className="truncate text-sm font-medium text-ink">{entry.name}</span>{entry.isDefault && <span className="rounded-full bg-tile px-2 py-0.5 text-[10px] text-ink-2">內建</span>}{entry.isHidden && <span className="rounded-full bg-mist-soft px-2 py-0.5 text-[10px] text-mist-ink">已隱藏</span>}{duplicateGroups.some((group) => group.brands.some((candidate) => candidate.name === entry.name)) && <span className="rounded-full bg-oat-soft px-2 py-0.5 text-[10px] text-oat-ink">可能重複</span>}</div>
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-3">{isShop ? <>{entry.kind === 'online' ? '網路' : entry.kind === 'physical' ? '實體' : '未分類'}{entry.url && <a href={entry.url} target="_blank" rel="noreferrer" className="truncate">{entry.url}</a>}</> : (entry.aliases ?? []).length ? `別名：${entry.aliases?.join('、')}` : '尚未設定別名'}<span>{brandTotal(entry)} 件・最近使用 {entry.lastUsed ?? '—'}</span></div>
              </div>
              {!isShop && <div className="hidden gap-1 sm:flex"><button type="button" aria-label={`將${entry.name}往前移`} disabled={index === 0} onClick={() => void moveMaterial(entry, -1)} className="flex size-9 items-center justify-center rounded-sm text-ink-2 disabled:opacity-30"><Icon name="back" size={15} /></button><button type="button" aria-label={`將${entry.name}往後移`} disabled={index === visible.length - 1} onClick={() => void moveMaterial(entry, 1)} className="flex size-9 items-center justify-center rounded-sm text-ink-2 disabled:opacity-30"><Icon name="next" size={15} /></button></div>}
              <span className="font-num text-sm font-bold text-ink">{brandTotal(entry)}</span>
              <div className="flex flex-none items-center gap-0.5"><button type="button" aria-label={`編輯${entry.name}`} onClick={() => openEditor(entry)} className="flex size-10 items-center justify-center rounded-sm text-ink-2 hover:bg-tile"><Icon name="edit" size={17} /></button>{entry.isDefault ? <button type="button" aria-label={`${entry.isHidden ? '顯示' : '隱藏'}${entry.name}`} onClick={() => void toggleMaterialVisibility(entry)} className="flex size-10 items-center justify-center rounded-sm text-ink-2 hover:bg-tile"><Icon name={entry.isHidden ? 'eye' : 'minus'} size={17} /></button> : <button type="button" aria-label={`刪除${entry.name}`} onClick={() => setPanel({ kind: 'delete', names: [entry.name] })} className="flex size-10 items-center justify-center rounded-sm text-rose-deep hover:bg-rose-soft"><Icon name="x" size={17} /></button>}</div>
            </article>)}
          </div>}
        </PaperCard>
        {!isShop && <p className="m-0 text-xs leading-5 text-ink-3">調整順序會套用到新增衣物材質選項。內建材質無法刪除，可改為隱藏。</p>}
      </>}
      {panelNode}
      {undo && <div role="status" className="fixed inset-x-4 bottom-28 z-40 mx-auto flex max-w-md items-center gap-3 rounded-tile bg-ink px-4 py-3 text-sm text-paper shadow-float md:bottom-8"><span className="min-w-0 flex-1">{undo.label}</span><button type="button" disabled={busy} onClick={() => void undoDelete()} className="min-h-11 flex-none px-2 font-medium text-oat">復原</button><button type="button" aria-label="關閉復原提示" onClick={() => setUndo(null)} className="flex size-9 flex-none items-center justify-center rounded-btn"><Icon name="x" size={16} /></button></div>}
      <Toast message={toast} onClose={() => setToast(null)} />
    </main>
  )
}

function EditEntryPanel({ kind, draft, busy, onChange, onCancel, onSubmit }: { kind: ManagedListKind; draft: Draft; busy: boolean; onChange: (draft: Draft) => void; onCancel: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const isShop = kind === 'shops'
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim sm:items-center sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && !busy && onCancel()}>
    <section role="dialog" aria-modal="true" aria-label={`${draft.originalName ? '編輯' : '新增'}${isShop ? '購買通路' : '材質'}`} className="flex max-h-[90dvh] w-full flex-col rounded-t-block bg-card shadow-sheet sm:max-w-lg sm:rounded-block sm:shadow-float">
      <header className="flex items-center border-b border-dashed border-line px-5 py-3"><h2 className="m-0 font-hd text-xl">{draft.originalName ? '編輯' : '新增'}{isShop ? '購買通路' : '材質'}</h2><button type="button" aria-label="關閉" disabled={busy} onClick={onCancel} className="ml-auto flex size-11 items-center justify-center rounded-btn text-ink-2"><Icon name="x" /></button></header>
      <form onSubmit={onSubmit} className="space-y-4 overflow-y-auto p-5">
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">名稱<input autoFocus required maxLength={isShop ? 80 : 40} value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} className="h-11 w-full rounded-btn border-[1.5px] border-line bg-paper px-3 text-sm font-normal" /></label>
        {isShop ? <>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">類型<Select label="通路類型" value={draft.kind ?? 'other'} options={SHOP_KINDS} onChange={(value) => onChange({ ...draft, kind: value })} /></label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">官網網址（選填）<input type="url" inputMode="url" value={draft.url ?? ''} onChange={(event) => onChange({ ...draft, url: event.target.value })} placeholder="https://" className="h-11 w-full rounded-btn border-[1.5px] border-line bg-paper px-3 text-sm font-normal" /></label>
        </> : <>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">別名（選填）<input value={(draft.aliases ?? []).join('、')} onChange={(event) => onChange({ ...draft, aliases: event.target.value.split(/[、,，]/).map((alias) => alias.trim()).filter(Boolean) })} placeholder="例如：Polyester、聚脂纖維" className="h-11 w-full rounded-btn border-[1.5px] border-line bg-paper px-3 text-sm font-normal" /></label>
          {draft.isDefault && <label className="flex min-h-11 items-center gap-2 text-sm text-ink"><input type="checkbox" checked={!!draft.isHidden} onChange={(event) => onChange({ ...draft, isHidden: event.target.checked })} className="size-5 accent-[var(--color-ink)]" />在新增衣物材質選項中隱藏</label>}
        </>}
        <div className="flex justify-end gap-2 border-t border-dashed border-line pt-3"><Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>取消</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? '儲存中…' : '儲存'}</Button></div>
      </form>
    </section>
  </div>
}

function MergeEntryPanel({ kind, names, keep, busy, onChange, onCancel, onConfirm }: { kind: ManagedListKind; names: string[]; keep: string; busy: boolean; onChange: (keep: string) => void; onCancel: () => void; onConfirm: () => void }) {
  const options = names.map((name) => ({ value: name, label: name }))
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim sm:items-center sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}><section role="dialog" aria-modal="true" aria-label={`合併${kind === 'shops' ? '通路' : '材質'}`} className="w-full space-y-4 rounded-t-block bg-card p-5 shadow-sheet sm:max-w-md sm:rounded-block sm:shadow-float"><h2 className="m-0 font-hd text-xl">合併成一個{kind === 'shops' ? '通路' : '材質'}</h2><p className="m-0 text-sm leading-6 text-ink-2">{quote(names)}會改成同一個名稱，相關衣物及選購清單也會一起更新。</p><label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">保留名稱<Select label="合併後名稱" value={keep} options={options} onChange={onChange} /></label><div className="flex justify-end gap-2"><Button variant="secondary" onClick={onCancel} disabled={busy}>取消</Button><Button variant="oat" onClick={onConfirm} disabled={busy}>合併</Button></div></section></div>
}
