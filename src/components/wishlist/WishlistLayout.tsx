import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Outlet } from 'react-router-dom'
import { TiltLabel } from '@/components/ui/Paper'
import { WishlistTabs } from '@/components/wishlist/WishlistTabs'
import './WishlistLayout.css'

interface BarOptions {
  /** 手機不顯示共用頁首（頁面有自己的手機頁首時） */
  mobileHidden?: boolean
  /** 桌機右側抽屜開著，整頁讓出右邊 */
  sidePanel?: boolean
}

interface BarContextValue {
  slot: HTMLElement | null
  setOptions: (options: BarOptions) => void
}

const BarContext = createContext<BarContextValue | null>(null)

/**
 * 選購清單／比較共用外框：頁首（標題＋分頁）固定不重繪，切換分頁時只換頁首右側內容與下方頁面。
 * 各頁用 <WishlistBar> 把自己的頁首控制項放進來。
 */
export function WishlistLayout() {
  const [slot, setSlot] = useState<HTMLDivElement | null>(null)
  const [options, setOptions] = useState<BarOptions>({})
  const value = useMemo(() => ({ slot, setOptions }), [slot])
  return (
    <main className={`wishlist-shell ${options.sidePanel ? 'has-side-panel' : ''}`}>
      <header className={`wishlist-bar ${options.mobileHidden ? 'is-mobile-hidden' : ''}`}>
        <TiltLabel accent="rose" as="h1">選購清單</TiltLabel>
        <WishlistTabs />
        <div ref={setSlot} className="wishlist-bar__slot" />
      </header>
      <BarContext.Provider value={value}>
        <Outlet />
      </BarContext.Provider>
    </main>
  )
}

/** 把頁面專屬的頁首控制項放進共用頁首（分頁右側） */
export function WishlistBar({ children, mobileHidden = false, sidePanel = false }: BarOptions & { children: ReactNode }) {
  const context = useContext(BarContext)
  const setOptions = context?.setOptions
  useLayoutEffect(() => {
    setOptions?.({ mobileHidden, sidePanel })
    return () => setOptions?.({})
  }, [setOptions, mobileHidden, sidePanel])
  return context?.slot ? createPortal(children, context.slot) : null
}
