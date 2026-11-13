import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import type { CutoutRegion } from '@/types'

const FULL_REGION: CutoutRegion = { x: 0, y: 0, w: 100, h: 100 }
const MIN_SIZE = 5
const KEY_STEP = 2

type Corner = 'nw' | 'ne' | 'sw' | 'se'
type Drag = { mode: 'move' | 'draw' | Corner; startX: number; startY: number; start: CutoutRegion }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const round = (value: number) => Math.round(value * 10) / 10

/** 範圍是否等於整張照片（幾乎沒框） */
function isFullRegion(region: CutoutRegion | null | undefined) {
  return !region || (region.x <= 0.5 && region.y <= 0.5 && region.w >= 99 && region.h >= 99)
}

/** 依四個邊建立範圍，並確保留在照片內、不小於最小尺寸 */
function fromEdges(left: number, top: number, right: number, bottom: number): CutoutRegion {
  const l = clamp(Math.min(left, right), 0, 100 - MIN_SIZE)
  const t = clamp(Math.min(top, bottom), 0, 100 - MIN_SIZE)
  const r = clamp(Math.max(left, right), l + MIN_SIZE, 100)
  const b = clamp(Math.max(top, bottom), t + MIN_SIZE, 100)
  return { x: l, y: t, w: r - l, h: b - t }
}

const CORNERS: { corner: Corner; className: string; label: string }[] = [
  { corner: 'nw', className: '-left-[22px] -top-[22px] cursor-nwse-resize', label: '左上角' },
  { corner: 'ne', className: '-right-[22px] -top-[22px] cursor-nesw-resize', label: '右上角' },
  { corner: 'sw', className: '-bottom-[22px] -left-[22px] cursor-nesw-resize', label: '左下角' },
  { corner: 'se', className: '-bottom-[22px] -right-[22px] cursor-nwse-resize', label: '右下角' },
]

/**
 * 框選去背範圍：桌面為置中對話框、手機為底部面板。
 * 範圍以照片寬高的百分比表示，送到 remove.bg 的 roi 參數；框外一律視為背景。
 */
