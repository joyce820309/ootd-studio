import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Combobox } from '@/components/ui/Combobox'
import { Icon } from '@/components/ui/Icon'
import { MarkdownNoteField } from '@/components/ui/MarkdownNote'
import { SLOTS } from '@/lib/slots'
import { PRIORITY_LABEL, shopFromUrl, WISH_STATUS } from '@/lib/wishlist'
import { fetchManagedList } from '@/lib/data'
import { materialNames, parsePercentages } from '@/lib/materials'
import type { ManagedListSummary } from '@/types'
import type { WishlistInput, WishlistItem, WishPriority } from '@/types'

type EditableStatus = WishlistInput['status']
const STATUS_OPTIONS: EditableStatus[] = ['considering', 'waiting', 'ready', 'dropped']
const PRIORITY_OPTIONS: WishPriority[] = [3, 2, 1]

interface Draft {
  url: string
  name: string
  slot: WishlistInput['slot'] | ''
  colorHex: string
  colorName: string
  shop: string
  brand: string
  price: string
  shipping: string
  targetPrice: string
  size: string
  sizeNote: string
  necklineSize: string
  priority: WishPriority | null
  status: EditableStatus
  returnPolicy: string
  material: string
  materialComposition: string
  materialPercentages: Record<string, string>
  reason: string
}

export interface WishlistFormDefaults {
  url?: string
  slot?: WishlistInput['slot']
}

function toDraft(item?: WishlistItem, defaults?: WishlistFormDefaults): Draft {
  const num = (value?: number) => (value === undefined ? '' : String(value))
  return {
    url: item?.url ?? defaults?.url ?? '',
    name: item?.name ?? '',
    slot: item?.slot ?? defaults?.slot ?? '',
    colorHex: item?.colorHex ?? '#D9CBB3',
    colorName: item?.colorName ?? '',
    shop: item?.shop === '尚未決定' ? '' : (item?.shop ?? ''),
    brand: item?.brand ?? '',
    price: num(item?.price),
    shipping: num(item?.shipping),
    targetPrice: num(item?.targetPrice),
    size: item?.size ?? '',
    sizeNote: item?.sizeNote ?? '',
    necklineSize: item?.necklineSize == null ? '' : String(item.necklineSize),
    priority: item?.priority ?? null,
    status: item && item.status !== 'bought' ? item.status : 'considering',
    returnPolicy: item?.returnPolicy ?? '',
    material: item?.material ?? '',
    materialComposition: item?.materialComposition ?? '',
    materialPercentages: Object.fromEntries(Object.entries(item?.materialPercentages ?? {}).map(([name, value]) => [name, String(value)])),
    reason: item?.reason ?? '',
  }
}

type Errors = Partial<Record<'name' | 'slot' | 'price' | 'shipping' | 'targetPrice' | 'url' | 'necklineSize' | 'materialPercentages', string>>

function parseAmount(value: string): number | null | 'invalid' {
  const trimmed = value.replace(/[,\s]/g, '')
  if (!trimmed) return null
  if (!/^\d+$/.test(trimmed)) return 'invalid'
  return Number(trimmed)
}

