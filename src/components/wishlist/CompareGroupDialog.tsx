import { useId, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import type { CompareGroup, CompareGroupInput } from '@/types'

/** 新增／編輯比較群組：名稱（需求）與預算。 */
export function CompareGroupDialog({
  group,
  saving,
  onCancel,
  onSubmit,
  onDelete,
}: {
  group?: CompareGroup
  saving: boolean
  onCancel: () => void
  onSubmit: (input: CompareGroupInput) => void
  onDelete?: () => void
}) {
  const uid = useId()
  const [title, setTitle] = useState(group?.title ?? '')
  const [budget, setBudget] = useState(group?.budget !== undefined ? String(group.budget) : '')
  const [errors, setErrors] = useState<{ title?: string; budget?: string }>({})

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = budget.replace(/[,\s]/g, '')
    const next: typeof errors = {}
    if (!title.trim()) next.title = '請寫下這次想找什麼，例如「冬天想要一條寬褲」。'
    if (trimmed && !/^\d+$/.test(trimmed)) next.budget = '預算請填整數，例如 3500。'
    setErrors(next)
    if (next.title || next.budget) {
      document.getElementById(`${uid}-${next.title ? 'title' : 'budget'}`)?.focus()
      return
    }
    onSubmit({ title, budget: trimmed ? Number(trimmed) : null })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-scrim sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onCancel()
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-heading`}
        noValidate
        onSubmit={submit}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !saving) onCancel()
        }}
        className="flex w-full flex-col gap-4 rounded-t-block bg-card p-5 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-sheet sm:max-w-md sm:rounded-block sm:pb-5 sm:shadow-float"
      >
        <div className="space-y-1.5">
          <h2 id={`${uid}-heading`} className="m-0 font-hd text-xl">{group ? '編輯比較群組' : '新的比較群組'}</h2>
          <p className="m-0 text-sm leading-6 text-ink-2">一個群組放同一個需求的候選，例如不同網站的類似寬褲。</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-title`} className="text-[13px] font-medium text-ink">想找什麼<span className="ml-1 text-rose-deep" aria-hidden="true">*</span></label>
          <input
            id={`${uid}-title`}
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={40}
            placeholder="例：冬天想要一條寬褲"
            aria-required="true"
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? `${uid}-title-error` : undefined}
            className="h-11 w-full rounded-btn border-[1.5px] border-line bg-card px-3 text-sm text-ink placeholder:text-ink-3 aria-invalid:border-rose-deep"
          />
          {errors.title && <span id={`${uid}-title-error`} className="text-xs text-rose-deep">{errors.title}</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-budget`} className="text-[13px] font-medium text-ink">預算（選填）</label>
          <input
            id={`${uid}-budget`}
            inputMode="numeric"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="例：3500"
            aria-invalid={!!errors.budget}
            aria-describedby={`${uid}-budget-note`}
            className="h-11 w-full rounded-btn border-[1.5px] border-line bg-card px-3 font-num text-sm text-ink tabular placeholder:text-ink-3 aria-invalid:border-rose-deep"
          />
          <span id={`${uid}-budget-note`} className={`text-xs ${errors.budget ? 'text-rose-deep' : 'text-ink-2'}`}>
            {errors.budget ?? '含運總價超過預算的候選會標示出來。'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onDelete && (
            <Button variant="ghost" className="text-rose-deep" disabled={saving} onClick={onDelete}>刪除群組</Button>
          )}
          <Button variant="secondary" className="ml-auto" disabled={saving} onClick={onCancel}>取消</Button>
          <Button type="submit" variant="primary" disabled={saving} aria-busy={saving}>{saving ? '儲存中…' : group ? '儲存' : '建立群組'}</Button>
        </div>
      </form>
    </div>
  )
}
