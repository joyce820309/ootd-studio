import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { Icon } from '@/components/ui/Icon'

interface ComboboxProps {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  entityName?: string
  manageHref?: string
}

function normalize(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const saved = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1))
      previous = saved
    }
  }
  return row[b.length]
}

/** 可搜尋、可手動建立的新品牌選單；品牌只會在表單儲存時隨衣物一併寫入。 */
export function Combobox({ label, value, options, onChange, placeholder = `選擇或輸入${label}`, className = '', entityName = label, manageHref }: ComboboxProps) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const desktopInputRef = useRef<HTMLInputElement>(null)
  const mobileInputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (!open || mobileOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery(value)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, mobileOpen, value])

  useEffect(() => {
    if (!mobileOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    mobileInputRef.current?.focus()
    return () => { document.body.style.overflow = previous }
  }, [mobileOpen])

  const rankedOptions = useMemo(() => [...options].sort((a, b) => a.localeCompare(b, 'zh-TW')), [options])
  const normalizedQuery = normalize(query)
  const filtered = useMemo(() => {
    if (!normalizedQuery) return rankedOptions
    return rankedOptions.filter((option) => normalize(option).includes(normalizedQuery))
  }, [normalizedQuery, rankedOptions])
  const exact = rankedOptions.some((option) => normalize(option) === normalizedQuery)
  const similar = normalizedQuery.length >= 2 && !exact
    ? rankedOptions.filter((option) => {
      const candidate = normalize(option)
      return candidate.includes(normalizedQuery) || normalizedQuery.includes(candidate) || distance(candidate, normalizedQuery) <= 2
    }).slice(0, 3)
    : []
  const showCreate = !!normalizedQuery && !exact
  const optionCount = filtered.length + (showCreate ? 1 : 0)
  const activeOptionId = `${id}-option-${activeIndex}`
  const displayed = query || value
  function select(name: string) {
    onChange(name)
    setQuery(name)
    setOpen(false)
    setMobileOpen(false)
  }

  function clear(event?: MouseEvent) {
    event?.stopPropagation()
    onChange('')
    setQuery('')
    setActiveIndex(0)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((index) => Math.min(index + 1, Math.max(0, optionCount - 1)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((index) => Math.max(0, index - 1))
    } else if (event.key === 'Enter' && (open || mobileOpen)) {
      event.preventDefault()
      if (activeIndex < filtered.length && filtered[activeIndex]) select(filtered[activeIndex])
      else if (showCreate) select(query.trim())
    } else if (event.key === 'Escape' && (open || mobileOpen)) {
      event.preventDefault()
      setOpen(false)
      setMobileOpen(false)
      setQuery(value)
      desktopInputRef.current?.blur()
    }
  }

  function renderOptions(idSuffix = '') {
    if (!filtered.length && !showCreate) {
      return <div className="brand-combobox__empty px-3 py-4 text-sm text-ink-2">{options.length ? `沒有符合的${entityName}` : `還沒有任何${entityName}，直接輸入即可新增。`}</div>
    }
    return <>
      {filtered.length > 0 && <>
        <p className="brand-combobox__group m-0 px-3 pb-1 pt-2 text-[11px] text-ink-3">{normalizedQuery ? '符合的品牌' : '全部品牌（A–Z）'}</p>
        {filtered.map((option, index) => <Option key={normalize(option)} id={`${id}${idSuffix}-option-${index}`} option={option} selected={normalize(value) === normalize(option)} active={activeIndex === index} onClick={() => select(option)} />)}
      </>}
      {showCreate && <>
        {similar.length > 0 && <div className="brand-combobox__similar m-1 flex items-start gap-2 rounded-sm bg-mist-soft p-2.5 text-xs leading-5 text-mist-ink"><Icon name="alert" size={16} /><span>你是不是要找已經有的{entityName}？先看看以下相似項目。</span></div>}
        <p className="m-0 border-t border-dashed border-line px-3 pb-1 pt-2 text-[11px] text-ink-3">新增{entityName}</p>
        <button id={`${id}${idSuffix}-option-${filtered.length}`} type="button" role="option" aria-selected={activeIndex === filtered.length} onClick={() => select(query.trim())} className={`brand-combobox__create flex min-h-11 w-full items-center gap-2 rounded-sm px-3 text-left text-sm ${similar.length ? 'text-ink-2' : 'text-mist-deep'} ${activeIndex === filtered.length ? 'bg-oat-soft' : 'hover:bg-tile'}`}><Icon name="plus" size={18} />新增「{query.trim()}」</button>
      </>}
    </>
  }

  return <div ref={rootRef} className={`brand-combobox relative min-w-0 ${className}`}>
    <div className="brand-combobox__desktop relative hidden md:block">
      <input ref={desktopInputRef} id={id} role="combobox" aria-label={label} aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-listbox`} aria-activedescendant={open && optionCount ? activeOptionId : undefined} value={query} onFocus={() => { if (!open) setQuery(value); setOpen(true) }} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); setOpen(true) }} onKeyDown={handleKeyDown} placeholder={placeholder} className="h-12 w-full rounded-btn border-[1.5px] border-line bg-card px-3 pr-20 text-sm text-ink placeholder:text-ink-3 focus:border-mist-deep" />
      {displayed && <button type="button" aria-label="清除品牌" onClick={clear} className="absolute right-10 top-1 flex size-10 items-center justify-center rounded-btn text-ink-2 hover:bg-tile"><Icon name="x" size={16} /></button>}
      <button type="button" aria-label={open ? '關閉品牌選單' : '開啟品牌選單'} aria-expanded={open} onClick={() => { setOpen((current) => !current); desktopInputRef.current?.focus() }} className="absolute right-1 top-1 flex size-10 items-center justify-center rounded-btn text-ink-3 hover:bg-tile"><Icon name={open ? 'back' : 'down'} size={18} /></button>
      {open && <div className="brand-combobox__popup absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-card bg-card p-1.5 shadow-float" role="listbox" id={`${id}-listbox`} aria-label={label}>{renderOptions()}<div className="brand-combobox__footer flex items-center justify-between border-t border-dashed border-line px-2.5 py-2 text-[11px] text-ink-3"><span>共 {options.length} 個{entityName}</span>{manageHref && <ManageLink href={manageHref} entityName={entityName} className="min-h-8" />}</div></div>}
    </div>
    <div className="brand-combobox__mobile flex h-12 w-full items-center rounded-btn border-[1.5px] border-line bg-card md:hidden"><button type="button" aria-label={`${label}：${displayed || placeholder}`} aria-haspopup="dialog" aria-expanded={mobileOpen} onClick={() => { setQuery(value); setMobileOpen(true) }} className="flex min-w-0 flex-1 items-center gap-2 rounded-btn bg-transparent px-3 text-left text-sm text-ink"><span className={displayed ? 'min-w-0 flex-1 truncate' : 'min-w-0 flex-1 truncate text-ink-3'}>{displayed || placeholder}</span><Icon name="down" size={18} className="text-ink-3" /></button>{displayed && <button type="button" aria-label="清除品牌" onClick={() => clear()} className="mr-1 flex size-10 flex-none items-center justify-center rounded-sm text-ink-2 hover:bg-tile"><Icon name="x" size={16} /></button>}</div>
    {mobileOpen && <div className="brand-combobox__mobile-overlay fixed inset-0 z-50 bg-scrim md:hidden" onMouseDown={(event) => event.target === event.currentTarget && setMobileOpen(false)}>
      <section role="dialog" aria-modal="true" aria-label={`選擇${label}`} className="brand-combobox__mobile-sheet absolute inset-x-0 bottom-0 top-[8dvh] flex flex-col gap-2 rounded-t-block bg-card px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-2 shadow-sheet">
        <span aria-hidden="true" className="mx-auto h-1 w-10 rounded-full bg-line-strong" />
        <header className="flex items-center"><h2 className="m-0 font-hd text-xl">{label}</h2><button type="button" onClick={() => { setMobileOpen(false); setQuery(value) }} className="ml-auto flex min-h-11 items-center px-3 text-sm text-mist-deep">取消</button></header>
        <div className="relative"><Icon name="search" size={18} className="absolute left-3 top-3 text-ink-2" /><input ref={mobileInputRef} role="combobox" aria-label={`搜尋或輸入${label}`} aria-autocomplete="list" aria-expanded="true" aria-controls={`${id}-mobile-listbox`} aria-activedescendant={optionCount ? `${id}-mobile-option-${activeIndex}` : undefined} value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0) }} onKeyDown={handleKeyDown} placeholder={placeholder} className="h-12 w-full rounded-btn border-[1.5px] border-mist-deep bg-card pl-10 pr-12 text-base text-ink" />{query && <button type="button" aria-label="清除輸入" onClick={() => { setQuery(''); setActiveIndex(0); mobileInputRef.current?.focus() }} className="absolute right-1 top-1 flex size-10 items-center justify-center rounded-btn text-ink-2"><Icon name="x" size={16} /></button>}</div>
        <div className="brand-combobox__mobile-list min-h-0 flex-1 overflow-y-auto" role="listbox" id={`${id}-mobile-listbox`} aria-label={label}>{renderOptions('-mobile')}</div>
        <footer className="flex items-center justify-between gap-2 border-t border-dashed border-line pt-1 text-xs text-ink-3"><span>選擇既有{entityName}，或輸入新增</span>{manageHref && <ManageLink href={manageHref} entityName={entityName} className="min-h-11 text-[13px]" />}</footer>
      </section>
    </div>}
  </div>
}

function Option({ id, option, selected, active, onClick }: { id: string; option: string; selected: boolean; active: boolean; onClick: () => void }) {
  return <button id={id} type="button" role="option" aria-selected={selected} onClick={onClick} className={`brand-combobox__option flex min-h-[42px] w-full items-center gap-2.5 rounded-sm px-2.5 text-left text-sm text-ink ${active ? 'bg-oat-soft' : 'hover:bg-tile'}`}><span aria-hidden="true" className={`w-[18px] flex-none ${selected ? 'text-ink' : 'text-transparent'}`}><Icon name="check" size={16} /></span><span className="min-w-0 flex-1 truncate">{option}</span></button>
}

/** 清單管理在新分頁開啟，表單填到一半也不會遺失 */
function ManageLink({ href, entityName, className = '' }: { href: string; entityName: string; className?: string }) {
  return <a href={href} target="_blank" rel="noopener" className={`brand-combobox__manage inline-flex flex-none items-center gap-1 font-medium text-mist-deep ${className}`}>管理{entityName}<Icon name="link" size={13} /><span className="sr-only">（在新分頁開啟）</span></a>
}
