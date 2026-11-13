import { useId, type ReactNode } from 'react'
import { Button } from './Button'
import { Icon } from './Icon'
import { PageState } from './PageState'
import { PaperCard, WashBlob } from './Paper'

type ProgressFile = { id: string; name: string; progress: number; status?: string }
type ActiveFilter = { id: string; label: string }

/** B10-01：首次使用、衣櫃尚無衣物。 */
export function EmptyClosetState({ onAdd }: { onAdd: () => void }) {
  return <PageState icon="closet" tone="oat" title="衣櫃還是空的" description="先放進第一件衣物吧，從最常穿的那件開始。" action={<Button variant="primary" onClick={onAdd}>加入第一件衣物</Button>} />
}

/** B10-02：多張照片上傳進度，可用於背景上傳佇列。 */
export function ImageUploadProgressState({ files, title = '正在上傳照片', backgroundNote }: { files: ProgressFile[]; title?: string; backgroundNote?: string }) {
  return (
    <PaperCard className="space-y-4 p-5" aria-label={title}>
      <h2 className="m-0 font-hd text-xl">{title}</h2>
      <ul className="m-0 space-y-3 p-0">
        {files.map((file) => {
          const progress = Math.max(0, Math.min(100, file.progress))
          const complete = progress === 100
          return (
            <li key={file.id} className="flex list-none items-center gap-3">
              <span aria-hidden="true" className={`h-12 w-10 flex-none rounded-sm ${complete ? 'bg-sage-soft' : 'bg-tile'}`} />
              <span className="min-w-0 flex-1">
                <span className="mb-1 flex justify-between gap-2 text-xs text-ink-2"><span className="truncate">{file.name}</span><span className="font-num">{file.status ?? (complete ? '完成' : `${progress}%`)}</span></span>
                <span role="progressbar" aria-label={`${file.name} 上傳進度`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} className="block h-1.5 overflow-hidden rounded-full bg-line"><span className={`block h-full rounded-full ${complete ? 'bg-sage-deep' : 'bg-ink'}`} style={{ width: `${progress}%` }} /></span>
              </span>
            </li>
          )
        })}
      </ul>
      {backgroundNote && <p className="m-0 text-xs leading-5 text-ink-2">{backgroundNote}</p>}
    </PaperCard>
  )
}

/** B10-03：圖片去背處理中；進度可未知，仍可離開處理畫面。 */
export function CutoutProcessingState({ progress, onContinue }: { progress?: number; onContinue?: () => void }) {
  const value = progress === undefined ? undefined : Math.max(0, Math.min(100, progress))
  return (
    <PaperCard aria-busy="true" className="flex flex-col items-center gap-3 p-6 text-center">
      <span aria-hidden="true" className="relative flex h-32 w-28 items-center justify-center overflow-hidden rounded-tile bg-tile">
        <Icon name="closet" size={52} className="text-rose-deep" />
        <span className="absolute inset-x-0 top-0 h-1/2 animate-pulse border-b-2 border-dashed border-card bg-paper/70" />
      </span>
      <h2 className="m-0 font-hd text-xl">正在幫你剪下衣服</h2>
      <div role="progressbar" aria-label="去背進度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} className="h-1.5 w-48 overflow-hidden rounded-full bg-line">
        <span className={`block h-full rounded-full bg-sage-deep ${value === undefined ? 'w-2/5 animate-pulse' : ''}`} style={value === undefined ? undefined : { width: `${value}%` }} />
      </div>
      {value !== undefined && <span className="font-num text-xs text-ink-2">{value}%</span>}
      {onContinue && <Button variant="ghost" className="text-mist-deep underline" onClick={onContinue}>先填資料，不用等</Button>}
    </PaperCard>
  )
}

/** B10-04：去背失敗，但原始照片仍可使用。 */
export function CutoutFailureState({ message = '衣服和背景顏色太接近時常會這樣。可以重試、直接用原圖，或晚點再處理。', onRetry, onUseOriginal }: { message?: string; onRetry: () => void; onUseOriginal: () => void }) {
  return <PageState icon="alert" tone="rose" title="這張沒剪好" description={message} action={<><Button variant="secondary" onClick={onRetry}>重新去背</Button><Button variant="primary" onClick={onUseOriginal}>使用原圖</Button></>} />
}

/** B10-05：離線提示。只有傳入 queuedCount 時才顯示待同步數量，避免誤稱已排入佇列。 */
export function OfflineState({ queuedCount, description = '目前離線。請先確認連線；尚未同步的變更仍以目前頁面的儲存狀態為準。' }: { queuedCount?: number; description?: string }) {
  return (
    <section role="status" className="overflow-hidden rounded-card bg-ink text-paper shadow-paper">
      <div className="flex items-center gap-2.5 px-4 py-3 text-sm font-medium"><Icon name="alert" size={18} />目前離線・仍可瀏覽</div>
      <div className="flex flex-col items-center gap-3 bg-card px-5 py-5 text-center text-ink">
        <p className="m-0 max-w-md text-sm leading-6 text-ink-2">{description}</p>
        {queuedCount !== undefined && <span className="rounded-full bg-oat-soft px-3 py-1 text-xs text-oat-ink">{queuedCount} 筆變更等待同步</span>}
        <span className="text-xs text-ink-2">去背、網址解析與 AI 需要連線。</span>
      </div>
    </section>
  )
}

