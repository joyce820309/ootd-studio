import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { ItemImage } from '@/components/closet/ItemImage'
import { Button } from '@/components/ui/Button'
import { DatePicker } from '@/components/ui/DatePicker'
import { Icon } from '@/components/ui/Icon'
import { saveReviewRecord } from '@/lib/data'
import { GARMENT_COLORS } from '@/lib/colors'
import { todayISO } from '@/lib/date'
import { DECISIONS, REASON_GROUPS } from '@/lib/review'
import type { ClosetItem, ExchangeKind, ReviewDecision, ReviewRecord } from '@/types'

const CHIP = 'inline-flex min-h-11 items-center rounded-full border-[1.5px] px-3.5 text-[13px] font-medium md:min-h-[38px]'
const FIELD = 'h-11 rounded-btn border-[1.5px] bg-card px-3 text-sm text-ink md:h-10'
const EXCHANGE_KINDS: { value: ExchangeKind; label: string }[] = [
  { value: 'size', label: '換尺寸' },
  { value: 'color', label: '換顏色' },
  { value: 'other', label: '換別款' },
]

/** 儲存後要去哪：覆盤頁、建立換到的那件、或留在原地 */
export type ReviewMarkNext = 'review' | 'exchange' | 'stay'

/** 「- 」開頭或一般文字，一行一點 */
const toLines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.replace(/^\s*[-*]\s+/, '').trim())
    .filter(Boolean)

/**
 * 標記踩雷（B17 Dialog／BM14 Bottom sheet）。
 * 四種處理方式；換貨時記下換成什麼，下一步會複製成新的一件（B17.2）。
 * 平台不呼叫 AI：開關只決定儲存後要不要去覆盤頁整理資料（B17.3）。
 */
