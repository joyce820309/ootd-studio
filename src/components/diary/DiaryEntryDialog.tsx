import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import { ItemImage } from '@/components/closet/ItemImage'
import { OutfitBoard } from '@/components/outfit/OutfitBoard'
import { Button } from '@/components/ui/Button'
import { DatePicker } from '@/components/ui/DatePicker'
import { toUploadableImage } from '@/lib/image'
import { Icon } from '@/components/ui/Icon'
import { MarkdownNoteField } from '@/components/ui/MarkdownNote'
import { todayISO } from '@/lib/date'
import { entryPieces, FEEL_LABEL, formatDiaryDate, OCCASIONS, occasionTone, TONE_CLASS, WEATHER_LABEL, WEATHERS } from '@/lib/diary'
import { SLOTS, STATUS_LABEL } from '@/lib/slots'
import type { ClosetItem, DiaryEntry, DiaryEntryInput, DiaryFeel, DiaryPhotoChange, DiaryWeather, Slot } from '@/types'

type Source = 'today' | 'past' | 'pick'
type Picks = Partial<Record<Slot, string>>

const FEELS: DiaryFeel[] = ['comfy', 'ok', 'uncomfy']

function picksOf(entry: DiaryEntry): Picks {
  const out: Picks = {}
  for (const [slot, pick] of Object.entries(entry.picks)) if (pick?.kind === 'closet') out[slot as Slot] = pick.itemId
  return out
}

const chipClass = (on: boolean, extra = '') =>
  `inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-3.5 text-[13px] font-medium md:h-10 ${
    on ? 'border-ink bg-ink text-paper' : 'border-line bg-card text-ink hover:border-line-strong'
  } ${extra}`

const fieldLabel = 'text-[13px] font-medium text-ink'
const hint = 'ml-1.5 text-xs font-normal text-ink-2'

