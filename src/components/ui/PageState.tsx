import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import { PaperCard } from './Paper'

type Tone = 'oat' | 'mist' | 'rose' | 'sage'

const TONE: Record<Tone, { badge: string; icon: string }> = {
  oat: { badge: 'bg-oat-soft text-oat-ink', icon: 'bg-oat-wash' },
  mist: { badge: 'bg-mist-soft text-mist-deep', icon: 'bg-mist-wash' },
  rose: { badge: 'bg-rose-soft text-rose-ink', icon: 'bg-rose-wash' },
  sage: { badge: 'bg-sage-soft text-sage-deep', icon: 'bg-sage-wash' },
}

/** 統一呈現空資料、錯誤等非主要內容狀態，說明原因與下一步。 */
export function PageState({
  icon,
  title,
  description,
  action,
  tone = 'mist',
  compact = false,
  children,
}: {
  icon: IconName
  title: string
  description: string
  action?: ReactNode
  tone?: Tone
  compact?: boolean
  children?: ReactNode
}) {
  const colors = TONE[tone]
  return (
    <PaperCard className={`relative flex flex-col items-center gap-3 overflow-hidden text-center ${compact ? 'p-6' : 'min-h-72 justify-center p-8 sm:p-10'}`}>
      <span aria-hidden="true" className={`absolute -left-5 -top-5 size-28 rounded-block mix-blend-multiply ${colors.icon}`} style={{ rotate: '-8deg' }} />
      <span aria-hidden="true" className={`absolute -bottom-6 -right-5 size-24 rounded-block mix-blend-multiply ${colors.icon}`} style={{ rotate: '8deg' }} />
      <span className={`relative flex size-[60px] items-center justify-center rounded-[18px] ${colors.badge}`} style={{ rotate: '-3deg' }}>
        <Icon name={icon} size={26} />
      </span>
      <h2 className="relative m-0 font-hd text-xl text-ink">{title}</h2>
      <p className="relative m-0 max-w-md text-sm leading-6 text-ink-2">{description}</p>
      {children && <div className="relative flex flex-wrap justify-center gap-2">{children}</div>}
      {action && <div className="relative flex flex-wrap justify-center gap-2">{action}</div>}
    </PaperCard>
  )
}

/** 共用非阻塞載入畫面，保留內容大致尺寸避免版面跳動。 */
export function LoadingState({ label = '正在載入資料…', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <section aria-busy="true" aria-label={label} className="space-y-3" role="status">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => <div key={index} aria-hidden="true" className={`animate-pulse rounded-tile bg-tile ${index === 0 ? 'h-24' : 'h-16'}`} />)}
    </section>
  )
}
