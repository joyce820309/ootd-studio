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
  const cls = `object-contain drop-shadow-garment ${className}`
  if (cutoutUrl) return <img src={cutoutUrl} alt={name} className={cls} loading="lazy" />
  return <GarmentArt shape={shape} color={colorHex} label={name} className={cls} />
}
