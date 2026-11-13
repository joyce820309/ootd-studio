import { NavLink } from 'react-router-dom'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex h-10 items-center rounded-sm px-4 text-sm no-underline ${
    isActive ? 'bg-card font-bold text-ink shadow-sticker' : 'font-medium text-ink-2 hover:text-ink'
  }`

/** 選購清單的兩個分頁：清單／比較試搭台。目前頁面以白底與 aria-current 標示。 */
export function WishlistTabs({ className = '' }: { className?: string }) {
  return (
    <nav aria-label="選購清單分頁" className={`inline-flex rounded-btn bg-tile p-[3px] ${className}`}>
      <NavLink to="/wishlist" end className={tabClass}>清單</NavLink>
      <NavLink to="/wishlist/compare" className={tabClass}>比較試搭台</NavLink>
    </nav>
  )
}