function validate(draft: Draft): { errors: Errors; input?: WishlistInput } {
  const errors: Errors = {}
  if (!draft.name.trim()) errors.name = '請填商品名稱。'
  if (!draft.slot) errors.slot = '請選擇部位，搭配板才知道放哪裡。'
  const price = parseAmount(draft.price)
  if (price === null) errors.price = '請填價格，還不確定可以先填 0。'
  else if (price === 'invalid') errors.price = '價格請填整數，例如 2990。'
  const shipping = parseAmount(draft.shipping)
  if (shipping === 'invalid') errors.shipping = '運費請填整數，免運可填 0。'
  const targetPrice = parseAmount(draft.targetPrice)
  if (targetPrice === 'invalid') errors.targetPrice = '目標價請填整數。'
  const necklineSize = draft.necklineSize.trim() ? Number(draft.necklineSize) : null
  if (necklineSize !== null && (!Number.isFinite(necklineSize) || necklineSize < 0)) errors.necklineSize = '領口尺寸請填 0 以上的數字。'
  if (Object.entries(draft.materialPercentages).some(([name, value]) => materialNames(draft.material).includes(name) && value.trim() && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 100))) errors.materialPercentages = '材質比例請填 0 到 100 之間的數字。'
  if (draft.url.trim() && !shopFromUrl(draft.url)) errors.url = '網址格式看起來不對，請確認是否以 https:// 開頭。'
  if (Object.keys(errors).length) return { errors }
  return {
    errors,
    input: {
      name: draft.name,
      slot: draft.slot as WishlistInput['slot'],
      colorHex: draft.colorHex,
      colorName: draft.colorName,
      shop: draft.shop,
      url: draft.url,
      price: price as number,
      shipping: shipping as number | null,
      targetPrice: targetPrice as number | null,
      brand: draft.brand,
      size: draft.size,
      sizeNote: draft.sizeNote,
      necklineSize: draft.slot === 'top' ? necklineSize : null,
      priority: draft.priority,
      reason: draft.reason,
      material: draft.material,
      materialComposition: draft.materialComposition,
      materialPercentages: parsePercentages(draft.materialPercentages),
      returnPolicy: draft.returnPolicy,
      status: draft.status,
    },
  }
}

const inputClass = 'h-11 w-full min-w-0 rounded-btn border-[1.5px] border-line bg-card px-3 text-sm text-ink placeholder:text-ink-3 aria-invalid:border-rose-deep'

function Field({ label, htmlFor, error, hint, required, children, className = '' }: { label: string; htmlFor: string; error?: string; hint?: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
        {label}
        {required && <span className="ml-1 text-rose-deep" aria-hidden="true">*</span>}
      </label>
      {children}
      {error ? (
        <span id={`${htmlFor}-error`} className="text-xs text-rose-deep">{error}</span>
      ) : hint ? (
        <span id={`${htmlFor}-hint`} className="text-xs text-ink-2">{hint}</span>
      ) : null}
    </div>
  )
}

