import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from './Button'
import { Icon } from './Icon'
import { TiltLabel } from './Paper'

/**
 * 便利貼 StickyNote（設計稿 B19：design/general/B-StickyNote.dc.html）
 *
 * - variant：hand 手帳字＋橫線（使用者自己寫的短筆記）／mixed 標題手帳字、內文圓體（數字、AI、長內容）／grid 白色方格紙＋膠帶標題
 * - tone：顏色＝內容的意思。mist 我寫的、sage AI 產生、rose 踩雷／警告、oat 提示／心情
 * - 一個畫面最多 2 張；AI 內容不要用 hand；不要用在表單、表格、錯誤訊息或主要按鈕上。
 */

export type StickyNoteVariant = 'hand' | 'mixed' | 'grid'
export type StickyNoteTone = 'mist' | 'sage' | 'rose' | 'oat'
export type StickyNoteTape = 'auto' | 'oat' | 'rose' | 'mist' | false
/** auto：手機用 sm、md 以上用 md；也可固定其中一種 */
export type StickyNoteSize = 'auto' | 'md' | 'sm'

export interface StickyNoteProps {
  variant?: StickyNoteVariant
  tone?: StickyNoteTone
  /** 標題（hand、mixed 寫在紙上；grid 變成膠帶標籤） */
  title: string
  /** 標題層級，依頁面結構調整 */
  headingLevel?: 'h2' | 'h3'
  /** 自訂內容；優先於 items / value */
  children?: ReactNode
  /** 給字串陣列會排成清單；支援 **粗體** */
  items?: string[]
  /** 純文字內容（可編輯時的原始文字）：「- 」開頭的行會變成清單 */
  value?: string
  /** auto 依 id 算角度；grid 與編輯中永遠不傾斜 */
  tilt?: 'auto' | 'none'
  /** 算傾斜角度與草稿 key 用，例如 item.id */
  id?: string
  /** 膠帶顏色；auto 會和 tone 錯開 */
  tape?: StickyNoteTape
  /** true＝hand 4 行、mixed 6 行；數字＝自訂行數；false 不收合 */
  collapsible?: boolean | number
  /** 右上角小字，例如「AI・參考用」 */
  badge?: string
  /** 底部小字，例如 AI 的依據 */
  footnote?: string
  /** 右上鉛筆；空的時候整張可點 */
  editable?: boolean
  onSave?: (text: string) => void | Promise<void>
  /** 空的時候顯示的提示 */
  placeholder?: string
  size?: StickyNoteSize
  className?: string
}

/* ── 尺寸 ──────────────────────────────────────────── */

/** 每一行的高度（px）：hand 17px／行高 32px；mixed 14px／行高 1.85 ≈ 26px */
const LINE_PX = { hand: 32, mixed: 26 } as const
const DEFAULT_LINES = { hand: 4, mixed: 6 } as const
const TILTS = [-0.8, -0.4, 0.4, 0.8] as const

/** 便利貼內距：桌面 28/22/26/24（B-StickyNote）；手機 26/16/22/18（B-M-Review） */
const PAD = {
  md: 'pt-7 pr-[22px] pb-[26px] pl-6',
  sm: 'pt-[26px] pr-4 pb-[22px] pl-[18px]',
  auto: 'pt-[26px] pr-4 pb-[22px] pl-[18px] md:pt-7 md:pr-[22px] md:pb-[26px] md:pl-6',
} as const
/** grid 方格紙內距：桌面 28/22/22 */
const GRID_PAD = {
  md: 'pt-7 px-[22px] pb-[22px]',
  sm: 'pt-[26px] px-4 pb-[18px]',
  auto: 'pt-[26px] px-4 pb-[18px] md:pt-7 md:px-[22px] md:pb-[22px]',
} as const
/** 膠帶：96×24，往上凸出 11px */
const TAPE_SIZE = {
  md: 'w-24 -ml-12',
  sm: 'w-20 -ml-10',
  auto: 'w-20 -ml-10 md:w-24 md:-ml-12',
} as const

