import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { RuleCheckTag, RuleScopeTag } from '@/components/review/LessonRules'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { buildAiPrompt, classifyRule, parseAiReply, promptSections, type KnownNames, type PromptContext, type PromptSection, type RuleDraft } from '@/lib/review'

type Tab = 'copy' | 'paste'
type Draft = RuleDraft & { on: boolean; editing: boolean }

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // 舊瀏覽器或沒有權限：用隱藏的 textarea 複製
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}

/**
 * AI 覆盤・複製與貼上（B17.3／BM14.3）。平台不呼叫 AI：
 * ① 把資料整理成一段文字給使用者複製；② 把貼回來的回覆照格式拆成原因與規則草稿。
 */
export function AiReviewDialog({
  context,
  known,
  initialTab = 'copy',
  onCancel,
  onApply,
}: {
  context: PromptContext
  known: KnownNames
  initialTab?: Tab
  onCancel: () => void
  onApply: (result: { reasons: string[]; rules: RuleDraft[] }) => Promise<void>
}) {
  const uid = useId()
  const sections = useMemo(() => promptSections(context), [context])
  const [tab, setTab] = useState<Tab>(initialTab)
  const [include, setInclude] = useState<Set<PromptSection>>(() => new Set(sections.filter((s) => s.available).map((s) => s.key)))
  const [pickerOpen, setPickerOpen] = useState(false)
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle')
  const [reply, setReply] = useState('')
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLElement>(null)

  const prompt = useMemo(() => buildAiPrompt(context, include), [context, include])
  const parsed = useMemo(() => (reply.trim() ? parseAiReply(reply, known) : null), [reply, known])

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus()
    return () => {
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [])

  // 複製後切去 AI App，回來時自動切到「② 貼上回覆」
  useEffect(() => {
    if (copied !== 'done') return
    const onVisible = () => {
      if (document.visibilityState === 'visible') setTab('paste')
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [copied])

  const toggleSection = (key: PromptSection) =>
    setInclude((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const doCopy = async () => {
    setCopied((await copyText(prompt)) ? 'done' : 'failed')
  }

  const changeReply = (text: string) => {
    setReply(text)
    const result = text.trim() ? parseAiReply(text, known) : null
    setDrafts((result?.rules ?? []).map((rule) => ({ ...rule, on: rule.checkKind === 'auto', editing: false })))
  }

  const updateDraft = (index: number, patch: Partial<Draft>) =>
    setDrafts((current) =>
      current.map((draft, i) => {
        if (i !== index) return draft
        const next = { ...draft, ...patch }
        if (patch.condition !== undefined) {
          const again = classifyRule(next.scope, next.condition, known)
          return { ...next, checkKind: again.checkKind, kind: again.kind }
        }
        return next
      }),
    )

  const apply = async () => {
    if (!parsed) return setError('先貼上 AI 的回覆。')
    setSaving(true)
    setError(null)
    try {
      await onApply({ reasons: parsed.reasons, rules: drafts.filter((draft) => draft.on && draft.condition.trim()) })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '沒能放進覆盤頁，請再試一次。')
      setSaving(false)
    }
  }

  const charCount = prompt.replace(/\s/g, '').length

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-scrim md:items-start md:overflow-y-auto md:p-6 md:pt-14"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onCancel()
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !saving) onCancel()
        }}
        className="relative flex max-h-[calc(100dvh-44px)] w-full flex-col rounded-t-block bg-card shadow-sheet md:max-h-none md:max-w-[720px] md:rounded-block md:shadow-float"
      >
        <div aria-hidden="true" className="flex justify-center pt-2 md:hidden">
          <span className="h-1 w-10 rounded-full bg-line-strong" />
        </div>
        <header className="flex items-center gap-2.5 py-2 pr-2 pl-4 md:pt-5 md:pr-4 md:pl-6">
          <h2 id={`${uid}-title`} className="m-0 font-hd text-[22px] md:text-[24px]">AI 覆盤</h2>
          <span className="text-xs text-ink-2">平台不呼叫 AI，不會產生費用</span>
          <button type="button" aria-label="關閉" onClick={onCancel} disabled={saving} className="ml-auto inline-flex size-11 items-center justify-center rounded-btn text-ink-2 hover:bg-tile">
            <Icon name="x" />
          </button>
        </header>

        <div role="tablist" aria-label="步驟" className="mx-4 grid grid-cols-2 rounded-btn bg-tile p-[3px] md:mx-6">
          {(
            [
              ['copy', '① 複製給 AI'],
              ['paste', '② 貼上回覆'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              id={`${uid}-tab-${value}`}
              aria-selected={tab === value}
              aria-controls={`${uid}-panel`}
              onClick={() => setTab(value)}
              className={`h-11 rounded-sm text-sm md:h-10 ${tab === value ? 'bg-card font-bold text-ink shadow-sticker' : 'font-medium text-ink-2'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${tab}`} className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4 pt-4 pb-4 md:overflow-visible md:px-6 md:pb-6">
          {tab === 'copy' ? (
            <>
              <button type="button" aria-expanded={pickerOpen} onClick={() => setPickerOpen((open) => !open)} className="inline-flex min-h-11 items-center gap-1 self-start text-[13px] font-medium text-mist-deep md:hidden">
                選擇要包含的資料
                <Icon name="down" size={16} />
              </button>
              <fieldset className={`m-0 flex-wrap gap-x-4 gap-y-1 border-0 p-0 md:flex ${pickerOpen ? 'flex' : 'hidden'}`}>
                <legend className="sr-only">要給 AI 的資料</legend>
                {sections.map((section) => (
                  <label key={section.key} className={`inline-flex min-h-11 items-center gap-2 text-[13px] md:min-h-9 ${section.available ? 'cursor-pointer text-ink' : 'text-ink-3'}`}>
                    <input type="checkbox" checked={include.has(section.key)} disabled={!section.available} onChange={() => toggleSection(section.key)} className="size-[18px] accent-ink" />
                    {section.label}
                  </label>
                ))}
              </fieldset>
              <pre tabIndex={0} aria-label="要複製給 AI 的文字" className="m-0 max-h-[38vh] overflow-auto rounded-tile border-[1.5px] border-dashed border-line-strong bg-paper p-3.5 font-sans text-[13px] leading-[1.75] whitespace-pre-wrap text-ink md:max-h-80">
                {prompt}
              </pre>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-ink-2">
                  約 <span className="font-num tabular">{charCount}</span> 字・不含照片和價格・結尾附回覆格式
                </span>
                <Button variant="primary" className="ml-auto max-md:w-full" onClick={() => void doCopy()}>
                  <Icon name="link" size={18} />
                  {copied === 'done' ? '再複製一次' : '複製'}
                </Button>
              </div>
              {copied !== 'idle' && (
                <div role="status" className={`flex flex-wrap items-center gap-2 rounded-tile p-3 text-[13px] leading-6 ${copied === 'done' ? 'bg-sage-soft text-sage-ink' : 'bg-rose-soft text-status-repair-fg'}`}>
                  <Icon name={copied === 'done' ? 'check' : 'alert'} size={18} />
                  <span className="min-w-0 flex-1">{copied === 'done' ? '已複製。貼到你常用的 AI，拿到回覆後回來貼上。' : '瀏覽器不讓我們複製，請長按上面的文字自己複製。'}</span>
                  {copied === 'done' && (
                    <Button variant="secondary" className="h-10" onClick={() => setTab('paste')}>
                      下一步：貼上回覆
                    </Button>
                  )}
                </div>
              )}
              <p className="m-0 text-xs leading-5 text-ink-2">結尾的「回覆格式」是關鍵：AI 照格式回答，平台就能把規則拆出來。</p>
            </>
          ) : (
            <>
              <label className="flex flex-col gap-2 text-sm font-bold">
                AI 的回覆
                <textarea
                  rows={8}
                  value={reply}
                  onChange={(event) => changeReply(event.target.value)}
                  placeholder={'原因：\n- …\n規則：\n- 範圍｜條件'}
                  className="resize-y rounded-btn border-[1.5px] border-line bg-paper px-3 py-2 text-sm leading-[1.7] font-normal text-ink"
                />
              </label>
              {parsed && (
                <p role="status" className={`m-0 flex items-center gap-1.5 text-[13px] ${parsed.formatted ? 'text-sage-deep' : 'text-oat-deep'}`}>
                  <Icon name={parsed.formatted ? 'check' : 'alert'} size={17} />
                  {parsed.formatted
                    ? `認出 ${parsed.reasons.length} 個原因、${parsed.rules.length} 條規則・勾選的會開始提醒`
                    : '沒有照格式回答：整段會放進「AI 覆盤」便利貼，沒有認出規則，可以在覆盤頁手動加。'}
                </p>
              )}
              {drafts.length > 0 && (
                <fieldset className="m-0 flex flex-col border-0 p-0">
                  <legend className="mb-1 p-0 text-sm font-bold">
                    規則草稿 <span className="text-xs font-normal text-ink-2">勾選的才會開始提醒</span>
                  </legend>
                  {drafts.map((draft, index) => (
                    <div key={index} className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-t-[1.5px] border-dashed border-line py-2.5 first:border-t-0">
                      <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                        <input type="checkbox" checked={draft.on} onChange={(event) => updateDraft(index, { on: event.target.checked })} aria-label={`採用：${draft.condition}`} className="size-[18px] flex-none accent-ink" />
                        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <RuleScopeTag rule={draft} />
                          <RuleCheckTag check={draft.checkKind} />
                          {!draft.editing && <span className="text-sm font-medium text-ink">{draft.condition}</span>}
                        </span>
                      </label>
                      {draft.editing ? (
                        <input
                          aria-label="規則條件"
                          value={draft.condition}
                          onChange={(event) => updateDraft(index, { condition: event.target.value })}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              updateDraft(index, { editing: false })
                            }
                          }}
                          onBlur={() => updateDraft(index, { editing: false })}
                          autoFocus
                          className="h-11 w-full rounded-btn border-[1.5px] border-mist bg-card px-3 text-sm text-ink md:h-10"
                        />
                      ) : (
                        <Button variant="ghost" className="h-11 px-2.5 text-[13px] md:h-10" onClick={() => updateDraft(index, { editing: true })}>
                          改數字
                        </Button>
                      )}
                    </div>
                  ))}
                </fieldset>
              )}
              {error && (
                <p role="alert" className="m-0 text-[13px] text-rose-deep">
                  {error}
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" className="max-md:!hidden" onClick={onCancel} disabled={saving}>
                  取消
                </Button>
                <Button variant="primary" className="max-md:w-full" onClick={() => void apply()} disabled={saving || !parsed}>
                  {saving ? '儲存中…' : '放進覆盤頁'}
                </Button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