/** B10-06：儲存成功提示，可提供可選的「查看」操作。 */
export function SaveSuccessState({ message = '已儲存完成', onView, viewLabel = '查看' }: { message?: string; onView?: () => void; viewLabel?: string }) {
  return (
    <div role="status" className="flex items-center gap-2.5 rounded-tile bg-ink px-3.5 py-3 text-sm text-paper shadow-paper">
      <span className="flex size-[22px] flex-none items-center justify-center rounded-full bg-sage text-sage-ink"><Icon name="check" size={14} /></span>
      <span className="flex-1">{message}</span>
      {onView && <button type="button" onClick={onView} className="min-h-9 rounded-sm px-2 text-oat">{viewLabel}</button>}
    </div>
  )
}

/** B10-07：儲存失敗時保留畫面資料，提供重試與查看草稿操作。 */
export function SaveFailureState({ message = '內容已保留成草稿，不會不見。連線穩定後再試一次。', onRetry, onViewDraft }: { message?: string; onRetry: () => void; onViewDraft?: () => void }) {
  return (
    <section role="alert" className="flex flex-col gap-2 rounded-tile border-[1.5px] border-rose-edge bg-rose-soft p-3.5 text-rose-ink">
      <h2 className="m-0 text-sm font-bold">沒有存成功</h2>
      <p className="m-0 text-xs leading-5">{message}</p>
      <div className="flex flex-wrap gap-2"><Button variant="primary" className="h-9" onClick={onRetry}>重試</Button>{onViewDraft && <Button variant="ghost" className="h-9 text-rose-ink" onClick={onViewDraft}>看草稿</Button>}</div>
    </section>
  )
}

/** B10-08：搜尋為零筆，可點建議字詞快速替換搜尋字。 */
export function NoSearchResultsState({ query, suggestions = [], onSuggestion, onOpenCompare }: { query: string; suggestions?: string[]; onSuggestion?: (value: string) => void; onOpenCompare?: () => void }) {
  return (
    <PageState icon="search" tone="mist" title={`找不到「${query}」`} description="試試更短的關鍵字，或搜尋顏色、品牌。" action={onOpenCompare && <Button variant="secondary" onClick={onOpenCompare}>在網路上找？加到比較試搭台</Button>}>
      {suggestions.map((suggestion) => <Button key={suggestion} variant="secondary" className="h-9 rounded-full px-3" onClick={() => onSuggestion?.(suggestion)}>{suggestion}</Button>)}
    </PageState>
  )
}

/** B10-09：篩選結果為零，列出目前條件供逐一移除。 */
export function NoFilteredItemsState({ filters, onRemoveFilter }: { filters: ActiveFilter[]; onRemoveFilter: (id: string) => void }) {
  return (
    <PageState icon="search" tone="sage" title="這個組合沒有衣物" description={`目前符合 ${filters.map((filter) => filter.label).join(' × ') || '目前條件'} 的衣物為 0 件，拿掉一個條件看看。`}>
      {filters.map((filter) => <Button key={filter.id} variant="secondary" className="h-9 rounded-full px-3" onClick={() => onRemoveFilter(filter.id)}>{filter.label} ×</Button>)}
    </PageState>
  )
}

/** B10-10：AI 分析等待中，使用骨架並提供取消操作。 */
export function AiThinkingState({ status = '正在整理搭配建議…', onCancel }: { status?: string; onCancel?: () => void }) {
  return (
    <section aria-busy="true" className="flex flex-col gap-3 rounded-card bg-sage-soft p-4 text-sage-ink">
      <p role="status" className="m-0 flex items-center gap-2 text-sm"><span aria-hidden="true" className="flex gap-1"><i className="size-1.5 animate-pulse rounded-full bg-sage-deep" /><i className="size-1.5 animate-pulse rounded-full bg-sage-deep/60" /><i className="size-1.5 animate-pulse rounded-full bg-sage-deep/30" /></span>{status}</p>
      <span aria-hidden="true" className="h-4 w-3/5 animate-pulse rounded-sm bg-card" />
      <span aria-hidden="true" className="grid grid-cols-4 gap-1.5">{Array.from({ length: 4 }, (_, index) => <i key={index} className="aspect-square animate-pulse rounded-tile bg-card" />)}</span>
      <span aria-hidden="true" className="h-2 animate-pulse rounded-sm bg-card" />
      {onCancel && <Button variant="secondary" className="self-start" onClick={onCancel}>停止</Button>}
    </section>
  )
}

