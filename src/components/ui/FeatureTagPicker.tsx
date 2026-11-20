import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { FEATURE_DIMENSIONS, FEATURE_SINGLE_DIMENSIONS, detectFeatureSuggestions, featureAppliesTo } from '@/lib/features'
import { useIsMobile } from '@/lib/useIsMobile'
import type { FeatureDefinition, FeatureDimension, FeatureTag } from '@/types'
import './FeatureTagPicker.css'

interface FeatureTagPickerProps {
  name: string
  definitions: FeatureDefinition[]
  value: FeatureTag[]
  dismissed: string[]
  typeKeys: string[]
  onChange: (features: FeatureTag[]) => void
  onDismissedChange: (dismissed: string[]) => void
  onCreate: (name: string, dimension: FeatureDimension) => Promise<FeatureDefinition>
  disabled?: boolean
}

const featureKey = (feature: FeatureTag) => `${feature.dimension}:${feature.name}`
const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/[\s\u3000]/g, '')

/** 新增衣物、選購候選及衣物編輯共用的特徵選擇器。 */
export function FeatureTagPicker({ name, definitions, value, dismissed, typeKeys, onChange, onDismissedChange, onCreate, disabled = false }: FeatureTagPickerProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const tags = useMemo(() => detectFeatureSuggestions(name, definitions, typeKeys, value, dismissed).slice(0, 8), [name, definitions, typeKeys, value, dismissed])
  const available = useMemo(() => definitions.filter((feature) => !feature.isHidden && featureAppliesTo(feature, typeKeys)), [definitions, typeKeys])
  const selected = useMemo(() => new Set(value.map(featureKey)), [value])
  const suggestions = useMemo(() => new Set(tags.map(({ tag }) => featureKey(tag))), [tags])
  const selectedDefinitions = useMemo(() => value.map((tag) => definitions.find((feature) => feature.name === tag.name && feature.dimension === tag.dimension) ?? {
    ...tag, aliases: [], applicableTypes: [], sortOrder: 10000, isHidden: false,
  }), [definitions, value])
  const quickOptions = useMemo(() => {
    const multiple = available.filter((feature) => !FEATURE_SINGLE_DIMENSIONS.has(feature.dimension))
    const chosen = new Map<string, FeatureDefinition>()
    for (const { tag } of tags) {
      const option = available.find((entry) => entry.name === tag.name)
      if (option) chosen.set(option.name, option)
    }
    for (const feature of selectedDefinitions.filter((entry) => !FEATURE_SINGLE_DIMENSIONS.has(entry.dimension))) chosen.set(feature.name, feature)
    for (const feature of multiple) if (chosen.size < (isMobile ? 5 : 8)) chosen.set(feature.name, feature)
    return [...chosen.values()].slice(0, Math.max(isMobile ? 5 : 8, [...chosen.values()].filter((entry) => selected.has(featureKey(entry))).length))
  }, [available, isMobile, selected, selectedDefinitions, tags])

  function acceptFeature(feature: FeatureTag) {
    const key = featureKey(feature)
    if (selected.has(key)) {
      onChange(value.filter((entry) => featureKey(entry) !== key))
      const wasFoundInName = detectFeatureSuggestions(name, definitions, typeKeys).some(({ tag }) => featureKey(tag) === key)
      if (suggestions.has(key) || wasFoundInName) onDismissedChange([...new Set([...dismissed, key])])
      return
    }
    const next = FEATURE_SINGLE_DIMENSIONS.has(feature.dimension)
      ? [...value.filter((entry) => entry.dimension !== feature.dimension), feature]
      : [...value, feature]
    onChange(next)
    if (suggestions.has(key)) onDismissedChange(dismissed.filter((entry) => entry !== key))
  }

  function acceptAllSuggestions() {
    let next = [...value]
    for (const { tag } of tags) {
      if (FEATURE_SINGLE_DIMENSIONS.has(tag.dimension)) next = next.filter((entry) => entry.dimension !== tag.dimension)
      if (!next.some((entry) => featureKey(entry) === featureKey(tag))) next.push(tag)
    }
    onChange(next)
  }

  return (
    <section className="feature-picker min-w-0 space-y-2.5" aria-label="特徵（選填）">
      <header className="flex min-w-0 flex-wrap items-center gap-2">
        <h3 className="m-0 text-[13px] font-medium text-ink">特徵 <span className="font-normal text-ink-2">（選填{available.length ? '，依類型提供建議' : ''}）</span></h3>
        {tags.length > 0 && <span className="text-xs text-mist-ink">從名稱找到 <b className="font-num">{tags.length}</b> 個</span>}
        {tags.length > 0 && <button type="button" disabled={disabled} onClick={acceptAllSuggestions} className="ml-auto min-h-10 rounded-btn px-2 text-xs font-medium text-mist-deep disabled:opacity-50">全部採用</button>}
      </header>

      {FEATURE_DIMENSIONS.filter((dimension) => dimension.mode === 'single').map((dimension) => {
        const options = available.filter((feature) => feature.dimension === dimension.id)
        const suggestedForDimension = tags.filter(({ tag }) => tag.dimension === dimension.id)
        if (!options.length && !suggestedForDimension.length) return null
        const display = [...new Map([...options, ...selectedDefinitions.filter((entry) => entry.dimension === dimension.id), ...suggestedForDimension.map(({ tag }) => definitions.find((entry) => entry.name === tag.name)!).filter(Boolean)].map((feature) => [feature.name, feature])).values()]
        return <div key={dimension.id} className="feature-picker__line min-w-0">
          <span className="feature-picker__label">{dimension.label}</span>
          <div role="radiogroup" aria-label={dimension.label} className="flex min-w-0 flex-wrap gap-1.5">
            {display.map((feature) => <FeatureChip key={feature.name} feature={feature} selected={selected.has(featureKey(feature))} suggested={suggestions.has(featureKey(feature)) && !selected.has(featureKey(feature))} disabled={disabled} onClick={() => acceptFeature(feature)} />)}
          </div>
        </div>
      })}

      <div className="feature-picker__line min-w-0">
        <span className="feature-picker__label">特徵</span>
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {quickOptions.map((feature) => <FeatureChip key={feature.name} feature={feature} selected={selected.has(featureKey(feature))} suggested={suggestions.has(featureKey(feature)) && !selected.has(featureKey(feature))} disabled={disabled} onClick={() => acceptFeature(feature)} />)}
          {value.filter((feature) => !FEATURE_SINGLE_DIMENSIONS.has(feature.dimension) && !quickOptions.some((option) => option.name === feature.name)).map((feature) => <FeatureChip key={feature.name} feature={feature} selected suggested={false} disabled={disabled} onClick={() => acceptFeature(feature)} />)}
          <button type="button" disabled={disabled} onClick={() => setOpen(true)} className="feature-picker__more inline-flex min-h-11 items-center gap-1 rounded-full border-[1.5px] border-dashed border-line-strong px-3 text-[12px] text-mist-deep disabled:opacity-50"><Icon name="more" size={15} />更多・新增</button>
        </div>
      </div>

      {value.length > 0 && <p className="m-0 text-xs leading-5 text-ink-2">已選：{value.map((feature) => `${FEATURE_DIMENSIONS.find((entry) => entry.id === feature.dimension)?.label}：${feature.name}`).join('、')}</p>}
      <FeaturePickerDialog
        open={open}
        title={`${name || '衣物'}・特徵`}
        definitions={[...new Map([...available, ...selectedDefinitions].map((feature) => [feature.name, feature])).values()]}
        selected={selected}
        suggestions={suggestions}
        onClose={() => setOpen(false)}
        onToggle={acceptFeature}
        onCreate={async (featureName, dimension) => {
          const created = await onCreate(featureName, dimension)
          acceptFeature({ name: created.name, dimension: created.dimension })
        }}
      />
    </section>
  )
}

