import type { CSSProperties } from 'react'
import { ItemImage } from '@/components/closet/ItemImage'
import { SLOT_META } from '@/lib/slots'
import type { GarmentShape, OutfitTemplate, Slot } from '@/types'

export interface BoardPiece {
  name: string
  colorHex: string
  cutoutUrl?: string
  shape?: GarmentShape
  /** 選購清單中、尚未購買的單品：玫瑰色虛線框 */
  isWish?: boolean
}

interface Props {
  template: OutfitTemplate
  pieces: Partial<Record<Slot, BoardPiece>>
  className?: string
  compact?: boolean
}

/**
 * 固定板型：上衣在上、下身在中、鞋子在下；外套在左，配件與包包在右。
 * 「三件直列」只排上衣、下身、鞋子。
 */
const LAYOUT: Record<OutfitTemplate, { style: CSSProperties; extra: string; slots: Slot[] }> = {
  full: {
    style: {
      gridTemplateAreas: '"outer top acc" "outer bottom bag" ". shoes bag"',
      gridTemplateColumns: '1fr 1.25fr 0.9fr',
      gridTemplateRows: '1fr 1fr 0.75fr',
    },
    extra: '',
    slots: ['outer', 'top', 'acc', 'bottom', 'bag', 'shoes'],
  },
  column: {
    style: {
      gridTemplateAreas: '"top" "bottom" "shoes"',
      gridTemplateColumns: '1fr',
      gridTemplateRows: '1fr 1.1fr 0.6fr',
    },
    extra: 'mx-auto w-full max-w-[380px]',
    slots: ['top', 'bottom', 'shoes'],
  },
}

const TILT: Record<Slot, number> = { outer: -3, top: 2, bottom: -2, shoes: 3, bag: 2, acc: -2 }

export function OutfitBoard({ template, pieces, className = '', compact = false }: Props) {
  const layout = LAYOUT[template]
  return (
    <div className={`grid gap-2.5 ${layout.extra} ${className}`} style={layout.style}>
      {layout.slots.map((slot) => {
        const meta = SLOT_META[slot]
        const piece = pieces[slot]
        return (
          <div
            key={slot}
            style={{ gridArea: slot }}
            className={`relative flex min-h-0 items-center justify-center overflow-hidden rounded-card bg-paper ${
              piece?.isWish ? 'outline-2 -outline-offset-2 outline-dashed outline-rose-deep' : ''
            }`}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-[10%_8%] rounded-[18px] mix-blend-multiply"
              style={{ background: meta.wash, opacity: 0.65, rotate: `${TILT[slot]}deg` }}
            />
            {!compact && <span className="absolute top-2 left-2.5 z-[1] text-[11px] font-medium text-ink-2">{meta.label}</span>}
            {piece ? (
              <ItemImage
                name={piece.isWish ? `${piece.name}（尚未購買）` : piece.name}
                colorHex={piece.colorHex}
                cutoutUrl={piece.cutoutUrl}
                shape={piece.shape}
                className="relative aspect-square h-[84%] max-w-[86%]"
              />
            ) : (
              <span className="relative flex h-[78%] w-[84%] items-center justify-center rounded-tile border-[1.5px] border-dashed border-line-strong text-xs text-ink-3">
                尚未選擇{meta.label}
              </span>
            )}
            {piece?.isWish && (
              <span className="absolute right-2 bottom-2 z-[1] rounded-full bg-rose-deep px-2 py-0.5 text-[10px] text-white">想買</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
