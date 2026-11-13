import type { ButtonHTMLAttributes } from 'react'
import { STATUS_LABEL } from '@/lib/slots'
import type { ItemStatus } from '@/types'

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
  dotColor?: string
}

/** 篩選／條件 Chip。選取狀態同時用 aria-pressed 與深色底呈現，不只靠顏色。 */
export function Chip({ selected = false, dotColor, className = '', children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-3.5 text-[13px] font-medium ${
        selected ? 'border-ink bg-ink text-paper' : 'border-line bg-card text-ink hover:border-line-strong'
      } ${className}`}
      {...rest}
    >
      {dotColor && <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: dotColor }} />}
      {children}
    </button>
  )
}

const STATUS_CLASS: Record<ItemStatus, string> = {
  ok: 'bg-status-ok-bg text-status-ok-fg',
  not_arrived: 'bg-status-cleaning-bg text-status-cleaning-fg',
  cleaning: 'bg-status-cleaning-bg text-status-cleaning-fg',
  repair: 'bg-status-repair-bg text-status-repair-fg',
  lent: 'bg-status-lent-bg text-status-lent-fg',
  stored: 'bg-status-stored-bg text-status-stored-fg',
  retired: 'bg-status-stored-bg text-ink-3',
}

/** 狀態標籤：色點＋文字，不只靠顏色辨識 */
export function StatusTag({ status, className = '' }: { status: ItemStatus; className?: string }) {
  return (
    <span className={`status-tag inline-flex h-[22px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[11px] font-medium ${STATUS_CLASS[status]} ${className}`}>
      <span aria-hidden="true" className="status-tag__dot size-1.5 shrink-0 rounded-full bg-current" />
      <span className="status-tag__label">{STATUS_LABEL[status]}</span>
    </span>
  )
}
