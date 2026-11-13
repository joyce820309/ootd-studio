import { isWearable, REQUIRED_SLOTS, SLOT_META } from './slots'
import type { ClosetItem, Slot } from '@/types'

export type Picks = Record<Slot, string | null>

export const EMPTY_PICKS: Picks = { outer: null, top: null, bottom: null, shoes: null, bag: null, acc: null }

/** 依部位分組，並把可穿的放前面 */
export function groupBySlot(items: ClosetItem[]): Record<Slot, ClosetItem[]> {
  const out: Record<Slot, ClosetItem[]> = { outer: [], top: [], bottom: [], shoes: [], bag: [], acc: [] }
  for (const item of items) out[item.slot].push(item)
  for (const slot of Object.keys(out) as Slot[]) {
    out[slot].sort((a, b) => Number(isWearable(b.status)) - Number(isWearable(a.status)))
  }
  return out
}

/** 預設搭配：每個必選部位優先挑目前在家可穿、穿著次數最多的那件；都不在家時仍挑一件，方便自由搭配 */
export function suggestDefaultPicks(items: ClosetItem[]): Picks {
  const grouped = groupBySlot(items)
  const picks = { ...EMPTY_PICKS }
  for (const slot of REQUIRED_SLOTS) {
    const best = [...grouped[slot]].sort((a, b) => Number(isWearable(b.status)) - Number(isWearable(a.status)) || (b.wearCount ?? 0) - (a.wearCount ?? 0))[0]
    picks[slot] = best?.id ?? null
  }
  return picks
}

export function missingRequired(picks: Picks): string[] {
  return REQUIRED_SLOTS.filter((s) => !picks[s]).map((s) => SLOT_META[s].label)
}
