import { Link } from 'react-router-dom'
import { useProfileIdentity } from '@/lib/profileIdentity'

/** 頁首右側的頭像：前往「我的」（/me：體態、清單管理、設定） */
export function ProfileAvatarLink({ className = '' }: { className?: string }) {
  const { initial } = useProfileIdentity()
  return (
    <Link to="/me" aria-label="我的：體態、清單管理、設定" className={`flex size-11 flex-none items-center justify-center no-underline ${className}`}>
      <span className="flex size-8 items-center justify-center rounded-full border-[1.5px] border-ink bg-card font-logo text-[13px] font-semibold text-ink md:size-[34px] md:text-sm">{initial}</span>
    </Link>
  )
}
