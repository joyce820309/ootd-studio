import { materialMix } from '@/lib/materialMix'
import type { MaterialPercentages } from '@/types'

interface MaterialMixProps {
  material?: string | null
  materialComposition?: string | null
  materialPercentages?: MaterialPercentages | null
  className?: string
}

/**
 * 材質比例（B7.3 規格・全專案統一）：10px 比例條（各段間隔 2px）＋圖例「● 名稱 …… 85%」。
 * 依 % 從多到少；沒填 % 只列名稱、不畫比例條；加總不到 100 補灰色「其他」。
 */
export function MaterialMix({ material, materialComposition, materialPercentages, className = '' }: MaterialMixProps) {
  const mix = materialMix({ material, materialComposition, materialPercentages })
  if (!mix.parts.length) return null
  const withPercent = mix.parts.filter((part) => part.percent != null)
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {mix.hasPercent && (
        <div aria-hidden="true" className="flex h-2.5 gap-0.5 overflow-hidden rounded-[5px]">
          {withPercent.map((part) => <span key={part.name} className="h-full min-w-[3px]" style={{ flexGrow: part.percent!, flexBasis: 0, background: part.color }} />)}
        </div>
      )}
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0" aria-label="材質比例">
        {mix.parts.map((part) => (
          <li key={part.name} className={`flex items-center gap-2 text-[13px] ${part.other ? 'text-ink-2' : 'text-ink'}`}>
            <i aria-hidden="true" className="size-2.5 flex-none rounded-[3px]" style={{ background: part.color }} />
            <span className="min-w-0">{part.name}</span>
            {part.percent != null && <b className="ml-auto font-num tabular">{part.percent}%</b>}
          </li>
        ))}
      </ul>
    </div>
  )
}
