import { useId, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { canStretch, halveText, looksLikeCircle, resolveMeasure, type FlatFieldValue, type MeasureField } from '@/lib/stretch'
import type { BodyMeasurement } from '@/types'


const BOX = 'flex h-12 min-w-0 items-center gap-1.5 rounded-tile border-[1.5px] px-3 focus-within:border-mist-deep'
const INPUT = 'w-full min-w-0 flex-1 bg-transparent text-right font-num text-lg font-bold text-ink outline-none placeholder:text-base placeholder:font-normal placeholder:text-ink-3'

/**
 * 平放尺寸欄位（B20 A1–A6）：單格可直接貼「40-60」，或點「有彈性」展開平放／拉開後兩格。
 * 胸寬、腰寬、臀寬會做一圈量提示；按「不用」後這個欄位不再提示（只限這次編輯）。
 */
export function FlatMeasureField({
  field,
  value,
  onChange,
  body,
  className = '',
}: {
  field: MeasureField
  value: FlatFieldValue
  onChange: (value: FlatFieldValue) => void
  body?: BodyMeasurement | null
  className?: string
}) {
  const id = useId()
  const [dismissed, setDismissed] = useState(false)
  const stretchable = canStretch(field.key)
  const expanded = value.stretch !== undefined
  const resolved = resolveMeasure(field, value.text, value.stretch)
  const circle = !dismissed && !resolved.error && looksLikeCircle(field.key, resolved.flat, body ?? null)
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = resolved.error ? errorId : resolved.recognized || expanded ? hintId : undefined
  const wide = expanded || circle

  const border = resolved.error ? 'border-field-error' : circle ? 'border-oat-edge' : resolved.recognized ? 'border-field-ok' : 'border-line'

  function expand() {
    if (resolved.recognized && resolved.flat != null && resolved.stretch != null) onChange({ text: String(resolved.flat), stretch: String(resolved.stretch) })
    else onChange({ text: value.text, stretch: '' })
  }

  function halve() {
    onChange(expanded ? { text: halveText(value.text), stretch: value.stretch ? halveText(value.stretch) : '' } : { text: halveText(value.text) })
  }

  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${wide ? 'col-span-full sm:col-span-2' : ''} ${className}`}>
      <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
        <label htmlFor={`${id}-flat`}>{field.label}</label>
        {(expanded || resolved.recognized) && <span className="inline-flex h-[22px] items-center rounded-full bg-oat-soft px-2 text-[11px] font-medium text-oat-ink">彈性</span>}
      </span>

      {expanded ? (
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-1.5">
          <span className="flex min-w-0 flex-col gap-1 text-[11px] text-ink-2">
            平放
            <span className={`${BOX} ${resolved.error && !resolved.flat ? 'border-field-error' : circle ? 'border-oat-edge' : 'border-line'} bg-card`}>
              <input id={`${id}-flat`} type="text" inputMode="decimal" autoComplete="off" value={value.text} onChange={(event) => onChange({ ...value, text: event.target.value })} placeholder="平放" aria-label={`${field.label}平放`} aria-invalid={resolved.error ? true : undefined} aria-describedby={describedBy} className={INPUT} />
              <span className="font-num text-xs text-ink-3">cm</span>
            </span>
          </span>
          <span aria-hidden="true" className="pb-3.5 text-ink-3">↔</span>
          <span className="flex min-w-0 flex-col gap-1 text-[11px] text-ink-2">
            拉開後
            <span className={`${BOX} border-oat-edge bg-stretch-field`}>
              <input type="text" inputMode="decimal" autoComplete="off" value={value.stretch} onChange={(event) => onChange({ ...value, stretch: event.target.value })} placeholder="選填" aria-label={`${field.label}拉開後`} aria-invalid={resolved.error ? true : undefined} aria-describedby={describedBy} className={INPUT} />
              <span className="font-num text-xs text-ink-3">cm</span>
            </span>
          </span>
        </div>
      ) : (
        <span className={`${BOX} ${border} bg-card`}>
          <input id={`${id}-flat`} type="text" inputMode="decimal" autoComplete="off" value={value.text} onChange={(event) => onChange({ text: event.target.value })} placeholder="選填" aria-invalid={resolved.error ? true : undefined} aria-describedby={describedBy} className={INPUT} />
          <span className="font-num text-xs text-ink-3">cm</span>
        </span>
      )}

      {resolved.error ? (
        <span id={errorId} role="alert" className="flex items-start gap-1.5 text-xs leading-5 text-rose-deep"><Icon name="alert" size={15} className="mt-0.5 flex-none" />{resolved.error}</span>
      ) : resolved.recognized ? (
        <span id={hintId} className="flex items-center gap-1.5 text-xs text-sage-ink"><Icon name="check" size={15} />已辨識：平放 <b className="font-num">{resolved.flat}</b>・可拉到 <b className="font-num">{resolved.stretch}</b> cm</span>
      ) : expanded ? (
        <span id={hintId} className="text-xs text-oat-ink">拉開後也量平放，不是一整圈</span>
      ) : null}

      {circle && (
        <div role="alert" className="flex flex-col gap-2 rounded-btn bg-oat-soft px-3 py-2.5">
          <span className="text-[13px] leading-6 text-oat-ink">這看起來像一整圈的數字。要除以 2，變成 <b className="font-num">{resolved.stretch != null ? `${halveText(String(resolved.flat))}～${halveText(String(resolved.stretch))}` : halveText(String(resolved.flat))}</b> 嗎？</span>
          <span className="flex gap-1.5">
            <button type="button" onClick={halve} className="inline-flex min-h-11 items-center rounded-btn bg-ink px-3.5 text-[13px] font-medium text-paper sm:min-h-9">除以 2</button>
            <button type="button" onClick={() => setDismissed(true)} className="inline-flex min-h-11 items-center rounded-btn px-2.5 text-[13px] font-medium text-oat-ink hover:bg-oat sm:min-h-9">不用</button>
          </span>
        </div>
      )}

      {stretchable && (expanded ? (
        <button type="button" onClick={() => onChange({ text: value.text })} className="inline-flex min-h-11 items-center self-start px-1 text-xs font-medium text-ink-2 hover:text-ink sm:min-h-9">移除彈性</button>
      ) : !resolved.recognized && (
        <button type="button" onClick={expand} className="inline-flex min-h-11 items-center self-start px-1 text-xs font-medium text-mist-deep hover:text-mist-ink sm:min-h-9">＋ 有彈性</button>
      ))}
    </div>
  )
}
