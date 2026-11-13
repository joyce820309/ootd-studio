import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import type { ProfileNavContext } from '@/lib/profileNav'

const LINKS = [
  { to: '/me', label: '體態與尺寸', end: true },
  { to: '/me/measurements', label: '量測紀錄', end: false },
  { to: '/me/brands', label: '品牌', end: false },
  { to: '/me/shops', label: '購買通路', end: false },
  { to: '/me/materials', label: '材質', end: false },
]

/** 個人資料子導覽（大螢幕左欄）；目前頁面以燕麥色左側線標示 */
export function ProfileSideNav({ counts = {}, className = '' }: { counts?: Partial<Record<string, number>>; className?: string }) {
  return (
    <nav aria-label="個人資料" className={`flex flex-col gap-0.5 ${className}`}>
      <span className="px-3 pb-1.5 text-xs text-ink-3">個人資料</span>
      {LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          className={({ isActive }) => `flex min-h-11 items-center gap-2 rounded-btn px-3 text-sm text-ink no-underline ${isActive ? 'bg-card font-bold shadow-[inset_3px_0_0_var(--color-oat)]' : 'hover:bg-tile'}`}
        >
          {link.label}
          {counts[link.to] !== undefined && <span className="ml-auto font-num text-xs font-normal text-ink-3 tabular">{counts[link.to]}</span>}
        </NavLink>
      ))}
    </nav>
  )
}

/**
 * /me 底下共用外框：大螢幕（xl 以上）左側固定子導覽；
 * 筆電以下不顯示左欄，改由各頁的 ProfileBreadcrumb 回到個人資料。
 */
export function ProfileLayout() {
  const [counts, setCounts] = useState<Partial<Record<string, number>>>({})
  const context: ProfileNavContext = {
    setNavCount: (path, count) => setCounts((current) => (current[path] === count ? current : { ...current, [path]: count })),
  }
  return (
    <div className="xl:mx-auto xl:grid xl:max-w-[1560px] xl:grid-cols-[220px_minmax(0,1fr)] xl:items-start xl:gap-2 xl:pl-8">
      <ProfileSideNav counts={counts} className="sticky top-4 hidden pt-9 xl:flex" />
      <div className="min-w-0">
        <Outlet context={context} />
      </div>
    </div>
  )
}

/** 筆電以下才出現的麵包屑；大螢幕由左側子導覽取代 */
export function ProfileBreadcrumb({ current, className = '' }: { current: string; className?: string }) {
  return (
    <nav aria-label="麵包屑" className={`flex items-center gap-2 text-[13px] text-ink-2 xl:hidden ${className}`}>
      <Link to="/me" className="flex min-h-11 items-center">個人資料</Link>
      <span aria-hidden="true">›</span>
      <span aria-current="page">{current}</span>
    </nav>
  )
}
