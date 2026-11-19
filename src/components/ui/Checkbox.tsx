import { useEffect, useRef, type ChangeEvent, type InputHTMLAttributes } from 'react'

/**
 * 勾選框（B21）：像一張貼紙，沒勾是細框，勾了變深色、微微歪 −4°。
 * 外層固定 44 × 44 的點擊區，裡面才是 24 px 的框。
 */

type CheckboxTone = 'light' | 'dark'

interface CheckboxMarkProps {
  checked: boolean
  /** 部分選取（只用在「全選」） */
  indeterminate?: boolean
  disabled?: boolean
  /** dark：放在深色工具列上，框反白 */
  tone?: CheckboxTone
  /** 壓在縮圖上時，四周留一圈底色，避免跟照片混在一起 */
  halo?: boolean
  className?: string
}

/**
 * 只有外觀的勾選框，沒有輸入元件。
 * 放在整張卡片就是一個 `<label>` 的情境時用：由外層 `<label className="group/checkbox">` 內的原生 input 負責鍵盤與螢幕閱讀器。
 */
export function CheckboxMark({ checked, indeterminate = false, disabled = false, tone = 'light', halo = false, className = '' }: CheckboxMarkProps) {
  const on = checked || indeterminate
  const dark = tone === 'dark'
  const boxState = disabled
    ? on
      ? 'bg-check-locked'
      : 'bg-tile shadow-[inset_0_0_0_1.5px_var(--color-line-strong)]'
    : on
      ? dark
        ? 'bg-paper'
        : 'bg-ink'
      : 'bg-card shadow-[inset_0_0_0_1.5px_var(--color-check-edge)] group-hover/checkbox:shadow-[inset_0_0_0_2px_var(--color-ink)]'
  const markStroke = dark && !disabled ? 'stroke-ink' : 'stroke-paper'

  return (
    <span aria-hidden="true" className={`checkbox-mark flex size-11 flex-none items-center justify-center ${className}`}>
      <span className={`checkbox-mark__box flex size-6 items-center justify-center rounded-[7px] motion-safe:transition-transform motion-safe:duration-[120ms] ${on ? '-rotate-[4deg]' : ''} ${halo ? 'ring-[3px] ring-card' : ''} ${boxState}`}>
        {(checked || indeterminate) && (
          <svg viewBox="0 0 24 24" className={`checkbox-mark__icon size-4 fill-none ${markStroke}`} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
            <path d={indeterminate ? 'M6 12h12' : 'M5 12.5l4.5 4.5L19 7.5'} />
          </svg>
        )}
      </span>
    </span>
  )
}

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'checked' | 'onChange' | 'size'> {
  checked: boolean
  indeterminate?: boolean
  onCheckedChange: (checked: boolean, event: ChangeEvent<HTMLInputElement>) => void
  /** 沒有可見文字時用來當名稱，一定要填 */
  label: string
  tone?: CheckboxTone
  /** 套在外層 44 × 44 點擊區上，例如絕對定位 */
  className?: string
}

/** 獨立使用的勾選框：原生 checkbox 疊在上面（透明），鍵盤與螢幕閱讀器照常運作。 */
export function Checkbox({ checked, indeterminate = false, onCheckedChange, label, tone = 'light', disabled, className = '', ...rest }: CheckboxProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate
  }, [indeterminate])

  return (
    <label
      className={`checkbox group/checkbox relative inline-flex size-11 flex-none items-center justify-center rounded-tile has-[input:focus-visible]:outline-[2.5px] has-[input:focus-visible]:-outline-offset-[6px] has-[input:focus-visible]:outline-mist-deep ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${className}`}
    >
      <input
        ref={inputRef}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onCheckedChange(event.target.checked, event)}
        className="checkbox__input absolute inset-0 m-0 size-full cursor-[inherit] opacity-0"
        {...rest}
      />
      <CheckboxMark checked={checked} indeterminate={indeterminate} disabled={disabled} tone={tone} />
    </label>
  )
}
