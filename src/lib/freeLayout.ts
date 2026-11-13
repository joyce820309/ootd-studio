import type { FreeLayout, Placement, Slot } from '@/types'

/** 尺寸與位置的限制，避免單品被拖出畫布或縮到看不見 */
export const LIMITS = {
  minW: 8,
  maxW: 70,
  minPos: 0,
  maxPos: 100,
} as const

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const round1 = (v: number) => Math.round(v * 10) / 10

/**
 * 預設位置：沿用「完整平鋪」的邏輯，
 * 外套在左、上衣在上、下身在中、鞋子在下、包包與配件在右。
 * 圖層順序：外套壓在上衣上面，鞋子與包包在最上層。
 */
export function defaultLayout(): FreeLayout {
  return {
    top: { x: 52, y: 24, w: 28, rot: 0, z: 1 },
    outer: { x: 28, y: 34, w: 32, rot: -4, z: 2 },
    bottom: { x: 52, y: 58, w: 26, rot: 0, z: 3 },
    acc: { x: 80, y: 20, w: 18, rot: 6, z: 4 },
    bag: { x: 80, y: 58, w: 22, rot: 4, z: 5 },
    shoes: { x: 50, y: 86, w: 22, rot: -3, z: 6 },
  }
}

export function normalize(p: Placement): Placement {
  return {
    x: round1(clamp(p.x, LIMITS.minPos, LIMITS.maxPos)),
    y: round1(clamp(p.y, LIMITS.minPos, LIMITS.maxPos)),
    w: round1(clamp(p.w, LIMITS.minW, LIMITS.maxW)),
    rot: Math.round(((p.rot % 360) + 540) % 360) - 180,
    z: p.z,
  }
}

/** 把指定單品往上（dir = 1）或往下（dir = -1）移一層，只和畫布上可見的單品交換 */
export function shiftLayer(layout: FreeLayout, slot: Slot, visible: Slot[], dir: 1 | -1): FreeLayout {
  const order = [...visible].sort((a, b) => layout[a].z - layout[b].z)
  const i = order.indexOf(slot)
  const j = i + dir
  if (i < 0 || j < 0 || j >= order.length) return layout
  const other = order[j]
  return {
    ...layout,
    [slot]: { ...layout[slot], z: layout[other].z },
    [other]: { ...layout[other], z: layout[slot].z },
  }
}

/** 放到最上層：新加入的單品會用到 */
export function bringToFront(layout: FreeLayout, slot: Slot): FreeLayout {
  const top = Math.max(...Object.values(layout).map((p) => p.z))
  if (layout[slot].z === top) return layout
  return { ...layout, [slot]: { ...layout[slot], z: top + 1 } }
}

/** 只保留已勾選部位的位置，用於儲存 */
export function pickLayout(layout: FreeLayout, slots: Slot[]): Partial<FreeLayout> {
  return Object.fromEntries(slots.map((s) => [s, layout[s]]))
}
