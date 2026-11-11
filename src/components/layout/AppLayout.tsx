import { Outlet } from 'react-router-dom'
import { isDemoMode } from '@/lib/supabase'
import { AppHeader } from './AppHeader'
import { MobileTabBar } from './MobileTabBar'

export function AppLayout() {
  return (
    <div className="min-h-dvh bg-paper">
      {isDemoMode && (
        <p role="status" className="m-0 bg-oat-soft px-4 py-1.5 text-center text-xs text-oat-ink">
          示範模式：尚未設定 Supabase，資料不會儲存。設定方式請見 README。
        </p>
      )}
      <AppHeader />
      <div className="pb-28 md:pb-0">
        <Outlet />
      </div>
      <MobileTabBar />
    </div>
  )
}
