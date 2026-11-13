import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Icon } from '@/components/ui/Icon'
import { getStudioBackground, STUDIO_BACKGROUND_THEMES, STUDIO_COLOR_SWATCHES } from '@/lib/studioBackground'
import type { StudioBackgroundCustom, StudioBackgroundMode, StudioBackgroundTheme } from '@/types'

type Props = {
  theme: StudioBackgroundTheme
  mode: StudioBackgroundMode
  custom: StudioBackgroundCustom
  recommendedTheme: StudioBackgroundTheme | null
  onThemeChange: (theme: StudioBackgroundTheme) => void
  onModeChange: (mode: StudioBackgroundMode) => void
  onCustomChange: (custom: StudioBackgroundCustom) => void
}

const MODES: { id: StudioBackgroundMode; label: string }[] = [
  { id: 'on', label: '開' },
  { id: 'soft', label: '淡' },
  { id: 'off', label: '關' },
]

export function StudioBackgroundPicker({ theme, mode, custom, recommendedTheme, onThemeChange, onModeChange, onCustomChange }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  const [customSlot, setCustomSlot] = useState<'a' | 'b'>('a')
  const [hexEdit, setHexEdit] = useState<{ slot: 'a' | 'b'; original: string; value: string } | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const activeTheme = getStudioBackground(theme, custom)
  const hexDraft = hexEdit?.slot === customSlot && hexEdit.original === custom[customSlot] ? hexEdit.value : custom[customSlot]

  useEffect(() => {
    const dialog = dialogRef.current
    if (mobileOpen && dialog && !dialog.open) dialog.showModal()
    else if (!mobileOpen && dialog?.open) dialog.close()
  }, [mobileOpen])

  function selectTheme(nextTheme: StudioBackgroundTheme) {
    onThemeChange(nextTheme)
    setCustomOpen(nextTheme === 'custom')
    if (nextTheme === 'custom') setCustomSlot('a')
  }

  function updateColor(hex: string) {
    if (!/^#[\da-f]{6}$/i.test(hex)) return
    onCustomChange({ ...custom, [customSlot]: hex.toUpperCase() })
    onThemeChange('custom')
  }

  function dismissFromBackdrop(event: MouseEvent<HTMLDialogElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
      event.currentTarget.close()
    }
  }

  const themeOptions = (
    <div role="group" aria-label="背景主題" className="flex flex-wrap gap-1.5">
      {STUDIO_BACKGROUND_THEMES.map((option) => {
        const swatch = getStudioBackground(option.id, custom)
        const recommended = option.id === recommendedTheme
        const selected = theme === option.id
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            aria-label={`${option.name}${recommended ? '，推薦' : ''}`}
            onClick={() => selectTheme(option.id)}
            className={`studio-background-picker__theme relative inline-flex h-10 items-center gap-1.5 rounded-btn border-[1.5px] bg-card py-1 pl-1 pr-2.5 text-xs text-ink transition-colors ${selected ? 'border-ink font-bold' : 'border-line-strong hover:border-ink-2'}`}
          >
            <span aria-hidden="true" className="relative size-7 flex-none overflow-hidden rounded-sm border border-ink/10" style={{ backgroundColor: swatch.background }}>
              <span className="absolute -left-0.5 top-1 size-5 rotate-[-6deg] rounded-tag" style={{ backgroundColor: swatch.previewA, opacity: option.id === 'plain' ? 0 : 0.8 }} />
              <span className="absolute -right-0.5 bottom-0.5 size-5 rotate-[6deg] rounded-tag mix-blend-multiply" style={{ backgroundColor: swatch.previewB, opacity: option.id === 'plain' ? 0 : 0.8 }} />
              {option.id === 'custom' && <span className="absolute inset-0 flex items-center justify-center bg-card/60 text-lg leading-none">＋</span>}
            </span>
            {option.name}
            {recommended && <span aria-hidden="true" className="studio-background-picker__star absolute -right-1.5 -top-2 flex size-[18px] items-center justify-center rounded-full bg-oat text-[11px] text-ink shadow-paper">★</span>}
          </button>
        )
      })}
    </div>
  )

  const modeControl = (
    <div className={`studio-background-picker__modes flex items-center gap-2 ${!activeTheme.blobA ? 'opacity-45' : ''}`}>
      <span className="text-xs text-ink-2">色塊</span>
      <div role="group" aria-label="色塊顯示模式" className="grid grid-cols-3 rounded-btn bg-tile p-1">
        {MODES.map((option) => <button key={option.id} type="button" aria-pressed={mode === option.id} disabled={!activeTheme.blobA} onClick={() => onModeChange(option.id)} className={`min-h-8 min-w-10 rounded-sm px-2 text-xs ${mode === option.id ? 'bg-card font-bold text-ink shadow-paper' : 'text-ink-2'} disabled:cursor-not-allowed`}>{option.label}</button>)}
      </div>
    </div>
  )

  const customEditor = (
    <div className="studio-background-picker__custom space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="m-0 font-hd text-lg">自訂背景</h3>
        <button type="button" aria-label="關閉自訂背景" onClick={() => { setCustomOpen(false); setMobileOpen(false) }} className="flex size-11 items-center justify-center rounded-btn text-ink-2 hover:bg-tile"><Icon name="x" /></button>
      </div>
      <div role="group" aria-label="選擇要編輯的色塊" className="grid grid-cols-2 gap-2">
        {(['a', 'b'] as const).map((slot) => (
          <button key={slot} type="button" aria-pressed={customSlot === slot} onClick={() => setCustomSlot(slot)} className={`flex min-h-12 items-center gap-2 rounded-btn border-[1.5px] px-2.5 text-left text-xs ${customSlot === slot ? 'border-ink bg-paper' : 'border-line bg-card'}`}>
            <span aria-hidden="true" className="size-7 flex-none rounded-sm border border-ink/10" style={{ backgroundColor: custom[slot] }} />
            <span className="min-w-0"><span className="block">色塊 {slot === 'a' ? '1' : '2'}</span><span className="font-num text-ink-2">{custom[slot]}</span></span>
          </button>
        ))}
      </div>
      <p className="m-0 text-xs text-ink-2">從衣物色系挑一個顏色</p>
      <div role="group" aria-label="背景色票" className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {STUDIO_COLOR_SWATCHES.map((swatch) => <button key={swatch.hex} type="button" aria-label={swatch.name} aria-pressed={custom[customSlot] === swatch.hex} title={swatch.name} onClick={() => updateColor(swatch.hex)} className={`studio-background-picker__swatch aspect-square rounded-sm border border-ink/10 ${custom[customSlot] === swatch.hex ? 'ring-2 ring-ink ring-offset-2 ring-offset-card' : ''}`} style={{ backgroundColor: swatch.hex }} />)}
      </div>
      <label className="flex min-h-11 items-center gap-2 text-xs text-ink-2">
        HEX（選填）
        <input type="text" inputMode="text" autoCapitalize="characters" spellCheck={false} aria-label="背景 HEX 色碼" value={hexDraft} pattern="#[0-9A-Fa-f]{6}" maxLength={7} onChange={(event) => { setHexEdit({ slot: customSlot, original: custom[customSlot], value: event.target.value }); updateColor(event.target.value) }} onBlur={() => { if (!/^#[\da-f]{6}$/i.test(hexDraft)) setHexEdit(null) }} className="ml-auto h-11 w-32 rounded-btn border-[1.5px] border-line-strong bg-paper px-3 font-num text-sm text-ink outline-none focus:border-mist-deep" />
      </label>
      <p className="m-0 text-[11px] leading-5 text-ink-2">色塊會依顏色深淺自動調整透明度，保持衣物清楚。</p>
    </div>
  )

  return (
    <div className="studio-background-picker relative z-20">
      <div className="studio-background-picker__desktop hidden items-center gap-2 sm:flex sm:flex-wrap">
        <span className="mr-0.5 text-xs font-medium text-ink-2">背景</span>
        {themeOptions}
        <div className="ml-auto">{modeControl}</div>
      </div>
      {recommendedTheme && <p className="studio-background-picker__hint m-0 mt-1 hidden text-xs leading-5 text-ink-2 sm:block">★ 依畫布單品推薦「{STUDIO_BACKGROUND_THEMES.find((entry) => entry.id === recommendedTheme)?.name}」；新穿搭預設素紙。</p>}

      <button type="button" aria-expanded={mobileOpen} aria-haspopup="dialog" onClick={() => setMobileOpen(true)} className="studio-background-picker__mobile absolute right-2 top-16 z-20 flex h-10 items-center gap-1.5 rounded-btn bg-card px-2.5 text-xs text-ink shadow-paper sm:hidden">
        <span aria-hidden="true" className="relative size-6 overflow-hidden rounded-sm border border-ink/10" style={{ backgroundColor: activeTheme.background }}>
          <span className="absolute left-0 top-1 size-4 rounded-tag" style={{ backgroundColor: activeTheme.previewA, opacity: theme === 'plain' ? 0 : 0.8 }} />
          <span className="absolute bottom-0 right-0 size-4 rounded-tag mix-blend-multiply" style={{ backgroundColor: activeTheme.previewB, opacity: theme === 'plain' ? 0 : 0.8 }} />
        </span>
        背景
      </button>

      {customOpen && <div className="studio-background-picker__desktop-custom absolute right-0 top-12 z-30 hidden w-[min(320px,calc(100vw-32px))] rounded-card bg-card p-4 shadow-float sm:block">{customEditor}</div>}

      {mobileOpen && (
        <dialog ref={dialogRef} aria-label={customOpen ? '自訂背景' : '背景主題'} onClose={() => setMobileOpen(false)} onClick={dismissFromBackdrop} className="studio-background-picker__sheet max-h-[85dvh] w-full overflow-y-auto rounded-t-block bg-card px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-2 shadow-sheet sm:hidden">
            <span aria-hidden="true" className="mx-auto mb-2 block h-1 w-10 rounded-full bg-line-strong" />
            {customOpen ? <>{customEditor}<button type="button" onClick={() => { setCustomOpen(false); setMobileOpen(false) }} className="mt-3 min-h-11 w-full rounded-btn bg-ink px-4 text-sm font-medium text-paper">套用背景</button></> : (
              <>
                <div className="flex items-center justify-between"><h2 className="m-0 font-hd text-xl">背景主題</h2><button type="button" onClick={() => setMobileOpen(false)} className="min-h-11 px-2 text-sm font-medium text-mist-deep">完成</button></div>
                {recommendedTheme && <p className="m-0 -mt-1 text-xs leading-5 text-ink-2">★ 依這套衣物推薦「{STUDIO_BACKGROUND_THEMES.find((entry) => entry.id === recommendedTheme)?.name}」</p>}
                <div role="radiogroup" aria-label="背景主題" className="grid grid-cols-4 gap-x-2 gap-y-3">{STUDIO_BACKGROUND_THEMES.map((option) => {
                  const swatch = getStudioBackground(option.id, custom)
                  const selected = theme === option.id
                  return <button key={option.id} type="button" role="radio" aria-checked={selected} aria-label={`${option.name}${option.id === recommendedTheme ? '，推薦' : ''}`} onClick={() => selectTheme(option.id)} className="studio-background-picker__mobile-theme relative flex min-w-0 flex-col items-center gap-1.5 bg-transparent text-xs text-ink">
                    <span aria-hidden="true" className={`relative h-[54px] w-full overflow-hidden rounded-tile ${selected ? 'ring-2 ring-ink ring-offset-2 ring-offset-card' : 'border border-line'}`} style={{ backgroundColor: swatch.background }}>
                      <span className="absolute left-[12%] top-[14%] h-[58%] w-[48%] rotate-[-5deg] rounded-sm" style={{ backgroundColor: swatch.previewA, opacity: option.id === 'plain' ? 0 : 0.8 }} />
                      <span className="absolute left-[40%] top-[32%] h-[58%] w-[48%] rotate-[5deg] rounded-sm mix-blend-multiply" style={{ backgroundColor: swatch.previewB, opacity: option.id === 'plain' ? 0 : 0.8 }} />
                      {option.id === 'custom' && <span className="absolute inset-0 flex items-center justify-center bg-card/60 text-xl">＋</span>}
                    </span>
                    {option.name}
                    {option.id === recommendedTheme && <span aria-hidden="true" className="absolute right-0 top-[-7px] flex size-5 items-center justify-center rounded-full bg-oat text-[11px] text-ink shadow-paper">★</span>}
                  </button>
                })}</div>
                {modeControl}
                <p className="m-0 text-[11px] leading-5 text-ink-2">選取或拖曳單品時，開啟中的色塊會自動變淡；背景會跟著穿搭一起儲存。</p>
              </>
            )}
        </dialog>
      )}
    </div>
  )
}
