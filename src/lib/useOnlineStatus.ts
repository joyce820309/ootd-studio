import { useEffect, useState } from 'react'

/** 只反映瀏覽器連線狀態；不代表資料已離線佇列或可自動同步。 */
export function useOnlineStatus() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)

  useEffect(() => {
    const onlineAgain = () => setOnline(true)
    const offlineNow = () => setOnline(false)
    window.addEventListener('online', onlineAgain)
    window.addEventListener('offline', offlineNow)
    return () => {
      window.removeEventListener('online', onlineAgain)
      window.removeEventListener('offline', offlineNow)
    }
  }, [])

  return online
}
