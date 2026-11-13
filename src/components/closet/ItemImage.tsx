import { useState } from 'react'
import { GarmentArt } from './GarmentArt'
import type { GarmentShape } from '@/types'

interface Props {
  name: string
  cutoutUrl?: string
  shape?: GarmentShape
  colorHex: string
  className?: string
}

/** 優先顯示去背圖，沒有圖片時顯示示範剪影。圖片統一加柔和投影，淺色衣物也能看清楚。 */
export function ItemImage({ name, cutoutUrl, shape = 'tee', colorHex, className = '' }: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const cls = `object-contain drop-shadow-garment ${className}`
  if (cutoutUrl && failedUrl !== cutoutUrl) return <img src={cutoutUrl} alt={name} className={cls} loading="lazy" onError={() => setFailedUrl(cutoutUrl)} />
  return <GarmentArt shape={shape} color={colorHex} label={failedUrl === cutoutUrl ? `${name}（圖片載入失敗，顯示示意圖）` : name} className={cls} />
}
