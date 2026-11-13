import type { ReactNode } from 'react'
import { getStudioBackground } from '@/lib/studioBackground'
import type { StudioBackgroundCustom, StudioBackgroundMode, StudioBackgroundTheme } from '@/types'

export function StudioBackgroundSurface({ theme = 'plain', mode = 'on', custom, className = '', children }: {
  theme?: StudioBackgroundTheme
  mode?: StudioBackgroundMode
  custom?: StudioBackgroundCustom
  className?: string
  children: ReactNode
}) {
  const background = getStudioBackground(theme, custom ?? { a: '#E7B9B4', b: '#8C9A86' })
  const opacity = !background.blobA || mode === 'off' ? 0 : mode === 'soft' ? 0.25 : 1

  return (
    <div className={`studio-background-surface relative isolate overflow-hidden bg-dot-grid ${className}`} style={{ backgroundColor: background.background }}>
      <span aria-hidden="true" className="pointer-events-none absolute left-[8%] top-[12%] h-[58%] w-[46%] rounded-block mix-blend-multiply transition-opacity duration-200" style={{ backgroundColor: background.blobA ?? 'transparent', opacity, rotate: '-3deg' }} />
      <span aria-hidden="true" className="pointer-events-none absolute left-[40%] top-[30%] h-[56%] w-[44%] rounded-block mix-blend-multiply transition-opacity duration-200" style={{ backgroundColor: background.blobB ?? 'transparent', opacity, rotate: '4deg' }} />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
