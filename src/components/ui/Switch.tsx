/**
 * 開關（設計稿 review.css 的 .sw）：按了立刻生效的設定用開關；多選才用 Checkbox。
 * button role="switch"，連文字一起可以點。
 */
export function Switch({ checked, label, onChange, tone = 'sage', disabled = false, className = '' }: { checked: boolean; label: string; onChange: () => void; tone?: 'sage' | 'mist'; disabled?: boolean; className?: string }) {
  const on = tone === 'mist' ? 'bg-mist-deep' : 'bg-sage-deep'
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={onChange} className={`flex min-h-11 items-center gap-2 text-left text-[13px] text-ink disabled:cursor-not-allowed disabled:opacity-50 ${className}`}>
      <span aria-hidden="true" className={`relative h-6 w-[42px] flex-none rounded-full transition-colors ${checked ? on : 'bg-line-strong'}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-card shadow-sticker transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </span>
      <span className="flex-1 md:flex-none">{label}</span>
    </button>
  )
}