/** B10-11：AI 暫時找不到搭配，提供放寬條件或納入選購清單的操作。 */
export function AiNoOutfitState({ condition, detail, onRelax, onIncludeWishlist }: { condition: string; detail: string; onRelax: () => void; onIncludeWishlist: () => void }) {
  return <PageState icon="chat" tone="sage" title="這次沒搭出合適的" description={`「${condition}」下，${detail}。放寬一個條件，或也考慮選購清單？`} action={<><Button variant="secondary" onClick={onRelax}>放寬條件</Button><Button variant="primary" onClick={onIncludeWishlist}>包含想買的</Button></>} />
}

/** B10-12：衣物圖片失敗，固定保留圖片比例和名稱，允許重試。 */
export function ImageLoadFailureState({ name, onRetry }: { name: string; onRetry: () => void }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div role="img" aria-label={`${name}圖片載入失敗`} className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-tile bg-tile text-ink-2">
        <Icon name="alert" size={28} />
        <Button variant="secondary" className="h-9 text-xs" onClick={onRetry}>重新載入</Button>
      </div>
      <span className="truncate text-[13px] font-medium">{name}</span>
    </div>
  )
}

/** B10-13：破壞性操作確認；內容、封存與刪除動作由呼叫端決定。 */
export function DestructiveActionDialog({ title, description, cancelLabel = '取消', secondaryAction, confirmLabel = '刪除', onCancel, onConfirm }: { title: string; description: string; cancelLabel?: string; secondaryAction?: { label: string; onClick: () => void }; confirmLabel?: string; onCancel: () => void; onConfirm: () => void }) {
  const titleId = useId()
  const descriptionId = useId()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}>
      <section role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} onKeyDown={(event) => { if (event.key === 'Escape') onCancel() }} className="w-full max-w-lg space-y-3 rounded-block bg-card p-5 shadow-float sm:p-6">
        <h2 id={titleId} className="m-0 font-hd text-xl">{title}</h2>
        <p id={descriptionId} className="m-0 text-sm leading-6 text-ink-2">{description}</p>
        <div className="flex flex-wrap justify-end gap-2"><Button variant="ghost" onClick={onCancel}>{cancelLabel}</Button>{secondaryAction && <Button variant="secondary" onClick={secondaryAction.onClick}>{secondaryAction.label}</Button>}<Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button></div>
      </section>
    </div>
  )
}

/** B10-14：可選填體態提示，允許略過當次建議。 */
export function NoBodyMeasurementsState({ onFill, onSkip }: { onFill: () => void; onSkip: () => void }) {
  return (
    <section className="relative overflow-hidden rounded-card bg-mist-soft p-5 text-left text-mist-ink">
      <WashBlob accent="oat" className="-right-5 -top-5 size-20" tilt={12} />
      <h2 className="relative m-0 text-[15px] font-bold">想讓尺寸建議更貼近你嗎？</h2>
      <p className="relative mb-3 mt-2 text-[13px] leading-6">只要身高和常穿尺寸兩項，就能比對合不合身。其他都可以不填。</p>
      <div className="relative flex flex-wrap gap-2"><Button variant="primary" onClick={onFill}>填兩項就好</Button><Button variant="ghost" className="text-mist-ink" onClick={onSkip}>這次先不用</Button></div>
    </section>
  )
}

/** B10-15：商品網址無法解析，提供改用圖片或手動填寫的出口。 */
export function ProductUrlFailureState({ onChooseImage, onManualEntry }: { onChooseImage: () => void; onManualEntry: () => void }) {
  return <PageState icon="link" tone="rose" title="讀不到這個商品頁" description="有些網站不開放讀取。可以選擇商品截圖，或手動填名稱和價格。" action={<><Button variant="secondary" onClick={onChooseImage}>選擇商品截圖</Button><Button variant="primary" onClick={onManualEntry}>手動填寫</Button></>} />
}

/** B10-16：必選部位未完成，列出缺少項目並提供直接回到搭配編輯的操作。 */
export function MissingRequiredSlotsState({ missing, onChoose }: { missing: string[]; onChoose: () => void }) {
  return (
    <PaperCard role="alert" className="space-y-3 p-4">
      <h2 className="m-0 font-hd text-lg">搭配還缺必選部位</h2>
      <p className="m-0 text-sm leading-6 text-ink-2">選好{missing.join('和')}就能儲存，外套與配件可以略過。</p>
      <div className="flex flex-wrap gap-2">{missing.map((item) => <span key={item} className="rounded-sm border-[1.5px] border-dashed border-rose-deep px-3 py-2 text-xs text-rose-ink">缺{item}</span>)}</div>
      <Button variant="oat" onClick={onChoose}>去選{missing[0]}</Button>
    </PaperCard>
  )
}

/** 可與任意狀態卡共用的補充說明容器。 */
export function StateNote({ children }: { children: ReactNode }) {
  return <p className="m-0 text-xs leading-5 text-ink-2">{children}</p>
}
