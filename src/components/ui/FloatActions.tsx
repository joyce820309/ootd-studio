import { useEffect, useRef, useState } from 'react'
import './FloatActions.css'

interface FloatActionsProps {
  /** 頁面有收起的區塊時才傳；count 為 0 時不顯示展開鈕 */
  fold?: { open: boolean; count: number; onToggle: () => void; controls?: string }
  /** 採購籃件數；0 時不顯示採購籃鈕 */
  basket?: { qty: number; onOpen: () => void }
  /** 打開抽屜、預覽或對話框時整組藏起來 */
  hidden?: boolean
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** 頁面上第一個看得到的 h1（桌機與手機各有一個標題時，另一個會被 display:none） */
function focusPageHeading() {
  const heading = [...document.querySelectorAll<HTMLElement>('main h1')].find((element) => element.getClientRects().length > 0)
  if (!heading) return
  if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
  heading.focus({ preventScroll: true })
}

/** 往下捲超過一個視窗高度才算「離頂端很遠」 */
function useScrolledPastViewport() {
  const [past, setPast] = useState(false)
  useEffect(() => {
    let frame = 0
    const update = () => { frame = 0; setPast(window.scrollY > window.innerHeight) }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [])
  return past
}

/**
 * B26 右下角懸浮按鈕組：由上到下為回到頂端、展開／收起、採購籃。
 * 只放圖示；提示文字只是視覺輔助（aria-hidden），觸控裝置不顯示。
 * 手機以 CSS 變數 --float-actions-bottom 讓開底部操作列。
 */
export function FloatActions({ fold, basket, hidden = false }: FloatActionsProps) {
  const pastViewport = useScrolledPastViewport()
  const topRef = useRef<HTMLButtonElement>(null)
  const showFold = !!fold && fold.count > 0
  const showBasket = !!basket && basket.qty > 0

  // 鍵盤停在「回到頂端」時按 Home 捲回頂端，按鈕消失前把焦點交給頁面標題，避免掉回 body
  useEffect(() => {
    if (!pastViewport && topRef.current === document.activeElement) focusPageHeading()
  }, [pastViewport])

  if (hidden || (!pastViewport && !showFold && !showBasket)) return null

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' })
    focusPageHeading()
  }

  return (
    <div className="float-actions">
      {pastViewport && (
        <button ref={topRef} type="button" className="float-actions__button float-actions__button--top" aria-label="回到頂端" onClick={scrollToTop}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h12M12 19V9M7 13l5-5 5 5" /></svg>
          <span className="float-actions__tip" aria-hidden="true">回到頂端</span>
        </button>
      )}
      {showFold && (
        <button
          type="button"
          className="float-actions__button float-actions__button--fold"
          aria-expanded={fold.open}
          aria-controls={fold.controls}
          aria-label={fold.open ? '收起後面幾區' : `展開其餘 ${fold.count} 區`}
          onClick={fold.onToggle}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={fold.open ? 'M7 17l5-5 5 5M7 11l5-5 5 5' : 'M7 7l5 5 5-5M7 13l5 5 5-5'} /></svg>
          <span className="float-actions__tip" aria-hidden="true">{fold.open ? '收起後面幾區' : `展開其餘 ${fold.count} 區`}</span>
        </button>
      )}
      {showBasket && (
        <button type="button" className="float-actions__button float-actions__button--basket" aria-haspopup="dialog" aria-label={`打開採購籃，${basket.qty} 件`} onClick={basket.onOpen}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16l-1.5 11h-13zM9 8V6a3 3 0 0 1 6 0v2" /></svg>
          <span className="float-actions__badge" aria-hidden="true">{basket.qty}</span>
          <span className="float-actions__tip" aria-hidden="true">採購籃・{basket.qty} 件</span>
        </button>
      )}
    </div>
  )
}
