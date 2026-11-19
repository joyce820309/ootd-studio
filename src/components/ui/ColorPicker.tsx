import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Icon } from '@/components/ui/Icon'
import { GARMENT_COLORS } from '@/lib/colors'
import './ColorPicker.css'

export interface ColorPickerValue {
  /** 色票名稱（自由輸入 HEX 時仍保留最接近的色名） */
  name: string
  /** 色系群組，例如「白米」、「灰黑」 */
  family: string
  /** 實際顯示用 HEX */
  hex: string
  source: 'photo' | 'pick'
}

export interface ColorPickerPhoto {
  id: string
  src: string
  alt?: string
  label?: string
}

interface ColorPickerProps {
  value: ColorPickerValue
  onChange: (value: ColorPickerValue) => void
  /** 僅可傳入這件衣物的照片，避免對非本人衣物照片取色。 */
  photos?: ColorPickerPhoto[]
  label?: string
  disabled?: boolean
  className?: string
}

interface PickerColor extends ColorPickerValue {
  source: 'pick'
}

interface RecentColor {
  name: string
  family: string
  hex: string
}

interface ImagePoint {
  x: number
  y: number
  left: number
  top: number
  naturalX: number
  naturalY: number
}

const RECENT_STORAGE_KEY = 'ootd-color-picker-recent-v1'
const SAMPLE_EDGE = 64
const MAGNIFIER_ZOOM = 3
const RECENT_LIMIT = 6

const FAMILY_ORDER = ['白米', '棕', '灰黑', '藍', '綠', '黃橘', '紅粉', '紫', '其他']
const COLOR_FAMILY: Record<string, string> = {
  白: '白米', 米: '白米', 燕麥: '白米', 杏: '白米',
  駝: '棕', 咖啡: '棕',
  灰: '灰黑', 黑: '灰黑',
  海軍藍: '藍', 藍: '藍',
  綠: '綠', 黃: '黃橘', 橘: '黃橘',
  紅: '紅粉', 酒紅: '紅粉', 粉: '紅粉', 紫: '紫',
  多色: '其他', 其他: '其他',
}

const PICKER_COLORS: PickerColor[] = GARMENT_COLORS.map((color) => ({
  name: color.name,
  family: COLOR_FAMILY[color.name] ?? '其他',
  hex: color.hex,
  source: 'pick',
}))

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const validHex = (value: string) => /^#[0-9a-f]{6}$/i.test(value)

function normalizeRecent(value: unknown): RecentColor[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((entry): entry is RecentColor => !!entry && typeof entry === 'object'
      && typeof entry.name === 'string' && typeof entry.family === 'string'
      && typeof entry.hex === 'string' && validHex(entry.hex))
    .slice(0, RECENT_LIMIT)
}

