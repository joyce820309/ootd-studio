import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ItemImage } from '@/components/closet/ItemImage'
import { AiReviewDialog } from '@/components/review/AiReviewDialog'
import { LessonRuleForm, LessonRuleRow } from '@/components/review/LessonRules'
import { ReviewMarkDialog } from '@/components/review/ReviewMarkDialog'
import { DestructiveActionDialog } from '@/components/ui/B10States'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { LoadingState, PageState } from '@/components/ui/PageState'
import { PaperCard, TiltLabel } from '@/components/ui/Paper'
import { StickyNote } from '@/components/ui/StickyNote'
import { Toast, type ToastMessage } from '@/components/ui/Toast'
import { deleteLessonRule, fetchCategories, fetchClosetItemDetail, fetchClosetItems, fetchExchangedTo, fetchLessonItems, fetchLessonRules, fetchProfileData, fetchReviewForItem, removeReviewRecord, saveLessonRule, updateReviewRecord } from '@/lib/data'
import {
  bandLabel,
  buildSizeRows,
  comfortItems,
  DECISION_LABEL,
  DECISION_TAG,
  formatCm,
  formatSigned,
  hasSizeComparison,
  judgeLabel,
  pickBodySnapshot,
  rangeBarPositions,
  reasonGroup,
  type KnownNames,
  type RuleDraft,
  type SizeRow,
} from '@/lib/review'
import type { BodyMeasurement, ClosetItem, LessonRule, LessonRuleInput, ReviewRecord } from '@/types'
import { toISODate } from '@/lib/date'

const slash = (iso?: string) => (iso ? iso.replace(/-/g, '/') : '')
const shortDate = (iso?: string) => (iso ? iso.slice(5).replace('-', '/') : '')

/** 「- 」開頭或一般文字，一行一點 */
const toLines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.replace(/^\s*[-*]\s+/, '').trim())
    .filter(Boolean)

interface PageData {
  item: ClosetItem
  record: ReviewRecord | null
  closet: ClosetItem[]
  measurements: BodyMeasurement[]
  rules: LessonRule[]
  /** 判斷規則能不能自動檢查用的品牌與類別名稱 */
  known: KnownNames
  /** 換貨換到的那件 */
  exchangedTo: Pick<ClosetItem, 'id' | 'name' | 'size'> | null
}

const judgeTone = (row: SizeRow) =>
  row.judge === 'small' || row.judge === 'big'
    ? { tag: 'bg-rose-soft text-status-repair-fg', text: 'text-rose-deep', marker: 'bg-rose-deep' }
    : row.judge === 'ok'
      ? { tag: 'bg-sage-soft text-sage-ink', text: 'text-sage-deep', marker: 'bg-sage-deep' }
      : { tag: 'bg-tile text-ink-2', text: 'text-ink-2', marker: 'bg-ink-3' }

function RangeBar({ row }: { row: SizeRow }) {
  const pos = rangeBarPositions(row)
  if (!pos) return <span className="text-xs text-ink-2">{row.missingBody ? '缺身體量測' : '—'}</span>
  const tone = judgeTone(row)
  return (
    <span className="relative block h-[30px] w-full min-w-0" aria-hidden="true">
      <span className="absolute inset-x-0 top-[9px] h-0.5 rounded-full bg-line-strong" />
      {pos.band && <span className="absolute top-1 h-3 rounded-full bg-sage-soft" style={{ left: `${pos.band.left}%`, width: `${pos.band.width}%` }} />}
      <span className={`absolute top-[3px] size-3.5 -translate-x-1/2 rounded-full border-2 border-card ${tone.marker}`} style={{ left: `${pos.marker}%` }} />
      {pos.band && (
        <span className="absolute bottom-0 font-num text-xs whitespace-nowrap text-sage-deep tabular" style={{ left: `${pos.band.left}%` }}>
          {bandLabel(row)}
        </span>
      )}
    </span>
  )
}

