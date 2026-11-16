import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ButtonLink } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { PageState } from '@/components/ui/PageState'
import { Toast, type ToastMessage } from '@/components/ui/Toast'
import { FIXED_FIELDS, fixedDraftError, fixedProfileToDraft, measurementChanges, measurementDateLabel, timeOfDayLabel, toBodyProfileInput, widerFoot, type FixedDraft, type FixedKey } from '@/lib/bodyMeasurement'
import { findDuplicateGroups } from '@/lib/brands'
import { fetchBrands, fetchClosetItems, fetchDiaryEntries, fetchLessonItems, fetchManagedList, saveBodyProfile, saveProfilePreferences, signOut } from '@/lib/data'
import { useProfileIdentity } from '@/lib/profileIdentity'
import { isDemoMode } from '@/lib/supabase'
import type { BodyMeasurement, BodyProfile, BrandSummary, ProfilePreferences } from '@/types'

type ListCount = { count: number; duplicates: number }
type HubCounts = { closet?: number; diaryDays?: number; brands?: ListCount; shops?: ListCount; materials?: ListCount; lessons?: number }

const listCount = (entries: BrandSummary[], distinct: string[]): ListCount => ({ count: entries.length, duplicates: findDuplicateGroups(entries, distinct).length })

/** 「我的」各區的數字；個別讀取失敗時只是不顯示數字 */
function useHubCounts() {
  const [counts, setCounts] = useState<HubCounts>({})
  useEffect(() => {
    let alive = true
    const settle = <T,>(promise: Promise<T>, apply: (value: T) => Partial<HubCounts>) =>
      promise.then((value) => alive && setCounts((current) => ({ ...current, ...apply(value) }))).catch(() => undefined)
    void settle(fetchClosetItems(), (items) => ({ closet: items.length }))
    void settle(fetchDiaryEntries(), (entries) => ({ diaryDays: new Set(entries.map((entry) => entry.date)).size }))
    void settle(fetchBrands(), ({ brands, distinctGroups }) => ({ brands: listCount(brands, distinctGroups) }))
    void settle(fetchManagedList('shops'), ({ entries, distinctGroups }) => ({ shops: listCount(entries as BrandSummary[], distinctGroups) }))
    void settle(fetchManagedList('materials'), ({ entries, distinctGroups }) => ({ materials: listCount(entries as BrandSummary[], distinctGroups) }))
    void settle(fetchLessonItems(), (items) => ({ lessons: items.length }))
    return () => { alive = false }
  }, [])
  return counts
}

function Row({ to, swatch, label, count, badge, first = false }: { to: string; swatch: string; label: string; count?: number; badge?: string; first?: boolean }) {
  return (
    <Link to={to} className={`flex min-h-[60px] items-center gap-3 pl-3.5 pr-2 text-[15px] text-ink no-underline ${first ? '' : 'border-t-[1.5px] border-dashed border-line'}`}>
      <span aria-hidden="true" className={`size-2.5 flex-none rounded-[3px] ${swatch}`} />
      <span className="min-w-0 flex-1">{label}</span>
      {badge && <span className="whitespace-nowrap rounded-full bg-oat-soft px-2 py-0.5 text-[11px] text-oat-ink">{badge}</span>}
      {count !== undefined && <span className="font-num text-[13px] text-ink-2 tabular">{count}</span>}
      <Icon name="next" size={18} className="flex-none text-ink-3" />
    </Link>
  )
}

function Section({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-card bg-card py-1 shadow-paper">
      <h2 id={id} className="m-0 px-3.5 pb-1.5 pt-3 text-xs font-medium text-ink-3">{title}</h2>
      {children}
    </section>
  )
}

function Switch({ checked }: { checked: boolean }) {
  return (
    <span aria-hidden="true" className={`relative h-6 w-[42px] flex-none rounded-full transition-colors ${checked ? 'bg-sage-deep' : 'bg-line-strong'}`}>
      <span className={`absolute top-0.5 size-5 rounded-full bg-card shadow-sticker transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </span>
  )
}

function FixedInput({ label, hint, value, onChange, tone = 'default', className = '' }: { label: string; hint?: string; value: string; onChange: (value: string) => void; tone?: 'default' | 'wider'; className?: string }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 text-[13px] font-medium text-ink ${className}`}>
      {label}
      <span className={`flex h-12 items-center gap-1.5 rounded-tile border-[1.5px] px-3 focus-within:border-mist-deep ${tone === 'wider' ? 'border-field-ok bg-sage-wash' : value.trim() ? 'border-line bg-paper' : 'border-dashed border-line bg-paper'}`}>
        <input type="number" min="0" step="0.1" inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} placeholder="選填" aria-label={`${label}（cm）`} className="h-full w-full min-w-0 flex-1 bg-transparent text-right font-num text-[17px] font-bold text-ink outline-none placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:text-ink-3" />
        <span className="flex-none font-num text-xs text-ink-3">cm</span>
      </span>
      {hint && <span className="text-[11px] font-normal leading-4 text-mist-deep">{hint}</span>}
    </label>
  )
}

