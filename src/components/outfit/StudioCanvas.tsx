import { useRef, type PointerEvent, type RefObject } from 'react'
import { ItemImage } from '@/components/closet/ItemImage'
import { Icon } from '@/components/ui/Icon'
import { Button } from '@/components/ui/Button'
import type { ClosetItem, Placement, WishlistItem } from '@/types'

export interface StudioPiece {
  key: string
  source: 'closet' | 'wishlist'
  item: ClosetItem | WishlistItem
  placement: Placement
}

interface Props {
  pieces: StudioPiece[]
  selectedKey: string | null
  onSelect: (key: string | null) => void
  onPlace: (key: string, placement: Placement) => void
  onRemove: (key: string) => void
  onReplace: () => void
  onExport: () => void
  onLayer: (key: string, direction: 1 | -1) => void
  paper: 'apricot' | 'mist' | 'rose' | 'card'
  onPaperChange: (paper: Props['paper']) => void
  canvasRef: RefObject<HTMLDivElement | null>
  onInteractionEnd: () => void
  className?: string
}

interface DragState {
  key: string
  pointerId: number
  mode: 'move' | 'scale' | 'rotate'
  startX: number
  startY: number
  start: Placement
  rect: DOMRect
}

interface PinchState {
  key: string
  start: Placement
  rect: DOMRect
  distance: number
  angle: number
  midpointX: number
  midpointY: number
}

const PAPERS = [
  { id: 'apricot', label: '杏色點格紙', color: 'bg-apricot bg-dot-grid' },
  { id: 'mist', label: '霧藍紙', color: 'bg-mist-soft' },
  { id: 'rose', label: '玫瑰紙', color: 'bg-rose-soft' },
  { id: 'card', label: '白紙', color: 'bg-card' },
] as const

const clampPlacement = (placement: Placement): Placement => ({
  x: Math.max(4, Math.min(96, placement.x)),
  y: Math.max(4, Math.min(96, placement.y)),
  w: Math.max(10, Math.min(70, placement.w)),
  rot: ((placement.rot + 540) % 360) - 180,
  z: placement.z,
})

