import type { GarmentShape } from '@/types'

/** 示範用衣物剪影。正式資料請用去背圖片（ItemImage 會自動優先使用圖片）。 */
const SHAPES: Record<GarmentShape, { d: string; detail?: string; detailWidth?: number }> = {
  tee: { d: 'M30 18L42 14Q50 22 58 14L70 18L86 32L76 42L70 38V86H30V38L24 42L14 32Z', detail: 'M42 14Q50 24 58 14' },
  shirt: { d: 'M32 16L44 12L50 20L56 12L68 16L80 30L88 76L78 78L70 40V88H30V40L22 78L12 76L20 30Z', detail: 'M50 20V88M44 12L50 22L56 12' },
  knit: { d: 'M32 16L44 13Q50 19 56 13L68 16L80 30L88 78L78 80L70 42V86H30V42L22 80L12 78L20 30Z', detail: 'M30 80H70M44 13Q50 21 56 13' },
  pants: { d: 'M32 10H68L72 90H56L50 36L44 90H28Z', detail: 'M50 10V36M32 16H68' },
  skirt: { d: 'M36 14H64L80 86H20Z', detail: 'M36 20H64M44 20L40 86M56 20L60 86', detailWidth: 0.8 },
  coat: { d: 'M30 12L44 10L50 30L56 10L70 12L84 28L90 84L80 86L72 46L74 92H26L28 46L20 86L10 84L16 28Z', detail: 'M50 30V92M44 10L50 30L56 10' },
  dress: { d: 'M40 12H60L62 34L78 88H22L38 34Z', detail: 'M38 34H62' },
  shoe: { d: 'M14 62V46Q24 44 34 52Q48 62 70 62Q86 62 88 72V76H14Z', detail: 'M14 70H88' },
  boot: { d: 'M30 14H52V56Q70 58 84 66Q90 70 88 80H30Z', detail: 'M30 74H88' },
  bag: { d: 'M22 40H78L82 86H18Z', detail: 'M36 40Q36 18 50 18Q64 18 64 40', detailWidth: 3 },
  scarf: { d: 'M22 18H78V34H60L64 88H48L44 34H22Z', detail: 'M48 80H64' },
  sock: { d: 'M38 10H56V58L72 70Q78 76 72 84Q66 88 58 84L40 72Q36 68 38 62Z', detail: 'M38 18H56M38 26H56' },
}

interface Props {
  shape: GarmentShape
  color: string
  label: string
  className?: string
}

export function GarmentArt({ shape, color, label, className }: Props) {
  const s = SHAPES[shape]
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label={label} className={className}>
      <path d={s.d} fill={color} stroke="rgb(59 47 37 / 0.22)" strokeWidth={0.6} />
      {s.detail && (
        <path d={s.detail} fill="none" stroke="rgb(59 47 37 / 0.3)" strokeWidth={s.detailWidth ?? 1} strokeLinecap="round" />
      )}
    </svg>
  )
}
