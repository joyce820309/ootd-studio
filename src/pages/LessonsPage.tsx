import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ItemImage } from '@/components/closet/ItemImage'
import { RuleCheckTag, RuleScopeTag, RuleSwitch } from '@/components/review/LessonRules'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Icon } from '@/components/ui/Icon'
import { LoadingState, PageState } from '@/components/ui/PageState'
import { PaperCard, TiltLabel } from '@/components/ui/Paper'
import { StickyNote } from '@/components/ui/StickyNote'
import { Toast, type ToastMessage } from '@/components/ui/Toast'
import { fetchClosetItems, fetchLessonItems, fetchLessonRules, fetchReviewRecords, saveLessonRule } from '@/lib/data'
import { DECISION_LABEL, DECISION_TAG, lessonStats, plainText, reviewDate } from '@/lib/review'
import type { ClosetItem, LessonRule, ReviewRecord, Slot } from '@/types'

type Filter = 'all' | 'top' | 'bottom' | 'outer' | 'shoesBag'
const FILTERS: { value: Filter; label: string; slots: Slot[] }[] = [
  { value: 'all', label: '全部', slots: [] },
  { value: 'top', label: '上衣', slots: ['top'] },
  { value: 'bottom', label: '下身', slots: ['bottom'] },
  { value: 'outer', label: '外套', slots: ['outer'] },
  { value: 'shoesBag', label: '鞋包', slots: ['shoes', 'bag', 'acc'] },
]

interface PageData {
  records: ReviewRecord[]
  items: Map<string, ClosetItem>
  rules: LessonRule[]
  boughtThisYear: number
}

function ReviewCard({ record, item }: { record: ReviewRecord; item?: ClosetItem }) {
  const analysis = record.aiSummary[0]
  return (
    <Link to={`/closet/${record.itemId}/review`} className="flex gap-3 rounded-card bg-card p-3 text-ink no-underline shadow-paper transition-transform hover:-translate-y-px md:gap-4 md:p-3.5">
      <span className="flex size-[76px] flex-none items-center justify-center rounded-btn bg-tile p-1.5 md:size-[92px]">
        <ItemImage name={record.itemName} cutoutUrl={item?.cutoutUrl} shape={item?.shape} colorHex={item?.colorHex ?? '#D9CBB3'} className="max-h-full max-w-full" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 truncate text-[14px] font-bold md:text-[15px]">{record.itemName}</span>
          {record.size && <span className="font-num text-xs text-ink-2 tabular">{record.size}</span>}
          <span className="ml-auto font-num text-xs text-ink-2 tabular">{reviewDate(record)}</span>
        </span>
        <span className="flex flex-wrap gap-1.5">
          <span className={`inline-flex h-6 items-center rounded-full px-2 text-xs font-medium ${DECISION_TAG[record.decision]}`}>{DECISION_LABEL[record.decision]}</span>
          {record.reasons.slice(0, 3).map((reason) => (
            <span key={reason} className="inline-flex h-6 items-center rounded-full bg-tile px-2 text-xs text-ink-2">
              {reason}
            </span>
          ))}
        </span>
        {analysis && (
          <span className="rounded-sm bg-sage-soft px-2.5 py-1.5 text-[13px] leading-5 text-sage-ink">
            <span className="line-clamp-2">
              <b className="font-bold">AI：</b>
              {plainText(analysis)}
            </span>
          </span>
        )}
      </span>
    </Link>
  )
}

