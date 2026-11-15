import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Select } from '@/components/ui/Select'
import { CHECK_LABEL, CHECK_TAG, classifyRule, RULE_KIND_LABEL, RULE_KIND_TAG, type KnownNames } from '@/lib/review'
import type { LessonRule, LessonRuleCheck, LessonRuleInput, LessonRuleKind } from '@/types'

const INPUT = 'h-11 w-full rounded-btn border-[1.5px] border-line bg-card px-3 text-sm text-ink'
const KIND_OPTIONS = (Object.keys(RULE_KIND_LABEL) as LessonRuleKind[]).map((value) => ({ value, label: RULE_KIND_LABEL[value] }))

/** 開關（role=switch）。外層 label 可點，觸控範圍至少 44px。 */
export function RuleSwitch({
  checked,
  onChange,
  label,
  tone = 'sage',
  disabled,
  children,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  tone?: 'sage' | 'mist'
  disabled?: boolean
  children?: ReactNode
}) {
  const on = tone === 'sage' ? 'bg-sage-deep' : 'bg-mist-deep'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex min-h-11 flex-none items-center gap-2 rounded-btn px-1 text-[13px] text-ink disabled:opacity-50"
    >
      <span aria-hidden="true" className={`relative inline-block h-6 w-[42px] rounded-full transition-colors ${checked ? on : 'bg-line-strong'}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-card shadow-sticker transition-[left] ${checked ? 'left-5' : 'left-0.5'}`} />
      </span>
      {children}
    </button>
  )
}

export function RuleCheckTag({ check }: { check: LessonRuleCheck }) {
  return <span className={`inline-flex h-6 flex-none items-center rounded-full px-2 text-xs font-medium ${CHECK_TAG[check]}`}>{CHECK_LABEL[check]}</span>
}

export function RuleScopeTag({ rule }: { rule: Pick<LessonRule, 'kind' | 'scope'> }) {
  return <span className={`inline-flex h-6 max-w-full items-center self-start truncate rounded-full px-2.5 text-xs font-medium ${RULE_KIND_TAG[rule.kind]}`}>{rule.scope}</span>
}

/** 新增／編輯一條規則 */
export function LessonRuleForm({
  initial,
  defaults,
  known,
  onSubmit,
  onCancel,
}: {
  initial?: LessonRule
  defaults: Pick<LessonRuleInput, 'scope' | 'kind' | 'sourceReviewId'>
  /** 用來判斷「可自動檢查」或「只提醒」 */
  known: KnownNames
  onSubmit: (input: LessonRuleInput) => Promise<void>
  onCancel: () => void
}) {
  const uid = useId()
  const [kind, setKind] = useState<LessonRuleKind>(initial?.kind ?? defaults.kind)
  const [scope, setScope] = useState(initial?.scope ?? defaults.scope)
  const [text, setText] = useState(initial?.text ?? '')
  const [why, setWhy] = useState(initial?.why ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!scope.trim()) return setError('請填適用範圍，例如「ZARA・襯衫」。')
    if (!text.trim()) return setError('請寫下規則內容。')
    setSaving(true)
    setError(null)
    try {
      await onSubmit({
        id: initial?.id,
        kind,
        checkKind: classifyRule(scope, text, known).checkKind,
        scope: scope.trim(),
        text: text.trim(),
        why: why.trim() || '自己加的規則',
        active: initial?.active ?? true,
        sourceReviewId: initial?.sourceReviewId ?? defaults.sourceReviewId,
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '規則沒能儲存。')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate aria-label={initial ? '編輯規則' : '新增規則'} className="flex flex-col gap-3 rounded-tile border-[1.5px] border-dashed border-line-strong bg-paper p-3.5">
      <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
          <span aria-hidden="true">類型</span>
          <Select label="類型" value={kind} options={KIND_OPTIONS} onChange={setKind} />
        </div>
        <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-medium text-ink-2">
          適用範圍
          <input value={scope} onChange={(e) => setScope(e.target.value)} maxLength={80} placeholder="例如：ZARA・襯衫" className={INPUT} />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
        規則
        <input id={`${uid}-text`} value={text} onChange={(e) => setText(e.target.value)} maxLength={220} placeholder="例如：平放胸寬至少 47 cm" className={INPUT} />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
        為什麼 <span className="sr-only">（選填）</span>
        <input value={why} onChange={(e) => setWhy(e.target.value)} maxLength={500} placeholder="選填，例如：這次 S 的胸圍只比我大 4 cm" className={INPUT} />
      </label>
      {error && (
        <p role="alert" className="m-0 text-[13px] text-rose-deep">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          取消
        </Button>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? '儲存中…' : '儲存規則'}
        </Button>
      </div>
    </form>
  )
}

/** 覆盤頁的規則列：範圍、內容、原因、提醒開關、編輯、刪除 */
export function LessonRuleRow({
  rule,
  onToggle,
  onEdit,
  onDelete,
}: {
  rule: LessonRule
  onToggle: (next: boolean) => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t-[1.5px] border-dashed border-line py-3 first:border-t-0 ${rule.active ? '' : 'opacity-70'}`}>
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
        <span className="flex flex-wrap gap-1.5 sm:w-36 sm:flex-none sm:flex-col sm:items-start">
          <RuleScopeTag rule={rule} />
          <RuleCheckTag check={rule.checkKind} />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-[15px] font-bold text-ink">{rule.text}</span>
          <span className="text-xs text-ink-2">{rule.why}</span>
        </span>
      </div>
      <div className="ml-auto flex items-center">
        <RuleSwitch checked={rule.active} onChange={onToggle} label={`提醒我：${rule.text}`}>
          提醒我
        </RuleSwitch>
        <button type="button" aria-label={`編輯規則：${rule.text}`} onClick={onEdit} className="inline-flex size-11 items-center justify-center rounded-btn text-ink-2 hover:bg-tile">
          <Icon name="edit" size={18} />
        </button>
        <button type="button" aria-label={`刪除規則：${rule.text}`} onClick={onDelete} className="inline-flex size-11 items-center justify-center rounded-btn text-ink-2 hover:bg-tile hover:text-rose-deep">
          <Icon name="trash" size={18} />
        </button>
      </div>
    </div>
  )
}