export function StudioCanvas({
  pieces,
  selectedKey,
  onSelect,
  onPlace,
  onRemove,
  onReplace,
  onExport,
  onLayer,
  paper,
  onPaperChange,
  canvasRef,
  onInteractionEnd,
  className = '',
}: Props) {
  const drag = useRef<DragState | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<PinchState | null>(null)

  function begin(event: PointerEvent<HTMLElement>, piece: StudioPiece, mode: DragState['mode']) {
    if (event.button !== 0 || !canvasRef.current) return
    event.stopPropagation()
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const active = [...pointers.current.values()]
    const rect = canvasRef.current.getBoundingClientRect()
    if (active.length >= 2 && selectedKey === piece.key) {
      const [first, second] = active
      pinch.current = {
        key: piece.key,
        start: piece.placement,
        rect,
        distance: Math.hypot(second.x - first.x, second.y - first.y) || 1,
        angle: Math.atan2(second.y - first.y, second.x - first.x) * (180 / Math.PI),
        midpointX: (first.x + second.x) / 2,
        midpointY: (first.y + second.y) / 2,
      }
      drag.current = null
      onSelect(piece.key)
      return
    }
    drag.current = {
      key: piece.key,
      pointerId: event.pointerId,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      start: piece.placement,
      rect,
    }
    onSelect(piece.key)
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const gesture = pinch.current
    const active = [...pointers.current.values()]
    if (gesture && active.length >= 2) {
      const [first, second] = active
      const distance = Math.hypot(second.x - first.x, second.y - first.y) || 1
      const angle = Math.atan2(second.y - first.y, second.x - first.x) * (180 / Math.PI)
      const midpointX = (first.x + second.x) / 2
      const midpointY = (first.y + second.y) / 2
      onPlace(gesture.key, clampPlacement({
        ...gesture.start,
        x: gesture.start.x + ((midpointX - gesture.midpointX) / gesture.rect.width) * 100,
        y: gesture.start.y + ((midpointY - gesture.midpointY) / gesture.rect.height) * 100,
        w: gesture.start.w * (distance / gesture.distance),
        rot: gesture.start.rot + angle - gesture.angle,
      }))
      return
    }
    const current = drag.current
    if (!current || event.pointerId !== current.pointerId) return
    const dx = event.clientX - current.startX
    const dy = event.clientY - current.startY
    const start = current.start
    if (current.mode === 'move') {
      onPlace(current.key, clampPlacement({ ...start, x: start.x + (dx / current.rect.width) * 100, y: start.y + (dy / current.rect.height) * 100 }))
    } else if (current.mode === 'scale') {
      onPlace(current.key, clampPlacement({ ...start, w: start.w + ((Math.abs(dx) + Math.abs(dy)) / current.rect.width) * 50 * Math.sign(dx + dy || 1) }))
    } else {
      const cx = current.rect.left + (start.x / 100) * current.rect.width
      const cy = current.rect.top + (start.y / 100) * current.rect.height
      const angle = (Math.atan2(event.clientY - cy, event.clientX - cx) * 180) / Math.PI + 90
      onPlace(current.key, clampPlacement({ ...start, rot: angle }))
    }
  }

  function end(event: PointerEvent<HTMLElement>) {
    const didInteract = drag.current?.pointerId === event.pointerId || pinch.current !== null
    pointers.current.delete(event.pointerId)
    if (didInteract) {
      drag.current = null
      pinch.current = null
      onInteractionEnd()
    }
  }

  const selectedPiece = pieces.find((piece) => piece.key === selectedKey) ?? null
  const ordered = [...pieces].sort((a, b) => a.placement.z - b.placement.z)

  return (
    <div className={`flex min-h-0 flex-col gap-2 ${className}`}>
      <div className="flex min-h-12 items-center rounded-tile bg-paper px-1">
        {selectedPiece ? (
          <div role="toolbar" aria-label={`調整：${selectedPiece.item.name}`} className="flex w-full items-center gap-0.5 overflow-x-auto">
            <span className="mr-auto hidden min-w-0 truncate px-2 text-[13px] font-medium sm:inline">{selectedPiece.item.name}</span>
            <Tool icon="layerUp" label="上移一層" onClick={() => onLayer(selectedPiece.key, 1)} />
            <Tool icon="layerDown" label="下移一層" onClick={() => onLayer(selectedPiece.key, -1)} />
            <Tool icon="rotateLeft" label="向左旋轉 15 度" onClick={() => onPlace(selectedPiece.key, clampPlacement({ ...selectedPiece.placement, rot: selectedPiece.placement.rot - 15 }))} />
            <Tool icon="rotateRight" label="向右旋轉 15 度" onClick={() => onPlace(selectedPiece.key, clampPlacement({ ...selectedPiece.placement, rot: selectedPiece.placement.rot + 15 }))} />
            <Tool icon="minus" label="縮小" onClick={() => onPlace(selectedPiece.key, clampPlacement({ ...selectedPiece.placement, w: selectedPiece.placement.w - 3 }))} />
            <Tool icon="plus" label="放大" onClick={() => onPlace(selectedPiece.key, clampPlacement({ ...selectedPiece.placement, w: selectedPiece.placement.w + 3 }))} />
            <Tool icon="reset" label="替換單品" onClick={onReplace} />
            <Tool icon="x" label="移出畫布" onClick={() => onRemove(selectedPiece.key)} danger />
          </div>
        ) : <span className="px-2 text-[13px] text-ink-2">選取單品以調整位置、尺寸與圖層</span>}
      </div>

      <div
        ref={canvasRef}
        role="application"
        aria-label="搭配工作台畫布"
        aria-roledescription="搭配畫布"
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerDown={() => onSelect(null)}
        className={`relative min-h-[440px] flex-1 touch-none select-none overflow-hidden rounded-block sm:min-h-[520px] lg:min-h-[640px] ${PAPERS.find((option) => option.id === paper)?.color ?? PAPERS[0].color}`}
      >
        <span aria-hidden="true" className="pointer-events-none absolute left-[8%] top-[12%] h-[58%] w-[46%] rounded-block bg-mist-wash mix-blend-multiply" style={{ rotate: '-3deg' }} />
        <span aria-hidden="true" className="pointer-events-none absolute left-[40%] top-[30%] h-[56%] w-[44%] rounded-block bg-rose-wash mix-blend-multiply" style={{ rotate: '4deg' }} />

        {ordered.map((piece) => {
          const isSelected = piece.key === selectedKey
          const item = piece.item
          return (
            <div
              key={piece.key}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={`${item.name}${piece.source === 'wishlist' ? '，選購中試穿' : ''}；方向鍵移動，Delete 移除`}
              onPointerDown={(event) => begin(event, piece, 'move')}
              onFocus={() => onSelect(piece.key)}
              onKeyDown={(event) => {
                const moveBy = event.shiftKey ? 5 : 1
                const next = { ...piece.placement }
                if (event.key === 'ArrowLeft') next.x -= moveBy
                else if (event.key === 'ArrowRight') next.x += moveBy
                else if (event.key === 'ArrowUp') next.y -= moveBy
                else if (event.key === 'ArrowDown') next.y += moveBy
                else if (event.key === '[') next.rot -= 15
                else if (event.key === ']') next.rot += 15
                else if (event.key === '+' || event.key === '=') next.w += 3
                else if (event.key === '-') next.w -= 3
                else if (event.key === 'PageUp' || event.key === 'PageDown') {
                  event.preventDefault()
                  onLayer(piece.key, event.key === 'PageUp' ? 1 : -1)
                  return
                } else if (event.key === 'Delete' || event.key === 'Backspace') {
                  event.preventDefault()
                  onRemove(piece.key)
                  return
                } else if (event.key === 'Escape') {
                  onSelect(null)
                  return
                } else return
                event.preventDefault()
                onPlace(piece.key, clampPlacement(next))
              }}
              className={`absolute aspect-square cursor-grab outline-none active:cursor-grabbing ${isSelected ? 'focus-visible:outline-none' : 'focus-visible:outline-[2.5px] focus-visible:outline-mist-deep'}`}
              style={{ left: `${piece.placement.x}%`, top: `${piece.placement.y}%`, width: `${piece.placement.w}%`, zIndex: piece.placement.z + 1, transform: `translate(-50%, -50%) rotate(${piece.placement.rot}deg)` }}
            >
              <ItemImage name={item.name} colorHex={item.colorHex} cutoutUrl={item.cutoutUrl} shape={item.shape} className="pointer-events-none size-full" />
              {piece.source === 'wishlist' && <span aria-hidden="true" className="pointer-events-none absolute inset-[2%] rounded-btn border-2 border-dashed border-rose-deep" />}
              {isSelected && <SelectionControls onScale={(event) => begin(event, piece, 'scale')} onRotate={(event) => begin(event, piece, 'rotate')} />}
            </div>
          )
        })}

        {pieces.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
            <span className="font-hd text-2xl text-ink">畫布是空的</span>
            <span className="max-w-sm text-sm leading-6 text-ink-2">從衣物素材加入單品，或切換到選購清單試搭。</span>
          </div>
        )}

        <div className="absolute bottom-3 left-3 z-50 flex gap-2">
          <span className="flex h-9 items-center rounded-btn bg-card px-3 font-num text-xs shadow-paper">100%</span>
          <span className="flex h-9 items-center rounded-btn bg-card px-3 text-xs shadow-paper">{pieces.length} 件單品</span>
        </div>
        <div role="group" aria-label="背景紙" className="absolute bottom-3 right-3 z-50 flex gap-1 rounded-btn bg-card p-1 shadow-paper">
          {PAPERS.map((option) => (
            <button key={option.id} type="button" aria-label={option.label} aria-pressed={paper === option.id} onClick={() => onPaperChange(option.id)} className={`size-9 rounded-sm border-2 ${paper === option.id ? 'border-ink' : 'border-line-strong'} ${option.id === 'apricot' ? 'bg-apricot' : option.id === 'mist' ? 'bg-mist-soft' : option.id === 'rose' ? 'bg-rose-soft' : 'bg-card'}`} />
          ))}
        </div>
      </div>
      <p className="m-0 hidden text-center text-xs text-ink-2 sm:block">拖曳移動・角落縮放・上方圓鈕旋轉・Delete 移除・方向鍵微調</p>
      <p className="m-0 text-center text-xs text-ink-2 sm:hidden">拖曳移動・雙指調整位置・方向鍵或工具列微調</p>
      <Button variant="secondary" className="self-center sm:hidden" onClick={onExport}><Icon name="outfit" size={17} />另存畫布圖片</Button>
    </div>
  )
}

