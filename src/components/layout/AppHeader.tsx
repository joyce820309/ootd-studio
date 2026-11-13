import { Link, NavLink } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { LogoSticker } from '@/components/ui/Paper'

const NAV = [
  { to: '/home', label: '首頁' },
  { to: '/closet', label: '我的衣櫃' },
  { to: '/outfit', label: '今日搭配' },
  { to: '/studio', label: '搭配工作台' },
  { to: '/diary', label: '穿搭日記' },
  { to: '/wishlist', label: '選購清單' },
] as const

/** 桌面 header：紙色背景＋虛線收邊，燕麥色只出現在 Logo 貼紙與目前頁面底線。 */
export function AppHeader() {
  return (
    <header className="hidden flex-wrap items-center gap-4 border-b-[1.5px] border-dashed border-line-strong bg-paper px-[clamp(16px,3vw,32px)] pt-3 md:flex">
      <Link to="/home" className="flex items-center gap-2.5 pb-3 no-underline">
        <LogoSticker />
        <span className="font-num text-[10px] font-bold tracking-[0.2em] text-ink-3">OOTD STUDIO</span>
      </Link>
      <nav aria-label="主要導覽" className="mx-auto flex flex-wrap gap-0.5">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              `inline-flex h-[50px] items-center border-b-4 px-3 text-[15px] no-underline ${
                isActive ? 'border-oat font-bold text-ink' : 'border-transparent font-medium text-ink-2 hover:border-line hover:text-ink'
              }`
            }
          >
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="flex items-center gap-1 pb-2.5">
        <button type="button" aria-label="通知" className="inline-flex size-11 items-center justify-center rounded-btn text-ink-2 hover:bg-tile">
          <Icon name="bell" />
        </button>
        <Link to="/me" aria-label="個人資料" className="flex size-11 items-center justify-center no-underline">
          <span className="flex size-[34px] items-center justify-center rounded-full border-[1.5px] border-ink bg-card font-logo text-sm font-semibold text-ink">J</span>
        </Link>
      </div>
    </header>
  )
}
