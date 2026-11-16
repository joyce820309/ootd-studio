import { useSyncExternalStore } from 'react'

/** 與 Tailwind md 斷點一致：寬度小於 768px 視為手機版面 */
const MOBILE_QUERY = '(max-width: 767px)'

function subscribe(onChange: () => void) {
  const query = window.matchMedia(MOBILE_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

export function useIsMobile() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(MOBILE_QUERY).matches, () => false)
}
