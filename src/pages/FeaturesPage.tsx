import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { DestructiveActionDialog } from '@/components/ui/B10States'
import { Icon } from '@/components/ui/Icon'
import { LoadingState, PageState } from '@/components/ui/PageState'
import { PaperCard } from '@/components/ui/Paper'
import { ProfileBreadcrumb } from '@/components/layout/ProfileNav'
import { Select } from '@/components/ui/Select'
import { Toast, type ToastMessage } from '@/components/ui/Toast'
import { createGarmentFeature, fetchGarmentFeatures, replaceGarmentFeatures, updateGarmentFeature } from '@/lib/data'
import { FEATURE_DIMENSIONS, normalizeFeatureAliases } from '@/lib/features'
import { GARMENT_TYPES, GARMENT_TYPE_ORDER } from '@/lib/wishlist'
import { SLOTS } from '@/lib/slots'
import { useIsMobile } from '@/lib/useIsMobile'
import type { FeatureDefinition, FeatureDefinitionInput, FeatureDimension } from '@/types'
import './FeaturesPage.css'

interface FeatureDraft extends FeatureDefinitionInput { originalName?: string }
type DeleteTarget = FeatureDefinition | null

const DIMENSION_OPTIONS = [{ value: 'all', label: '全部維度' }, ...FEATURE_DIMENSIONS.map((dimension) => ({ value: dimension.id, label: dimension.label }))]
const TYPE_OPTIONS = SLOTS.flatMap((slot) => {
  const options = GARMENT_TYPES[slot.slot] ?? []
  const order = GARMENT_TYPE_ORDER[slot.slot] ?? []
  return [{ key: `${slot.slot}:*`, label: `${slot.label}・全部類型` }, ...[...options].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)).map((option) => ({ key: `${slot.slot}:${option.id}`, label: `${slot.label}・${option.label}` }))]
})
const normalize = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase().replace(/[\s\u3000]/g, '')

function editable(feature: FeatureDefinition): FeatureDraft {
  return { originalName: feature.name, name: feature.name, dimension: feature.dimension, aliases: [...feature.aliases], applicableTypes: [...feature.applicableTypes], sortOrder: feature.sortOrder, isHidden: feature.isHidden }
}

function newFeature(features: FeatureDefinition[]): FeatureDraft {
  return { name: '', dimension: 'detail', aliases: [], applicableTypes: [], sortOrder: Math.max(0, ...features.map((feature) => feature.sortOrder)) + 10, isHidden: false }
}

function prettyTypes(types: string[]) {
  if (!types.length || types.includes('*')) return '全部類型'
  return types.map((type) => TYPE_OPTIONS.find((option) => option.key === type)?.label ?? type.split(':').join('・')).join('、')
}

function findSynonymSuggestions(features: FeatureDefinition[]) {
  return features.flatMap((feature) => feature.aliases.flatMap((alias) => {
    const target = features.find((candidate) => candidate.name !== feature.name && candidate.dimension === feature.dimension && normalize(candidate.name) === normalize(alias))
    return target ? [{ source: feature, target, alias }] : []
  }))
}