const TAPE_BG = {
  oat: 'bg-note-tape-oat',
  rose: 'bg-note-tape-rose',
  mist: 'bg-note-tape-mist',
} as const
/** 膠帶 auto：和便利貼底色錯開 */
const AUTO_TAPE: Record<StickyNoteTone, 'oat' | 'rose' | 'mist'> = {
  mist: 'oat',
  sage: 'rose',
  rose: 'oat',
  oat: 'mist',
}
const LABEL_ACCENT: Record<StickyNoteTone, StickyNoteTone> = { mist: 'mist', sage: 'sage', rose: 'rose', oat: 'oat' }

/* ── 工具 ──────────────────────────────────────────── */

/** 依 id 算出固定角度，同一張每次打開都一樣 */
function stickyNoteTilt(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return TILTS[Math.abs(hash) % TILTS.length]
}

function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const pattern = /\*\*(.+?)\*\*/g
  let cursor = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text))) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index))
    parts.push(<b key={match.index} className="font-bold">{match[1]}</b>)
    cursor = match.index + match[0].length
  }
  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}

type Block = { kind: 'list'; lines: string[] } | { kind: 'p'; lines: string[] }

/** 「- 」或「* 」開頭的行變成清單，其餘為段落 */
function parseStickyText(value: string): Block[] {
  const blocks: Block[] = []
  for (const raw of value.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd()
    if (!line.trim()) continue
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line)
    const kind = bullet ? 'list' : 'p'
    const text = bullet ? bullet[1] : line
    const last = blocks[blocks.length - 1]
    if (last?.kind === kind) last.lines.push(text)
    else blocks.push({ kind, lines: [text] })
  }
  return blocks
}

function readDraft(key: string | null) {
  if (!key) return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}
function writeDraft(key: string | null, text: string | null) {
  if (!key) return
  try {
    if (text === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, text)
  } catch {
    /* 無痕模式等情況：草稿只是方便，失敗就略過 */
  }
}

/* ── 元件 ──────────────────────────────────────────── */