function SizeTable({ rows, item, body, beforePurchase, comfortCount }: { rows: SizeRow[]; item: ClosetItem; body: BodyMeasurement | null; beforePurchase: boolean; comfortCount: number }) {
  const caption = body ? `身體：${slash(body.measuredOn)} 的量測（${beforePurchase ? '購買前最近一次' : '最近一次'}）・衣服：平放尺寸，圍度 ×2` : '身體：還沒有量測紀錄・衣服：平放尺寸，圍度 ×2'
  return (
    <PaperCard className="flex flex-col gap-3 p-4 md:px-[22px] md:py-5">
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
        <h2 className="m-0 font-hd text-[19px] md:text-[22px]">尺寸對照</h2>
        <span className="text-xs text-ink-2">{caption}</span>
        <span className="ml-auto hidden items-center gap-3.5 text-xs text-ink-2 md:flex">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-5 rounded-full bg-sage-soft" />
            你常穿的範圍
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-rose-deep" />
            這件
          </span>
        </span>
      </div>

      {!hasSizeComparison(item.slot) ? (
        <p className="m-0 text-sm text-ink-2">包包和配件不做尺寸對照。</p>
      ) : rows.length === 0 ? (
        <p className="m-0 text-sm leading-6 text-ink-2">
          這件還沒有填平放尺寸。
          <Link to={`/closet/${item.id}`}>到衣物詳細補上</Link>
          後，就能和身體、常穿衣物對照。
        </p>
      ) : (
        <>
          {/* 桌面：表格 */}
          <div role="table" aria-label="尺寸對照" className="hidden md:block">
            <div role="row" className="grid grid-cols-[64px_52px_96px_64px_minmax(160px,1fr)_70px] items-center gap-2.5 pb-2 text-xs text-ink-2">
              <span role="columnheader">部位</span>
              <span role="columnheader" className="text-right">這件</span>
              <span role="columnheader" className="text-right">我的身體</span>
              <span role="columnheader" className="text-right">差多少</span>
              <span role="columnheader" className="pl-2">和常穿的比</span>
              <span role="columnheader">判定</span>
            </div>
            {rows.map((row) => {
              const tone = judgeTone(row)
              return (
                <div key={row.part.label} role="row" className="grid min-h-[52px] grid-cols-[64px_52px_96px_64px_minmax(160px,1fr)_70px] items-center gap-2.5 border-t-[1.5px] border-dashed border-line text-sm">
                  <span role="cell" className="font-medium">{row.part.label}</span>
                  <span role="cell" className="text-right font-num tabular">{formatCm(row.item)}</span>
                  <span role="cell" className="text-right font-num text-ink-2 tabular">
                    {row.body != null ? `${row.part.bodyLabel ? `${row.part.bodyLabel} ` : ''}${formatCm(row.body)}` : '—'}
                  </span>
                  <span role="cell" className={`text-right font-num font-bold tabular ${tone.text}`}>
                    {row.part.body && row.metric != null ? formatSigned(row.metric) : '—'}
                  </span>
                  <span role="cell" className="pl-2">
                    <RangeBar row={row} />
                  </span>
                  <span role="cell">
                    <span className={`inline-flex h-[26px] items-center rounded-full px-2.5 text-xs font-medium ${tone.tag}`}>{judgeLabel(row)}</span>
                  </span>
                </div>
              )
            })}
          </div>

          {/* 手機：每個部位一張小卡 */}
          <ul className="m-0 flex list-none flex-col p-0 md:hidden" aria-label="尺寸對照">
            {rows.map((row) => {
              const tone = judgeTone(row)
              return (
                <li key={row.part.label} className="flex flex-col gap-1 border-t-[1.5px] border-dashed border-line py-2.5 first:border-t-0 first:pt-0">
                  <span className="flex items-center gap-2">
                    <span className="w-12 flex-none text-sm font-bold">{row.part.label}</span>
                    <span className="min-w-0 flex-1 truncate font-num text-xs text-ink-2 tabular">
                      這件 {formatCm(row.item)}・身體 {row.body != null ? formatCm(row.body) : '—'}
                    </span>
                    <span className={`font-num text-sm font-bold tabular ${tone.text}`}>{row.part.body && row.metric != null ? formatSigned(row.metric) : ''}</span>
                    <span className={`inline-flex h-6 items-center rounded-full px-2 text-xs font-medium ${tone.tag}`}>{judgeLabel(row)}</span>
                  </span>
                  <RangeBar row={row} />
                </li>
              )
            })}
          </ul>
        </>
      )}

      <p className="m-0 text-xs leading-5 text-ink-2">
        {comfortCount
          ? `「常穿的範圍」來自你留下且穿過 5 次以上的 ${comfortCount} 件${item.categoryName ?? '同類衣物'}；差多少＝這件 − 身體。`
          : `還沒有穿過 5 次以上的${item.categoryName ?? '同類衣物'}，所以沒有「常穿的範圍」可比；差多少＝這件 − 身體。`}
      </p>
    </PaperCard>
  )
}