function rgbFromHex(hex: string) {
  return [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
}

function linearize(channel: number) {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

/** sRGB 轉 OKLab，讓不同色相的色差比較符合人眼感受。 */
function toOklab(hex: string): [number, number, number] {
  const [r8, g8, b8] = rgbFromHex(hex).map(linearize)
  const l = Math.cbrt(0.4122214708 * r8 + 0.5363325363 * g8 + 0.0514459929 * b8)
  const m = Math.cbrt(0.2119034982 * r8 + 0.6806995451 * g8 + 0.1073969566 * b8)
  const s = Math.cbrt(0.0883024619 * r8 + 0.2817188376 * g8 + 0.6299787005 * b8)
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]
}

function nearestColor(hex: string) {
  const target = toOklab(hex)
  return PICKER_COLORS
    .filter((color) => color.name !== '多色' && color.name !== '其他')
    .map((color) => {
      const lab = toOklab(color.hex)
      return { color, distance: Math.hypot(target[0] - lab[0], target[1] - lab[1], target[2] - lab[2]) }
    })
    .sort((a, b) => a.distance - b.distance)[0]
}

function closenessLabel(distance: number) {
  if (distance < 0.055) return '很接近'
  if (distance < 0.12) return '差一點'
  return '差蠻多，可以自己改名'
}

/** 在原圖的圓形範圍取樣：排除最暗、最亮各 10%，再取 RGB 各通道中位數。 */
function sampleImageColor(image: HTMLImageElement, naturalX: number, naturalY: number): string {
  const shortEdge = Math.min(image.naturalWidth, image.naturalHeight)
  const diameter = Math.min(shortEdge, Math.max(9, shortEdge * 0.04))
  const radius = diameter / 2
  const left = clamp(naturalX - radius, 0, image.naturalWidth - diameter)
  const top = clamp(naturalY - radius, 0, image.naturalHeight - diameter)
  const canvas = document.createElement('canvas')
  canvas.width = SAMPLE_EDGE
  canvas.height = SAMPLE_EDGE
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('瀏覽器無法讀取這張照片。')
  context.drawImage(image, left, top, diameter, diameter, 0, 0, SAMPLE_EDGE, SAMPLE_EDGE)
  const pixels = context.getImageData(0, 0, SAMPLE_EDGE, SAMPLE_EDGE).data
  const points: { r: number; g: number; b: number; brightness: number }[] = []
  const center = (SAMPLE_EDGE - 1) / 2
  const sampleRadius = SAMPLE_EDGE / 2
  for (let y = 0; y < SAMPLE_EDGE; y += 1) {
    for (let x = 0; x < SAMPLE_EDGE; x += 1) {
      if ((x - center) ** 2 + (y - center) ** 2 > sampleRadius ** 2) continue
      const index = (y * SAMPLE_EDGE + x) * 4
      const r = pixels[index]
      const g = pixels[index + 1]
      const b = pixels[index + 2]
      points.push({ r, g, b, brightness: 0.2126 * r + 0.7152 * g + 0.0722 * b })
    }
  }
  points.sort((a, b) => a.brightness - b.brightness)
  const trim = Math.floor(points.length * 0.1)
  const kept = points.slice(trim, points.length - trim)
  const median = (channel: 'r' | 'g' | 'b') => {
    const values = kept.map((point) => point[channel]).sort((a, b) => a - b)
    const middle = Math.floor(values.length / 2)
    return Math.round(values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2)
  }
  return `#${[median('r'), median('g'), median('b')].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

function mapImagePoint(event: ReactPointerEvent<HTMLDivElement>, image: HTMLImageElement): ImagePoint | null {
  const rect = event.currentTarget.getBoundingClientRect()
  if (!image.naturalWidth || !image.naturalHeight || !rect.width || !rect.height) return null
  const scale = Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight)
  const width = image.naturalWidth * scale
  const height = image.naturalHeight * scale
  const offsetX = (rect.width - width) / 2
  const offsetY = (rect.height - height) / 2
  const x = clamp(event.clientX - rect.left - offsetX, 0, width)
  const y = clamp(event.clientY - rect.top - offsetY, 0, height)
  return {
    x: x / width,
    y: y / height,
    left: offsetX + x,
    top: offsetY + y,
    naturalX: (x / width) * image.naturalWidth,
    naturalY: (y / height) * image.naturalHeight,
  }
}

function cssPosition(point: ImagePoint | null): CSSProperties | undefined {
  return point ? { left: `${point.left}px`, top: `${point.top}px` } : undefined
}

/** B22 自訂選色器：按色名挑選，或在本件衣物照片上取色。 */
export function ColorPicker({ value, onChange, photos = [], label = '改顏色', disabled = false, className = '' }: ColorPickerProps) {
  const id = useId()
  const ids = { title: `${id}-title`, tabNames: `${id}-tab-names`, tabPhoto: `${id}-tab-photo`, panelNames: `${id}-panel-names`, panelPhoto: `${id}-panel-photo`, hex: `${id}-hex`, hexHelp: `${id}-hex-help` }
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const magnifierRef = useRef<HTMLCanvasElement>(null)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'names' | 'photo'>('names')
  const [draft, setDraft] = useState<ColorPickerValue>(value)
  const [hexText, setHexText] = useState(value.hex)
  const [activePhotoId, setActivePhotoId] = useState(photos[0]?.id ?? '')
  const [recent, setRecent] = useState<RecentColor[]>(() => {
    if (typeof window === 'undefined') return []
    try { return normalizeRecent(JSON.parse(window.localStorage.getItem(RECENT_STORAGE_KEY) ?? '[]')) } catch { return [] }
  })
  const [point, setPoint] = useState<ImagePoint | null>(null)
  const [sampledHex, setSampledHex] = useState<string | null>(null)
  const [sampleError, setSampleError] = useState<string | null>(null)
  const [position, setPosition] = useState({ top: 24, left: 24 })
  const isPointerDown = useRef(false)
  const activePhoto = photos.find((photo) => photo.id === activePhotoId) ?? photos[0]
  const closest = useMemo(() => sampledHex ? nearestColor(sampledHex) : null, [sampledHex])
  const groupedColors = useMemo(() => FAMILY_ORDER.map((family) => ({
    family,
    colors: PICKER_COLORS.filter((color) => color.family === family),
  })).filter((group) => group.colors.length), [])

  useLayoutEffect(() => {
    if (!open || window.matchMedia('(max-width: 767px)').matches) return
    const trigger = triggerRef.current
    const dialog = dialogRef.current
    if (!trigger || !dialog) return
    const anchor = trigger.getBoundingClientRect()
    const popup = dialog.getBoundingClientRect()
    const left = clamp(anchor.left, 12, window.innerWidth - popup.width - 12)
    const below = anchor.bottom + 8
    const top = below + popup.height <= window.innerHeight - 12 ? below : Math.max(12, anchor.top - popup.height - 8)
    setPosition({ top, left })
  }, [open, tab, activePhotoId])

  const updateRecent = useCallback((color: ColorPickerValue) => {
    const next = [{ name: color.name, family: color.family, hex: color.hex }, ...recent.filter((entry) => !(entry.name === color.name && entry.hex.toLowerCase() === color.hex.toLowerCase()))].slice(0, RECENT_LIMIT)
    setRecent(next)
    try { window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next)) } catch { /* 儲存空間停用時仍可正常選色 */ }
  }, [recent])

  const close = () => {
    dialogRef.current?.close()
    setOpen(false)
  }

  function applyColor(color: ColorPickerValue) {
    onChange(color)
    updateRecent(color)
    close()
  }

  function chooseNamedColor(color: PickerColor) {
    setDraft({ ...color })
    setHexText(color.hex)
  }

  function handleHexChange(next: string) {
    setHexText(next)
    if (validHex(next)) setDraft((current) => ({ ...current, hex: next.toUpperCase(), source: 'pick' }))
  }

  function changeTab(next: 'names' | 'photo') {
    setTab(next)
    if (next === 'photo' && !activePhoto && photos[0]) setActivePhotoId(photos[0].id)
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      changeTab(tab === 'names' ? 'photo' : 'names')
    }
    if (event.key === 'Home') { event.preventDefault(); changeTab('names') }
    if (event.key === 'End') { event.preventDefault(); changeTab('photo') }
  }

  function openPicker() {
    setTab('names')
    setDraft({ ...value })
    setHexText(value.hex)
    setActivePhotoId(photos[0]?.id ?? '')
    setPoint(null)
    setSampledHex(null)
    setSampleError(null)
    setOpen(true)
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }

  function handlePhotoPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const image = imageRef.current
    if (!image) return
    const next = mapImagePoint(event, image)
    if (!next) return
    event.currentTarget.setPointerCapture(event.pointerId)
    isPointerDown.current = true
    setPoint(next)
    setSampleError(null)
  }

  function handlePhotoPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isPointerDown.current) return
    const image = imageRef.current
    const next = image ? mapImagePoint(event, image) : null
    if (next) setPoint(next)
  }

  function handlePhotoPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isPointerDown.current) return
    isPointerDown.current = false
    const image = imageRef.current
    const next = image ? mapImagePoint(event, image) : null
    if (!image || !next) return
    setPoint(next)
    try {
      setSampledHex(sampleImageColor(image, next.naturalX, next.naturalY))
      setSampleError(null)
    } catch {
      setSampledHex(null)
      setSampleError('這張照片目前無法取色，請確認圖片來源允許讀取，或改用色名選取。')
    }
  }

  const drawMagnifier = useCallback(() => {
    const canvas = magnifierRef.current
    const image = imageRef.current
    if (!canvas || !image || !point || !image.naturalWidth || !image.naturalHeight) return
    const context = canvas.getContext('2d')
    if (!context) return
    const size = 96
    const crop = Math.max(9, Math.min(image.naturalWidth, image.naturalHeight) * 0.04) * MAGNIFIER_ZOOM
    const left = clamp(point.naturalX - crop / 2, 0, image.naturalWidth - crop)
    const top = clamp(point.naturalY - crop / 2, 0, image.naturalHeight - crop)
    canvas.width = size
    canvas.height = size
    context.clearRect(0, 0, size, size)
    context.drawImage(image, left, top, crop, crop, 0, 0, size, size)
  }, [point])

  useEffect(() => { drawMagnifier() }, [drawMagnifier, activePhotoId])

  function outsidePointerUp(event: ReactPointerEvent<HTMLDialogElement>) {
    const dialog = dialogRef.current
    if (!dialog || event.target !== dialog) return
    const rect = dialog.getBoundingClientRect()
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close()
  }

  const dialogStyle = {
    '--color-picker-top': `${position.top}px`,
    '--color-picker-left': `${position.left}px`,
  } as CSSProperties

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${label}：${value.name}，${value.hex}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={openPicker}
        className={`color-picker__trigger ${disabled ? 'is-disabled' : ''} ${className}`}
      >
        <span aria-hidden="true" className="color-picker__trigger-swatch" style={{ backgroundColor: value.hex }} />
        <span className="color-picker__trigger-label">{value.name}</span>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={ids.title}
        onClose={() => setOpen(false)}
        onPointerUp={outsidePointerUp}
        style={dialogStyle}
        className="color-picker__dialog"
      >
        <header className="color-picker__header">
          <h2 id={ids.title} className="color-picker__title">選擇顏色</h2>
          <button type="button" onClick={close} aria-label="關閉選色器" className="color-picker__close"><Icon name="x" size={18} /></button>
        </header>

        <div role="tablist" aria-label="選色方式" className="color-picker__tabs">
          <button id={ids.tabNames} type="button" role="tab" aria-selected={tab === 'names'} aria-controls={ids.panelNames} tabIndex={tab === 'names' ? 0 : -1} autoFocus onClick={() => changeTab('names')} onKeyDown={handleTabKeyDown} className="color-picker__tab">色名</button>
          <button id={ids.tabPhoto} type="button" role="tab" aria-selected={tab === 'photo'} aria-controls={ids.panelPhoto} tabIndex={tab === 'photo' ? 0 : -1} onClick={() => changeTab('photo')} onKeyDown={handleTabKeyDown} className="color-picker__tab">從照片取色</button>
        </div>

        <section id={ids.panelNames} role="tabpanel" aria-labelledby={ids.tabNames} hidden={tab !== 'names'} className="color-picker__panel color-picker__panel--names">
            {recent.length > 0 && <ColorRow label="最近" colors={recent.map((entry) => ({ ...entry, source: 'pick' as const }))} selected={draft} onSelect={chooseNamedColor} />}
            {groupedColors.map((group) => <ColorRow key={group.family} label={group.family} colors={group.colors} selected={draft} onSelect={chooseNamedColor} />)}
            <div className="color-picker__selection">
              <span aria-hidden="true" className="color-picker__selection-swatch" style={{ backgroundColor: validHex(hexText) ? hexText : draft.hex }} />
              <span className="color-picker__selected-name">{draft.name}</span>
              <label className="color-picker__hex-label" htmlFor={ids.hex}>HEX</label>
              <input id={ids.hex} value={hexText} onChange={(event) => handleHexChange(event.target.value)} aria-invalid={!validHex(hexText)} aria-describedby={ids.hexHelp} autoComplete="off" spellCheck={false} className="color-picker__hex-input" />
              <span id={ids.hexHelp} className="sr-only">請輸入井字號開頭的六位 HEX 色碼</span>
            </div>
        </section>
        <section id={ids.panelPhoto} role="tabpanel" aria-labelledby={ids.tabPhoto} hidden={tab !== 'photo'} className="color-picker__panel color-picker__panel--photo">
            {!photos.length ? (
              <div className="color-picker__empty">這件衣物還沒有照片。<br />先加入照片，才能從照片取色。</div>
            ) : (
              <>
                {photos.length > 1 && <div role="group" aria-label="選擇這件衣物的照片" className="color-picker__thumbnails">{photos.map((photo, index) => <button key={photo.id} type="button" aria-label={photo.label ?? `選擇第 ${index + 1} 張照片`} aria-pressed={activePhoto?.id === photo.id} onClick={() => { setActivePhotoId(photo.id); setPoint(null); setSampledHex(null); setSampleError(null) }} className="color-picker__thumbnail"><img src={photo.src} alt="" loading="lazy" /></button>)}</div>}
                <div className="color-picker__photo-stage" onPointerDown={handlePhotoPointerDown} onPointerMove={handlePhotoPointerMove} onPointerUp={handlePhotoPointerUp} onPointerCancel={() => { isPointerDown.current = false }}>
                  {activePhoto && <img key={activePhoto.id} ref={imageRef} crossOrigin="anonymous" src={activePhoto.src} alt={activePhoto.alt ?? '這件衣物的照片'} draggable={false} onLoad={drawMagnifier} className="color-picker__photo" />}
                  {point && <>
                    <span aria-hidden="true" className="color-picker__sample-ring" style={cssPosition(point)} />
                    <div aria-hidden="true" className="color-picker__magnifier" style={{ left: `clamp(54px, ${point.left}px, calc(100% - 54px))`, top: `${Math.max(58, point.top - 116)}px` }}><canvas ref={magnifierRef} /><span className="color-picker__magnifier-center" /></div>
                  </>}
                  <span className="color-picker__photo-hint">拖曳圓圈到光線均勻的平面，放開取色</span>
                </div>
                {sampleError && <p role="alert" className="color-picker__error">{sampleError}</p>}
                {sampledHex && closest && <div className="color-picker__sample-result" aria-live="polite">
                  <span aria-hidden="true" className="color-picker__result-swatch" style={{ backgroundColor: sampledHex }} />
                  <span className="color-picker__result-copy"><span>取到 <b className="font-num">{sampledHex}</b></span><span>最接近色名：<b>{closest.color.name}</b>（{closenessLabel(closest.distance)}）</span></span>
                </div>}
              </>
            )}
        </section>

        <footer className="color-picker__footer">
          {tab === 'photo' && sampledHex && closest ? (
            <>
              <button type="button" onClick={() => applyColor({ name: closest.color.name, family: closest.color.family, hex: closest.color.hex, source: 'pick' })} className="color-picker__text-button">只用色名</button>
              <button type="button" onClick={() => applyColor({ name: closest.color.name, family: closest.color.family, hex: sampledHex, source: 'photo' })} className="color-picker__apply-button">套用「{closest.color.name} {sampledHex}」</button>
            </>
          ) : (
            <>
              <span className="color-picker__footer-current"><span aria-hidden="true" className="color-picker__footer-swatch" style={{ backgroundColor: validHex(hexText) ? hexText : draft.hex }} />{draft.name} <span className="font-num">{validHex(hexText) ? hexText.toUpperCase() : draft.hex}</span></span>
              <button type="button" disabled={!validHex(hexText)} onClick={() => applyColor({ ...draft, hex: hexText.toUpperCase(), source: 'pick' })} className="color-picker__apply-button">套用顏色</button>
            </>
          )}
        </footer>
      </dialog>
    </>
  )
}

function ColorRow({ label, colors, selected, onSelect }: { label: string; colors: PickerColor[]; selected: ColorPickerValue; onSelect: (color: PickerColor) => void }) {
  return (
    <div className="color-picker__row">
      <span className="color-picker__family">{label}</span>
      <div className="color-picker__swatches">
        {colors.map((color) => {
          const isSelected = selected.name === color.name && selected.hex.toLowerCase() === color.hex.toLowerCase()
          return <button key={`${color.name}-${color.hex}`} type="button" aria-label={`${color.name}，${color.hex}`} aria-pressed={isSelected} onClick={() => onSelect(color)} className="color-picker__swatch-option">
            <span aria-hidden="true" className={`color-picker__swatch ${color.name === '多色' ? 'color-picker__swatch--multi' : ''}`} style={{ backgroundColor: color.name === '多色' ? undefined : color.hex }} />
            <span className="color-picker__swatch-name">{color.name}</span>
          </button>
        })}
      </div>
    </div>
  )
}
