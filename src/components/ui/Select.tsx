import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '@/components/ui/Icon'

export interface SelectOption<T extends string = string> {
  value: T
  label: string
  /** 右側小字，例如件數 */
  hint?: string
}

interface SelectProps<T extends string> {
  /** 無障礙名稱，也是手機底部清單的標題 */
  label: string
  value: T | ''
  options: SelectOption<T>[]
  onChange: (value: T) => void
  /** 還沒選時顯示的灰字 */
  placeholder?: string
  /** 取代觸發按鈕上的文字（例：精簡版排序名稱、前面加圖示） */
  display?: ReactNode
  /** 觸發按鈕外觀；不給就用一般表單欄位樣式 */
  triggerClassName?: string
  /** 清單對齊觸發按鈕的哪一側 */
  align?: 'left' | 'right'
  className?: string
  id?: string
}

const FIELD = 'h-11 w-full rounded-btn border-[1.5px] border-line bg-card px-3 text-sm text-ink'
const MOBILE_QUERY = '(max-width: 767px)'

/**
 * 只能從清單挑的下拉選單（B13 清單樣式）：
 * 桌面在欄位下方展開浮動清單（鍵盤移到的列為燕麥底、已選有 ✓）；手機改用底部清單，每列 48px。
 */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = '請選擇',
  display,
  triggerClassName = FIELD,
  align = 'left',
  className = '',
  id: idProp,
}: SelectProps<T>) {
  const autoId = useId()
  const id = idProp ?? autoId
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<'closed' | 'popup' | 'sheet'>('closed')
  const [activeIndex, setActiveIndex] = useState(0)
  const [position, setPosition] = useState<CSSProperties>({})
  const selectedIndex = options.findIndex((option) => option.value === value)
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined
  const open = mode !== 'closed'

  function openList() {
    if (!options.length) return
    setActiveIndex(Math.max(0, selectedIndex))
    setMode(window.matchMedia(MOBILE_QUERY).matches ? 'sheet' : 'popup')
  }

  function close(returnFocus = true) {
    setMode('closed')
    if (returnFocus) triggerRef.current?.focus()
  }

  function choose(index: number) {
    const option = options[index]
    if (!option) return
    if (option.value !== value) onChange(option.value)
    close()
  }

  // 浮動清單用 fixed 定位，避免被有 overflow 的卡片裁掉；下方空間不夠時往上開
  useLayoutEffect(() => {
    if (mode !== 'popup') return
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      const height = Math.min(popupRef.current?.offsetHeight ?? 288, 288)
      const below = window.innerHeight - rect.bottom
      const up = below < height + 12 && rect.top > below
      const minWidth = Math.max(rect.width, 160)
      setPosition({
        minWidth,
        maxWidth: Math.max(minWidth, 320),
        ...(up ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
        ...(align === 'right' ? { right: window.innerWidth - rect.right } : { left: rect.left }),
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [mode, align])

  useEffect(() => {
    if (mode !== 'popup') return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!popupRef.current?.contains(target) && !triggerRef.current?.contains(target)) close(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [mode])

  useEffect(() => {
    if (mode !== 'sheet') return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    popupRef.current?.querySelector<HTMLElement>('[aria-selected="true"], [role="option"]')?.focus()
    return () => { document.body.style.overflow = previous }
  }, [mode])

  // 鍵盤移動時讓目前那列保持在可見範圍
  useEffect(() => {
    if (mode !== 'popup') return
    document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView({ block: 'nearest' })
  }, [mode, activeIndex, id])

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    const last = options.length - 1
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault()
        openList()
      }
      return
    }
    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, last)) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)) }
    else if (event.key === 'Home') { event.preventDefault(); setActiveIndex(0) }
    else if (event.key === 'End') { event.preventDefault(); setActiveIndex(last) }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(activeIndex) }
    else if (event.key === 'Escape') { event.preventDefault(); close() }
    else if (event.key === 'Tab') { if (mode === 'popup') choose(activeIndex) }
    else if (event.key.length === 1) {
      // 打字跳到開頭相符的選項
      const key = event.key.toLocaleLowerCase()
      const start = activeIndex + 1
      const order = [...options.slice(start), ...options.slice(0, start)]
      const hit = order.findIndex((option) => option.label.toLocaleLowerCase().startsWith(key))
      if (hit >= 0) setActiveIndex((start + hit) % options.length)
    }
  }

  const row = (option: SelectOption<T>, index: number, sheet: boolean) => {
    const isSelected = option.value === value
    const isActive = !sheet && index === activeIndex
    return (
      <div
        key={option.value}
        id={sheet ? undefined : `${id}-option-${index}`}
        role="option"
        aria-selected={isSelected}
        tabIndex={sheet ? 0 : -1}
        onPointerEnter={() => !sheet && setActiveIndex(index)}
        onClick={() => choose(index)}
        onKeyDown={sheet ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(index) } } : undefined}
        className={`flex w-full cursor-pointer items-center gap-2.5 rounded-sm px-2.5 text-left text-ink ${sheet ? 'min-h-12 text-[15px]' : 'min-h-[42px] text-sm'} ${isActive ? 'bg-oat-soft' : sheet && isSelected ? 'bg-oat-wash' : 'hover:bg-tile'}`}
      >
        <span aria-hidden="true" className={`flex w-[18px] flex-none ${isSelected ? 'text-ink' : 'text-transparent'}`}><Icon name="check" size={16} /></span>
        <span className={`min-w-0 flex-1 truncate ${isSelected ? 'font-medium' : ''}`}>{option.label}</span>
        {option.hint && <span className="flex-none font-num text-xs text-ink-3 tabular">{option.hint}</span>}
      </div>
    )
  }

  return (
    <div className={`relative min-w-0 ${className}`}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-listbox` : undefined}
        aria-activedescendant={mode === 'popup' ? `${id}-option-${activeIndex}` : undefined}
        onClick={() => (open ? close() : openList())}
        onKeyDown={handleKeyDown}
        className={`flex min-w-0 cursor-pointer items-center gap-1.5 text-left ${triggerClassName}`}
      >
        <span className={`min-w-0 flex-1 truncate ${!display && !selected ? 'text-ink-3' : ''}`}>{display ?? selected?.label ?? placeholder}</span>
        <Icon name="down" size={16} className={`flex-none text-ink-2 transition-transform motion-reduce:transition-none ${mode === 'popup' ? 'rotate-180' : ''}`} />
      </button>

      {mode === 'popup' && createPortal(
        <div
          ref={popupRef}
          id={`${id}-listbox`}
          role="listbox"
          aria-label={label}
          style={position}
          onMouseDown={(event) => event.preventDefault()}
          className="fixed z-50 max-h-72 overflow-y-auto rounded-card bg-card p-1.5 shadow-float"
        >
          {options.map((option, index) => row(option, index, false))}
        </div>,
        document.body,
      )}

      {mode === 'sheet' && createPortal(
        <div className="fixed inset-0 z-50 bg-scrim" onMouseDown={(event) => event.target === event.currentTarget && close()}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={label}
            onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); close() } }}
            className="absolute inset-x-0 bottom-0 flex max-h-[80dvh] flex-col gap-2 rounded-t-block bg-card px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-2 shadow-sheet"
          >
            <span aria-hidden="true" className="mx-auto h-1 w-10 rounded-full bg-line-strong" />
            <header className="flex items-center">
              <h2 className="m-0 font-hd text-xl">{label}</h2>
              <button type="button" onClick={() => close()} className="ml-auto flex min-h-11 items-center px-3 text-sm text-mist-deep">取消</button>
            </header>
            <div ref={popupRef} id={`${id}-listbox`} role="listbox" aria-label={label} className="min-h-0 flex-1 overflow-y-auto">
              {options.map((option, index) => row(option, index, true))}
            </div>
          </section>
        </div>,
        document.body,
      )}
    </div>
  )
}