async function fetchReviewPageData(id: string): Promise<PageData | null> {
  const [item, record, closet, profile, rules, categories, lessonItems, exchangedTo] = await Promise.all([
    fetchClosetItemDetail(id),
    fetchReviewForItem(id),
    fetchClosetItems(),
    fetchProfileData(),
    fetchLessonRules(),
    fetchCategories(),
    fetchLessonItems(),
    fetchExchangedTo(id),
  ])
  if (!item) return null
  const brands = [...new Set([...closet, ...lessonItems].map((entry) => entry.brand?.trim()).filter((brand): brand is string => !!brand))]
  return { item, record, closet, measurements: profile.measurements, rules, known: { brands, categories: categories.map((category) => category.name) }, exchangedTo }
}

export function ReviewPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [markOpen, setMarkOpen] = useState(false)
  const [ruleForm, setRuleForm] = useState<'new' | LessonRule | null>(null)
  const [confirm, setConfirm] = useState<{ kind: 'rule'; rule: LessonRule } | { kind: 'restore' } | null>(null)
  const [aiTab, setAiTab] = useState<'copy' | 'paste' | null>(null)
  const [toast, setToast] = useState<ToastMessage | null>(null)

  const [reloadKey, setReloadKey] = useState(0)
  const load = useCallback(() => setReloadKey((key) => key + 1), [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [id])

  useEffect(() => {
    let alive = true
    fetchReviewPageData(id)
      .then((next) => {
        if (!alive) return
        setData(next)
        setLoadError(null)
      })
      .catch((cause) => {
        if (alive) setLoadError(cause instanceof Error ? cause.message : '讀取覆盤失敗。')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [id, reloadKey])

  const context = useMemo(() => {
    if (!data) return null
    const { measurement, beforePurchase } = pickBodySnapshot(data.measurements, data.item.purchaseDate)
    const comfort = comfortItems(data.item, data.closet)
    const rows = buildSizeRows(data.item, measurement, comfort)
    return { item: data.item, rows, body: measurement, comfortCount: comfort.length, beforePurchase }
  }, [data])

  if (loading) {
    return (
      <main className="mx-auto max-w-[1240px] px-4 pt-6 pb-16 md:px-12">
        <LoadingState label="正在載入覆盤…" rows={4} />
      </main>
    )
  }
  if (loadError) {
    return (
      <main className="mx-auto max-w-[1240px] px-4 pt-6 pb-16 md:px-12">
        <PageState icon="alert" tone="rose" title="覆盤沒能載入" description={loadError} action={<Button variant="primary" onClick={() => { setLoadError(null); setLoading(true); load() }}>重新載入</Button>} />
      </main>
    )
  }
  if (!data || !context) {
    return (
      <main className="mx-auto max-w-[1240px] px-4 pt-6 pb-16 md:px-12">
        <PageState icon="closet" title="找不到這件衣物" description="可能已經刪除，或網址不正確。" action={<ButtonLink to="/closet/lessons" variant="primary">回踩雷筆記本</ButtonLink>} />
      </main>
    )
  }

  const { item, record } = data
  const reviewRules = record ? data.rules.filter((rule) => rule.sourceReviewId === record.id) : []
  const title = `${item.name}${item.size ? `・${item.size}` : ''}`
  const decisionDate = record?.decision === 'exchanged' ? record.exchangedOn : record?.returnedOn
  const decisionText = record ? `${DECISION_LABEL[record.decision]}${decisionDate ? `・${shortDate(decisionDate)}` : ''}` : ''
  const copyUrl = `/closet/new?from=${item.id}&reason=exchange`

  const patchRecord = (patch: Partial<ReviewRecord>) => setData((current) => (current && current.record ? { ...current, record: { ...current.record, ...patch } } : current))
  const upsertRule = (rule: LessonRule) =>
    setData((current) => (current ? { ...current, rules: current.rules.some((entry) => entry.id === rule.id) ? current.rules.map((entry) => (entry.id === rule.id ? rule : entry)) : [rule, ...current.rules] } : current))

  const saveFeeling = async (text: string) => {
    if (!record) return
    const personalNote = toLines(text)
    try {
      await updateReviewRecord(record.id, { personalNote })
      patchRecord({ personalNote })
      setToast({ tone: 'success', text: '已更新我的體感。' })
    } catch (cause) {
      setToast({ tone: 'error', text: cause instanceof Error ? cause.message : '我的體感沒能儲存。' })
      throw cause
    }
  }

  const toggleRule = async (rule: LessonRule, active: boolean) => {
    upsertRule({ ...rule, active })
    try {
      await saveLessonRule({ ...rule, active })
    } catch (cause) {
      upsertRule(rule)
      setToast({ tone: 'error', text: cause instanceof Error ? cause.message : '規則沒能更新。' })
    }
  }

  const submitRule = async (input: LessonRuleInput) => {
    const { rule } = await saveLessonRule(input)
    upsertRule(rule)
    setRuleForm(null)
    setToast({ tone: 'success', text: input.id ? '規則已更新。' : '已加入規則。' })
  }

  const confirmNow = async () => {
    if (!confirm) return
    try {
      if (confirm.kind === 'rule') {
        await deleteLessonRule(confirm.rule.id)
        setData((current) => (current ? { ...current, rules: current.rules.filter((rule) => rule.id !== confirm.rule.id) } : current))
        setToast({ tone: 'success', text: '已刪除規則。' })
      } else if (record) {
        await removeReviewRecord(record)
        navigate(`/closet/${item.id}`, { replace: true })
        return
      }
    } catch (cause) {
      setToast({ tone: 'error', text: cause instanceof Error ? cause.message : '操作沒有完成。' })
    }
    setConfirm(null)
  }

  /** 完成覆盤：內容都已隨時儲存，回到筆記本 */
  const finish = () => navigate('/closet/lessons', { state: { toast: `已完成「${item.name}」的覆盤。` } })

  /** 把 AI 回覆放進覆盤頁：原因變成便利貼、勾選的規則開始提醒 */
  const applyAi = async ({ reasons, rules }: { reasons: string[]; rules: RuleDraft[] }) => {
    if (!record) return
    const aiPastedAt = new Date().toISOString()
    await updateReviewRecord(record.id, { aiSummary: reasons, aiPastedAt })
    const saved: LessonRule[] = []
    for (const draft of rules) {
      const { rule } = await saveLessonRule({ scope: draft.scope, kind: draft.kind, checkKind: draft.checkKind, text: draft.condition, why: '來自 AI 覆盤', active: true, sourceReviewId: record.id })
      saved.push(rule)
    }
    patchRecord({ aiSummary: reasons, aiPastedAt })
    setData((current) => (current ? { ...current, rules: [...saved, ...current.rules] } : current))
    setAiTab(null)
    setToast({ tone: 'success', text: rules.length ? `已放進覆盤頁，加入 ${rules.length} 條規則。` : '已放進覆盤頁。' })
  }

  const ruleDefaults = {
    scope: item.brand ? `${item.brand}・${item.categoryName ?? '衣物'}` : `所有${item.categoryName ?? '衣物'}`,
    kind: item.brand ? ('brand' as const) : ('category' as const),
    sourceReviewId: record?.id,
  }

  return (
    <main className="mx-auto flex max-w-[1240px] flex-col gap-4 px-4 pt-2 pb-16 md:gap-[22px] md:px-[clamp(16px,4vw,48px)] md:pt-6">
      {/* 麵包屑（手機為返回列） */}
      <nav aria-label="麵包屑" className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-2">
        <Link to="/closet/lessons" className="inline-flex min-h-11 items-center gap-1 text-ink-2 no-underline hover:text-ink">
          <Icon name="back" size={16} />
          踩雷筆記本
        </Link>
        <span aria-hidden="true" className="hidden md:inline">/</span>
        <span className="hidden truncate md:inline">{item.name}</span>
      </nav>

      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
        <TiltLabel accent="rose" className="hidden md:inline-flex">踩雷覆盤</TiltLabel>
        <h1 className="m-0 min-w-0 font-hd text-[24px] leading-tight md:text-[30px]">{title}</h1>
        {record && (
          <span className={`inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ${DECISION_TAG[record.decision]}`}>
            <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
            <span className="font-num tabular">{decisionText}</span>
          </span>
        )}
        {record && (
          <div className="ml-auto hidden gap-2 md:flex">
            <Button variant="secondary" onClick={() => setMarkOpen(true)}>
              編輯原因
            </Button>
            <Button variant="primary" onClick={finish}>
              <Icon name="check" />
              完成覆盤
            </Button>
          </div>
        )}
      </div>

      {!record ? (
        <PageState
          icon="alert"
          tone="rose"
          title="這件還沒標記踩雷"
          description="標記後，衣物會移到踩雷筆記本，並對照你的尺寸整理原因與下次的挑選規則。"
          action={
            <>
              <ButtonLink to={`/closet/${item.id}`} variant="secondary">回衣物詳細</ButtonLink>
              <Button variant="primary" onClick={() => setMarkOpen(true)}>這件踩雷了</Button>
            </>
          }
        />
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 md:gap-7 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
          {/* 左側：衣物資料（手機為精簡卡） */}
          <aside aria-label="這件衣物" className="flex flex-col gap-3.5">
            <PaperCard className="hidden p-3.5 lg:block">
              <div className="relative flex aspect-square items-center justify-center rounded-tile bg-tile p-6">
                <ItemImage name={item.name} cutoutUrl={item.cutoutUrl} shape={item.shape} colorHex={item.colorHex} className="max-h-full max-w-full" />
                <span title="不會出現在衣櫃和搭配" className="absolute top-2.5 left-2.5 rounded-full bg-card/95 px-2.5 py-1 text-xs text-ink-2">只留在筆記本</span>
              </div>
            </PaperCard>
            <PaperCard className="flex items-center gap-3 p-3 lg:hidden">
              <span className="flex size-[72px] flex-none items-center justify-center rounded-btn bg-tile p-1.5">
                <ItemImage name={item.name} cutoutUrl={item.cutoutUrl} shape={item.shape} colorHex={item.colorHex} className="max-h-full max-w-full" />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5 text-[13px] text-ink-2">
                {item.brand && <span>{item.brand}</span>}
                {(item.materialComposition || item.material) && <span className="truncate">{item.materialComposition || item.material}</span>}
                {item.purchasePrice != null && <span className="font-num tabular">NT${item.purchasePrice.toLocaleString('zh-TW')}</span>}
              </span>
            </PaperCard>
            <PaperCard className="hidden px-5 py-1 lg:block">
              <dl className="m-0">
                {[
                  ['品牌', item.brand],
                  ['尺寸標', item.size],
                  ['材質', item.materialComposition || item.material],
                  ['購買通路', item.store],
                  ['價格', item.purchasePrice != null ? `NT$${item.purchasePrice.toLocaleString('zh-TW')}${record.decision === 'returned' ? '・已退款' : record.decision === 'exchanged' && record.exchangeExtra ? `・補差價 NT$${record.exchangeExtra.toLocaleString('zh-TW')}` : ''}` : undefined],
                  ['購買日', slash(item.purchaseDate)],
                ].map(([label, value], index) => (
                  <div key={label} className={`flex justify-between gap-3 py-[11px] text-[13px] ${index ? 'border-t-[1.5px] border-dashed border-line' : ''}`}>
                    <dt className="flex-none text-ink-2">{label}</dt>
                    <dd className={`m-0 text-right font-medium ${label === '價格' || label === '購買日' || label === '尺寸標' ? 'font-num tabular' : ''}`}>{value || '—'}</dd>
                  </div>
                ))}
              </dl>
            </PaperCard>
            <p className="m-0 hidden px-1 text-xs leading-6 text-ink-2 lg:block">照片、尺寸、材質都保留，只是不會出現在衣櫃、今日搭配和統計裡。</p>
            <div className="hidden flex-wrap gap-2 lg:flex">
              <ButtonLink to={`/closet/${item.id}`} variant="ghost" className="px-2">看衣物詳細</ButtonLink>
              <Button variant="ghost" className="px-2" onClick={() => setConfirm({ kind: 'restore' })}>不是踩雷，移回衣櫃</Button>
            </div>
          </aside>

          <div className="flex min-w-0 flex-col gap-4 md:gap-[22px]">
            {record.decision === 'exchanged' && (
              <div role="note" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-tile bg-oat-soft px-4 py-3 text-[13px] text-oat-ink">
                <Icon name="merge" size={18} />
                <span className="min-w-0 flex-1">
                  {data.exchangedTo ? (
                    <>
                      換成：
                      <Link to={`/closet/${data.exchangedTo.id}`} className="font-bold text-oat-ink">
                        {data.exchangedTo.name}
                        {data.exchangedTo.size && `・${data.exchangedTo.size}`}
                      </Link>
                    </>
                  ) : (
                    <>換貨{record.exchangeKind === 'size' && record.exchangeSize ? `成 ${record.exchangeSize}` : record.exchangeKind === 'color' && record.exchangeColorName ? `成${record.exchangeColorName}色` : ''}，換到的那件還沒建立。</>
                  )}
                </span>
                {!data.exchangedTo && (
                  <ButtonLink to={copyUrl} variant="oat" className="h-10">
                    建立換到的那件
                  </ButtonLink>
                )}
              </div>
            )}
            <PaperCard className="flex flex-col gap-3 p-4 md:px-[22px] md:py-5">
              <div className="flex items-center gap-2">
                <h2 className="m-0 font-hd text-[19px] md:text-[22px]">哪裡不對</h2>
                <Button variant="ghost" className="ml-auto h-11 px-2.5 md:hidden" onClick={() => setMarkOpen(true)}>
                  <Icon name="edit" size={16} />
                  編輯
                </Button>
              </div>
              {record.reasons.length ? (
                <div className="flex flex-wrap gap-2">
                  {record.reasons.map((reason) => {
                    const group = reasonGroup(reason)
                    return (
                      <span key={reason} className={`inline-flex h-[30px] items-center gap-1.5 rounded-full px-3 text-[13px] font-medium ${group === '尺寸' ? 'bg-rose-soft text-status-repair-fg' : 'bg-tile text-ink-2'}`}>
                        <span className="text-xs opacity-75">{group}</span>
                        {reason}
                      </span>
                    )
                  })}
                </div>
              ) : (
                <p className="m-0 text-sm text-ink-2">還沒選原因，按「編輯原因」補上。</p>
              )}
            </PaperCard>

            <SizeTable rows={context.rows} item={item} body={context.body} beforePurchase={context.beforePurchase} comfortCount={context.comfortCount} />

            <div className="grid items-start gap-6 pt-2 md:grid-cols-2">
              <StickyNote
                id={`feel-${record.id}`}
                tone="mist"
                variant="mixed"
                title="我的體感"
                headingLevel="h2"
                value={record.personalNote.map((line) => `- ${line}`).join('\n')}
                editable
                onSave={saveFeeling}
                placeholder="寫下穿上的感覺，例如哪裡緊、哪裡卡…"
              />
              {record.aiSummary.length ? (
                <div className="flex flex-col gap-1.5">
                  <StickyNote
                    id={`ai-${record.id}`}
                    tone="sage"
                    variant="mixed"
                    title="AI 覆盤"
                    headingLevel="h2"
                    badge="AI・參考用"
                    items={record.aiSummary}
                    footnote={record.aiPastedAt ? `${shortDate(toISODate(new Date(record.aiPastedAt)))} 從外部 AI 貼上` : '從外部 AI 貼上'}
                  />
                  <Button variant="ghost" className="self-end px-2.5 text-[13px]" onClick={() => setAiTab('copy')}>
                    重新問 AI
                  </Button>
                </div>
              ) : (
                <StickyNote id={`ai-${record.id}`} tone="sage" variant="mixed" title="AI 覆盤" headingLevel="h2" badge="AI・參考用" collapsible={false}>
                  <p className="m-0 mb-3.5 text-sm leading-6">還沒有內容。把資料複製給你常用的 AI，再把回覆貼回來。</p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button variant="primary" className="h-11" onClick={() => setAiTab('copy')}>
                      <Icon name="link" size={18} />
                      ① 複製資料給 AI
                    </Button>
                    <Button variant="secondary" className="h-11" onClick={() => setAiTab('paste')}>
                      <Icon name="chat" size={18} />
                      ② 貼上 AI 的回覆
                    </Button>
                  </div>
                  <p className="m-0 mt-3 text-xs leading-5">不想用 AI 也沒關係，規則可以自己加。</p>
                </StickyNote>
              )}
            </div>

            <PaperCard className="flex flex-col gap-2 p-4 md:px-[22px] md:py-5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="m-0 font-hd text-[19px] md:text-[22px]">下次的挑選規則</h2>
                <span className="text-xs text-ink-2">打開的規則，會在新增選購、比較試搭、新增衣物時提醒你</span>
              </div>
              {reviewRules.length === 0 && ruleForm === null && <p className="m-0 py-2 text-sm text-ink-2">這次還沒有規則。把學到的事寫成一條，下次挑選時就會想起來。</p>}
              <div className="flex flex-col">
                {reviewRules.map((rule) =>
                  ruleForm !== 'new' && ruleForm?.id === rule.id ? (
                    <LessonRuleForm key={rule.id} initial={rule} defaults={ruleDefaults} known={data.known} onSubmit={submitRule} onCancel={() => setRuleForm(null)} />
                  ) : (
                    <LessonRuleRow key={rule.id} rule={rule} onToggle={(next) => void toggleRule(rule, next)} onEdit={() => setRuleForm(rule)} onDelete={() => setConfirm({ kind: 'rule', rule })} />
                  ),
                )}
              </div>
              {ruleForm === 'new' ? (
                <LessonRuleForm defaults={ruleDefaults} known={data.known} onSubmit={submitRule} onCancel={() => setRuleForm(null)} />
              ) : (
                <Button variant="ghost" className="self-start px-2 !text-mist-deep" onClick={() => setRuleForm('new')}>
                  <Icon name="plus" size={18} />
                  自己加一條規則
                </Button>
              )}
            </PaperCard>

            {/* 手機：主要按鈕放在內容最後，避開底部分頁列 */}
            <div className="flex flex-col gap-2 md:hidden">
              <Button variant="primary" size="lg" className="w-full" onClick={finish}>
                <Icon name="check" />
                完成覆盤
              </Button>
              <div className="flex justify-center gap-2">
                <ButtonLink to={`/closet/${item.id}`} variant="ghost">看衣物詳細</ButtonLink>
                <Button variant="ghost" onClick={() => setConfirm({ kind: 'restore' })}>移回衣櫃</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {markOpen && (
        <ReviewMarkDialog
          item={item}
          record={record}
          onCancel={() => setMarkOpen(false)}
          onSaved={(saved, demo, next) => {
            setMarkOpen(false)
            if (next === 'exchange' && !data.exchangedTo) {
              navigate(copyUrl)
              return
            }
            setToast({ tone: 'success', text: demo ? '已儲存（示範資料）。' : record ? '已更新踩雷原因。' : '已移到踩雷筆記本。' })
            setData((current) => (current ? { ...current, record: saved } : current))
            load()
          }}
        />
      )}
      {aiTab && record && (
        <AiReviewDialog
          context={{ item, record, rows: context.rows, body: context.body, comfortCount: context.comfortCount }}
          known={data.known}
          initialTab={aiTab}
          onCancel={() => setAiTab(null)}
          onApply={applyAi}
        />
      )}
      {confirm && (
        <DestructiveActionDialog
          title={confirm.kind === 'rule' ? '刪除這條規則？' : '把這件移回衣櫃？'}
          description={confirm.kind === 'rule' ? `「${confirm.rule.text}」刪除後就不會再提醒。` : '這次的覆盤紀錄會刪除，衣物回到衣櫃、狀態改為「可穿」。已建立的挑選規則會保留在踩雷筆記本。'}
          confirmLabel={confirm.kind === 'rule' ? '刪除' : '移回衣櫃'}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void confirmNow()}
        />
      )}
      <Toast message={toast} onClose={() => setToast(null)} />
    </main>
  )
}