export function StickyNote({
  variant = 'mixed',
  tone = 'mist',
  title,
  headingLevel = 'h3',
  children,
  items,
  value,
  tilt = 'auto',
  id,
  tape = 'auto',
  collapsible = true,
  badge,
  footnote,
  editable = false,
  onSave,
  placeholder = '寫點什麼…',
  size = 'auto',
  className = '',
}: StickyNoteProps) {
  const headingId = useId()
  const textareaId = useId()
  const draftKey = editable && id ? `sticky-note-draft:${id}` : null

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const editButtonRef = useRef<HTMLButtonElement>(null)

  const blocks = children == null && !items?.length && value ? parseStickyText(value) : []
  const listCount = items?.length ?? blocks.reduce((sum, b) => sum + (b.kind === 'list' ? b.lines.length : 0), 0)
  const hasContent = children != null || Boolean(items?.length) || blocks.length > 0

  const isGrid = variant === 'grid'
  const lineVariant = variant === 'hand' ? 'hand' : 'mixed'
  const maxLines = collapsible === false || isGrid ? null : typeof collapsible === 'number' ? collapsible : DEFAULT_LINES[lineVariant]
  const maxHeight = maxLines ? maxLines * LINE_PX[lineVariant] : null
  const collapsed = maxHeight !== null && overflowing && !expanded

  const angle = tilt === 'none' || isGrid || editing ? 0 : stickyNoteTilt(id ?? title)
  const tapeTone = tape === 'auto' ? AUTO_TAPE[tone] : tape
  const Heading = headingLevel

  // 量測內容是否超過收合行數
  useLayoutEffect(() => {
    const el = bodyRef.current
    if (!el || maxHeight === null) return
    const measure = () => setOverflowing(el.scrollHeight > maxHeight + 2)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [maxHeight, value, items, children])

  // 編輯中自動存草稿
  useEffect(() => {
    if (editing) writeDraft(draftKey, draft)
  }, [editing, draft, draftKey])

  useEffect(() => {
    if (editing) textareaRef.current?.focus()
  }, [editing])

  const startEdit = () => {
    setDraft(readDraft(draftKey) ?? value ?? (items ? items.map((t) => `- ${t}`).join('\n') : ''))
    setEditing(true)
  }
  const cancelEdit = () => {
    writeDraft(draftKey, null)
    setEditing(false)
    requestAnimationFrame(() => editButtonRef.current?.focus())
  }
  const save = async () => {
    setSaving(true)
    try {
      await onSave?.(draft.trim())
      writeDraft(draftKey, null)
      setEditing(false)
    } catch {
      /* 儲存失敗：留在編輯中，草稿保留；錯誤訊息由 onSave 的呼叫端顯示 */
    } finally {
      setSaving(false)
    }
  }

  /* ── 內容 ── */
  const textClass =
    variant === 'mixed' ? 'text-sm leading-[1.85] text-(--note-text)' : 'font-hd text-[17px] leading-8 text-(--note-text)'
  const listClass = `sticky-note__list m-0 flex list-none flex-col p-0 ${
    variant === 'mixed' ? 'sticky-note__list--mixed gap-1.5' : 'sticky-note__list--hand'
  }`

  const renderLines = (lines: string[]) => (
    <ul className={listClass}>
      {lines.map((line, i) => (
        <li key={i}>{renderInline(line)}</li>
      ))}
    </ul>
  )

  const content =
    children ??
    (items?.length ? (
      renderLines(items)
    ) : (
      <div className={variant === 'mixed' ? 'flex flex-col gap-1.5' : ''}>
        {blocks.map((block, i) =>
          block.kind === 'list' ? (
            <div key={i}>{renderLines(block.lines)}</div>
          ) : (
            <p key={i} className="m-0">
              {block.lines.map((line, j) => (
                <span key={j}>
                  {j > 0 && <br />}
                  {renderInline(line)}
                </span>
              ))}
            </p>
          ),
        )}
      </div>
    ))

  const body = (
    <div
      id={`${headingId}-body`}
      ref={bodyRef}
      className={`relative min-w-0 break-words [overflow-wrap:anywhere] ${textClass} ${collapsed ? 'overflow-hidden' : ''}`}
      style={collapsed && maxHeight ? { maxHeight } : undefined}
    >
      {content}
      {collapsed && <span aria-hidden="true" className="sticky-note__fade pointer-events-none absolute inset-x-0 bottom-0 h-12" />}
    </div>
  )

  const expandButton =
    maxHeight !== null && overflowing ? (
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={`${headingId}-body`}
        onClick={() => setExpanded((v) => !v)}
        className="mt-1.5 h-10 rounded-btn border-0 bg-card/70 px-3 text-[13px] font-medium text-(--note-title) hover:bg-card"
      >
        {expanded ? (
          '收合'
        ) : listCount > 0 ? (
          <>
            展開全部 <span className="font-num tabular">{listCount}</span> 則
          </>
        ) : (
          '展開全部'
        )}
      </button>
    ) : null

  /* ── grid：方格紙＋膠帶標題，不傾斜、不收合 ── */
  if (isGrid) {
    return (
      <section aria-labelledby={headingId} className={`flex min-w-0 flex-col ${className}`}>
        <TiltLabel as={headingLevel} accent={LABEL_ACCENT[tone]} className="relative z-[1] -mb-2.5 ml-3.5">
          <span id={headingId}>{title}</span>
        </TiltLabel>
        <div data-tone={tone} className={`sticky-note sticky-note--grid relative rounded-card shadow-paper ${GRID_PAD[size]}`}>
          <div className="font-hd text-[17px] leading-8 text-ink">{hasContent ? content : <span className="text-ink-2">{placeholder}</span>}</div>
        </div>
      </section>
    )
  }

  const shell = `sticky-note relative block w-full min-w-0 rounded-tag text-left shadow-note transition-transform duration-200 ${PAD[size]} ${className}`
  const tapeEl =
    tapeTone !== false ? (
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute left-1/2 -top-[11px] h-6 shadow-[0_1px_2px_rgb(59_47_37/0.08)] ${TAPE_SIZE[size]} ${TAPE_BG[tapeTone]}`}
        style={{ rotate: angle > 0 ? '2deg' : '-3deg' }}
      />
    ) : null
  const fold = <span aria-hidden="true" className="sticky-note__fold pointer-events-none absolute right-0 bottom-0 size-[26px] rounded-bl-[4px]" />

  /* ── 空的：整張是按鈕 ── */
  if (!hasContent && editable && !editing) {
    return (
      <button
        type="button"
        data-tone={tone}
        data-empty=""
        onClick={startEdit}
        className={`${shell} border-0 font-sans`}
        style={{ rotate: `${angle / 1.5}deg` }}
      >
        {tapeEl && <span className="opacity-70">{tapeEl}</span>}
        <span className="block font-hd text-[22px] leading-8 text-(--note-title)">{title}</span>
        <span className="flex items-center gap-2 font-hd text-[17px] leading-8 text-(--note-accent)">
          <Icon name="edit" />
          {placeholder}
        </span>
        {fold}
      </button>
    )
  }

  /* ── 編輯中：轉正，方便打字 ── */
  if (editing) {
    return (
      <section data-tone={tone} aria-labelledby={headingId} className={shell}>
        {tapeEl}
        <div className="flex flex-col gap-2">
          <label id={headingId} htmlFor={textareaId} className="font-hd text-[22px] leading-8 text-(--note-title)">
            {title}
          </label>
          <textarea
            id={textareaId}
            ref={textareaRef}
            rows={4}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancelEdit()
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void save()
            }}
            aria-describedby={`${textareaId}-hint`}
            className="min-h-28 w-full resize-y rounded-btn border-[1.5px] border-(--note-edge) bg-card px-2.5 py-2 text-sm leading-[1.7] text-ink"
          />
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span id={`${textareaId}-hint`} className="min-w-0 flex-1 text-xs text-(--note-accent)">
            「- 」開頭會變成清單
          </span>
          <Button variant="ghost" className="h-10! px-2.5! text-(--note-title)!" onClick={cancelEdit} disabled={saving}>
            取消
          </Button>
          <Button variant="primary" className="h-10! px-3.5!" onClick={() => void save()} disabled={saving}>
            {saving ? '儲存中…' : '儲存'}
          </Button>
        </div>
      </section>
    )
  }

  /* ── 一般顯示 ── */
  return (
    <section
      data-tone={tone}
      aria-labelledby={headingId}
      className={`${shell} ${variant === 'hand' ? 'sticky-note--ruled' : ''}`}
      style={{ rotate: `${angle}deg` }}
    >
      {tapeEl}
      {badge && (
        <span
          className={`absolute top-4 font-num text-xs font-bold tracking-[.14em] text-(--note-accent) ${editable ? 'right-14' : 'right-3.5'}`}
        >
          {badge}
        </span>
      )}
      {editable && (
        <button
          ref={editButtonRef}
          type="button"
          aria-label={`編輯${title}`}
          onClick={startEdit}
          className="absolute top-2 right-2 inline-flex size-11 items-center justify-center rounded-btn border-0 bg-transparent text-(--note-title) hover:bg-card/60"
        >
          <Icon name="edit" />
        </button>
      )}
      <Heading
        id={headingId}
        className={`m-0 font-hd text-[22px] leading-8 font-normal text-(--note-title) ${variant === 'mixed' ? 'mb-2' : ''} ${
          editable || badge ? 'pr-12' : ''
        }`}
      >
        {title}
      </Heading>
      {hasContent ? body : <p className="m-0 text-sm text-ink-2">{placeholder}</p>}
      {expandButton}
      {footnote && <span className="mt-2 block text-xs text-(--note-accent)">{footnote}</span>}
      {fold}
    </section>
  )
}
