/**
 * 照片顏色標籤 PhotoColorTag（設計稿 B27：design/general/B-PhotoTag.dc.html）
 *
 * 像把照片貼進手帳：一段半透明、平光、直邊的紙膠帶，一半壓在照片上、一半貼在本子上，寫著小色點＋色名。
 * - 依商品 id 算出固定的膠帶顏色、角度（-8°~-3° 或 3°~7°）與位置：同一件每次打開都一樣，不同件各有不同。
 * - 同一件的每張照片用同一捲膠帶顏色，只是角度微調。
 * - 膠帶一半在照片外：外框不能 overflow:hidden（圓角裁切放在內層），照片四周要留 24px 以上空白。
 * - 手機照片滿版，只用「壓在下緣」。
 * - 膠帶 aria-hidden；顏色名寫在主圖 alt。
 */

const TAPES = ['bg-washi-oat', 'bg-washi-mist', 'bg-washi-sage', 'bg-washi-peach', 'bg-washi-lavender'] as const
const ANGLES = [-8, -7, -6, -5, -4, -3, 3, 4, 5, 6, 7] as const

export type PhotoColorTagPlace = 'corner' | 'bottom' | 'edge'

function hashOf(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return Math.abs(hash)
}

/** 依商品 id 算出膠帶外觀；mobile 只用「壓在下緣」 */
function photoColorTagLook(seed: string, photoIndex = 0, mobile = false) {
  const hash = hashOf(seed)
  const tape = TAPES[hash % TAPES.length]
  const base = ANGLES[Math.floor(hash / TAPES.length) % ANGLES.length]
  // 同一件每張照片角度微調 ±1°，但不跨過 0
  const nudge = [0, 1, -1][photoIndex % 3]
  const angle = base < 0 ? Math.min(-3, Math.max(-8, base + nudge)) : Math.min(7, Math.max(3, base + nudge))
  const places: PhotoColorTagPlace[] = ['corner', 'bottom', 'edge']
  const place: PhotoColorTagPlace = mobile ? 'bottom' : places[Math.floor(hash / 55) % places.length]
  return { tape, angle, place }
}

const PLACE_STYLE: Record<PhotoColorTagPlace, (angle: number) => { className: string; rotate: string }> = {
  corner: (angle) => ({ className: '-right-[30px] bottom-[34px]', rotate: `${angle}deg` }),
  bottom: (angle) => ({ className: 'right-10 -bottom-4', rotate: `${angle}deg` }),
  // 右緣直貼：轉成直的，角度只差一點點
  edge: (angle) => ({ className: '-right-11 bottom-[110px]', rotate: `${-86 + angle / 2}deg` }),
}

export function PhotoColorTag({ seed, label, hex, photoIndex = 0, mobile = false, className = '' }: { seed: string; label: string; hex?: string; photoIndex?: number; mobile?: boolean; className?: string }) {
  const { tape, angle, place } = photoColorTagLook(seed, photoIndex, mobile)
  const style = PLACE_STYLE[place](angle)
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute z-[4] flex items-center whitespace-nowrap font-hd text-ink ${mobile ? 'h-8 gap-1.5 px-[18px] text-base' : 'h-[34px] gap-[7px] px-[22px] text-lg'} ${style.className} ${className}`}
      style={{ rotate: style.rotate }}
    >
      <span className={`absolute inset-0 shadow-[0_1px_2px_rgb(59_47_37/0.08)] ${tape}`} />
      {hex && <i className={`relative flex-none rounded-full shadow-[0_0_0_1.5px_rgb(255_252_246/0.9)] ${mobile ? 'size-2.5' : 'size-[11px]'}`} style={{ background: hex }} />}
      <span className="relative">{label}</span>
    </span>
  )
}

/** 縮圖不貼膠帶：右下角 14px 色點，2px 紙色外圈 */
export function PhotoColorDot({ hex, label }: { hex: string; label?: string }) {
  return <span aria-hidden="true" title={label} className="absolute right-[5px] bottom-[5px] size-3.5 rounded-full shadow-[0_0_0_2px_var(--color-card),0_1px_3px_rgb(59_47_37/0.3)]" style={{ background: hex }} />
}
