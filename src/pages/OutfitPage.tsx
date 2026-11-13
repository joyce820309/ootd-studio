import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FreeCanvas } from '@/components/outfit/FreeCanvas'
import { OutfitBoard, type BoardPiece } from '@/components/outfit/OutfitBoard'
import { SlotPicker } from '@/components/outfit/SlotPicker'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { PaperCard, Tape, TiltLabel, WashBlob } from '@/components/ui/Paper'
import { LoadingState, PageState } from '@/components/ui/PageState'
import { Toast, type ToastMessage } from '@/components/ui/Toast'
import { fetchClosetItems, saveOutfit, useAsync } from '@/lib/data'
import { bringToFront, defaultLayout, pickLayout, shiftLayer } from '@/lib/freeLayout'
import { EMPTY_PICKS, groupBySlot, missingRequired, suggestDefaultPicks, type Picks } from '@/lib/outfit'
import { todayISO } from '@/lib/date'
import { storeTodayPicks, type RewearState } from '@/lib/diary'
import { SLOT_META, SLOTS } from '@/lib/slots'
import type { ClosetItem, FreeLayout, OutfitTemplate, Placement, Slot } from '@/types'


export function OutfitPage() {
  const { data: items, loading, error } = useAsync(fetchClosetItems)

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-10"><LoadingState label="正在整理你的衣櫃…" /></main>
    )
  }
  if (error || !items) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-10" role="alert"><PageState icon="alert" tone="rose" title="衣櫃暫時打不開" description="衣物資料讀取失敗，沒有任何搭配變更。確認連線後再重試。" action={<Button variant="secondary" onClick={() => window.location.reload()}>重新載入</Button>} /></main>
    )
  }
  return <OutfitEditor items={items} />
}

function OutfitEditor({ items }: { items: ClosetItem[] }) {
  const grouped = useMemo(() => groupBySlot(items), [items])
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  const location = useLocation()
  // 從穿搭日記「再穿一次」帶過來：不論衣物狀態都帶回，只有已不在衣櫃的先空著
  const [rewear] = useState(() => {
    const state = (location.state as Partial<RewearState> | null)?.rewear
    if (!state) return null
    const picks: Picks = { ...EMPTY_PICKS }
    const skipped: string[] = []
    for (const [slot, id] of Object.entries(state.picks) as [Slot, string][]) {
      const item = byId.get(id)
      if (item) picks[slot] = id
      else skipped.push(SLOT_META[slot].label)
    }
    return { name: state.name, picks, skipped }
  })
  const [name, setName] = useState(rewear?.name ?? '今天的穿搭')
  const [template, setTemplate] = useState<OutfitTemplate>('full')
  const [picks, setPicks] = useState<Picks>(() => rewear?.picks ?? suggestDefaultPicks(items))
  const [layout, setLayout] = useState<FreeLayout>(defaultLayout)
  const [selected, setSelected] = useState<Slot | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(() =>
    rewear
      ? rewear.skipped.length
        ? { tone: 'error', text: `再穿一次：${rewear.skipped.join('、')}那件已不在衣櫃，那格先空著，換一件就好。` }
        : { tone: 'success', text: '已帶回日記裡的這一套。' }
      : null,
  )
  const closeToast = useCallback(() => setToast(null), [])

  // 記下今天排好的單品，穿搭日記「記一筆」可以直接帶入
  useEffect(() => storeTodayPicks(picks), [picks])

  const placeOne = useCallback((slot: Slot, p: Placement) => setLayout((l) => ({ ...l, [slot]: p })), [])

  function pick(slot: Slot, id: string | null) {
    const isNew = !picks[slot] && id
    setPicks((p) => ({ ...p, [slot]: id }))
    // 新放進畫布的單品放到最上層，才不會被蓋住
    if (isNew) setLayout((l) => bringToFront(l, slot))
    if (!id && selected === slot) setSelected(null)
  }

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
      const pickedSlots = (Object.keys(picksOut) as Slot[])
      const res = await saveOutfit({
        name: name.trim() || '今天的穿搭',
        date: todayISO(),
        template,
        picks: picksOut,
        layout: template === 'free' ? pickLayout(layout, pickedSlots) : undefined,
      })
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
          className="h-11 min-w-[200px] flex-1 border-0 border-b-[1.5px] border-dashed border-line-strong bg-transparent px-1 font-hd text-[22px] text-ink md:max-w-[360px] md:flex-none"
        />
        <span className="hidden text-xs text-ink-2 lg:inline">勾選單品，系統依部位自動排版</span>
        <div className="ml-auto flex gap-2">
          <ButtonLink to="/studio" variant="secondary" className="px-3 text-xs sm:px-[18px] sm:text-sm">工作台</ButtonLink>
          <Button
            variant="ghost"
            onClick={() => {
              setPicks(EMPTY_PICKS)
              setSelected(null)
            }}
          >
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
              onSelect={(id) => pick(meta.slot, id)}
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
                  ['free', '自由擺放'],
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
            {template === 'free' ? (
              <Button
                variant="ghost"
                className="ml-auto h-9 px-3 text-[13px]"
                onClick={() => {
                  setLayout(defaultLayout())
                  setSelected(null)
                }}
              >
                <Icon name="reset" size={16} />
                重新排列
              </Button>
            ) : (
              <span className="ml-auto text-xs text-ink-2">上衣在上、下身在中、鞋子在下</span>
            )}
          </div>

          <PaperCard className="relative flex flex-col gap-3.5 p-5">
            <Tape accent="mist" />
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <span className="font-hd text-[22px]">{name || '今天的穿搭'}</span>
              <span className="font-num text-[13px] text-ink-2 tabular">{todayISO().replaceAll('-', '/')}</span>
            </div>
            {template === 'free' ? (
              <FreeCanvas
                pieces={pieces}
                layout={layout}
                selected={selected}
                onSelect={setSelected}
                onPlace={placeOne}
                onLayer={(slot, dir) => setLayout((l) => shiftLayer(l, slot, Object.keys(pieces) as Slot[], dir))}
                onRemove={(slot) => pick(slot, null)}
                className="h-[clamp(440px,52vw,600px)]"
              />
            ) : (
              <OutfitBoard template={template} pieces={pieces} className="h-[clamp(380px,48vw,560px)]" />
            )}
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
              <span className="font-hd text-[17px] text-sage-ink">搭配檢查</span>
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