function RulesNote({ rules, records, onToggle }: { rules: LessonRule[]; records: ReviewRecord[]; onToggle: (rule: LessonRule, active: boolean) => void }) {
  const sourceOf = (rule: LessonRule) => records.find((record) => record.id === rule.sourceReviewId)
  return (
    <StickyNote id="lesson-rules" tone="mist" variant="mixed" title="我的挑選規則" headingLevel="h2" collapsible={false}>
      <p className="m-0 mb-2 text-xs text-mist-ink">打開的會在選購、比較試搭、新增衣物時提醒</p>
      {rules.length === 0 ? (
        <p className="m-0 py-2 text-sm">完成一次覆盤後，學到的事會變成規則放在這裡。</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {rules.map((rule) => {
            const source = sourceOf(rule)
            return (
              <li key={rule.id} className={`flex items-center gap-2 border-t-[1.5px] border-dashed border-mist py-2 first:border-t-0 ${rule.active ? '' : 'opacity-60'}`}>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap gap-1.5">
                    <RuleScopeTag rule={rule} />
                    <RuleCheckTag check={rule.checkKind} />
                  </span>
                  <span className="text-sm font-medium text-ink">{rule.text}</span>
                  {source && (
                    <Link to={`/closet/${source.itemId}/review`} className="text-xs text-mist-deep">
                      來自 {source.itemName}
                    </Link>
                  )}
                </span>
                <RuleSwitch checked={rule.active} onChange={(next) => onToggle(rule, next)} label={`提醒我：${rule.text}`} tone="mist" />
              </li>
            )
          })}
        </ul>
      )}
    </StickyNote>
  )
}

/** 規則提醒的樣子（說明用範例，不是真的商品） */
function ReminderExample() {
  return (
    <PaperCard className="flex flex-col gap-2.5 p-4">
      <h2 className="m-0 font-hd text-[19px]">提醒長這樣</h2>
      <span className="text-xs text-ink-2">範例：在選購清單貼上 ZARA 的 S 號襯衫時</span>
      <div role="note" aria-label="提醒範例" className="flex flex-col gap-1.5 rounded-tile bg-rose-soft p-3 text-status-repair-fg">
        <span className="flex items-center gap-1.5 text-sm font-bold">
          <Icon name="alert" size={18} />
          你在 ZARA 襯衫 S 踩過雷
        </span>
        <span className="text-[13px] leading-6">
          上次胸口太緊。這件 S 平放胸寬 <span className="font-num">45 cm</span>，比你的規則（≥ <span className="font-num">47</span>）少 <span className="font-num">2 cm</span>，建議看 M。
        </span>
      </div>
      <span className="text-xs leading-5 text-ink-2">只提醒、不阻擋；同一條規則 7 天內只提醒一次。</span>
    </PaperCard>
  )
}

async function fetchLessonsPageData(): Promise<PageData> {
  const [records, lessonItems, rules, closet] = await Promise.all([fetchReviewRecords(), fetchLessonItems(), fetchLessonRules(), fetchClosetItems()])
  const year = String(new Date().getFullYear())
  const boughtThisYear = [...closet, ...lessonItems].filter((item) => item.purchaseDate?.startsWith(year)).length
  return { records, items: new Map(lessonItems.map((item) => [item.id, item])), rules, boughtThisYear }
}

