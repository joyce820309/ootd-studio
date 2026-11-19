import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Select } from '@/components/ui/Select'
import { AI_INCLUDES, AI_TEMPLATES, buildAiText, type AiInclude } from '@/lib/wishlistAi'
import type { BodyMeasurement, BodyProfile, ClosetItem, WishlistItem } from '@/types'

interface WishlistAiPanelProps {
  items: WishlistItem[]
  closet: ClosetItem[]
  body: BodyMeasurement | null
  bodyProfile: BodyProfile | null
  /** 「我的」裡的「AI 使用體態資料」開關；關閉時不附上體態 */
  allowBody: boolean
  include: Set<AiInclude>
  onIncludeChange: (include: Set<AiInclude>) => void
  onCopied: (result: { ok: boolean; count: number }) => void
  templateOptions?: { value: string; label: string }[]
  buildText?: (items: WishlistItem[], include: Set<AiInclude>) => string
  summaryLabel?: string
  titleId?: string
  /** 手機底部面板才需要關閉鈕 */
  onClose?: () => void
  className?: string
}

/** 整理給 AI（B7.2、BM19.1）：範本＋要包含的資料＋即時預覽＋複製。平台不呼叫 AI，只產生文字。 */
export function WishlistAiPanel({ items, closet, body, bodyProfile, allowBody, include, onIncludeChange, onCopied, templateOptions, buildText, summaryLabel, titleId = 'wishlist-ai-title', onClose, className = '' }: WishlistAiPanelProps) {
  const options = templateOptions ?? AI_TEMPLATES.map((entry) => ({ value: entry.id, label: entry.label }))
  const [template, setTemplate] = useState(options[0]?.value ?? AI_TEMPLATES[0].id)
  const [copyFailed, setCopyFailed] = useState(false)
  const effective = new Set(include)
  if (!allowBody) effective.delete('body')
  const text = items.length ? buildText?.(items, effective) ?? buildAiText({ items, closet, body, bodyProfile, include: effective }) : ''

  const toggle = (key: AiInclude) => {
    const next = new Set(include)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onIncludeChange(next)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopyFailed(false)
      onCopied({ ok: true, count: items.length })
    } catch {
      setCopyFailed(true)
      onCopied({ ok: false, count: items.length })
    }
  }

  return (
    <div className={`wishlist-ai-panel flex flex-col gap-3.5 ${className}`}>
      <div className="wishlist-ai-panel__head flex items-baseline gap-2">
        <h2 id={titleId} className="m-0 font-hd text-[21px]">整理給 AI</h2>
        <span className="min-w-0 flex-1 text-xs text-ink-2">{summaryLabel ?? <>已選 <b className="font-num tabular">{items.length}</b> 件</>}・平台不呼叫 AI</span>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="關閉" className="-my-2 -mr-2 flex size-11 flex-none items-center justify-center rounded-btn bg-transparent text-ink">
            <Icon name="x" />
          </button>
        )}
      </div>

      <div className="wishlist-ai-panel__template flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">範本</span>
        <Select
          label="選擇範本"
          value={template}
          options={options}
          onChange={setTemplate}
          triggerClassName="h-[46px] w-full rounded-tile border-[1.5px] border-line-strong bg-card px-3 text-sm"
        />
      </div>

      <div role="group" aria-label="要包含的資料" className="wishlist-ai-panel__includes flex flex-wrap gap-1.5">
        {AI_INCLUDES.map((entry) => {
          const blocked = entry.key === 'body' && !allowBody
          const on = include.has(entry.key) && !blocked
          return (
            <button
              key={entry.key}
              type="button"
              aria-pressed={on}
              disabled={blocked}
              onClick={() => toggle(entry.key)}
              className={`wishlist-ai-panel__include inline-flex min-h-[34px] items-center rounded-full border-[1.5px] px-3 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
                on ? 'border-mist-deep bg-mist-soft text-mist-ink' : 'border-dashed border-line-strong bg-transparent text-ink-2'
              }`}
            >
              {entry.label}
            </button>
          )
        })}
      </div>
      {!allowBody && <p className="m-0 text-xs leading-5 text-ink-2">「我的」裡關閉了「AI 使用體態資料」，所以不會附上體態。</p>}

      {items.length ? (
        <pre tabIndex={0} aria-label="預覽文字" className="wishlist-ai-panel__preview m-0 max-h-[46dvh] overflow-auto whitespace-pre-wrap rounded-tile bg-paper px-3.5 py-3 font-sans text-[12.5px] leading-[1.75] text-ink shadow-[inset_0_0_0_1.5px_var(--color-line)]">{text}</pre>
      ) : (
        <p className="wishlist-ai-panel__empty m-0 rounded-tile bg-paper px-3.5 py-6 text-center text-[13px] leading-6 text-ink-2 shadow-[inset_0_0_0_1.5px_var(--color-line)]">還沒有勾選商品。<br />點左邊的卡片勾選，文字會在這裡即時整理。</p>
      )}

      <div className="wishlist-ai-panel__foot flex items-center gap-2.5">
        <span className="flex-1 text-xs text-ink-2">{items.length ? <>約 <span className="font-num tabular">{text.length}</span> 字</> : null}</span>
        <Button type="button" variant="primary" disabled={!items.length} onClick={() => void copy()}>
          <Icon name="copy" size={18} />
          複製
        </Button>
      </div>
      {copyFailed && <p role="status" className="m-0 text-xs leading-5 text-rose-deep">沒有複製成功。請點一下上面的預覽文字，全選後手動複製。</p>}
    </div>
  )
}