export function DiaryEntryDialog({
  entry,
  initialDate,
  closet,
  pastEntries,
  todayPicks,
  saving,
  onCancel,
  onSubmit,
}: {
  /** 有值時為編輯模式 */
  entry?: DiaryEntry
  initialDate: string
  closet: ClosetItem[]
  pastEntries: DiaryEntry[]
  todayPicks: Picks | null
  saving: boolean
  onCancel: () => void
  onSubmit: (input: DiaryEntryInput, photo: DiaryPhotoChange) => void
}) {
  const uid = useId()
  const editing = !!entry
  const closetById = useMemo(() => new Map(closet.map((c) => [c.id, c])), [closet])
  const usable = (picks: Picks | null): Picks | null => {
    if (!picks) return null
    const out = Object.fromEntries(Object.entries(picks).filter(([, id]) => id && closetById.has(id))) as Picks
    return Object.keys(out).length ? out : null
  }
  const todayUsable = usable(todayPicks)

  const [date, setDate] = useState<string | null>(entry?.date ?? initialDate)
  const [source, setSource] = useState<Source>(editing ? 'pick' : todayUsable && initialDate === todayISO() ? 'today' : pastEntries.length ? 'past' : 'pick')
  const [picks, setPicks] = useState<Picks>(() => (entry ? picksOf(entry) : source === 'today' && todayUsable ? todayUsable : {}))
  const [pastId, setPastId] = useState<string | null>(null)
  const [name, setName] = useState(entry?.name ?? '')
  const [occasions, setOccasions] = useState<string[]>(entry?.occasions ?? [])
  const [customOpen, setCustomOpen] = useState(false)
  const [custom, setCustom] = useState('')
  const [rating, setRating] = useState<number | null>(entry?.rating ?? null)
  const [feel, setFeel] = useState<DiaryFeel | null>(entry?.feel ?? null)
  const [weather, setWeather] = useState<DiaryWeather | null>(entry?.weather ?? null)
  const [temp, setTemp] = useState(entry?.temperatureC !== null && entry?.temperatureC !== undefined ? String(entry.temperatureC) : '')
  const [note, setNote] = useState(entry?.note ?? '')
  const [photo, setPhoto] = useState<DiaryPhotoChange>(undefined)
  const [photoPreview, setPhotoPreview] = useState<string | null>(entry?.photoUrl ?? null)
  const [convertingPhoto, setConvertingPhoto] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const chooseSource = (next: Source) => {
    setSource(next)
    if (next === 'today' && todayUsable) setPicks(todayUsable)
    if (next === 'past') setPicks(pastId ? picksOf(pastEntries.find((e) => e.id === pastId)!) : {})
  }

  const pieces = useMemo(() => {
    const fake = { picks: Object.fromEntries(Object.entries(picks).map(([slot, itemId]) => [slot, { kind: 'closet', itemId }])) } as DiaryEntry
    return entryPieces(fake, closetById)
  }, [picks, closetById])
  const pieceCount = Object.keys(pieces).length

  const allOccasions = [...OCCASIONS.map((o) => o.label), ...occasions.filter((o) => !OCCASIONS.some((p) => p.label === o))]
  const toggleOccasion = (label: string) => setOccasions((list) => (list.includes(label) ? list.filter((o) => o !== label) : [...list, label]))
  const addCustom = () => {
    const label = custom.trim()
    if (label && !occasions.includes(label)) setOccasions((list) => [...list, label])
    setCustom('')
    setCustomOpen(false)
  }

  const onPhoto = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) {
      setError('照片請選擇圖片檔。')
      return
    }
    setConvertingPhoto(true)
    try {
      const uploadFile = await toUploadableImage(file)
      setPhoto(uploadFile)
      setPhotoPreview(URL.createObjectURL(uploadFile))
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '照片轉檔失敗，請換一張照片再試。')
    } finally {
      setConvertingPhoto(false)
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const tempText = temp.trim()
    if (convertingPhoto) return setError('照片處理完成後再儲存。')
    if (!date) return setError('請選擇日期。')
    if (date > todayISO()) return setError('只能記今天以前的穿搭。')
    if (!pieceCount) return setError('至少放一件這天穿的衣物。')
    if (tempText && !/^-?\d{1,2}$/.test(tempText)) return setError('氣溫請填整數，例如 18。')
    setError(null)
    onSubmit(
      {
        name,
        date,
        picks: Object.fromEntries(Object.entries(picks).filter(([, id]) => id && closetById.has(id))) as Picks,
        occasions,
        rating,
        feel,
        weather,
        temperatureC: tempText ? Number(tempText) : null,
        note,
      },
      photo,
    )
  }

  const sourceOptions: { key: Source; title: string; short: string; desc: string; disabled?: boolean }[] = [
    { key: 'today', title: '今天排好的搭配', short: '今天排好的', desc: todayUsable ? `從「今日搭配」帶入，${Object.keys(todayUsable).length} 件` : '今天還沒在「今日搭配」排過', disabled: !todayUsable },
    { key: 'past', title: '以前穿過的一套', short: '以前穿過的', desc: pastEntries.length ? '從日記挑一套，再改一兩件' : '日記裡還沒有紀錄', disabled: !pastEntries.length },
    { key: 'pick', title: '現在挑單品', short: '現在挑', desc: '依部位從衣櫃勾選' },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-scrim md:items-start md:overflow-y-auto md:p-6 md:pt-14"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onCancel()
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        noValidate
        onSubmit={submit}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !saving) onCancel()
        }}
        className="relative flex h-[calc(100dvh-44px)] w-full flex-col rounded-t-block bg-card shadow-sheet md:h-auto md:max-w-[920px] md:rounded-block md:shadow-float"
      >
        <span aria-hidden="true" className="absolute -top-[11px] left-1/2 -ml-12 hidden h-6 w-24 rounded-[2px] bg-oat-wash mix-blend-multiply md:block" style={{ rotate: '-2deg' }} />
        <div aria-hidden="true" className="flex justify-center pt-2 md:hidden"><span className="h-1 w-10 rounded-full bg-line-strong" /></div>
        <header className="flex items-center gap-2.5 border-b-[1.5px] border-dashed border-line-strong py-2.5 pr-2 pl-4 md:pt-[22px] md:pr-5 md:pb-3.5 md:pl-7">
          <h2 id={`${uid}-title`} className="m-0 font-hd text-[22px] md:text-[26px]">{editing ? '編輯紀錄' : '記一筆'}</h2>
          <span className="hidden text-[13px] text-ink-2 md:inline">{editing ? formatDiaryDate(entry.date) : '今天穿了什麼？'}</span>
          <button type="button" onClick={onCancel} disabled={saving} aria-label="關閉" className="ml-auto flex size-11 items-center justify-center rounded-btn bg-transparent text-ink">
            <Icon name="x" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-[18px] overflow-y-auto px-4 py-4 md:grid-cols-[330px_minmax(0,1fr)] md:gap-7 md:overflow-visible md:px-7 md:py-[22px]">
          {/* 左：哪一套 */}
          <div className="flex min-w-0 flex-col gap-3">
            <DatePicker label="日期" value={date} onChange={setDate} max={todayISO()} required />

            {!editing && (
              <fieldset className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
                <legend className={`${fieldLabel} mb-1.5 p-0`}>這天穿的是</legend>
                {/* 手機：三段切換 */}
                <div role="radiogroup" aria-label="這天穿的是" className="grid grid-cols-3 rounded-btn bg-tile p-[3px] md:hidden">
                  {sourceOptions.map((o) => (
                    <button key={o.key} type="button" role="radio" aria-checked={source === o.key} disabled={o.disabled} onClick={() => chooseSource(o.key)} className={`h-11 rounded-sm text-[13px] disabled:opacity-45 ${source === o.key ? 'bg-card font-bold text-ink shadow-sticker' : 'font-medium text-ink-2'}`}>
                      {o.short}
                    </button>
                  ))}
                </div>
                {/* 桌面：說明卡 */}
                <div role="radiogroup" aria-label="這天穿的是" className="hidden flex-col gap-2 md:flex">
                  {sourceOptions.map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      role="radio"
                      aria-checked={source === o.key}
                      disabled={o.disabled}
                      onClick={() => chooseSource(o.key)}
                      className={`flex items-center gap-3 rounded-tile border-[1.5px] bg-card px-3.5 py-2.5 text-left text-ink disabled:opacity-45 ${source === o.key ? 'border-ink' : 'border-line'}`}
                    >
                      <span aria-hidden="true" className={`flex size-5 flex-none items-center justify-center rounded-full border-[1.5px] ${source === o.key ? 'border-ink' : 'border-line-strong'}`}>
                        {source === o.key && <span className="size-2.5 rounded-full bg-ink" />}
                      </span>
                      <span className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">{o.title}</span>
                        <span className="text-xs text-ink-2">{o.desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            {source === 'past' && (
              <div role="radiogroup" aria-label="以前穿過的穿搭" className="flex max-h-[220px] flex-col gap-1.5 overflow-y-auto">
                {pastEntries.slice(0, 20).map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    role="radio"
                    aria-checked={pastId === e.id}
                    onClick={() => {
                      setPastId(e.id)
                      setPicks(picksOf(e))
                    }}
                    className={`flex min-h-11 items-center justify-between gap-2 rounded-btn border-[1.5px] bg-card px-3 text-left text-[13px] text-ink ${pastId === e.id ? 'border-ink' : 'border-line'}`}
                  >
                    <span className="min-w-0 truncate">{e.name}</span>
                    <span className="flex-none font-num text-xs text-ink-2 tabular">{e.date.slice(5).replace('-', '/')}</span>
                  </button>
                ))}
              </div>
            )}

            {source === 'pick' && <PiecePicker closet={closet} picks={picks} onChange={setPicks} />}

            <div className="relative rounded-card bg-apricot p-2.5">
              <OutfitBoard template="full" pieces={pieces} compact className="h-[190px] md:h-[210px]" />
            </div>
            <div className="flex items-start gap-2.5">
              <span className="flex-1 text-xs leading-[1.6] text-ink-2">
                {pieceCount === 0
                  ? '還沒放單品。'
                  : editing
                    ? '單品有變動時，穿過次數會跟著調整。'
                    : `存好後，這 ${pieceCount} 件的「穿過次數」會各加 1。`}
              </span>
              {source !== 'pick' && (
                <button type="button" onClick={() => setSource('pick')} className="inline-flex h-11 items-center gap-1 rounded-full border-[1.5px] border-line-strong bg-card px-3 text-xs font-medium whitespace-nowrap text-mist-deep md:h-[34px]">
                  換單品
                </button>
              )}
            </div>
          </div>

          {/* 右：感受 */}
          <div className="flex min-w-0 flex-col gap-[18px]">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${uid}-name`} className={fieldLabel}>名稱<small className={hint}>選填，不填會用日期</small></label>
              <input id={`${uid}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder={date ? `${formatDiaryDate(date).replace(/（.）/, '')}的穿搭` : ''} className="h-12 rounded-tile border-[1.5px] border-line-strong bg-card px-3.5 text-[15px] text-ink placeholder:text-ink-3" />
            </div>

            <fieldset className="m-0 border-0 p-0">
              <legend className={`${fieldLabel} mb-1.5 p-0`}>場合<small className={hint}>可複選</small></legend>
              <div className="flex flex-wrap gap-2">
                {allOccasions.map((label) => (
                  <button key={label} type="button" aria-pressed={occasions.includes(label)} onClick={() => toggleOccasion(label)} className={chipClass(occasions.includes(label))}>
                    <span aria-hidden="true" className={`size-2.5 rounded-[3px] ${TONE_CLASS[occasionTone(label)].dot}`} />
                    {label}
                  </button>
                ))}
                {customOpen ? (
                  <span className="inline-flex items-center gap-1">
                    <label htmlFor={`${uid}-custom`} className="sr-only">自訂場合</label>
                    <input
                      id={`${uid}-custom`}
                      autoFocus
                      value={custom}
                      maxLength={10}
                      onChange={(e) => setCustom(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addCustom()
                        }
                      }}
                      placeholder="例：婚禮"
                      className="h-11 w-28 rounded-full border-[1.5px] border-line-strong bg-card px-3 text-[13px] md:h-10"
                    />
                    <Button variant="secondary" className="h-11 px-3 md:h-10" onClick={addCustom}>加入</Button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setCustomOpen(true)} className={chipClass(false, 'border-dashed text-mist-deep')}>＋ 自訂</button>
                )}
              </div>
            </fieldset>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <span id={`${uid}-rt`} className={fieldLabel}>評分</span>
                <div role="radiogroup" aria-labelledby={`${uid}-rt`} className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} 分`} onClick={() => setRating(rating === n ? null : n)} className="flex size-11 items-center justify-center bg-transparent p-0">
                      <span
                        aria-hidden="true"
                        className={`size-[26px] rounded-[7px] border-[1.5px] ${rating !== null && n <= rating ? 'border-oat-edge bg-oat shadow-sticker' : 'border-line-strong bg-paper'}`}
                        style={{ rotate: `${n % 2 ? -8 : 6}deg` }}
                      />
                    </button>
                  ))}
                  <span className="ml-auto font-num text-[13px] whitespace-nowrap text-ink-2 tabular">{rating ? `${rating} / 5` : '未評分'}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span id={`${uid}-fe`} className={fieldLabel}>穿起來</span>
                <div role="radiogroup" aria-labelledby={`${uid}-fe`} className="grid grid-cols-3 rounded-btn bg-tile p-[3px]">
                  {FEELS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      role="radio"
                      aria-checked={feel === f}
                      onClick={() => setFeel(feel === f ? null : f)}
                      className={`h-11 rounded-sm text-[13px] md:h-10 ${feel === f ? `${f === 'comfy' ? 'bg-sage-soft text-sage-ink' : f === 'uncomfy' ? 'bg-rose-soft text-rose-ink' : 'bg-card text-ink'} font-bold shadow-sticker` : 'font-medium text-ink-2'}`}
                    >
                      {FEEL_LABEL[f]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <fieldset className="m-0 border-0 p-0">
              <legend className={`${fieldLabel} mb-1.5 p-0`}>天氣<small className={hint}>選填，之後可以依天氣找穿搭</small></legend>
              <div className="flex flex-wrap items-center gap-2">
                {WEATHERS.map((w) => (
                  <button key={w} type="button" aria-pressed={weather === w} onClick={() => setWeather(weather === w ? null : w)} className={chipClass(weather === w)}>
                    {WEATHER_LABEL[w]}
                  </button>
                ))}
                <span className="inline-flex h-11 items-center gap-1 rounded-full border-[1.5px] border-line-strong bg-card px-3.5 md:h-10">
                  <label htmlFor={`${uid}-temp`} className="sr-only">氣溫（攝氏）</label>
                  <input id={`${uid}-temp`} inputMode="numeric" value={temp} onChange={(e) => setTemp(e.target.value)} placeholder="—" className="w-8 border-0 bg-transparent text-right font-num text-[15px] font-bold text-ink tabular" />
                  <span className="text-[13px] text-ink-2">°C</span>
                </span>
              </div>
            </fieldset>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${uid}-note`} className={fieldLabel}>備註<small className={hint}>哪裡好穿、哪裡不合適？</small></label>
              <MarkdownNoteField id={`${uid}-note`} rows={3} value={note} onChange={setNote} className="w-full resize-y rounded-tile border-[1.5px] border-line-strong bg-card px-3.5 py-3 text-sm leading-[1.7] text-ink" />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className={fieldLabel}>照片<small className={hint}>選填，只有你看得到</small></span>
              {photoPreview ? (
                <div className="flex items-center gap-3">
                  <img src={photoPreview} alt="這天的鏡子自拍" className="h-24 w-20 rounded-btn object-cover" />
                  <label className="inline-flex min-h-11 cursor-pointer items-center rounded-btn border-[1.5px] border-line-strong bg-card px-3 text-[13px] font-medium">
                    換一張
                    <input type="file" accept="image/*" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
                  </label>
                  <Button variant="ghost" className="text-rose-deep" onClick={() => { setPhoto(null); setPhotoPreview(null) }}>移除</Button>
                </div>
              ) : (
                <label className="flex h-16 cursor-pointer items-center gap-3 rounded-tile border-[1.5px] border-dashed border-line-strong bg-paper px-4 text-sm font-medium text-ink-2 focus-within:outline-2 focus-within:outline-mist-deep">
                  <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-btn bg-oat-soft text-oat-ink"><Icon name="plus" /></span>
                  <span className="flex flex-col gap-0.5">加一張鏡子自拍<span className="text-xs font-normal text-ink-3">拍照或從相簿選一張</span></span>
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
                </label>
              )}
            </div>
          </div>
        </div>

        <footer className="flex flex-wrap items-center gap-3 border-t-[1.5px] border-dashed border-line-strong px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] md:px-7 md:pt-4 md:pb-[22px]">
          {error ? (
            <span role="alert" className="w-full text-[13px] text-rose-deep md:w-auto">{error}</span>
          ) : (
            <span className="hidden text-xs text-ink-2 md:inline">同一天可以記好幾筆，例如下午換了一套。</span>
          )}
          <Button variant="secondary" className="hidden md:ml-auto md:inline-flex" onClick={onCancel} disabled={saving}>取消</Button>
          <Button type="submit" variant="primary" size="lg" className="w-full md:h-11 md:w-auto md:text-sm" disabled={saving || convertingPhoto} aria-busy={saving || convertingPhoto}>
            <Icon name="check" />
            {convertingPhoto ? '照片處理中…' : saving ? '儲存中…' : editing ? '儲存變更' : '存進日記'}
          </Button>
        </footer>
      </form>
    </div>
  )
}

