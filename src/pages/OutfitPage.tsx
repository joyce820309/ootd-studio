import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { OutfitBoard, type BoardPiece } from '@/components/outfit/OutfitBoard'
import { SlotPicker } from '@/components/outfit/SlotPicker'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { PaperCard, Tape, TiltLabel, WashBlob } from '@/components/ui/Paper'
import { Toast, type ToastMessage } from '@/components/ui/Toast'
import { fetchClosetItems, saveOutfit, useAsync } from '@/lib/data'
import { EMPTY_PICKS, groupBySlot, missingRequired, suggestDefaultPicks, type Picks } from '@/lib/outfit'
import { SLOTS } from '@/lib/slots'
import type { ClosetItem, OutfitTemplate, Slot } from '@/types'

const today = () => new Date().toISOString().slice(0, 10)

export function OutfitPage() {
  const { data: items, loading, error } = useAsync(fetchClosetItems)

  if (loading) {
    return (
      <p role="status" className="p-10 text-center text-sm text-ink-2">
        正在整理你的衣櫃…
      </p>
    )
  }
  if (error || !items) {
    return (
      <p role="alert" className="mx-auto mt-10 max-w-md rounded-tile border-[1.5px] border-rose bg-rose-soft p-4 text-sm text-rose-ink">
        衣櫃資料讀取失敗，請重新整理再試一次。
      </p>
    )
  }
  return <OutfitEditor items={items} />
}

function OutfitEditor({ items }: { items: ClosetItem[] }) {
  const grouped = useMemo(() => groupBySlot(items), [items])
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  const [name, setName] = useState('今天的穿搭')
  const [template, setTemplate] = useState<OutfitTemplate>('full')
  const [picks, setPicks] = useState<Picks>(() => suggestDefaultPicks(items))
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const closeToast = useCallback(() => setToast(null), [])

  const pieces = useMemo(() => {
    const out: Partial<Record<Slot, BoardPiece>> = {}
    for (const s of SLOTS) {
      const item = picks[s.slot] ? byId.get(picks[s.slot]!) : undefined
      if (item) out[s.slot] = { name: item.name, colorHex: item.colorHex, cutoutUrl: item.cutoutUrl, shape: item.shape }
    }
    return out
  }, [picks, byId])

  const missing = missingRequired(picks)
  const extras = (['outer', 'bag', 'acc'] as Slot[]).filter((s) => picks[s]).map((s) => byId.get(picks[s]!)!.name)

  async function handleSave() {
    if (missing.length) {
      setToast({ tone: 'error', text: `還缺${missing.join('、')}，選好後就能儲存。` })
      return
    }
    setSaving(true)
    try {
      const picksOut = Object.fromEntries(
        Object.entries(picks)
          .filter(([, id]) => id)
          .map(([slot, id]) => [slot, { kind: 'closet' as const, itemId: id! }]),
      )
      const res = await saveOutfit({ name: name.trim() || '今天的穿搭', date: today(), template, picks: picksOut })
      setToast({ tone: 'success', text: res.demo ? '示範模式：已模擬存進穿搭日記' : '已存進穿搭日記' })
    } catch {
      setToast({ tone: 'error', text: '沒有存成功，內容已保留。連線穩定後再試一次。' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto flex max-w-[1320px] flex-col gap-5 px-[clamp(16px,3vw,40px)] pt-7 pb-14">
      <div className="flex flex-wrap items-center gap-3.5">
        <TiltLabel accent="rose" as="h1">今日搭配</TiltLabel>
        <label htmlFor="outfit-name" className="sr-only">
          穿搭名稱
        </label>
        <input
          id="outfit-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-11 min-w-[200px] flex-1 border-0 border-b-[1.5px] border-dashed border-line-strong bg-transparent px-1 font-hd text-[22px] font-bold text-ink md:max-w-[360px] md:flex-none"
        />
        <span className="hidden text-xs text-ink-2 lg:inline">勾選單品，系統依部位自動排版</span>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={() => setPicks(EMPTY_PICKS)}>
            全部清空
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            <Icon name="check" />
            {saving ? '儲存中…' : '存到穿搭日記'}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <PaperCard aria-label="依部位勾選單品" className="flex min-w-0 flex-col px-[18px] pt-2 pb-4.5 lg:max-w-[560px] lg:flex-[1_1_440px]">
          {SLOTS.map((meta) => (
            <SlotPicker
              key={meta.slot}
              meta={meta}
              items={grouped[meta.slot]}
              selectedId={picks[meta.slot]}
              onSelect={(id) => setPicks((p) => ({ ...p, [meta.slot]: id }))}
            />
          ))}
        </PaperCard>

        <section aria-label="搭配板預覽" className="order-first flex min-w-0 flex-col gap-3.5 lg:order-none lg:flex-[1.2_1_520px]">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[13px] font-medium">板型</span>
            <div role="group" aria-label="板型" className="inline-flex rounded-btn bg-tile p-[3px]">
              {(
                [
                  ['full', '完整平鋪'],
                  ['column', '三件直列'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={template === value}
                  onClick={() => setTemplate(value)}
                  className={`h-[38px] rounded-sm px-3.5 text-[13px] font-medium text-ink ${template === value ? 'bg-card shadow-sticker' : 'bg-transparent'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="ml-auto text-xs text-ink-2">上衣在上、下身在中、鞋子在下</span>
          </div>

          <PaperCard className="relative flex flex-col gap-3.5 p-5">
            <Tape accent="mist" />
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <span className="font-hd text-[22px] font-bold">{name || '今天的穿搭'}</span>
              <span className="font-num text-[13px] text-ink-2 tabular">{today().replaceAll('-', '/')}</span>
            </div>
            <OutfitBoard template={template} pieces={pieces} className="h-[clamp(380px,48vw,560px)]" />
            {template === 'column' && extras.length > 0 && (
              <p className="m-0 text-xs text-ink-2">另外搭配：{extras.join('、')}</p>
            )}
            <ul className="m-0 flex list-none flex-wrap gap-x-[18px] gap-y-1.5 border-t-[1.5px] border-dashed border-line p-0 pt-3 text-[13px]">
              {SLOTS.filter((s) => picks[s.slot]).map((s) => (
                <li key={s.slot}>
                  <span className="text-ink-3">{s.label}</span>　{byId.get(picks[s.slot]!)!.name}
                </li>
              ))}
            </ul>
          </PaperCard>

          <div className="relative flex flex-wrap items-start gap-3.5 overflow-hidden rounded-card bg-sage-soft px-4.5 py-4">
            <WashBlob accent="oat" className="-top-6 -right-6 size-[90px]" tilt={12} />
            <div className="relative flex flex-[1_1_280px] flex-col gap-1.5">
              <span className="font-hd text-[17px] font-bold text-sage-ink">搭配檢查</span>
              <span role="status" className="text-[13px] leading-relaxed text-sage-ink">
                {missing.length
                  ? `還缺：${missing.join('、')}。選好必選部位就能儲存。`
                  : '必選部位都齊了，可以存進穿搭日記。AI 比例與配色建議會在接上 Edge Function 後出現在這裡。'}
              </span>
            </div>
            <Link to="/wishlist/compare" className="relative self-center text-[13px]">
              混入想買的單品 →
            </Link>
          </div>
        </section>
      </div>
      <Toast message={toast} onClose={closeToast} />
    </main>
  )
}