export function CutoutRegionDialog({
  imageUrl,
  initialRegion,
  confirmLabel = '用這個範圍去背',
  onCancel,
  onConfirm,
}: {
  imageUrl: string
  initialRegion?: CutoutRegion | null
  confirmLabel?: string
  onCancel: () => void
  /** 框整張照片時回傳 null */
  onConfirm: (region: CutoutRegion | null) => void
}) {
  const titleId = useId()
  const descriptionId = useId()
  const frameRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const [region, setRegion] = useState<CutoutRegion>(initialRegion ?? FULL_REGION)
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => { boxRef.current?.focus() }, [])

  function pointToPercent(event: PointerEvent) {
    const rect = frameRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 }
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100),
    }
  }

  function beginDrag(event: PointerEvent, mode: Drag['mode']) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const point = pointToPercent(event)
    dragRef.current = { mode, startX: point.x, startY: point.y, start: region }
    frameRef.current?.setPointerCapture(event.pointerId)
    if (mode === 'draw') setRegion({ x: point.x, y: point.y, w: 0, h: 0 })
  }

  function moveDrag(event: PointerEvent) {
    const drag = dragRef.current
    if (!drag) return
    const point = pointToPercent(event)
    const dx = point.x - drag.startX
    const dy = point.y - drag.startY
    const { start } = drag
    if (drag.mode === 'draw') {
      setRegion({ x: Math.min(drag.startX, point.x), y: Math.min(drag.startY, point.y), w: Math.abs(dx), h: Math.abs(dy) })
    } else if (drag.mode === 'move') {
      setRegion({ ...start, x: clamp(start.x + dx, 0, 100 - start.w), y: clamp(start.y + dy, 0, 100 - start.h) })
    } else {
      let left = start.x
      let top = start.y
      let right = start.x + start.w
      let bottom = start.y + start.h
      if (drag.mode.includes('w')) left = Math.min(left + dx, right - MIN_SIZE)
      if (drag.mode.includes('e')) right = Math.max(right + dx, left + MIN_SIZE)
      if (drag.mode.includes('n')) top = Math.min(top + dy, bottom - MIN_SIZE)
      if (drag.mode.includes('s')) bottom = Math.max(bottom + dy, top + MIN_SIZE)
      setRegion(fromEdges(left, top, right, bottom))
    }
  }

  function endDrag(event: PointerEvent) {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    if (frameRef.current?.hasPointerCapture(event.pointerId)) frameRef.current.releasePointerCapture(event.pointerId)
    // 只是點一下、沒拉出框時，保留原本的範圍
    if (drag.mode === 'draw') setRegion((current) => (current.w < MIN_SIZE || current.h < MIN_SIZE ? drag.start : fromEdges(current.x, current.y, current.x + current.w, current.y + current.h)))
  }

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    const delta = { ArrowLeft: [-KEY_STEP, 0], ArrowRight: [KEY_STEP, 0], ArrowUp: [0, -KEY_STEP], ArrowDown: [0, KEY_STEP] }[event.key]
    if (!delta) return
    event.preventDefault()
    const [dx, dy] = delta
    setRegion((current) => event.shiftKey
      ? fromEdges(current.x, current.y, current.x + current.w + dx, current.y + current.h + dy)
      : { ...current, x: clamp(current.x + dx, 0, 100 - current.w), y: clamp(current.y + dy, 0, 100 - current.h) })
  }

  function confirm() {
    onConfirm(isFullRegion(region) ? null : { x: round(region.x), y: round(region.y), w: round(region.w), h: round(region.h) })
  }

  const full = isFullRegion(region)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={(event) => { if (event.key === 'Escape') onCancel() }}
        className="max-h-[100dvh] w-full min-w-0 space-y-4 overflow-y-auto rounded-t-block bg-card p-5 shadow-sheet sm:max-w-2xl sm:rounded-block sm:p-6 sm:shadow-float"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="m-0 font-hd text-xl">框選去背範圍</h2>
            <p id={descriptionId} className="mb-0 mt-1.5 text-sm leading-6 text-ink-2">把框拉到只剩要的那件衣服，框外會直接當成背景移除。在照片上拖一下可以重新畫框。</p>
          </div>
          <button type="button" aria-label="關閉" onClick={onCancel} className="-mr-2 -mt-2 flex size-11 flex-none items-center justify-center rounded-full text-ink-2 hover:bg-tile"><Icon name="x" size={18} /></button>
        </div>

        <div className="flex justify-center rounded-tile bg-tile p-6">
          {imageFailed ? (
            <div role="img" aria-label="無法預覽這張照片" className="flex min-h-48 flex-col items-center justify-center gap-2 text-center text-sm text-ink-2"><Icon name="alert" size={22} />瀏覽器無法預覽這張照片，<br />可以直接用整張照片去背。</div>
          ) : (
            <div
              ref={frameRef}
              className="relative w-fit cursor-crosshair touch-none select-none"
              onPointerDown={(event) => beginDrag(event, 'draw')}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              <img src={imageUrl} alt="去背來源照片" draggable={false} onError={() => setImageFailed(true)} className="block max-h-[min(56dvh,520px)] max-w-full" />
              {/* 框外變暗 */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute shadow-[0_0_0_9999px_var(--color-scrim)]" style={{ left: `${region.x}%`, top: `${region.y}%`, width: `${region.w}%`, height: `${region.h}%` }} />
              </div>
              <div
                ref={boxRef}
                tabIndex={0}
                role="group"
                aria-label={`去背範圍：左 ${Math.round(region.x)}%、上 ${Math.round(region.y)}%、寬 ${Math.round(region.w)}%、高 ${Math.round(region.h)}%。方向鍵移動，Shift 加方向鍵調整大小。`}
                onPointerDown={(event) => beginDrag(event, 'move')}
                onKeyDown={handleKey}
                className="absolute cursor-move border-2 border-dashed border-paper outline-1 outline-ink/60 [outline-style:solid]"
                style={{ left: `${region.x}%`, top: `${region.y}%`, width: `${region.w}%`, height: `${region.h}%` }}
              >
                {CORNERS.map(({ corner, className, label }) => (
                  <span
                    key={corner}
                    aria-label={`拖曳${label}調整範圍`}
                    onPointerDown={(event) => beginDrag(event, corner)}
                    className={`absolute flex size-11 items-center justify-center ${className}`}
                  >
                    <span className="size-3.5 rounded-full border-2 border-ink bg-paper shadow-sticker" />
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="m-0 text-xs text-ink-2" aria-live="polite">
          {full ? '目前是整張照片' : <>範圍：寬 <span className="font-num tabular">{Math.round(region.w)}%</span>・高 <span className="font-num tabular">{Math.round(region.h)}%</span></>}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" disabled={full} onClick={() => setRegion(FULL_REGION)}>改回整張照片</Button>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onCancel}>取消</Button>
            <Button variant="primary" onClick={confirm}><Icon name="check" size={18} />{confirmLabel}</Button>
          </div>
        </div>
      </section>
    </div>
  )
}
