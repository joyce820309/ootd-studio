import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'

type Accent = 'oat' | 'mist' | 'rose' | 'sage'

const WASH: Record<Accent, string> = {
  oat: 'bg-oat-wash',
  mist: 'bg-mist-wash',
  rose: 'bg-rose-wash',
  sage: 'bg-sage-wash',
}
const SOLID: Record<Accent, string> = {
  oat: 'bg-oat',
  mist: 'bg-mist',
  rose: 'bg-rose',
  sage: 'bg-sage',
}

/** 紙卡：紙張底色＋微微浮起的陰影 */
export function PaperCard({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-card bg-card shadow-paper ${className}`} {...rest} />
}

/**
 * 傾斜紙張標籤。規則：只用於區塊標題，角度 ±2° 內，每個區域最多一個。
 */
export function TiltLabel({
  children,
  accent = 'oat',
  tilt = -2,
  as: Tag = 'span',
  className = '',
}: {
  children: ReactNode
  accent?: Accent
  tilt?: number
  as?: 'span' | 'h1' | 'h2' | 'h3'
  className?: string
}) {
  const angle = Math.max(-2, Math.min(2, tilt))
  return (
    <Tag
      className={`inline-flex h-[34px] items-center self-start rounded-tag px-3.5 font-hd text-[17px] font-bold text-ink shadow-sticker ${SOLID[accent]} ${className}`}
      style={{ transform: `rotate(${angle}deg)` }}
    >
      {children}
    </Tag>
  )
}

/** 紙膠帶：只用於釘選、精選的卡片（例如「繼續上次的搭配」）。父層需為 relative。 */
export function Tape({ accent = 'mist', className = '', style }: { accent?: Accent; className?: string; style?: CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute left-1/2 -top-2.5 h-[22px] w-[84px] -translate-x-1/2 rounded-[2px] mix-blend-multiply ${WASH[accent]} ${className}`}
      style={{ rotate: '-3deg', ...style }}
    />
  )
}

/**
 * 透明疊色塊：multiply 混合，像描圖紙交疊。純裝飾，文字不要放在交界處。父層需為 relative + overflow-hidden。
 */
export function WashBlob({ accent, className = '', tilt = 8 }: { accent: Accent; className?: string; tilt?: number }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute rounded-[22px] mix-blend-multiply ${WASH[accent]} ${className}`}
      style={{ rotate: `${tilt}deg` }}
    />
  )
}

/** 品牌 Logo：燕麥色貼紙 */
export function LogoSticker({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <span
      className={`inline-block rounded-tag bg-oat font-logo font-semibold text-ink shadow-sticker ${size === 'sm' ? 'px-2.5 py-0.5 text-[19px]' : 'px-3 py-1 text-[22px]'}`}
      style={{ rotate: '-2deg' }}
    >
      My Closet
    </span>
  )
}
