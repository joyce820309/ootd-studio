import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { ItemImage } from '@/components/closet/ItemImage'
import { Icon, type IconName } from '@/components/ui/Icon'
import { WashBlob } from '@/components/ui/Paper'
import { normalize } from '@/lib/freeLayout'
import type { FreeLayout, Placement, Slot } from '@/types'
import type { BoardPiece } from './OutfitBoard'

type DragMode = 'move' | 'scale' | 'rotate'

interface Drag {
  mode: DragMode
  slot: Slot
  pointerId: number
  startX: number
  startY: number
  start: Placement
  rect: DOMRect
}

interface Props {
  pieces: Partial<Record<Slot, BoardPiece>>
  layout: FreeLayout
  selected: Slot | null
  onSelect: (slot: Slot | null) => void
  onPlace: (slot: Slot, placement: Placement) => void
  onLayer: (slot: Slot, dir: 1 | -1) => void
  onRemove: (slot: Slot) => void
  className?: string
}

const ROTATE_STEP = 15
const SCALE_STEP = 2
const MOVE_STEP = 1

/**
 * 自由擺放畫布。
 * 滑鼠／觸控：拖曳單品移動、拉角落控制點縮放、拉上方圓鈕旋轉。
 * 鍵盤：方向鍵移動（Shift 加速）、[ ] 旋轉、+ − 縮放、PageUp / PageDown 調整圖層、Delete 移出搭配、Esc 取消選取。
 */
export function FreeCanvas({ pieces, layout, selected, onSelect, onPlace, onLayer, onRemove, className = '' }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)

  const visible = (Object.keys(pieces) as Slot[]).sort((a, b) => layout[a].z - layout[b].z)

  function begin(e: PointerEvent, slot: Slot, mode: DragMode) {
    if (e.button !== 0 || !canvasRef.current) return
    e.stopPropagation()
    e.preventDefault()
    // preventDefault 會擋掉預設聚焦，手動聚焦單品，點選後就能直接用鍵盤微調
    ;(e.target as HTMLElement).closest<HTMLElement>('[data-piece]')?.focus({ preventScroll: true })
    canvasRef.current.setPointerCapture(e.pointerId)
    drag.current = {
      mode,
      slot,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      start: layout[slot],
      rect: canvasRef.current.getBoundingClientRect(),
    }
    onSelect(slot)
  }

  function onPointerMove(e: PointerEvent) {
    const d = drag.current
    if (!d || e.pointerId !== d.pointerId) return
    const { rect, start } = d
    const cx = rect.left + (start.x / 100) * rect.width
    const cy = rect.top + (start.y / 100) * rect.height

    if (d.mode === 'move') {
      onPlace(
        d.slot,
        normalize({
          ...start,
          x: start.x + ((e.clientX - d.startX) / rect.width) * 100,
          y: start.y + ((e.clientY - d.startY) / rect.height) * 100,
        }),
      )
    } else if (d.mode === 'scale') {
      const from = Math.hypot(d.startX - cx, d.startY - cy) || 1
      const to = Math.hypot(e.clientX - cx, e.clientY - cy)
      onPlace(d.slot, normalize({ ...start, w: start.w * (to / from) }))
    } else {
      // 控制點在單品正上方，所以要 +90°；按住 Shift 以 15° 為單位
      let deg = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI + 90
      if (e.shiftKey) deg = Math.round(deg / ROTATE_STEP) * ROTATE_STEP
      onPlace(d.slot, normalize({ ...start, rot: deg }))
    }
  }

  function end(e: PointerEvent) {
    if (drag.current && e.pointerId === drag.current.pointerId) {
      canvasRef.current?.releasePointerCapture(e.pointerId)
      drag.current = null
    }
  }

  function onKeyDown(e: KeyboardEvent, slot: Slot) {
    const p = layout[slot]
    const step = e.shiftKey ? MOVE_STEP * 5 : MOVE_STEP
    const next: Partial<Placement> | null =
      e.key === 'ArrowLeft' ? { x: p.x - step }
      : e.key === 'ArrowRight' ? { x: p.x + step }
      : e.key === 'ArrowUp' ? { y: p.y - step }
      : e.key === 'ArrowDown' ? { y: p.y + step }
      : e.key === '[' ? { rot: p.rot - ROTATE_STEP }
      : e.key === ']' ? { rot: p.rot + ROTATE_STEP }
      : e.key === '+' || e.key === '=' ? { w: p.w + SCALE_STEP }
      : e.key === '-' ? { w: p.w - SCALE_STEP }
      : null
    if (next) {
      e.preventDefault()
      onPlace(slot, normalize({ ...p, ...next }))
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault()
      onLayer(slot, e.key === 'PageUp' ? 1 : -1)
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      onRemove(slot)
    } else if (e.key === 'Escape') {
      onSelect(null)
    }
  }

  const sel = selected && pieces[selected] ? selected : null

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* 工具列固定在畫布上方，不會遮住單品；沒有選取時顯示提示，維持同樣高度避免版面跳動 */}
      <div className="flex min-h-12 items-center rounded-tile bg-paper px-1">
        {sel && pieces[sel] ? (
          <div role="toolbar" aria-label={`調整：${pieces[sel]!.name}`} className="flex w-full items-center gap-0.5 overflow-x-auto">
            <span className="mr-auto hidden truncate px-2 text-[13px] font-medium sm:inline">{pieces[sel]!.name}</span>
            <ToolButton icon="layerUp" label="上移一層" onClick={() => onLayer(sel, 1)} />
            <ToolButton icon="layerDown" label="下移一層" onClick={() => onLayer(sel, -1)} />
            <ToolButton icon="rotateLeft" label="向左旋轉 15 度" onClick={() => onPlace(sel, normalize({ ...layout[sel], rot: layout[sel].rot - ROTATE_STEP }))} />
            <ToolButton icon="rotateRight" label="向右旋轉 15 度" onClick={() => onPlace(sel, normalize({ ...layout[sel], rot: layout[sel].rot + ROTATE_STEP }))} />
            <ToolButton icon="minus" label="縮小" onClick={() => onPlace(sel, normalize({ ...layout[sel], w: layout[sel].w - SCALE_STEP * 2 }))} />
            <ToolButton icon="plus" label="放大" onClick={() => onPlace(sel, normalize({ ...layout[sel], w: layout[sel].w + SCALE_STEP * 2 }))} />
            <ToolButton icon="x" label="移出搭配" tone="danger" onClick={() => onRemove(sel)} />
          </div>
        ) : (
          <span className="px-2 text-[13px] text-ink-2">點一下畫布上的單品來調整</span>
        )}
      </div>
      <div
        ref={canvasRef}
        role="application"
        aria-label="自由擺放畫布"
        aria-roledescription="搭配畫布"
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerDown={() => onSelect(null)}
        className="relative min-h-0 flex-1 overflow-hidden rounded-block bg-apricot bg-dot-grid select-none"
      >
        <WashBlob accent="mist" className="top-[10%] left-[8%] h-[58%] w-[46%]" tilt={-3} />
        <WashBlob accent="rose" className="top-[30%] left-[42%] h-[56%] w-[46%]" tilt={4} />

        {visible.map((slot) => {
          const p = layout[slot]
          const piece = pieces[slot]!
          const isSel = sel === slot
          return (
            <div
              key={slot}
              data-piece={slot}
              role="button"
              tabIndex={0}
              aria-pressed={isSel}
              aria-label={`${piece.name}${piece.isWish ? '（尚未購買）' : ''}。方向鍵移動，[ ] 旋轉，加減號縮放`}
              onPointerDown={(e) => begin(e, slot, 'move')}
              onFocus={() => onSelect(slot)}
              onKeyDown={(e) => onKeyDown(e, slot)}
              className={`absolute aspect-square cursor-grab touch-none outline-none active:cursor-grabbing ${
                isSel ? 'focus-visible:outline-none' : 'focus-visible:outline-[2.5px] focus-visible:outline-mist-deep'
              }`}
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: `${p.w}%`,
                zIndex: p.z + 1,
                transform: `translate(-50%, -50%) rotate(${p.rot}deg)`,
              }}
            >
              <ItemImage
                name=""
                colorHex={piece.colorHex}
                cutoutUrl={piece.cutoutUrl}
                shape={piece.shape}
                className="pointer-events-none size-full"
              />
              {piece.isWish && (
                <>
                  <span aria-hidden="true" className="pointer-events-none absolute inset-[2%] rounded-btn border-2 border-dashed border-rose-deep" />
                  <span className="pointer-events-none absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-rose-deep px-2 py-0.5 text-[11px] whitespace-nowrap text-white">
                    想買・試穿
                  </span>
                </>
              )}
              {isSel && <SelectionFrame onScale={(e) => begin(e, slot, 'scale')} onRotate={(e) => begin(e, slot, 'rotate')} />}
            </div>
          )
        })}

        {visible.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
            <span className="font-hd text-2xl">畫布是空的</span>
            <span className="text-sm text-ink-2">從左邊勾選單品，它們會出現在這裡。</span>
          </div>
        )}

      </div>
      <p className="m-0 text-center text-xs text-ink-2">
        拖曳移動・角落縮放・上方圓鈕旋轉（按住 Shift 以 15° 對齊）・點空白處取消選取
      </p>
    </div>
  )
}