export function FeaturesPage() {
  const isMobile = useIsMobile()
  const [features, setFeatures] = useState<FeatureDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [dimension, setDimension] = useState('all')
  const [unusedOnly, setUnusedOnly] = useState(false)
  const [draft, setDraft] = useState<FeatureDraft | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null)
  const [mergeSource, setMergeSource] = useState<FeatureDefinition | null>(null)
  const [mergeTarget, setMergeTarget] = useState('')
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)

  async function load(showLoading = true) {
    if (showLoading) setLoading(true)
    try {
      setFeatures(await fetchGarmentFeatures(true))
      setLoadError(null)
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : '特徵清單載入失敗。')
    } finally { setLoading(false) }
  }
  useEffect(() => {
    let active = true
    void fetchGarmentFeatures(true).then((next) => {
      if (!active) return
      setFeatures(next)
      setLoadError(null)
    }).catch((cause: unknown) => {
      if (active) setLoadError(cause instanceof Error ? cause.message : '特徵清單載入失敗。')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const duplicateSuggestions = useMemo(() => findSynonymSuggestions(features).filter(({ source, target }) => !dismissedSuggestions.has(`${source.name}\n${target.name}`)), [features, dismissedSuggestions])
  const visible = useMemo(() => {
    const search = normalize(query)
    return features.filter((feature) => {
      if (dimension !== 'all' && feature.dimension !== dimension) return false
      if (unusedOnly && (feature.closetCount ?? 0) + (feature.wishCount ?? 0) > 0) return false
      if (!search) return true
      return normalize([feature.name, ...feature.aliases].join(' ')).includes(search)
    }).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh-TW'))
  }, [dimension, features, query, unusedOnly])

  const createNew = () => setDraft(newFeature(features))
  const openEdit = (feature: FeatureDefinition) => setDraft(editable(feature))
  const requestDelete = (feature: FeatureDefinition) => { setDraft(null); setDeleteTarget(feature) }

  async function saveFeature(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft) return
    const name = draft.name.trim()
    if (!name) return setToast({ tone: 'error', text: '請輸入特徵名稱。' })
    const duplicate = features.find((feature) => normalize(feature.name) === normalize(name) && feature.name !== draft.originalName)
    if (duplicate) return setToast({ tone: 'error', text: `「${name}」已存在；請使用「合併」整理同義特徵。` })
    setBusy(true)
    try {
      const input: FeatureDefinitionInput = { name, dimension: draft.dimension, aliases: normalizeFeatureAliases(draft.aliases, name), applicableTypes: draft.applicableTypes, sortOrder: draft.sortOrder, isHidden: draft.isHidden }
      if (draft.originalName) await updateGarmentFeature(draft.originalName, input)
      else await createGarmentFeature(input)
      setDraft(null)
      setToast({ tone: 'success', text: `「${name}」已${draft.originalName ? '更新' : '新增'}。` })
      await load()
    } catch (cause) {
      setToast({ tone: 'error', text: cause instanceof Error ? cause.message : '儲存特徵失敗。' })
    } finally { setBusy(false) }
  }

  async function deleteFeature(feature: FeatureDefinition) {
    setBusy(true)
    try {
      await replaceGarmentFeatures([feature.name], null)
      setDeleteTarget(null)
      if (draft?.originalName === feature.name) setDraft(null)
      setToast({ tone: 'success', text: `已刪除「${feature.name}」，相關衣物和選購候選已移除這個特徵。` })
      await load()
    } catch (cause) {
      setToast({ tone: 'error', text: cause instanceof Error ? cause.message : '刪除特徵失敗。' })
    } finally { setBusy(false) }
  }

  async function mergeFeature() {
    if (!mergeSource || !mergeTarget) return
    const target = features.find((feature) => feature.name === mergeTarget)
    if (!target || target.dimension !== mergeSource.dimension) return setToast({ tone: 'error', text: '只能合併到相同維度的特徵。' })
    setBusy(true)
    try {
      await replaceGarmentFeatures([mergeSource.name], target.name)
      setMergeSource(null)
      setMergeTarget('')
      setToast({ tone: 'success', text: `已將「${mergeSource.name}」合併到「${target.name}」。` })
      await load()
    } catch (cause) {
      setToast({ tone: 'error', text: cause instanceof Error ? cause.message : '合併特徵失敗。' })
    } finally { setBusy(false) }
  }

  const editor = draft ? <FeatureEditor
    draft={draft}
    busy={busy}
    onChange={setDraft}
    onCancel={() => setDraft(null)}
    onSubmit={saveFeature}
    onDelete={draft.originalName ? () => { const feature = features.find((entry) => entry.name === draft.originalName); if (feature) requestDelete(feature) } : undefined}
  /> : null

  return <main className="mx-auto flex max-w-[1320px] min-w-0 flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
    <ProfileBreadcrumb current="特徵" />
    <header className="flex flex-wrap items-end gap-3">
      <div className="mr-auto min-w-0 space-y-1"><h1 className="m-0 font-hd text-3xl text-ink">特徵</h1><p className="m-0 text-sm leading-6 text-ink-2">衣櫃與選購清單共用。特徵名稱和別名會用於搜尋與重複判斷。</p></div>
      <Button variant="secondary" onClick={createNew}><Icon name="plus" />新增特徵</Button>
    </header>

    {duplicateSuggestions.length > 0 && <section aria-label="可能同義的特徵" className="space-y-2 rounded-card bg-oat-soft p-3 sm:p-4">
      <h2 className="m-0 text-sm font-medium">可能是同一個意思</h2>
      {duplicateSuggestions.slice(0, 3).map(({ source, target, alias }) => <div key={`${source.name}-${target.name}`} className="flex flex-wrap items-center gap-2 rounded-tile bg-card p-3 text-sm">
        <span className="rounded-full bg-tile px-2.5 py-1">{alias}</span><Icon name="next" size={15} /><span>「{source.name}」可能和「{target.name}」同義</span>
        <span className="ml-auto flex gap-1"><Button variant="ghost" onClick={() => setDismissedSuggestions((current) => new Set(current).add(`${source.name}\n${target.name}`))}>不是</Button><Button variant="oat" onClick={() => { setMergeSource(source); setMergeTarget(target.name) }}>合併</Button></span>
      </div>)}
    </section>}

    {mergeSource && <PaperCard className="flex flex-wrap items-center gap-2 p-3"><span className="text-sm">將「{mergeSource.name}」合併到</span><Select label="合併目標特徵" value={mergeTarget} options={features.filter((feature) => feature.dimension === mergeSource.dimension && feature.name !== mergeSource.name).map((feature) => ({ value: feature.name, label: feature.name }))} onChange={setMergeTarget} className="min-w-40 flex-1" /><Button variant="secondary" disabled={busy} onClick={() => { setMergeSource(null); setMergeTarget('') }}>取消</Button><Button variant="primary" disabled={busy || !mergeTarget} onClick={() => void mergeFeature()}>確認合併</Button></PaperCard>}

    <div className={`grid min-w-0 gap-4 ${draft && !isMobile ? 'xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,.8fr)]' : ''}`}>
      <section className="min-w-0 space-y-3">
        <PaperCard className="flex flex-wrap items-center gap-2 p-3">
          <label className="sr-only" htmlFor="feature-search">搜尋特徵名稱或別名</label>
          <span className="flex min-h-11 min-w-[220px] flex-1 items-center gap-2 rounded-btn border-[1.5px] border-line-strong bg-paper px-3"><Icon name="search" size={17} className="text-ink-3" /><input id="feature-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋特徵或別名" className="min-w-0 flex-1 bg-transparent text-base outline-none" /></span>
          <Select label="特徵維度" value={dimension} options={DIMENSION_OPTIONS} onChange={setDimension} className="w-36" />
          <button type="button" aria-pressed={unusedOnly} onClick={() => setUnusedOnly((value) => !value)} className={`min-h-11 rounded-full border-[1.5px] px-3 text-xs ${unusedOnly ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-card text-ink-2'}`}>沒用到的</button>
          <span className="text-xs text-ink-2">{visible.length} 個</span>
        </PaperCard>
        {loading && !features.length ? <LoadingState label="正在整理特徵…" /> : loadError ? <PageState icon="alert" tone="rose" title="特徵清單載入失敗" description={loadError} action={<Button variant="secondary" onClick={() => void load()}>重新載入</Button>} /> : <PaperCard className="divide-y divide-dashed divide-line px-3">
          {FEATURE_DIMENSIONS.filter((group) => visible.some((feature) => feature.dimension === group.id)).map((group) => <section key={group.id} className="py-3">
            <h2 className="mb-1 mt-0 flex items-baseline gap-2 px-2 font-hd text-lg"><span>{group.label}</span><span className="font-sans text-xs text-ink-2">{group.mode === 'single' ? '單選屬性' : '多選特徵'}</span></h2>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {visible.filter((feature) => feature.dimension === group.id).map((feature) => <div key={feature.name} className="flex min-w-0 items-center gap-1 rounded-tile px-1 hover:bg-paper">
                <button type="button" onClick={() => openEdit(feature)} className="flex min-h-14 min-w-0 flex-1 items-center gap-2 rounded-tile px-1 text-left">
                  <span className="min-w-0 flex-1"><b className="block truncate text-sm font-medium">{feature.name}</b><span className="block truncate text-xs text-ink-2">{feature.aliases.length ? `別名：${feature.aliases.join('、')}` : prettyTypes(feature.applicableTypes)}</span></span>
                  <span className="hidden max-w-[130px] truncate text-[11px] text-ink-2 sm:block">{prettyTypes(feature.applicableTypes)}</span>
                  <span className="w-14 text-right font-num text-xs tabular text-ink-2">{feature.closetCount ?? 0}</span><span className="w-12 text-right font-num text-xs tabular text-ink-2">{feature.wishCount ?? 0}</span><Icon name="next" size={16} className="text-ink-3" />
                </button>
                <button type="button" aria-label={`合併「${feature.name}」`} onClick={() => { const target = features.find((entry) => entry.dimension === feature.dimension && entry.name !== feature.name); if (!target) return setToast({ tone: 'error', text: '這個維度還沒有其他可合併的特徵。' }); setMergeSource(feature); setMergeTarget(target.name) }} className="flex size-11 flex-none items-center justify-center rounded-btn text-ink-2 hover:bg-tile"><span aria-hidden="true" className="text-sm">↪</span></button>
                <button type="button" aria-label={`刪除「${feature.name}」`} onClick={() => setDeleteTarget(feature)} className="flex size-11 flex-none items-center justify-center rounded-btn text-rose-deep hover:bg-rose-soft"><Icon name="x" size={16} /></button>
              </div>)}
            </div>
          </section>)}
          {!visible.length && <PageState icon="search" tone="oat" compact title="沒有符合的特徵" description="換個關鍵字或維度看看。" />}
        </PaperCard>}
        <div className="grid grid-cols-[1fr_auto_auto] px-3 text-[11px] text-ink-3"><span>特徵名稱與別名</span><span className="w-14 text-right">衣櫃</span><span className="w-12 text-right">選購</span></div>
      </section>
      {!isMobile && draft && <aside className="sticky top-4 hidden self-start xl:block">{editor}</aside>}
    </div>

    {isMobile && draft && <FeatureEditorDialog draft={draft} busy={busy} onChange={setDraft} onCancel={() => setDraft(null)} onSubmit={saveFeature} onDelete={draft.originalName ? () => { const feature = features.find((entry) => entry.name === draft.originalName); if (feature) requestDelete(feature) } : undefined} />}
    {deleteTarget && <DestructiveActionDialog title={`刪除「${deleteTarget.name}」？`} description={`這個特徵用在 ${deleteTarget.closetCount ?? 0} 件衣物、${deleteTarget.wishCount ?? 0} 件選購候選。刪除後會從這些資料中移除。`} confirmLabel="刪除特徵" onCancel={() => setDeleteTarget(null)} onConfirm={() => void deleteFeature(deleteTarget)} />}
    <Toast message={toast} onClose={() => setToast(null)} />
  </main>
}

function FeatureEditor({ draft, busy, onChange, onCancel, onSubmit, onDelete }: { draft: FeatureDraft; busy: boolean; onChange: (draft: FeatureDraft) => void; onCancel: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onDelete?: () => void }) {
  const isNew = !draft.originalName
  const dimension = FEATURE_DIMENSIONS.find((entry) => entry.id === draft.dimension)!
  const selectedTypes = new Set(draft.applicableTypes)
  const allTypes = draft.applicableTypes.length === 0 || draft.applicableTypes.includes('*')
  const aliasValue = draft.aliases.join('、')
  function toggleType(key: string) {
    if (allTypes) onChange({ ...draft, applicableTypes: [key] })
    else {
      const next = new Set(draft.applicableTypes)
      const slotPrefix = `${key.split(':')[0]}:`
      if (key.endsWith(':*')) {
        for (const type of next) if (type.startsWith(slotPrefix)) next.delete(type)
        next.add(key)
      } else if (next.has(`${slotPrefix}*`)) {
        next.delete(`${slotPrefix}*`)
        next.add(key)
      } else if (next.has(key)) {
        if (next.size > 1) next.delete(key)
      } else next.add(key)
      onChange({ ...draft, applicableTypes: next.size === TYPE_OPTIONS.length ? [] : [...next] })
    }
  }
  return <form onSubmit={onSubmit} className="space-y-4 rounded-card bg-card p-4 shadow-paper">
    <header><h2 id="feature-editor-title" className="m-0 font-hd text-xl">{isNew ? '新增特徵' : `編輯「${draft.originalName}」`}</h2><p className="m-0 mt-1 text-xs text-ink-2">{dimension.label}・{dimension.mode === 'single' ? '單選屬性' : '多選特徵'}</p></header>
    <label className="flex flex-col gap-1.5 text-[13px] font-medium">名稱<input autoFocus value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} maxLength={40} className="h-11 rounded-btn border-[1.5px] border-line-strong bg-paper px-3 text-base font-normal text-ink" /></label>
    <div className="space-y-1.5"><span className="text-[13px] font-medium">維度</span>{isNew ? <Select label="特徵維度" value={draft.dimension} options={FEATURE_DIMENSIONS.map((entry) => ({ value: entry.id, label: `${entry.label}・${entry.mode === 'single' ? '單選' : '多選'}` }))} onChange={(value) => onChange({ ...draft, dimension: value as FeatureDimension })} /> : <p className="m-0 rounded-btn bg-tile px-3 py-2 text-sm">{dimension.label}・{dimension.mode === 'single' ? '單選屬性' : '多選特徵'} <span className="text-xs text-ink-2">維度固定；同一屬性組內只能有一個答案。</span></p>}</div>
    <label className="flex flex-col gap-1.5 text-[13px] font-medium">別名<input value={aliasValue} onChange={(event) => onChange({ ...draft, aliases: event.target.value.split(/[、,，]/).map((entry) => entry.trim()).filter(Boolean) })} placeholder="用頓號分隔，例如：闊腿、加寬" className="h-11 rounded-btn border-[1.5px] border-line-strong bg-paper px-3 text-base font-normal text-ink" /><span className="text-xs font-normal text-ink-2">商品名稱出現別名時，會建議選用「{draft.name || '此特徵'}」。</span></label>
    <fieldset className="space-y-2 border-0 p-0"><legend className="text-[13px] font-medium">適用類型</legend><div className="flex flex-wrap gap-1.5"><Chip selected={allTypes} onClick={() => onChange({ ...draft, applicableTypes: [] })} className="h-11">全部類型</Chip>{TYPE_OPTIONS.map((option) => <Chip key={option.key} selected={allTypes || selectedTypes.has(option.key)} onClick={() => toggleType(option.key)} className="h-11">{option.label}</Chip>)}</div><p className="m-0 text-xs leading-5 text-ink-2">只影響各類型的建議與快速選項；其他類型仍可在「更多特徵」搜尋。</p></fieldset>
    <div className="flex flex-wrap gap-2 border-t border-dashed border-line-strong pt-3">{onDelete && <Button type="button" variant="ghost" className="text-rose-deep" onClick={onDelete}>刪除…</Button>}<Button type="button" variant="secondary" className="ml-auto" onClick={onCancel}>取消</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? '儲存中…' : '儲存'}</Button></div>
  </form>
}

function FeatureEditorDialog({ draft, busy, onChange, onCancel, onSubmit, onDelete }: { draft: FeatureDraft; busy: boolean; onChange: (draft: FeatureDraft) => void; onCancel: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onDelete?: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [])
  function handleClose() {
    if (dialogRef.current?.open) return
    onCancel()
  }
  return <dialog ref={dialogRef} aria-labelledby="feature-editor-title" onClose={handleClose} className="feature-editor-dialog fixed inset-x-0 top-auto bottom-0 m-0 max-h-[88dvh] w-full max-w-none overflow-y-auto rounded-t-block border-0 bg-card p-4 pb-[calc(20px+env(safe-area-inset-bottom))] text-ink shadow-sheet backdrop:bg-scrim sm:inset-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[min(560px,calc(100vw-32px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card sm:shadow-float">
    <FeatureEditor draft={draft} busy={busy} onChange={onChange} onCancel={() => { dialogRef.current?.close(); onCancel() }} onSubmit={onSubmit} onDelete={onDelete} />
  </dialog>
}