export function LessonsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [data, setData] = useState<PageData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [mobileTab, setMobileTab] = useState<'list' | 'rules'>('list')
  // 從覆盤頁帶來的提示
  const [toast, setToast] = useState<ToastMessage | null>(() => {
    const message = (location.state as { toast?: string } | null)?.toast
    return message ? { tone: 'success', text: message } : null
  })

  // 提示只顯示一次：清掉 history state，重新整理時不會再出現
  useEffect(() => {
    if ((location.state as { toast?: string } | null)?.toast) navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    fetchLessonsPageData()
      .then((next) => {
        if (!alive) return
        setData(next)
        setError(null)
      })
      .catch((cause) => {
        if (alive) setError(cause instanceof Error ? cause.message : '讀取踩雷筆記本失敗。')
      })
    return () => {
      alive = false
    }
  }, [reloadKey])

  const stats = useMemo(() => (data ? lessonStats(data.records, data.items, data.boughtThisYear) : null), [data])

  const toggleRule = async (rule: LessonRule, active: boolean) => {
    const apply = (next: LessonRule) => setData((current) => (current ? { ...current, rules: current.rules.map((entry) => (entry.id === next.id ? next : entry)) } : current))
    apply({ ...rule, active })
    try {
      await saveLessonRule({ ...rule, active })
    } catch (cause) {
      apply(rule)
      setToast({ tone: 'error', text: cause instanceof Error ? cause.message : '規則沒能更新。' })
    }
  }

  const heading = (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
      <div className="flex flex-col gap-2.5">
        <TiltLabel accent="rose" as="h1">踩雷筆記本</TiltLabel>
        <p className="m-0 font-hd text-[22px] leading-tight md:text-[30px]">踩過的雷，變成下次的規則</p>
      </div>
      <p className="m-0 max-w-[440px] text-[13px] leading-6 text-ink-2 md:mb-1 md:ml-auto">退貨或不穿的衣物都收在這裡，尺寸和照片保留。在衣物詳細按「這件踩雷了」就會加進來。</p>
    </div>
  )

  if (error) {
    return (
      <main className="mx-auto flex max-w-[1240px] flex-col gap-5 px-4 pt-4 pb-16 md:px-[clamp(16px,4vw,48px)] md:pt-8">
        {heading}
        <PageState icon="alert" tone="rose" title="踩雷筆記本沒能載入" description={error} action={<Button variant="primary" onClick={() => { setError(null); setData(null); setReloadKey((key) => key + 1) }}>重新載入</Button>} />
      </main>
    )
  }

  if (!data || !stats) {
    return (
      <main className="mx-auto flex max-w-[1240px] flex-col gap-5 px-4 pt-4 pb-16 md:px-[clamp(16px,4vw,48px)] md:pt-8">
        {heading}
        <LoadingState label="正在載入踩雷筆記本…" rows={4} />
      </main>
    )
  }

  const slotOf = (record: ReviewRecord) => data.items.get(record.itemId)?.slot
  const countFor = (value: Filter) => (value === 'all' ? data.records.length : data.records.filter((record) => FILTERS.find((f) => f.value === value)!.slots.includes(slotOf(record) as Slot)).length)
  const visible = filter === 'all' ? data.records : data.records.filter((record) => FILTERS.find((f) => f.value === filter)!.slots.includes(slotOf(record) as Slot))
  const activeRules = data.rules.filter((rule) => rule.active).length

  const list = (
    <section aria-labelledby="lessons-list" className="flex min-w-0 flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="lessons-list" className="m-0 mr-1.5 hidden font-hd text-[22px] md:block">覆盤紀錄</h2>
        <div className="-mx-4 flex w-[calc(100%+32px)] min-w-0 gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:w-auto md:flex-wrap md:overflow-visible md:p-0" aria-label="依類別篩選">
          {FILTERS.map((entry) => (
            <Chip key={entry.value} selected={filter === entry.value} onClick={() => setFilter(entry.value)} className="h-11 md:h-9">
              {entry.label}
              <span className="font-num tabular">{countFor(entry.value)}</span>
            </Chip>
          ))}
        </div>
        <span className="ml-auto hidden text-xs text-ink-2 md:inline">依日期・新到舊</span>
      </div>
      {data.records.length === 0 ? (
        <PageState
          icon="alert"
          tone="rose"
          compact
          title="還沒有踩雷紀錄"
          description="買到不合適的衣服時，到衣物詳細按「這件踩雷了」，就能對照尺寸整理原因，變成下次的挑選規則。"
          action={<ButtonLink to="/closet" variant="primary">去我的衣櫃</ButtonLink>}
        />
      ) : visible.length === 0 ? (
        <PageState icon="search" compact title="這個類別沒有紀錄" description="換一個類別看看。" action={<Button variant="secondary" onClick={() => setFilter('all')}>看全部</Button>} />
      ) : (
        <div className="flex flex-col gap-3.5">
          {visible.map((record) => (
            <ReviewCard key={record.id} record={record} item={data.items.get(record.itemId)} />
          ))}
        </div>
      )}
    </section>
  )

  const statCards = [
    { key: 'total', label: '踩雷', value: <>{stats.total} <span className="text-sm font-medium text-ink-2">件</span></>, sub: stats.boughtThisYear ? `今年買的 ${stats.boughtThisYear} 件裡有 ${stats.thisYear} 件` : '今年還沒有購買紀錄', mobile: false },
    { key: 'returned', label: '已退貨', value: <>{stats.returned} <span className="text-sm font-medium text-ink-2">件</span></>, sub: stats.refund ? <>退回 <span className="font-num tabular">NT${stats.refund.toLocaleString('zh-TW')}</span></> : '沒有填價格', mobile: true },
    { key: 'reason', label: '最常見的原因', value: stats.topReason ? <span className="font-hd text-[20px] font-normal md:text-[22px]">{stats.topReason.reason}・{stats.topReason.count} 次</span> : <span className="text-base font-medium text-ink-2">還沒有</span>, sub: stats.topReason?.categories.length ? `出現在：${stats.topReason.categories.join('、')}` : '記下原因後會整理在這裡', mobile: true, accent: true },
  ]

  return (
    <main className="mx-auto flex max-w-[1240px] flex-col gap-5 px-4 pt-2 pb-16 md:gap-6 md:px-[clamp(16px,4vw,48px)] md:pt-8">
      {/* 手機返回列（桌面已有全站 header） */}
      <div className="flex items-center gap-1 md:hidden">
        <Link to="/closet" aria-label="返回我的衣櫃" className="-ml-2 inline-flex size-11 items-center justify-center text-ink">
          <Icon name="back" />
        </Link>
        <span className="text-[13px] text-ink-2">我的衣櫃</span>
        <span className="ml-auto font-num text-[13px] text-ink-2 tabular">{stats.total} 件</span>
      </div>

      {heading}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        {statCards.map((card) => (
          <PaperCard key={card.key} className={`${card.mobile ? 'flex' : 'hidden md:flex'} min-w-0 flex-col gap-1.5 p-3.5 md:p-4 ${card.accent ? 'bg-rose-soft' : ''}`}>
            <span className={`text-xs ${card.accent ? 'text-status-repair-fg' : 'text-ink-2'}`}>{card.label}</span>
            <span className="font-num text-[26px] leading-tight font-bold tabular md:text-[30px]">{card.value}</span>
            <span className={`text-xs ${card.accent ? 'text-status-repair-fg' : 'text-ink-2'}`}>{card.sub}</span>
          </PaperCard>
        ))}
      </div>

      {/* 手機：紀錄／規則分頁 */}
      <div role="tablist" aria-label="檢視" className="grid grid-cols-2 rounded-btn bg-tile p-[3px] md:hidden">
        {(
          [
            ['list', '覆盤紀錄', data.records.length],
            ['rules', '我的規則', activeRules],
          ] as const
        ).map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mobileTab === value}
            onClick={() => setMobileTab(value)}
            className={`h-11 rounded-sm text-sm ${mobileTab === value ? 'bg-card font-bold text-ink shadow-sticker' : 'font-medium text-ink-2'}`}
          >
            {label} <span className="font-num tabular">{count}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.9fr)]">
        <div className={`min-w-0 ${mobileTab === 'list' ? '' : 'hidden md:block'}`}>{list}</div>
        <aside aria-label="我的挑選規則" className={`flex flex-col gap-6 pt-3 ${mobileTab === 'rules' ? '' : 'hidden md:flex'}`}>
          <RulesNote rules={data.rules} records={data.records} onToggle={(rule, active) => void toggleRule(rule, active)} />
          <ReminderExample />
        </aside>
      </div>

      <Toast message={toast} onClose={() => setToast(null)} />
    </main>
  )
}
