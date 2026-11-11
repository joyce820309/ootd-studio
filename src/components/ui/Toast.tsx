import { useEffect } from 'react'
import { Icon } from './Icon'

export interface ToastMessage {
  tone: 'success' | 'error'
  text: string
}

/** 頁面底部的提示。成功 4 秒後自動消失；錯誤需要手動關閉。 */
export function Toast({ message, onClose }: { message: ToastMessage | null; onClose: () => void }) {
  useEffect(() => {
    if (!message || message.tone === 'error') return
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [message, onClose])

  if (!message) return null
  const ok = message.tone === 'success'
  return (
    <div
      role={ok ? 'status' : 'alert'}
      className={`fixed inset-x-4 bottom-28 z-40 mx-auto flex max-w-md items-center gap-2.5 rounded-tile px-4 py-3 text-sm shadow-float md:bottom-8 ${
        ok ? 'bg-ink text-paper' : 'border-[1.5px] border-rose bg-rose-soft text-rose-ink'
      }`}
    >
      <span className={`flex size-[22px] flex-none items-center justify-center rounded-full ${ok ? 'bg-sage text-sage-ink' : 'text-rose-deep'}`}>
        <Icon name={ok ? 'check' : 'alert'} size={14} />
      </span>
      <span className="flex-1">{message.text}</span>
      <button type="button" onClick={onClose} aria-label="關閉提示" className="flex size-8 items-center justify-center rounded-sm bg-transparent text-current">
        <Icon name="x" size={16} />
      </button>
    </div>
  )
}