function SelectionControls({ onScale, onRotate }: { onScale: (event: PointerEvent<HTMLSpanElement>) => void; onRotate: (event: PointerEvent<HTMLSpanElement>) => void }) {
  return (
    <>
      <span aria-hidden="true" className="pointer-events-none absolute -inset-1 rounded-sm border-[1.5px] border-dashed border-mist-deep" />
      {['-top-4 -left-4', '-top-4 -right-4', '-bottom-4 -left-4', '-bottom-4 -right-4'].map((position, index) => (
        <span key={index} aria-hidden="true" onPointerDown={onScale} className={`absolute ${position} flex size-8 cursor-nwse-resize items-center justify-center`}><span className="size-3 rounded-[3px] border-[1.5px] border-mist-deep bg-card" /></span>
      ))}
      <span aria-hidden="true" className="pointer-events-none absolute -top-6 left-1/2 h-5 w-px -translate-x-1/2 bg-mist-deep" />
      <span aria-hidden="true" onPointerDown={onRotate} className="absolute -top-12 left-1/2 flex size-8 -translate-x-1/2 cursor-grab items-center justify-center"><span className="flex size-[22px] items-center justify-center rounded-full bg-mist-deep text-white"><Icon name="rotateRight" size={13} /></span></span>
    </>
  )
}

function Tool({ icon, label, onClick, danger = false }: { icon: 'layerUp' | 'layerDown' | 'rotateLeft' | 'rotateRight' | 'minus' | 'plus' | 'reset' | 'x'; label: string; onClick: () => void; danger?: boolean }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} className={`flex size-10 flex-none items-center justify-center rounded-sm hover:bg-tile ${danger ? 'text-rose-deep' : 'text-ink'}`}><Icon name={icon} /></button>
}
