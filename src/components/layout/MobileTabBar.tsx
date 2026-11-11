import { NavLink } from 'react-router-dom'
import { Icon, type IconName } from '@/components/ui/Icon'

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/home', label: '首頁', icon: 'home' },
  { to: '/closet', label: '衣櫃', icon: 'closet' },
  { to: '/outfit', label: '搭配', icon: 'outfit' },
  { to: '/diary', label: '日記', icon: 'diary' },
  { to: '/wishlist', label: '選購', icon: 'wish' },
]

/** 手機底部導覽：中央「搭配」為燕麥色凸起按鈕，位於拇指熱區。 */
export function MobileTabBar() {
  return (
    <nav
      aria-label="主要導覽"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 items-end border-t-[1.5px] border-dashed border-line-strong bg-card px-2 pt-1.5 pb-[calc(10px+env(safe-area-inset-bottom))] md:hidden"
    >
      {TABS.map((t) => {
        const center = t.to === '/outfit'
        return (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 text-[11px] no-underline ${center ? 'h-auto' : 'h-14'} ${
                isActive || center ? 'font-bold text-ink' : 'text-ink-2'
              }`
            }
          >
            {center ? (
              <span
                className="-mt-7 flex size-[58px] items-center justify-center rounded-[18px] border-[1.5px] border-oat-edge bg-oat text-ink shadow-oat"
                style={{ rotate: '-4deg' }}
              >
                <Icon name={t.icon} size={26} />
              </span>
            ) : (
              <Icon name={t.icon} size={22} />
            )}
            {t.label}
          </NavLink>
        )
      })}
    </nav>
  )
}