/** 依部位從衣櫃挑單品；過去的日期可能穿過現在送洗中的衣物，所以不鎖住，只標狀態。 */
function PiecePicker({ closet, picks, onChange }: { closet: ClosetItem[]; picks: Picks; onChange: (picks: Picks) => void }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-tile border-[1.5px] border-dashed border-line p-2.5">
      {SLOTS.map((meta) => {
        const options = closet.filter((c) => c.slot === meta.slot && c.status !== 'retired')
        const labelId = `piece-${meta.slot}`
        const set = (id: string | null) => {
          const next = { ...picks }
          if (id) next[meta.slot] = id
          else delete next[meta.slot]
          onChange(next)
        }
        return (
          <div key={meta.slot} className="flex min-w-0 flex-col gap-1">
            <span id={labelId} className="text-xs font-medium text-ink-2">{meta.label}</span>
            <div role="radiogroup" aria-labelledby={labelId} className="flex gap-1.5 overflow-x-auto pb-1">
              <button type="button" role="radio" aria-checked={!picks[meta.slot]} onClick={() => set(null)} className={`flex size-14 flex-none items-center justify-center rounded-sm border-[1.5px] text-[11px] text-ink-2 ${!picks[meta.slot] ? 'border-ink bg-tile' : 'border-dashed border-line-strong bg-card'}`}>
                沒穿
              </button>
              {options.map((item) => {
                const on = picks[meta.slot] === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={`${item.name}${item.status === 'ok' ? '' : `（${STATUS_LABEL[item.status]}）`}`}
                    title={item.name}
                    onClick={() => set(item.id)}
                    className={`relative flex size-14 flex-none items-center justify-center rounded-sm border-[1.5px] bg-tile ${on ? 'border-ink' : 'border-transparent'}`}
                  >
                    <ItemImage name="" cutoutUrl={item.cutoutUrl} shape={item.shape} colorHex={item.colorHex} className="size-[80%]" />
                    {on && <span aria-hidden="true" className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-ink text-paper"><Icon name="check" size={10} /></span>}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