export function WishlistForm({
  item,
  defaults,
  title,
  saving,
  onCancel,
  onSubmit,
  onDelete,
}: {
  /** 有值時為編輯模式 */
  item?: WishlistItem
  /** 新增時預填（例如比較台貼上的網址、群組的部位） */
  defaults?: WishlistFormDefaults
  /** 自訂對話框標題 */
  title?: string
  saving: boolean
  onCancel: () => void
  onSubmit: (input: WishlistInput) => void
  onDelete?: () => void
}) {
  const uid = useId()
  const id = (name: string) => `${uid}-${name}`
  const [draft, setDraft] = useState<Draft>(() => {
    const draft = toDraft(item, defaults)
    const guessed = !item && draft.url ? shopFromUrl(draft.url) : null
    return guessed ? { ...draft, shop: guessed } : draft
  })
  const [errors, setErrors] = useState<Errors>({})
  const [shopSuggestions, setShopSuggestions] = useState<string[]>([])
  const [materials, setMaterials] = useState<ManagedListSummary[]>([])
  const editing = !!item

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    let active = true
    void Promise.all([fetchManagedList('shops'), fetchManagedList('materials')]).then(([shops, materialList]) => {
      if (!active) return
      setShopSuggestions(shops.entries.map((entry) => entry.name))
      const current = materialNames(item?.material)
      const extras = current.filter((name) => !materialList.entries.some((entry) => entry.name === name)).map((name) => ({ name, aliases: [], sortOrder: 1000, isDefault: false, isHidden: false, closetCount: 0, wishCount: 0, lastUsed: null }))
      setMaterials([...materialList.entries.filter((entry) => !entry.isHidden), ...extras])
    }).catch(() => undefined)
    return () => { active = false }
  }, [item?.id, item?.material])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))

  function toggleMaterial(name: string) {
    const current = materialNames(draft.material)
    const next = current.includes(name) ? current.filter((entry) => entry !== name) : [...current, name]
    set('material', next.join('、'))
    if (!next.includes(name)) {
      const percentages = { ...draft.materialPercentages }
      delete percentages[name]
      set('materialPercentages', percentages)
    }
  }

  const onUrlBlur = () => {
    if (!draft.url.trim() || draft.shop.trim()) return
    const shop = shopFromUrl(draft.url)
    if (shop) set('shop', shop)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const result = validate(draft)
    setErrors(result.errors)
    if (!result.input) {
      const first = Object.keys(result.errors)[0]
      document.getElementById(id(first))?.focus()
      return
    }
    onSubmit(result.input)
  }

  const described = (name: keyof Errors) => (errors[name] ? `${id(name)}-error` : undefined)

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
        aria-labelledby={id('title')}
        noValidate
        onSubmit={submit}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !saving) onCancel()
        }}
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-block bg-card shadow-sheet sm:max-w-2xl sm:rounded-block sm:shadow-float"
      >
        <div className="flex items-center gap-2 border-b-[1.5px] border-dashed border-line-strong px-5 py-3">
          <h2 id={id('title')} className="m-0 font-hd text-xl">{title ?? (editing ? '編輯商品' : '加入選購清單')}</h2>
          <button type="button" onClick={onCancel} disabled={saving} aria-label="關閉" className="ml-auto flex size-11 items-center justify-center rounded-btn bg-transparent text-ink-2 hover:bg-tile">
            <Icon name="x" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          <Field label="商品網址" htmlFor={id('url')} error={errors.url} hint="貼上後會自動帶入店家名稱。">
            <div className="relative">
              <span className="pointer-events-none absolute top-[12px] left-3 text-ink-3"><Icon name="link" size={18} /></span>
              <input
                id={id('url')}
                type="url"
                inputMode="url"
                autoFocus={!editing}
                value={draft.url}
                onChange={(e) => set('url', e.target.value)}
                onBlur={onUrlBlur}
                placeholder="https://"
                aria-invalid={!!errors.url}
                aria-describedby={described('url') ?? `${id('url')}-hint`}
                className={`${inputClass} pl-[38px]`}
              />
            </div>
          </Field>

          <Field label="商品名稱" htmlFor={id('name')} error={errors.name} required>
            <input id={id('name')} value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="例：奶油白羊毛混紡寬褲" aria-invalid={!!errors.name} aria-describedby={described('name')} aria-required="true" className={inputClass} maxLength={80} />
          </Field>

          <fieldset className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0" aria-describedby={described('slot')}>
            <legend className="mb-1.5 p-0 text-[13px] font-medium text-ink">部位<span className="ml-1 text-rose-deep" aria-hidden="true">*</span></legend>
            <div id={id('slot')} tabIndex={-1} className="flex flex-wrap gap-2">
              {SLOTS.map((s) => (
                <Chip key={s.slot} selected={draft.slot === s.slot} dotColor={s.solid} onClick={() => set('slot', s.slot)} className="h-11">
                  {s.label}
                </Chip>
              ))}
            </div>
            {errors.slot && <span id={`${id('slot')}-error`} className="text-xs text-rose-deep">{errors.slot}</span>}
          </fieldset>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1.5"><span className="text-[13px] font-medium text-ink">店家／網站</span><Combobox label="店家／網站" entityName="通路" value={draft.shop} options={shopSuggestions} onChange={(value) => set('shop', value)} placeholder="選擇或輸入店家／網站" manageHref="/me/shops" /><span id={`${id('shop')}-hint`} className="text-xs text-ink-2">留空會顯示「尚未決定」。</span></div>
            <Field label="品牌" htmlFor={id('brand')}>
              <input id={id('brand')} value={draft.brand} onChange={(e) => set('brand', e.target.value)} placeholder="例：COS" className={inputClass} />
            </Field>
          </div>
          {draft.slot === 'top' && <Field label="領口尺寸（cm）" htmlFor={id('necklineSize')} error={errors.necklineSize} hint="選填；衣領尺寸或領圍"><input id={id('necklineSize')} type="number" min="0" step="0.1" inputMode="decimal" value={draft.necklineSize} onChange={(event) => set('necklineSize', event.target.value)} placeholder="選填" aria-invalid={!!errors.necklineSize} className={`${inputClass} font-num tabular`} /></Field>}

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="價格" htmlFor={id('price')} error={errors.price} required>
              <input id={id('price')} inputMode="numeric" value={draft.price} onChange={(e) => set('price', e.target.value)} placeholder="2990" aria-invalid={!!errors.price} aria-describedby={described('price')} aria-required="true" className={`${inputClass} font-num tabular`} />
            </Field>
            <Field label="運費" htmlFor={id('shipping')} error={errors.shipping}>
              <input id={id('shipping')} inputMode="numeric" value={draft.shipping} onChange={(e) => set('shipping', e.target.value)} placeholder="免運填 0" aria-invalid={!!errors.shipping} aria-describedby={described('shipping')} className={`${inputClass} font-num tabular`} />
            </Field>
            <Field label="目標價" htmlFor={id('targetPrice')} error={errors.targetPrice} className="col-span-2 sm:col-span-1">
              <input id={id('targetPrice')} inputMode="numeric" value={draft.targetPrice} onChange={(e) => set('targetPrice', e.target.value)} placeholder="降到多少就買" aria-invalid={!!errors.targetPrice} aria-describedby={described('targetPrice')} className={`${inputClass} font-num tabular`} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="預計尺寸" htmlFor={id('size')}>
              <input id={id('size')} value={draft.size} onChange={(e) => set('size', e.target.value)} placeholder="例：S、36、EU 37.5" className={inputClass} />
            </Field>
            <Field label="尺寸備註" htmlFor={id('sizeNote')}>
              <MarkdownNoteField id={id('sizeNote')} value={draft.sizeNote} onChange={(value) => set('sizeNote', value)} rows={2} placeholder="例：36 有貨、只剩 L、肩寬 39 cm" className="w-full min-w-0 rounded-btn border-[1.5px] border-line bg-card px-3 py-2.5 text-sm leading-6 text-ink placeholder:text-ink-3" />
            </Field>
          </div>

          <div className="grid grid-cols-[auto_1fr] items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={id('color')} className="text-[13px] font-medium text-ink">顏色</label>
              <input id={id('color')} type="color" value={draft.colorHex} onChange={(e) => set('colorHex', e.target.value.toUpperCase())} className="h-11 w-14 cursor-pointer rounded-btn border-[1.5px] border-line bg-card p-1" />
            </div>
            <Field label="顏色名稱" htmlFor={id('colorName')}>
              <input id={id('colorName')} value={draft.colorName} onChange={(e) => set('colorName', e.target.value)} placeholder="例：奶油白" className={inputClass} />
            </Field>
          </div>

          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-1.5 p-0 text-[13px] font-medium text-ink">優先程度</legend>
            <div className="flex flex-wrap gap-2">
              {PRIORITY_OPTIONS.map((p) => (
                <Chip key={p} selected={draft.priority === p} onClick={() => set('priority', draft.priority === p ? null : p)} className="h-11 min-w-14 justify-center">
                  {PRIORITY_LABEL[p]}
                </Chip>
              ))}
            </div>
          </fieldset>

          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-1.5 p-0 text-[13px] font-medium text-ink">狀態</legend>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((s) => (
                <Chip key={s} selected={draft.status === s} onClick={() => set('status', s)} className="h-11">
                  {WISH_STATUS[s].label}
                </Chip>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="退換貨" htmlFor={id('returnPolicy')}>
              <input id={id('returnPolicy')} value={draft.returnPolicy} onChange={(e) => set('returnPolicy', e.target.value)} placeholder="例：30 天內可退" className={inputClass} />
            </Field>
          </div>

          <fieldset className="m-0 space-y-3 border-0 p-0">
            <legend className="mb-1 flex w-full items-center gap-2 text-[13px] font-medium text-ink">材質<span className="text-[11px] font-normal text-ink-3">選填比例</span><Link to="/me/materials" target="_blank" className="ml-auto flex min-h-11 items-center gap-1 text-xs font-medium text-mist-deep">管理材質<Icon name="link" size={13} /><span className="sr-only">（在新分頁開啟）</span></Link></legend>
            <div className="flex flex-wrap gap-2">{materials.map((material) => <Chip key={material.name} selected={materialNames(draft.material).includes(material.name)} onClick={() => toggleMaterial(material.name)} className="h-10">{material.name}</Chip>)}</div>
            {materialNames(draft.material).length > 0 && <div role="group" aria-label="材質比例" className="space-y-2 rounded-tile bg-paper p-3">
              {materialNames(draft.material).map((material, index) => <label key={material} htmlFor={`${id('materialPercent')}-${index}`} className="grid grid-cols-[minmax(0,1fr)_112px_40px] items-center gap-2 text-sm"><span className="min-w-0 truncate">{material}</span><span className="flex h-11 min-w-0 items-center rounded-btn border-[1.5px] border-line bg-card px-2.5 focus-within:border-mist-deep"><input id={`${id('materialPercent')}-${index}`} type="number" min="0" max="100" step="0.1" inputMode="decimal" value={draft.materialPercentages[material] ?? ''} onChange={(event) => set('materialPercentages', { ...draft.materialPercentages, [material]: event.target.value })} aria-label={`${material}比例`} className="min-w-0 flex-1 bg-transparent text-right font-num outline-none" /><span className="ml-1 text-ink-2">%</span></span><button type="button" aria-label={`移除${material}`} onClick={() => toggleMaterial(material)} className="flex size-10 items-center justify-center rounded-btn text-ink-2 hover:bg-tile"><Icon name="x" size={16} /></button></label>)}
              {errors.materialPercentages && <span role="alert" className="text-xs text-rose-deep">{errors.materialPercentages}</span>}
            </div>}
            {draft.materialComposition && <details className="text-xs text-ink-3"><summary className="min-h-9 cursor-pointer">舊版成分文字</summary><input value={draft.materialComposition} onChange={(event) => set('materialComposition', event.target.value)} aria-label="舊版成分文字" className={inputClass} /></details>}
          </fieldset>

          <Field label="想買的理由" htmlFor={id('reason')}>
            <MarkdownNoteField id={id('reason')} value={draft.reason} onChange={(value) => set('reason', value)} rows={3} placeholder="例：衣櫃缺一件比炭灰更正式、但不黑的外套。" className="w-full min-w-0 rounded-btn border-[1.5px] border-line bg-card px-3 py-2.5 text-sm leading-6 text-ink placeholder:text-ink-3" />
          </Field>

          {!editing && (
            <p className="m-0 text-xs text-ink-2">
              想加照片或去背？改用 <Link to="/closet/new">完整新增流程</Link>，最後一步選「選購清單（還在考慮）」。
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t-[1.5px] border-dashed border-line-strong px-5 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
          {onDelete && (
            <Button variant="ghost" className="text-rose-deep" onClick={onDelete} disabled={saving}>
              刪除
            </Button>
          )}
          <Button variant="secondary" className="ml-auto" onClick={onCancel} disabled={saving}>取消</Button>
          <Button type="submit" variant="primary" disabled={saving} aria-busy={saving}>
            {saving ? '儲存中…' : editing ? '儲存變更' : '加入清單'}
          </Button>
        </div>
      </form>
    </div>
  )
}
