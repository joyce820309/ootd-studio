import { Outlet } from 'react-router-dom'
import { isDemoMode } from '@/lib/supabase'
import { useOnlineStatus } from '@/lib/useOnlineStatus'
import { AppHeader } from './AppHeader'
import { MobileTabBar } from './MobileTabBar'
import { Icon } from '@/components/ui/Icon'

export function AppLayout() {
  const online = useOnlineStatus()
  return (
    <div className="min-h-dvh bg-paper">
      {isDemoMode && (
        <p role="status" className="m-0 bg-oat-soft px-4 py-1.5 text-center text-xs text-oat-ink">
          示範模式：尚未設定 Supabase，資料不會儲存。設定方式請見 README。
        </p>
      )}
      {!online && (
        <p role="status" className="m-0 flex items-center justify-center gap-2 bg-ink px-4 py-2 text-center text-xs text-paper">
          <Icon name="alert" size={15} />目前離線・瀏覽器內的草稿會保留；資料變更尚未同步，去背與線上服務暫不可用。
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
