import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * 沒有設定環境變數時為 null，App 以「示範模式」執行：
 * 不需要登入，使用 src/data/sample.ts 的示範資料。
 */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null

export const isDemoMode = supabase === null
