import { useAuth } from '@/lib/auth'

/** 頭像與「我的」頁使用的名稱：登入資料的名字 → Email 前段 → 示範使用者 */
export function useProfileIdentity() {
  const { session } = useAuth()
  const user = session?.user
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>
  const fromMeta = [meta.full_name, meta.name].find((value): value is string => typeof value === 'string' && value.trim() !== '')
  const name = fromMeta?.trim() || user?.email?.split('@')[0] || '示範使用者'
  return { name, initial: Array.from(name)[0]?.toUpperCase() ?? '我' }
}