/** 選取框：虛線框＋四角縮放點＋上方旋轉鈕。控制點視覺 12px、觸控熱區 32px。 */
function SelectionFrame({ onScale, onRotate }: { onScale: (e: PointerEvent) => void; onRotate: (e: PointerEvent) => void }) {
  const corners = ['-top-4 -left-4', '-top-4 -right-4', '-bottom-4 -left-4', '-bottom-4 -right-4']
  return (
    <>
      <span aria-hidden="true" className="pointer-events-none absolute -inset-1 rounded-sm border-[1.5px] border-dashed border-mist-deep" />
      {corners.map((pos, i) => (
        <span
          key={i}
          aria-hidden="true"
          onPointerDown={onScale}
          className={`absolute ${pos} flex size-8 cursor-nwse-resize touch-none items-center justify-center`}
        >
          <span className="size-3 rounded-[3px] border-[1.5px] border-mist-deep bg-card" />
        </span>
      ))}
      <span aria-hidden="true" className="pointer-events-none absolute -top-6 left-1/2 h-5 w-px -translate-x-1/2 bg-mist-deep" />
      <span
        aria-hidden="true"
        onPointerDown={onRotate}
        className="absolute -top-12 left-1/2 flex size-8 -translate-x-1/2 cursor-grab touch-none items-center justify-center"
      >
        <span className="flex size-[22px] items-center justify-center rounded-full bg-mist-deep text-white">
          <Icon name="rotateRight" size={13} />
        </span>
      </span>
    </>
  )
}

function ToolButton({ icon, label, onClick, tone }: { icon: IconName; label: string; onClick: () => void; tone?: 'danger' }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex size-10 flex-none items-center justify-center rounded-sm bg-transparent hover:bg-tile ${tone === 'danger' ? 'text-rose-deep' : 'text-ink'}`}
    >
      <Icon name={icon} />
    </button>
  )
}