export function ReviewMarkDialog({
  item,
  record,
  onCancel,
  onSaved,
}: {
  item: ClosetItem
  record: ReviewRecord | null
  onCancel: () => void
  onSaved: (record: ReviewRecord, demo: boolean, next: ReviewMarkNext) => void
}) {
  const uid = useId()
  const isNew = !record
  const [decision, setDecision] = useState<ReviewDecision>(record?.decision ?? 'returned')
  const [returnedOn, setReturnedOn] = useState(record?.returnedOn ?? todayISO())
  const [exchangeKind, setExchangeKind] = useState<ExchangeKind>(record?.exchangeKind ?? 'size')
  const [exchangeSize, setExchangeSize] = useState(record?.exchangeSize ?? '')
  const [exchangeColor, setExchangeColor] = useState<{ name: string; hex: string } | null>(
    record?.exchangeColorName && record.exchangeColorHex ? { name: record.exchangeColorName, hex: record.exchangeColorHex } : null,
  )
  const [exchangedOn, setExchangedOn] = useState(record?.exchangedOn ?? todayISO())
  const [extra, setExtra] = useState(record?.exchangeExtra != null ? String(record.exchangeExtra) : '')
  const [reasons, setReasons] = useState<string[]>(record?.reasons ?? [])
  const [customReason, setCustomReason] = useState('')
  const [feeling, setFeeling] = useState(record?.personalNote.join('\n') ?? '')
  const [toAi, setToAi] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus()
    return () => {
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [])

  const exchange = decision === 'exchanged'
  const known = new Set(REASON_GROUPS.flatMap((group) => group.reasons))
  const extraReasons = reasons.filter((reason) => !known.has(reason))
  const groups = REASON_GROUPS.map((group) => (group.group === '其他' ? { ...group, reasons: [...group.reasons, ...extraReasons] } : group))

  const toggleReason = (reason: string) =>
    setReasons((current) => (current.includes(reason) ? current.filter((entry) => entry !== reason) : [...current, reason]))

  const addCustomReason = () => {
    const text = customReason.trim()
    if (!text) return
    if (!reasons.includes(text)) setReasons((current) => [...current, text])
    setCustomReason('')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!reasons.length) return setError('至少選一個哪裡不對。')
    if (decision === 'returned' && !returnedOn) return setError('請選擇退貨日期。')
    if (exchange) {
      if (exchangeKind === 'size' && !exchangeSize.trim()) return setError('請填換成的尺寸，例如 M。')
      if (exchangeKind === 'color' && !exchangeColor) return setError('請選換成的顏色。')
      if (!exchangedOn) return setError('請選擇換貨日。')
      if (extra.trim() && !/^-?\d+(\.\d+)?$/.test(extra.trim())) return setError('補差價請填數字，例如 200。')
    }
    setError(null)
    setSaving(true)
    try {
      const { record: saved, demo } = await saveReviewRecord({
        itemId: item.id,
        itemName: item.name,
        brand: item.brand || undefined,
        size: item.size || undefined,
        material: item.materialComposition || item.material || undefined,
        price: item.purchasePrice,
        purchaseDate: item.purchaseDate || undefined,
        decision,
        returnedOn,
        exchangeKind,
        exchangeSize: exchangeSize.trim(),
        exchangeColorName: exchangeColor?.name,
        exchangeColorHex: exchangeColor?.hex,
        exchangedOn,
        exchangeExtra: extra.trim() ? Number(extra) : undefined,
        reasons,
        personalNote: toLines(feeling),
        aiSummary: record?.aiSummary ?? [],
        aiPastedAt: record?.aiPastedAt,
      })
      onSaved(saved, demo, exchange ? 'exchange' : isNew && !toAi ? 'stay' : 'review')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '沒能儲存，請再試一次。')
      setSaving(false)
    }
  }

  const cta = exchange ? '儲存，下一步建立換到的那件' : isNew && toAi ? '儲存並前往覆盤' : '儲存'
  const foot = exchange
    ? `原本這件標成「已換貨」，連同${item.size ? ` ${item.size} ` : ''}的尺寸留在踩雷筆記本；換到的那件會出現在衣櫃。`
    : '衣物會移到「踩雷筆記本」，尺寸和照片都保留，不會再出現在衣櫃和搭配裡。'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-scrim md:items-start md:overflow-y-auto md:p-6 md:pt-14"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onCancel()
      }}
    >
      <form
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        noValidate
        onSubmit={submit}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !saving) onCancel()
        }}
        className="relative flex max-h-[calc(100dvh-44px)] w-full flex-col rounded-t-block bg-card shadow-sheet md:max-h-none md:max-w-[680px] md:rounded-block md:shadow-float"
      >
        <div aria-hidden="true" className="flex justify-center pt-2 md:hidden">
          <span className="h-1 w-10 rounded-full bg-line-strong" />
        </div>
        <header className="flex items-center gap-3 border-b-[1.5px] border-dashed border-line-strong py-2.5 pr-2 pl-4 md:pt-5 md:pr-4 md:pb-3.5 md:pl-6">
          <span className="flex size-12 flex-none items-center justify-center rounded-sm bg-tile p-1">
            <ItemImage name={item.name} cutoutUrl={item.cutoutUrl} shape={item.shape} colorHex={item.colorHex} className="max-h-full max-w-full" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={`${uid}-title`} className="m-0 font-hd text-[22px] leading-tight md:text-[24px]">
              {isNew ? '這件踩雷了' : '編輯踩雷原因'}
            </h2>
            <p className="m-0 truncate text-[13px] text-ink-2">
              {item.name}
              {item.size && `・${item.size}`}
              {item.purchaseDate && (
                <>
                  ・<span className="font-num tabular">{item.purchaseDate.slice(5).replace('-', '/')}</span> 買
                </>
              )}
            </p>
          </div>
          <button type="button" aria-label="關閉" onClick={onCancel} disabled={saving} className="inline-flex size-11 flex-none items-center justify-center rounded-btn text-ink-2 hover:bg-tile">
            <Icon name="x" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4 md:overflow-visible md:px-6 md:py-5">
          <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
            <legend className="mb-2.5 p-0 text-sm font-bold">後來怎麼處理</legend>
            <div role="radiogroup" aria-label="後來怎麼處理" className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {DECISIONS.map((option) => {
                const on = decision === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setDecision(option.value)}
                    className={`flex min-h-11 flex-col items-start justify-center gap-0.5 rounded-tile px-3 py-2 text-left ${
                      on ? 'border-2 border-ink bg-card' : 'border-[1.5px] border-line-strong bg-paper'
                    }`}
                  >
                    <span className="text-[13px] font-bold text-ink md:text-sm">{option.label}</span>
                    <span className="hidden text-xs text-ink-2 md:block">{option.desc}</span>
                  </button>
                )
              })}
            </div>

            {exchange && (
              <div className="flex flex-col gap-2.5 rounded-tile bg-oat-soft p-3.5 text-[13px] text-oat-ink">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="w-[60px] font-bold">換成</span>
                  <div role="radiogroup" aria-label="換成" className="flex flex-wrap gap-2">
                    {EXCHANGE_KINDS.map((kind) => (
                      <button
                        key={kind.value}
                        type="button"
                        role="radio"
                        aria-checked={exchangeKind === kind.value}
                        onClick={() => setExchangeKind(kind.value)}
                        className={`${CHIP} ${exchangeKind === kind.value ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-card text-ink'}`}
                      >
                        {kind.label}
                      </button>
                    ))}
                  </div>
                </div>
                {exchangeKind === 'size' && (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="w-[60px] font-bold">尺寸</span>
                    <span className="inline-flex h-10 items-center rounded-btn bg-card/60 px-3.5 font-num text-ink-3 line-through">{item.size || '—'}</span>
                    <Icon name="arrowRight" size={18} />
                    <input
                      aria-label="換成的尺寸"
                      value={exchangeSize}
                      onChange={(event) => setExchangeSize(event.target.value)}
                      maxLength={12}
                      placeholder="M"
                      className={`${FIELD} w-24 border-oat-edge font-num text-[15px] font-bold`}
                    />
                  </div>
                )}
                {exchangeKind === 'color' && (
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:gap-2.5">
                    <span className="flex items-center gap-2.5 md:pt-2.5">
                      <span className="w-[60px] font-bold">顏色</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-[18px] rounded-[5px] border border-ink/20" style={{ background: item.colorHex }} />
                        {item.colorName}
                      </span>
                      <Icon name="arrowRight" size={18} />
                    </span>
                    <div role="radiogroup" aria-label="換成的顏色" className="flex flex-wrap gap-1.5">
                      {GARMENT_COLORS.filter((color) => color.name !== '多色' && color.name !== '其他').map((color) => {
                        const on = exchangeColor?.hex === color.hex && exchangeColor.name === color.name
                        return (
                          <button
                            key={color.name}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => setExchangeColor({ name: color.name, hex: color.hex })}
                            className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] px-2.5 text-xs md:min-h-9 ${on ? 'border-ink bg-ink text-paper' : 'border-line bg-card text-ink'}`}
                          >
                            <span aria-hidden="true" className="size-[18px] rounded-full border border-ink/15" style={{ background: color.hex }} />
                            {color.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
                {exchangeKind === 'other' && <p className="m-0 leading-6">換成同一家的另一款：下一步會複製品牌、通路、價格、購買日，品名和尺寸請重新填。</p>}
                <div className="flex flex-wrap items-end gap-2.5">
                  <DatePicker label="換貨日" value={exchangedOn} onChange={(value) => setExchangedOn(value ?? '')} max={todayISO()} className="min-w-0 flex-1 md:max-w-56" />
                  <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                    補差價（選填）
                    <input
                      inputMode="decimal"
                      value={extra}
                      onChange={(event) => setExtra(event.target.value)}
                      placeholder="NT$0"
                      className={`${FIELD} w-28 border-line-strong font-num`}
                    />
                  </label>
                </div>
              </div>
            )}

            {decision === 'returned' && <DatePicker label="退貨日期" value={returnedOn} onChange={(value) => setReturnedOn(value ?? '')} max={todayISO()} className="md:max-w-60" />}
          </fieldset>

          <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
            <legend className="mb-2.5 p-0 text-sm font-bold">
              哪裡不對 <span className="text-xs font-normal text-ink-2">可複選</span>
            </legend>
            {groups.map((group) => (
              <div key={group.group} className="flex flex-col gap-1.5 md:flex-row md:gap-3">
                <span className="w-10 flex-none pt-2 text-xs text-ink-2">{group.group}</span>
                <div className="flex flex-wrap gap-2">
                  {group.reasons.map((reason) => {
                    const on = reasons.includes(reason)
                    return (
                      <button
                        key={reason}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleReason(reason)}
                        className={`${CHIP} ${on ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-card text-ink'}`}
                      >
                        {reason}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            <div className="flex gap-2 md:pl-[52px]">
              <label className="min-w-0 flex-1">
                <span className="sr-only">自己寫一個原因</span>
                <input
                  value={customReason}
                  onChange={(event) => setCustomReason(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addCustomReason()
                    }
                  }}
                  maxLength={20}
                  placeholder="自己寫一個原因"
                  className="h-11 w-full rounded-btn border-[1.5px] border-line bg-paper px-3 text-sm text-ink md:h-10"
                />
              </label>
              <Button variant="secondary" className="h-11 md:h-10" onClick={addCustomReason} disabled={!customReason.trim()}>
                加入
              </Button>
            </div>
          </fieldset>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-bold">
              穿上的感覺 <span className="text-xs font-normal text-ink-2">選填，會變成「我的體感」便利貼；一行一點</span>
            </span>
            <textarea
              rows={3}
              value={feeling}
              onChange={(event) => setFeeling(event.target.value)}
              placeholder="例如：扣上第二顆扣子，胸口就拉出橫向皺褶。"
              className="resize-y rounded-btn border-[1.5px] border-line bg-paper px-3 py-2 text-sm leading-[1.7] text-ink"
            />
          </label>

          {isNew && !exchange && (
            <label className="flex cursor-pointer items-start gap-3 rounded-tile bg-sage-soft p-3">
              <input type="checkbox" checked={toAi} onChange={(event) => setToAi(event.target.checked)} className="peer sr-only" />
              <span aria-hidden="true" className={`relative mt-0.5 inline-block h-6 w-[42px] flex-none rounded-full transition-colors peer-focus-visible:outline peer-focus-visible:outline-[2.5px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-mist-deep ${toAi ? 'bg-sage-deep' : 'bg-line-strong'}`}>
                <span className={`absolute top-0.5 size-5 rounded-full bg-card shadow-sticker transition-[left] ${toAi ? 'left-5' : 'left-0.5'}`} />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-bold text-sage-ink">之後整理資料給 AI 覆盤</span>
                <span className="text-xs leading-5 text-sage-ink">平台不會自動呼叫 AI。覆盤頁會幫你把尺寸、量測、常穿範圍整理成一段文字，複製去問 AI，再把回覆貼回來。</span>
              </span>
            </label>
          )}
        </div>

        <footer className="flex flex-wrap items-center gap-3 border-t-[1.5px] border-dashed border-line-strong px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] md:px-6 md:pt-4 md:pb-5">
          {error && (
            <span role="alert" className="w-full text-[13px] text-rose-deep">
              {error}
            </span>
          )}
          <span className="w-full text-xs leading-5 text-ink-2 md:w-auto md:flex-1">{foot}</span>
          <Button variant="ghost" className="max-md:!hidden" onClick={onCancel} disabled={saving}>
            取消
          </Button>
          <Button type="submit" variant="primary" size="lg" className="w-full md:h-11 md:w-auto md:text-sm" disabled={saving} aria-busy={saving}>
            {saving ? '儲存中…' : cta}
          </Button>
        </footer>
      </form>
    </div>
  )
}
