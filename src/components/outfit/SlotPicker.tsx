import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ItemImage } from '@/components/closet/ItemImage'
import { Icon } from '@/components/ui/Icon'
import { isWearable, STATUS_LABEL, type SlotMeta } from '@/lib/slots'
import type { ClosetItem } from '@/types'

interface Props {
  meta: SlotMeta
  items: ClosetItem[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}

/** 單一部位的勾選列：必選部位不能「不搭配」；送洗、維修、借出中的衣物不可選。 */
export function SlotPicker({ meta, items, selectedId, onSelect }: Props) {
  const current = items.find((i) => i.id === selectedId)
  const groupId = `slot-${meta.slot}`
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2.5 border-0 border-b-[1.5px] border-dashed border-line px-0 py-3.5 last:border-b-0">
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className="size-3 rounded-[4px]" style={{ background: meta.solid }} />
        <legend id={groupId} className="float-left p-0 font-hd text-lg font-bold">
          {meta.label}
        </legend>
        <span className={`text-xs ${meta.required ? 'text-rose-deep' : 'text-ink-3'}`}>{meta.required ? '必選' : '選填'}</span>
        <span className="ml-auto text-right text-[13px] text-ink-2">{current ? current.name : meta.required ? '尚未選擇' : '不搭配'}</span>
      </div>
      <div role="radiogroup" aria-labelledby={groupId} className="flex gap-2.5 overflow-x-auto px-0.5 pt-0.5 pb-1">
        {!meta.required && (
          <OptionCard isNone selected={!selectedId} onClick={() => onSelect(null)} caption="略過">
            <span className="flex size-full items-center justify-center text-xs text-ink-3">不搭配</span>
          </OptionCard>
        )}
        {items.map((item) => {
          const wearable = isWearable(item.status)
          return (
            <OptionCard
              key={item.id}
              selected={selectedId === item.id}
              disabled={!wearable}
              onClick={() => onSelect(item.id)}
              caption={item.name}
              badge={wearable ? undefined : STATUS_LABEL[item.status]}
            >
              <ItemImage name={item.name} colorHex={item.colorHex} cutoutUrl={item.cutoutUrl} shape={item.shape} className="size-[76%]" />
            </OptionCard>
          )
        })}
        <Link to="/closet" className="flex w-[84px] flex-none flex-col gap-1.5 no-underline">
          <span className="flex size-[84px] items-center justify-center rounded-tile border-[1.5px] border-dashed border-line-strong text-mist-deep">
            <Icon name="next" />
          </span>
          <span className="text-xs text-mist-deep">看全部</span>
        </Link>
      </div>
    </fieldset>
  )
}

function OptionCard({
  isNone = false,
  selected,
  disabled,
  onClick,
  caption,
  badge,
  children,
}: {
  isNone?: boolean
  selected: boolean
  disabled?: boolean
  onClick: () => void
  caption: string
  badge?: string
  children: ReactNode
}) {
  const box = isNone
    ? selected
      ? 'bg-mist-soft outline-[2.5px] -outline-offset-[2.5px] outline-solid outline-mist-deep'
      : 'border-[1.5px] border-dashed border-line-strong'
    : selected
      ? 'bg-tile outline-[2.5px] -outline-offset-[2.5px] outline-solid outline-mist-deep'
      : 'bg-tile'
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className="flex w-[84px] flex-none cursor-pointer flex-col gap-1.5 border-0 bg-transparent p-0 text-left text-ink disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className={`relative flex size-[84px] items-center justify-center rounded-tile ${box}`}>
        {children}
        {selected && !isNone && (
          <span className="absolute top-1.5 right-1.5 flex size-[22px] items-center justify-center rounded-full bg-mist-deep text-white">
            <Icon name="check" size={13} />
          </span>
        )}
        {badge && (
          <span className="absolute bottom-1 left-1 rounded-full bg-status-repair-bg px-1.5 py-px text-[10px] text-status-repair-fg">{badge}</span>
        )}
      </span>
      <span className="text-xs leading-snug font-medium">{caption}</span>
    </button>
  )
}
