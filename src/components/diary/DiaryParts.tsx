import type { CSSProperties } from 'react'
import { ItemImage } from '@/components/closet/ItemImage'
import type { BoardPiece } from '@/components/outfit/OutfitBoard'
import { FEEL_CLASS, FEEL_LABEL, occasionTone, TONE_CLASS } from '@/lib/diary'
import type { DiaryFeel, Slot } from '@/types'

/** 評分：5 個微傾斜的紙片，填滿的是燕麥色。 */
export function RatingMarks({ value, size = 14 }: { value: number | null; size?: number }) {
  if (value === null) return <span className="text-xs text-ink-3">未評分</span>
  return (
    <span role="img" aria-label={`評分 ${value} 分（滿分 5 分）`} className="inline-flex gap-[3px]">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} aria-hidden="true" className={`rounded-[4px] ${n <= value ? 'bg-oat' : 'bg-line'}`} style={{ width: size, height: size, rotate: '-8deg' }} />
      ))}
    </span>
  )
}

export function OccasionChip({ occasions, withDot = true }: { occasions: string[]; withDot?: boolean }) {
  if (!occasions.length) return null
  const tone = TONE_CLASS[occasionTone(occasions[0])]
  return (
    <span className={`inline-flex h-[26px] items-center gap-[5px] rounded-full px-2.5 text-xs whitespace-nowrap ${tone.chip}`}>
      {withDot && <span aria-hidden="true" className={`size-2.5 rounded-[3px] ${tone.dot}`} />}
      {occasions.join('・')}
    </span>
  )
}

export function FeelChip({ feel, prefix = false }: { feel: DiaryFeel | null; prefix?: boolean }) {
  if (!feel) return null
  return <span className={`inline-flex h-[26px] items-center rounded-full px-2.5 text-xs whitespace-nowrap ${FEEL_CLASS[feel]}`}>{prefix ? `穿起來：${FEEL_LABEL[feel]}` : FEEL_LABEL[feel]}</span>
}

// 月曆格內的小拼貼：外套在左、上衣在上、下身在下、鞋在右下（百分比：left, top, width, 角度）
const COLLAGE: Partial<Record<Slot, [number, number, number, number]>> = {
  outer: [2, 10, 50, -8],
  top: [30, 0, 46, 3],
  bottom: [36, 34, 42, -2],
  shoes: [58, 62, 38, -6],
}

export function MiniCollage({ pieces, className = '', style }: { pieces: Partial<Record<Slot, BoardPiece>>; className?: string; style?: CSSProperties }) {
  return (
    <span aria-hidden="true" className={`relative block overflow-hidden rounded-sm ${className}`} style={style}>
      {(Object.keys(COLLAGE) as Slot[]).map((slot) => {
        const piece = pieces[slot]
        if (!piece) return null
        const [l, t, w, r] = COLLAGE[slot]!
        return (
          <span key={slot} className="absolute block aspect-square" style={{ left: `${l}%`, top: `${t}%`, width: `${w}%`, rotate: `${r}deg` }}>
            <ItemImage name="" cutoutUrl={piece.cutoutUrl} shape={piece.shape} colorHex={piece.colorHex} className="size-full" />
          </span>
        )
      })}
    </span>
  )
}
