import './FloatToggle.css'

interface FloatToggleProps {
  /** 收起的區塊是否已展開 */
  open: boolean
  /** 可收起的區塊數；0 時不顯示 */
  count: number
  onToggle: () => void
  /** 被收起區塊的容器 id（aria-controls） */
  controls?: string
  /** 手機用較短的文字（「展開」） */
  compact?: boolean
}

/**
 * B26 懸浮展開鈕：固定在畫面右下角，一次展開／收起頁面裡所有可收起的區塊。
 * 位置、留白由 FloatToggle.css 與使用頁面處理；手機以 --float-toggle-bottom 讓開底部操作列。
 */
export function FloatToggle({ open, count, onToggle, controls, compact = false }: FloatToggleProps) {
  if (count <= 0) return null
  return (
    <button
      type="button"
      className="float-toggle"
      aria-expanded={open}
      aria-controls={controls}
      aria-label={open ? '收起後面幾區' : `展開其餘 ${count} 區`}
      onClick={onToggle}
    >
      <span className="float-toggle__tape" aria-hidden="true" />
      <span className="float-toggle__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d={open ? 'M7 17l5-5 5 5M7 11l5-5 5 5' : 'M7 7l5 5 5-5M7 13l5 5 5-5'} /></svg>
      </span>
      <span>{open ? '收起' : compact ? '展開' : '展開全部'}</span>
      {!open && <span className="float-toggle__count" aria-hidden="true">{count}</span>}
    </button>
  )
}