/** 固定資料底部面板：直接更新 body_profile，不產生量測紀錄 */
function FixedProfileSheet({ profile, onClose, onSaved, onError }: { profile: BodyProfile; onClose: () => void; onSaved: (next: BodyProfile, demo: boolean) => void; onError: (message: string) => void }) {
  const titleId = useId()
  const [draft, setDraft] = useState<FixedDraft>(() => fixedProfileToDraft(profile))
  const [saving, setSaving] = useState(false)
  const panelRef = useRef<HTMLElement>(null)
  const set = (key: FixedKey, value: string) => setDraft((current) => ({ ...current, [key]: value }))
  const wider = widerFoot(draft)

  useEffect(() => {
    panelRef.current?.focus()
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function save() {
    const problem = fixedDraftError(draft)
    if (problem) return onError(problem)
    setSaving(true)
    try {
      const result = await saveBodyProfile(toBodyProfileInput(draft))
      onSaved(result.bodyProfile, result.demo)
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : '固定資料儲存失敗。')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-scrim" />
      <section ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative flex max-h-[90dvh] w-full flex-col gap-3.5 overflow-y-auto rounded-t-block bg-card px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-2 shadow-sheet outline-none">
        <span aria-hidden="true" className="mx-auto h-1 w-10 flex-none rounded-full bg-line-strong" />
        <div className="flex items-center">
          <h2 id={titleId} className="m-0 font-hd text-xl">固定資料</h2>
          <button type="button" onClick={onClose} className="ml-auto min-h-11 px-2 text-[15px] text-ink-2">取消</button>
          <button type="button" onClick={() => void save()} disabled={saving} className="min-h-11 px-1.5 text-[15px] font-medium text-mist-deep disabled:opacity-50">{saving ? '儲存中…' : '完成'}</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {FIXED_FIELDS.map((field) => <FixedInput key={field.key} label={field.label} hint={field.hint} value={draft[field.key]} onChange={(value) => set(field.key, value)} />)}
        </div>
        <div className="flex flex-col gap-2.5 border-t-[1.5px] border-dashed border-line pt-3">
          <button type="button" role="switch" aria-checked={draft.footWidthsDiffer} onClick={() => setDraft((current) => ({ ...current, footWidthsDiffer: !current.footWidthsDiffer, footWidthRightCm: current.footWidthsDiffer ? current.footWidthLeftCm : current.footWidthRightCm === current.footWidthLeftCm ? '' : current.footWidthRightCm }))} className="flex min-h-11 items-center gap-2.5 text-left text-[13px] font-medium text-ink">
            <span className="flex-1">裸腳腳寬・左右不同</span>
            <Switch checked={draft.footWidthsDiffer} />
          </button>
          <div className="grid grid-cols-3 gap-2">
            {draft.footWidthsDiffer ? <>
              <FixedInput label="左腳" value={draft.footWidthLeftCm} onChange={(value) => set('footWidthLeftCm', value)} tone={wider?.side === '左腳' && draft.footWidthRightCm ? 'wider' : 'default'} />
              <FixedInput label="右腳" value={draft.footWidthRightCm} onChange={(value) => set('footWidthRightCm', value)} tone={wider?.side === '右腳' ? 'wider' : 'default'} />
            </> : <FixedInput label="腳寬" value={draft.footWidthLeftCm} onChange={(value) => set('footWidthLeftCm', value)} className="col-span-2" />}
            <FixedInput label="腳跟寬" value={draft.heelWidthCm} onChange={(value) => set('heelWidthCm', value)} />
          </div>
          {wider && <span className="text-xs text-sage-ink">選鞋配大的那隻：{draft.footWidthsDiffer ? `${wider.side} ` : ''}<b className="font-num">{wider.value}</b> cm</span>}
        </div>
        <p className="m-0 text-[11px] leading-5 text-ink-2">改了直接更新，不會產生新的量測紀錄。</p>
      </section>
    </div>
  )
}

/**
 * 手機「我的」（BM11：design/mobile/B-M-Lists.dc.html）
 * 體態與尺寸、固定資料、清單管理、衣物、設定；桌面 /me 仍是 B-Body 的完整表單。
 */
export function MobileProfileHub({
  profile,
  measurements,
  bodyProfile,
  error,
  onProfileChange,
  onBodyProfileChange,
}: {
  profile: ProfilePreferences
  measurements: BodyMeasurement[]
  bodyProfile: BodyProfile
  error: string | null
  onProfileChange: (profile: ProfilePreferences) => void
  onBodyProfileChange: (profile: BodyProfile) => void
}) {
  const navigate = useNavigate()
  const { name, initial } = useProfileIdentity()
  const counts = useHubCounts()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [savingAi, setSavingAi] = useState(false)
  const latest = measurements[0] ?? null
  const changes = latest ? measurementChanges(latest, measurements[1]) : null

  const fixedCells: { label: string; value: string | null }[] = [
    ...FIXED_FIELDS.map((field) => ({ label: field.short, value: bodyProfile[field.key]?.toString() ?? null })),
    {
      label: bodyProfile.footWidthLeftCm != null && bodyProfile.footWidthRightCm != null && bodyProfile.footWidthLeftCm !== bodyProfile.footWidthRightCm ? '腳寬 左／右' : '腳寬',
      value: bodyProfile.footWidthLeftCm == null && bodyProfile.footWidthRightCm == null ? null
        : bodyProfile.footWidthLeftCm !== bodyProfile.footWidthRightCm && bodyProfile.footWidthRightCm != null ? `${bodyProfile.footWidthLeftCm ?? '—'}／${bodyProfile.footWidthRightCm}` : String(bodyProfile.footWidthLeftCm ?? bodyProfile.footWidthRightCm),
    },
    { label: '腳跟寬', value: bodyProfile.heelWidthCm?.toString() ?? null },
  ]

  async function toggleAi() {
    const next = { ...profile, aiUseBodyData: !profile.aiUseBodyData }
    onProfileChange(next)
    setSavingAi(true)
    try {
      await saveProfilePreferences(next)
    } catch (cause) {
      onProfileChange(profile)
      setToast({ tone: 'error', text: cause instanceof Error ? cause.message : '設定沒有儲存成功。' })
    } finally {
      setSavingAi(false)
    }
  }

  async function handleSignOut() {
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (cause) {
      setToast({ tone: 'error', text: cause instanceof Error ? cause.message : '登出失敗，請稍後再試。' })
    }
  }

  const dupBadge = (list?: ListCount) => (list?.duplicates ? `${list.duplicates} 組可能重複` : undefined)

  return (
    <main className="pb-10">
      <header className="flex items-center gap-1 border-b-[1.5px] border-dashed border-line-strong py-2 pl-1 pr-2">
        <Link to="/home" aria-label="返回首頁" className="flex size-11 items-center justify-center text-ink"><Icon name="back" size={22} /></Link>
        <h1 className="m-0 font-hd text-[22px]">我的</h1>
      </header>

      <div className="flex flex-col gap-3.5 px-3 pt-3.5">
        <div className="flex items-center gap-3 px-1 pt-1">
          <span aria-hidden="true" className="flex size-[52px] flex-none items-center justify-center rounded-full bg-ink font-logo text-xl font-semibold text-paper">{initial}</span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[17px] font-bold">{name}</span>
            <span className="text-xs text-ink-2">衣櫃 <span className="font-num tabular">{counts.closet ?? '—'}</span> 件・日記 <span className="font-num tabular">{counts.diaryDays ?? '—'}</span> 天</span>
          </span>
        </div>

        {error && <div role="alert"><PageState icon="alert" tone="rose" compact title="個人資料暫時載入失敗" description={error} /></div>}

        <section aria-labelledby="hub-body" className="flex flex-col gap-3 rounded-card bg-card p-3.5 shadow-[inset_4px_0_0_var(--color-mist),var(--shadow-paper)]">
          <div className="flex items-baseline gap-2"><h2 id="hub-body" className="m-0 font-hd text-xl">體態與尺寸</h2><span className="text-[11px] text-ink-3">只有你看得到</span></div>
          {latest ? (
            <Link to={`/me/measurements/${latest.id}`} className="flex items-center gap-2.5 rounded-tile bg-paper px-3 py-2.5 text-ink no-underline">
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-xs text-ink-2">最近一次量測</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-num text-base font-bold tabular">{measurementDateLabel(latest.measuredOn)}</span>
                  <span className="rounded-full bg-tile px-2 py-0.5 text-[10px] text-ink-2">{timeOfDayLabel(latest.timeOfDay)}</span>
                  <span className="rounded-full bg-oat-soft px-2 py-0.5 text-[10px] text-oat-ink">{measurements[1] ? (changes?.changed ? `改了 ${changes.changed} 項` : '數字都沒變') : '第一次記錄'}</span>
                </span>
              </span>
              <Icon name="next" size={18} className="flex-none text-ink-3" />
            </Link>
          ) : (
            <p className="m-0 rounded-tile bg-paper px-3 py-2.5 text-[13px] leading-6 text-ink-2">還沒有量測紀錄。先填一兩項尺寸，尺寸對照就能開始幫你比。</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <ButtonLink to="/me/measurements/new" variant="primary" className="h-12"><Icon name="plus" size={18} />新增量測</ButtonLink>
            <ButtonLink to="/me/measurements" variant="secondary" className="h-12">量測紀錄 <span className="font-num tabular">{measurements.length}</span></ButtonLink>
          </div>
        </section>

        <section aria-labelledby="hub-fixed" className="flex flex-col gap-2.5 rounded-card bg-card p-3.5 shadow-[inset_0_0_0_1.5px_var(--color-stretch-ring),var(--shadow-paper)]">
          <div className="flex items-center gap-2">
            <h2 id="hub-fixed" className="m-0 font-hd text-xl">固定資料</h2>
            <span className="rounded-full bg-oat-soft px-2 py-px text-[11px] text-oat-ink">不太會變</span>
            <button type="button" aria-haspopup="dialog" onClick={() => setSheetOpen(true)} className="ml-auto min-h-11 px-2 text-sm font-medium text-mist-deep">編輯</button>
          </div>
          <dl className="m-0 grid grid-cols-3 gap-1.5">
            {fixedCells.map((cell) => (
              <div key={cell.label} className={`flex min-w-0 flex-col gap-0.5 rounded-btn px-2.5 py-2 ${cell.value ? 'bg-paper' : 'bg-paper shadow-[inset_0_0_0_1.5px_var(--color-line)]'}`}>
                <dt className="truncate text-[11px] text-ink-2">{cell.label}</dt>
                <dd className={`m-0 font-num text-[15px] font-bold tabular ${cell.value ? 'text-ink' : 'text-ink-3'}`}>{cell.value ?? '未填'}</dd>
              </div>
            ))}
          </dl>
          <span className="text-[11px] leading-5 text-ink-2">改了直接更新，不會產生新的量測紀錄。</span>
        </section>

        <Section title="清單管理" id="hub-lists">
          <Row first to="/me/brands" swatch="bg-oat" label="品牌" count={counts.brands?.count} badge={dupBadge(counts.brands)} />
          <Row to="/me/shops" swatch="bg-mist" label="購買通路" count={counts.shops?.count} badge={dupBadge(counts.shops)} />
          <Row to="/me/materials" swatch="bg-sage" label="材質" count={counts.materials?.count} badge={dupBadge(counts.materials)} />
        </Section>

        <Section title="衣物" id="hub-closet">
          <Row first to="/closet/lessons" swatch="bg-rose" label="踩雷筆記本" count={counts.lessons} />
        </Section>

        <Section title="設定" id="hub-settings">
          <button type="button" role="switch" aria-checked={profile.aiUseBodyData} disabled={savingAi} onClick={() => void toggleAi()} className="flex min-h-[60px] w-full items-center gap-3 pl-3.5 pr-3 text-left text-[15px] text-ink">
            <span className="flex flex-1 flex-col gap-0.5">AI 文字預設附上體態資料<span className="text-[11px] text-ink-2">複製給 AI 時可以再取消勾選</span></span>
            <Switch checked={profile.aiUseBodyData} />
          </button>
          <details className="group border-t-[1.5px] border-dashed border-line">
            <summary className="flex min-h-[60px] cursor-pointer list-none items-center gap-3 pl-3.5 pr-2 text-[15px] text-ink [&::-webkit-details-marker]:hidden">
              <span className="flex-1">資料怎麼使用</span>
              <Icon name="down" size={18} className="text-ink-3 transition-transform group-open:rotate-180" />
            </summary>
            <p className="m-0 px-3.5 pb-3.5 text-[13px] leading-6 text-ink-2">體態與尺寸只用在尺寸對照與搭配比例建議，不會評價身形，也不會分享給任何人。平台不會呼叫 AI；只有你按「複製」時，文字才會離開這裡。</p>
          </details>
          {!isDemoMode && (
            <button type="button" onClick={() => void handleSignOut()} className="flex min-h-[60px] w-full items-center border-t-[1.5px] border-dashed border-line pl-3.5 text-left text-[15px] text-rose-deep">登出</button>
          )}
        </Section>
      </div>

      {sheetOpen && (
        <FixedProfileSheet
          profile={bodyProfile}
          onClose={() => setSheetOpen(false)}
          onError={(text) => setToast({ tone: 'error', text })}
          onSaved={(next, demo) => {
            onBodyProfileChange(next)
            setSheetOpen(false)
            setToast({ tone: 'success', text: demo ? '固定資料已套用在本次示範工作階段。' : '固定資料已更新，不會新增量測紀錄。' })
          }}
        />
      )}
      <Toast message={toast} onClose={() => setToast(null)} />
    </main>
  )
}