function FeatureChip({ feature, selected, suggested, disabled, onClick }: { feature: FeatureDefinition | FeatureTag; selected: boolean; suggested: boolean; disabled: boolean; onClick: () => void }) {
  const single = FEATURE_SINGLE_DIMENSIONS.has(feature.dimension)
  return <button type="button" role={single ? 'radio' : undefined} aria-checked={single ? selected : undefined} aria-pressed={!single ? selected : undefined} disabled={disabled} onClick={onClick} className={`feature-chip ${selected ? 'feature-chip--selected' : suggested ? 'feature-chip--suggested' : ''} disabled:cursor-not-allowed disabled:opacity-50`}>
    <span>{feature.name}</span>
    {suggested && <span className="feature-chip__source">名稱</span>}
  </button>
}

function FeaturePickerDialog({ open, title, definitions, selected, suggestions, onClose, onToggle, onCreate }: {
  open: boolean
  title: string
  definitions: FeatureDefinition[]
  selected: Set<string>
  suggestions: Set<string>
  onClose: () => void
  onToggle: (feature: FeatureTag) => void
  onCreate: (name: string, dimension: FeatureDimension) => Promise<void>
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const id = useId()
  const [query, setQuery] = useState('')
  const [addingDimension, setAddingDimension] = useState<FeatureDimension | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const matched = useMemo(() => {
    const value = normalize(query)
    if (!value) return []
    return definitions.filter((feature) => [feature.name, ...feature.aliases].some((entry) => normalize(entry).includes(value)))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-TW')).slice(0, 6)
  }, [definitions, query])
  const creatingExists = query.trim() && matched.some((feature) => [feature.name, ...feature.aliases].some((entry) => normalize(entry) === normalize(query)))

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      setQuery('')
      setError(null)
      setAddingDimension(null)
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [open])

  function handleClose() {
    // StrictMode cleanup 可能關閉舊 dialog；若已重新開啟則忽略舊 close event。
    if (dialogRef.current?.open || !open) return
    onClose()
  }

  async function create(name: string, dimension: FeatureDimension) {
    setSaving(true)
    setError(null)
    try {
      await onCreate(name.trim(), dimension)
      setQuery('')
      setAddingDimension(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '新增特徵失敗。')
    } finally { setSaving(false) }
  }

  function choose(feature: FeatureDefinition) {
    onToggle({ name: feature.name, dimension: feature.dimension })
    setQuery('')
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const count = matched.length + Number(!!query.trim() && !creatingExists && !!addingDimension)
    if (event.key === 'ArrowDown' && count) { event.preventDefault(); setActiveIndex((index) => (index + 1) % count) }
    else if (event.key === 'ArrowUp' && count) { event.preventDefault(); setActiveIndex((index) => (index - 1 + count) % count) }
    else if (event.key === 'Enter' && matched.length && activeIndex < matched.length) { event.preventDefault(); choose(matched[activeIndex]) }
    else if (event.key === 'Enter' && query.trim() && addingDimension && !creatingExists) { event.preventDefault(); void create(query, addingDimension) }
  }

  function dismissBackdrop(event: PointerEvent<HTMLDialogElement>) {
    const dialog = dialogRef.current
    if (!dialog || event.target !== dialog) return
    const rect = dialog.getBoundingClientRect()
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose()
  }

  return <dialog ref={dialogRef} aria-labelledby={`${id}-title`} onClose={handleClose} onPointerUp={dismissBackdrop} className="feature-picker-dialog fixed inset-x-0 top-auto bottom-0 m-0 hidden max-h-[82dvh] w-full max-w-none flex-col gap-3 overflow-hidden rounded-t-block border-0 bg-card p-4 pb-[calc(20px+env(safe-area-inset-bottom))] text-ink shadow-sheet backdrop:bg-scrim sm:inset-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:max-h-[min(82dvh,820px)] sm:w-[min(680px,calc(100vw-32px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card sm:p-5 sm:shadow-float">
    <header className="flex items-center gap-2"><div className="min-w-0 flex-1"><h2 id={`${id}-title`} className="m-0 font-hd text-xl">{title}</h2><p className="m-0 text-xs text-ink-2">虛線的名稱建議尚未選取；按一下才會加入。</p></div><button type="button" aria-label="關閉特徵選擇" onClick={onClose} className="flex size-11 items-center justify-center rounded-btn"><Icon name="x" /></button></header>
    <label className="flex min-h-11 items-center gap-2 rounded-tile border-[1.5px] border-line-strong bg-paper px-3 focus-within:border-mist-deep"><Icon name="search" size={17} className="text-ink-3" /><span className="sr-only">搜尋或新增特徵</span><input autoFocus type="search" value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0) }} onKeyDown={handleInputKeyDown} aria-autocomplete="list" aria-expanded={!!query} aria-controls={`${id}-results`} placeholder={addingDimension ? `搜尋或新增「${FEATURE_DIMENSIONS.find((entry) => entry.id === addingDimension)?.label}」特徵` : '先選一個維度，再搜尋或新增'} className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-3" autoComplete="off" /></label>
    {query && <ul id={`${id}-results`} role="listbox" aria-label="相近的特徵" className="m-0 max-h-40 list-none overflow-y-auto rounded-tile bg-paper p-1">
      {matched.map((feature, index) => <li key={feature.name}><button type="button" role="option" aria-selected={index === activeIndex} onClick={() => choose(feature)} className={`flex min-h-11 w-full flex-col items-start justify-center rounded-sm px-3 py-1 text-left ${index === activeIndex ? 'bg-tile' : ''}`}><span className="text-sm font-medium">{feature.name}<span className="ml-1 text-xs font-normal text-ink-2">・{FEATURE_DIMENSIONS.find((entry) => entry.id === feature.dimension)?.label}</span></span><span className="text-xs text-ink-2">{feature.aliases.includes(query) ? `「${query}」是它的別名，選這個` : selected.has(featureKey(feature)) ? '已選取，再點可取消' : '使用清單中的標準名稱'}</span></button></li>)}
      {matched.length === 0 && <li className="px-3 py-2 text-xs text-ink-2">沒有相近特徵。先選擇下方維度，再新增到共用清單。</li>}
      {addingDimension && query.trim() && !creatingExists && <li><button type="button" role="option" aria-selected={activeIndex === matched.length} disabled={saving} onClick={() => void create(query, addingDimension)} className="min-h-11 w-full rounded-sm border-t border-dashed border-line-strong px-3 text-left text-sm text-mist-deep">＋ 新增「{query.trim()}」到「{FEATURE_DIMENSIONS.find((entry) => entry.id === addingDimension)?.label}」</button></li>}
    </ul>}
    {error && <p role="alert" className="m-0 text-xs text-rose-deep">{error}</p>}
    <div className="feature-picker-dialog__groups min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1">
      {FEATURE_DIMENSIONS.map((dimension) => {
        const options = definitions.filter((feature) => feature.dimension === dimension.id)
        if (!options.length) return null
        return <section key={dimension.id} aria-labelledby={`${id}-${dimension.id}`} className="space-y-2">
          <h3 id={`${id}-${dimension.id}`} className="m-0 flex items-center gap-2 text-sm font-medium">{dimension.label}<span className="text-xs font-normal text-ink-2">{dimension.mode === 'single' ? '單選屬性' : '多選特徵'}</span></h3>
          {dimension.mode === 'single' ? <div role="radiogroup" aria-labelledby={`${id}-${dimension.id}`} className="flex flex-wrap gap-1.5">{options.map((feature) => <FeatureChip key={feature.name} feature={feature} selected={selected.has(featureKey(feature))} suggested={suggestions.has(featureKey(feature)) && !selected.has(featureKey(feature))} disabled={saving} onClick={() => choose(feature)} />)}</div>
            : <div className="flex flex-wrap gap-1.5">{options.map((feature) => <FeatureChip key={feature.name} feature={feature} selected={selected.has(featureKey(feature))} suggested={suggestions.has(featureKey(feature)) && !selected.has(featureKey(feature))} disabled={saving} onClick={() => choose(feature)} />)}</div>}
          {addingDimension === dimension.id ? <div className="flex flex-wrap gap-2"><Button type="button" variant="ghost" disabled={saving} onClick={() => { setAddingDimension(null); setQuery('') }}>取消新增</Button></div> : <button type="button" onClick={() => { setAddingDimension(dimension.id); setQuery('') }} className="min-h-10 rounded-full border-[1.5px] border-dashed border-line-strong px-3 text-xs text-mist-deep">＋ 新增到「{dimension.label}」</button>}
        </section>
      })}
    </div>
    <footer className="flex justify-end border-t border-dashed border-line-strong pt-2"><Button type="button" variant="primary" onClick={onClose}>完成</Button></footer>
  </dialog>
}
