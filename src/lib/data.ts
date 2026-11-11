import { useEffect, useState } from 'react'
import { SAMPLE_ITEMS, SAMPLE_WISHLIST } from '@/data/sample'
import type { ClosetItem, GarmentShape, ItemStatus, Outfit, Slot, WishlistItem } from '@/types'
import { supabase } from './supabase'

const CUTOUT_BUCKET = 'closet-images'
const SIGNED_URL_TTL = 60 * 60

interface ItemRow {
  id: string
  name: string
  category_id: string
  color_name: string
  color_hex: string
  brand: string | null
  size: string | null
  status: ItemStatus
  is_favorite: boolean
  image_cutout_path: string | null
  wear_count: number
  last_worn_at: string | null
  categories: { slot: Slot | null } | null
}

async function signed(paths: string[]): Promise<Record<string, string>> {
  if (!supabase || paths.length === 0) return {}
  const { data } = await supabase.storage.from(CUTOUT_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL)
  return Object.fromEntries((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]))
}

export async function fetchClosetItems(): Promise<ClosetItem[]> {
  if (!supabase) return SAMPLE_ITEMS
  const { data, error } = await supabase
    .from('items')
    .select('id,name,category_id,color_name,color_hex,brand,size,status,is_favorite,image_cutout_path,wear_count,last_worn_at,categories(slot)')
    .neq('status', 'retired')
    .order('created_at', { ascending: false })
  if (error) throw error
  const rows = (data ?? []) as unknown as ItemRow[]
  const urls = await signed(rows.map((r) => r.image_cutout_path).filter((p): p is string => !!p))
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    categoryId: r.category_id,
    slot: r.categories?.slot ?? 'acc',
    colorName: r.color_name,
    colorHex: r.color_hex,
    brand: r.brand ?? undefined,
    size: r.size ?? undefined,
    status: r.status,
    isFavorite: r.is_favorite,
    cutoutUrl: r.image_cutout_path ? urls[r.image_cutout_path] : undefined,
    shape: fallbackShape(r.categories?.slot ?? null),
    wearCount: r.wear_count,
    lastWornAt: r.last_worn_at ?? undefined,
  }))
}

export async function fetchWishlist(): Promise<WishlistItem[]> {
  if (!supabase) return SAMPLE_WISHLIST
  const { data, error } = await supabase
    .from('wishlist_items')
    .select('id,name,slot,color_hex,shop,price,shipping,url,size_note,status,compare_group_id,image_cutout_path')
    .in('status', ['considering', 'waiting', 'ready'])
  if (error) throw error
  const rows = data ?? []
  const urls = await signed(rows.map((r) => r.image_cutout_path).filter((p): p is string => !!p))
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slot: r.slot,
    colorHex: r.color_hex,
    shop: r.shop,
    price: r.price,
    shipping: r.shipping ?? undefined,
    url: r.url ?? undefined,
    sizeNote: r.size_note ?? undefined,
    status: r.status,
    compareGroupId: r.compare_group_id ?? undefined,
    cutoutUrl: r.image_cutout_path ? urls[r.image_cutout_path] : undefined,
    shape: fallbackShape(r.slot),
  }))
}

/** 儲存穿搭到「穿搭日記」。示範模式回傳 demo: true，不寫入任何資料。 */
export async function saveOutfit(outfit: Outfit): Promise<{ demo: boolean; id?: string }> {
  if (!supabase) return { demo: true }
  const { data, error } = await supabase
    .from('outfits')
    .insert({ name: outfit.name, worn_on: outfit.date, template: outfit.template, occasion: outfit.occasion ?? null, note: outfit.note ?? null })
    .select('id')
    .single()
  if (error) throw error
  const rows = Object.entries(outfit.picks).map(([slot, pick]) => ({
    outfit_id: data.id,
    slot,
    item_id: pick?.kind === 'closet' ? pick.itemId : null,
    wishlist_item_id: pick?.kind === 'wish' ? pick.wishId : null,
  }))
  if (rows.length) {
    const { error: e2 } = await supabase.from('outfit_items').insert(rows)
    if (e2) throw e2
  }
  return { demo: false, id: data.id }
}

function fallbackShape(slot: Slot | null): GarmentShape {
  switch (slot) {
    case 'outer':
      return 'coat'
    case 'top':
      return 'knit'
    case 'bottom':
      return 'pants'
    case 'shoes':
      return 'shoe'
    case 'bag':
      return 'bag'
    default:
      return 'scarf'
  }
}

/** 簡單的資料載入 hook */
export function useAsync<T>(load: () => Promise<T>) {
  const [state, setState] = useState<{ data: T | null; error: Error | null; loading: boolean }>({ data: null, error: null, loading: true })
  useEffect(() => {
    let alive = true
    load()
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((error: Error) => alive && setState({ data: null, error, loading: false }))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return state
}
