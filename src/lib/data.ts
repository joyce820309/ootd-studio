import { todayISO } from './date'
import { useEffect, useState } from 'react'
import { SAMPLE_BODY_MEASUREMENTS, SAMPLE_CATEGORIES, SAMPLE_COMPARE_GROUPS, SAMPLE_DIARY, SAMPLE_ITEMS, SAMPLE_PROFILE, SAMPLE_WISHLIST } from '@/data/sample'
import type { AddItemDestination, BodyMeasurement, BodyMeasurementInput, BrandChange, BrandSummary, Category, ClosetItem, ClosetPhoto, CompareGroup, CompareGroupInput, CutoutRegion, DiaryEntry, DiaryEntryInput, DiaryFeel, DiaryPhotoChange, DiaryWeather, GarmentShape, ItemStatus, ManagedEntryChange, ManagedListSummary, NewGarmentInput, Outfit, ProfilePreferences, ShopKind, Slot, StudioBackgroundCustom, StudioBackgroundMode, StudioBackgroundTheme, StudioCanvasItem, WishlistInput, WishlistItem, WishStatus } from '@/types'
import { toUploadableImage } from '@/lib/image'
import { MATERIAL_DEFAULTS, materialNames } from '@/lib/materials'
import { supabase } from './supabase'

const CUTOUT_BUCKET = 'closet-images'
const SIGNED_URL_TTL = 60 * 60
const demoClosetPhotos = new Map<string, ClosetPhoto[]>()

let demoProfile: ProfilePreferences = cloneProfile(SAMPLE_PROFILE)
let demoMeasurements: BodyMeasurement[] = SAMPLE_BODY_MEASUREMENTS.map((measurement) => ({ ...measurement }))
let demoClosetItems: ClosetItem[] = [...SAMPLE_ITEMS]
let demoWishlistItems: WishlistItem[] = [...SAMPLE_WISHLIST]
let demoCompareGroups: CompareGroup[] = SAMPLE_COMPARE_GROUPS.map((group) => ({ ...group }))
let demoCompareClosetItems: { groupId: string; itemId: string }[] = []
const demoGarmentDraftFiles = new Map<string, File[]>()
const demoManagedShops = new Map<string, { kind: ShopKind; url?: string }>()
const demoManagedMaterials = new Map<string, { aliases: string[]; sortOrder: number; isDefault: boolean; isHidden: boolean }>(MATERIAL_DEFAULTS.map((material) => [material.name, { aliases: [...material.aliases], sortOrder: material.sortOrder, isDefault: true, isHidden: false }]))

function cloneProfile(profile: ProfilePreferences): ProfilePreferences {
  return {
    ...profile,
    shoeSizes: profile.shoeSizes.map((size) => ({ ...size })),
    frequentSizes: [...profile.frequentSizes],
    fitPreferences: [...profile.fitPreferences],
    dislikedCuts: [...profile.dislikedCuts],
  }
}

function mapMeasurement(row: Record<string, unknown>): BodyMeasurement {
  const numberOrNull = (value: unknown) => value === null || value === undefined || value === '' ? null : Number(value)
  return {
    id: String(row.id),
    measuredOn: String(row.measured_on),
    heightCm: numberOrNull(row.height_cm),
    weightKg: numberOrNull(row.weight_kg),
    shoulderCm: numberOrNull(row.shoulder_cm),
    // 舊資料的單一胸圍視為上胸圍，避免 migration 前的紀錄消失。
    upperBustCm: numberOrNull(row.upper_bust_cm) ?? numberOrNull(row.bust_cm),
    underBustCm: numberOrNull(row.under_bust_cm),
    waistCm: numberOrNull(row.waist_cm),
    navelCm: numberOrNull(row.navel_cm),
    hipCm: numberOrNull(row.hip_cm),
    armCm: numberOrNull(row.arm_cm),
    inseamCm: numberOrNull(row.inseam_cm),
    thighCm: numberOrNull(row.thigh_cm),
    footToeLengthCm: numberOrNull(row.foot_toe_length_cm),
    footToeWidthCm: numberOrNull(row.foot_toe_width_cm),
    footToeBallCm: numberOrNull(row.foot_toe_ball_cm),
    footToeInstepCm: numberOrNull(row.foot_toe_instep_cm),
    footSockLengthCm: numberOrNull(row.foot_sock_length_cm),
    footSockWidthCm: numberOrNull(row.foot_sock_width_cm),
    footSockBallCm: numberOrNull(row.foot_sock_ball_cm),
    footSockInstepCm: numberOrNull(row.foot_sock_instep_cm),
    footBareLengthCm: numberOrNull(row.foot_bare_length_cm) ?? numberOrNull(row.foot_cm),
    footBareWidthCm: numberOrNull(row.foot_bare_width_cm),
    footBareBallCm: numberOrNull(row.foot_bare_ball_cm),
    footBareInstepCm: numberOrNull(row.foot_bare_instep_cm),
    note: typeof row.note === 'string' ? row.note : '',
    createdAt: String(row.created_at ?? ''),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : undefined,
  }
}

function measurementPayload(input: BodyMeasurementInput) {
  return {
    measured_on: input.measuredOn,
    height_cm: input.heightCm,
    weight_kg: input.weightKg,
    shoulder_cm: input.shoulderCm,
    upper_bust_cm: input.upperBustCm,
    under_bust_cm: input.underBustCm,
    waist_cm: input.waistCm,
    navel_cm: input.navelCm,
    hip_cm: input.hipCm,
    arm_cm: input.armCm,
    inseam_cm: input.inseamCm,
    thigh_cm: input.thighCm,
    foot_toe_length_cm: input.footToeLengthCm,
    foot_toe_width_cm: input.footToeWidthCm,
    foot_toe_ball_cm: input.footToeBallCm,
    foot_toe_instep_cm: input.footToeInstepCm,
    foot_sock_length_cm: input.footSockLengthCm,
    foot_sock_width_cm: input.footSockWidthCm,
    foot_sock_ball_cm: input.footSockBallCm,
    foot_sock_instep_cm: input.footSockInstepCm,
    foot_bare_length_cm: input.footBareLengthCm,
    foot_bare_width_cm: input.footBareWidthCm,
    foot_bare_ball_cm: input.footBareBallCm,
    foot_bare_instep_cm: input.footBareInstepCm,
    note: input.note || null,
  }
}

interface ItemRow {
  id: string
  name: string
  category_id: string
  color_name: string
  color_hex: string
  second_color_hex?: string | null
  brand: string | null
  size: string | null
  neckline_size?: number | null
  fit?: string | null
  material?: string | null
  material_composition?: string | null
  material_percentages?: Record<string, number> | null
  seasons?: string[] | null
  occasions?: string[] | null
  purchase_date?: string | null
  purchase_price?: number | null
  store?: string | null
  product_url?: string | null
  note?: string | null
  flat_measurements?: Record<string, number | null> | null
  status: ItemStatus
  is_favorite: boolean
  image_original_path: string | null
  image_cutout_path: string | null
    cutout_status?: 'pending' | 'processing' | 'done' | 'failed' | 'skipped'
  wear_count: number
  last_worn_at: string | null
  categories: { name?: string; slot: Slot | null } | null
}

interface ItemPhotoRow {
  id: string
  storage_path: string
  sort_order: number
  is_cover: boolean
}

function itemFromRow(row: ItemRow, urls: Record<string, string>, photos?: ClosetPhoto[]): ClosetItem {
  const imagePath = row.image_cutout_path ?? row.image_original_path
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    slot: row.categories?.slot ?? 'acc',
    categorySlot: row.categories?.slot ?? null,
    categoryName: row.categories?.name,
    colorName: row.color_name,
    colorHex: row.color_hex,
    secondColorHex: row.second_color_hex ?? undefined,
    brand: row.brand ?? undefined,
    size: row.size ?? undefined,
    necklineSize: row.neckline_size ?? undefined,
    fit: row.fit ?? undefined,
    material: row.material ?? undefined,
    materialComposition: row.material_composition ?? undefined,
    materialPercentages: row.material_percentages ?? undefined,
    seasons: row.seasons ?? [],
    occasions: row.occasions ?? [],
    purchaseDate: row.purchase_date ?? undefined,
    purchasePrice: row.purchase_price ?? undefined,
    store: row.store ?? undefined,
    productUrl: row.product_url ?? undefined,
    note: row.note ?? undefined,
    flatMeasurements: row.flat_measurements ?? {},
    status: row.status,
    isFavorite: row.is_favorite,
    cutoutUrl: imagePath ? urls[imagePath] : undefined,
    originalUrl: row.image_original_path ? urls[row.image_original_path] : undefined,
    cutoutStatus: row.cutout_status,
    photos,
    shape: fallbackShape(row.categories?.slot ?? null),
    wearCount: row.wear_count,
    lastWornAt: row.last_worn_at ?? undefined,
  }
}

async function signed(paths: string[]): Promise<Record<string, string>> {
  if (!supabase || paths.length === 0) return {}
  const { data } = await supabase.storage.from(CUTOUT_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL)
  return Object.fromEntries((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]))
}

export async function fetchClosetItems(): Promise<ClosetItem[]> {
  if (!supabase) return demoClosetItems.filter((item) => item.status !== 'retired').map((item) => ({ ...item }))
  const { data, error } = await supabase
    .from('items')
    .select('id,name,category_id,color_name,color_hex,brand,size,neckline_size,fit,material,material_composition,material_percentages,seasons,occasions,purchase_date,purchase_price,store,product_url,note,flat_measurements,status,is_favorite,image_original_path,image_cutout_path,cutout_status,wear_count,last_worn_at,categories(name,slot)')
    .neq('status', 'retired')
    .eq('is_draft', false)
    .order('created_at', { ascending: false })
  if (error) throw error
  const rows = (data ?? []) as unknown as ItemRow[]
  const imagePaths = rows.flatMap((row) => [row.image_cutout_path, row.image_original_path].filter((path): path is string => !!path))
  const urls = await signed(imagePaths)
  return rows.map((row) => itemFromRow(row, urls))
}

/** 過去衣物使用過的品牌，供新增衣物品牌欄位建議；仍可手動輸入新品牌。 */
export async function fetchClosetBrands(): Promise<string[]> {
  // 品牌管理頁手動新增的品牌也列進建議
  if (!supabase) return [...new Set([...demoClosetItems.map((item) => item.brand?.trim()), ...demoBrands].filter((brand): brand is string => !!brand))].sort((a, b) => a.localeCompare(b, 'zh-TW'))
  const [{ data, error }, manual] = await Promise.all([
    supabase.from('items').select('brand').eq('is_draft', false).not('brand', 'is', null),
    supabase.from('brands').select('name'),
  ])
  if (error) throw error
  // brands 表在 0011 之前不存在，讀不到時只用衣物上的品牌
  const extra = manual.error ? [] : (manual.data ?? []).map((row) => row.name as string)
  return [...new Set([...(data ?? []).map((row) => row.brand?.trim()), ...extra].filter((brand): brand is string => !!brand))].sort((a, b) => a.localeCompare(b, 'zh-TW'))
}

/** 讀取單件衣物完整資料、多張照片、原圖與去背圖（若有）。 */
export async function fetchClosetItemDetail(id: string): Promise<ClosetItem | null> {
  if (!supabase) {
    const item = demoClosetItems.find((entry) => entry.id === id)
    if (!item) return null
    const category = SAMPLE_CATEGORIES.find((entry) => entry.id === item.categoryId)
      ?? SAMPLE_CATEGORIES.find((entry) => entry.name === item.categoryId)
      ?? SAMPLE_CATEGORIES.find((entry) => entry.slot === item.slot)
    return { ...item, categoryId: category?.id ?? item.categoryId, categoryName: category?.name ?? item.categoryId, categorySlot: category ? category.slot : item.categorySlot ?? item.slot, seasons: item.seasons ?? [], flatMeasurements: item.flatMeasurements ?? {}, photos: [...(demoClosetPhotos.get(id) ?? [])] }
  }
  const { data, error } = await supabase.from('items')
    .select('id,name,category_id,color_name,color_hex,second_color_hex,brand,size,neckline_size,fit,material,material_composition,material_percentages,seasons,occasions,purchase_date,purchase_price,store,product_url,note,flat_measurements,status,is_favorite,image_original_path,image_cutout_path,cutout_status,wear_count,last_worn_at,categories(id,name,slot,sort),item_photos(id,storage_path,sort_order,is_cover)')
    .eq('id', id)
    .eq('is_draft', false)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const row = data as unknown as ItemRow & { categories: { id: string; name: string; slot: Slot | null; sort: number } | null; item_photos: ItemPhotoRow[] | null }
  const photoRows = row.item_photos ?? []
  const paths = [...new Set([row.image_original_path, row.image_cutout_path, ...photoRows.map((photo) => photo.storage_path)].filter((path): path is string => !!path))]
  const urls = await signed(paths)
  const photos: ClosetPhoto[] = photoRows.sort((a, b) => a.sort_order - b.sort_order).map((photo) => ({
    id: photo.id,
    path: photo.storage_path,
    url: urls[photo.storage_path],
    sortOrder: photo.sort_order,
    isCover: photo.is_cover,
  }))
  const item = itemFromRow(row, urls, photos)
  item.categoryName = row.categories?.name
  return item
}

function closetItemPayload(input: Partial<ClosetItem> & { categoryId?: string }) {
  const payload: Record<string, unknown> = {}
  const fields: [keyof ClosetItem, string][] = [
    ['name', 'name'], ['categoryId', 'category_id'], ['colorName', 'color_name'], ['colorHex', 'color_hex'],
    ['secondColorHex', 'second_color_hex'], ['brand', 'brand'], ['size', 'size'], ['necklineSize', 'neckline_size'], ['fit', 'fit'],
    ['material', 'material'], ['materialComposition', 'material_composition'], ['materialPercentages', 'material_percentages'], ['seasons', 'seasons'],
    ['occasions', 'occasions'], ['purchaseDate', 'purchase_date'], ['purchasePrice', 'purchase_price'],
    ['store', 'store'], ['productUrl', 'product_url'], ['note', 'note'], ['flatMeasurements', 'flat_measurements'],
  ]
  for (const [source, target] of fields) {
    if (!(source in input)) continue
    const value = input[source]
    payload[target] = source === 'secondColorHex' && value === '' ? null : value ?? null
  }
  return payload
}

/** 更新衣物詳細欄位。狀態欄位透過 updateClosetItemStatus 處理。 */
export async function updateClosetItem(id: string, input: Partial<ClosetItem>): Promise<{ demo: boolean }> {
  if (!supabase) {
    demoClosetItems = demoClosetItems.map((item) => item.id === id ? { ...item, ...input } : item)
    return { demo: true }
  }
  const payload = closetItemPayload(input)
  if (!Object.keys(payload).length) return { demo: false }
  const { error } = await supabase.from('items').update(payload).eq('id', id).eq('is_draft', false)
  if (error) throw error
  return { demo: false }
}

/** 變更衣物狀態，可用 retired 封存，不刪除歷史穿著關聯。 */
export async function updateClosetItemStatus(id: string, status: ItemStatus): Promise<{ demo: boolean }> {
  if (!supabase) {
    demoClosetItems = demoClosetItems.map((item) => item.id === id ? { ...item, status } : item)
    return { demo: true }
  }
  const { error } = await supabase.from('items').update({ status }).eq('id', id).eq('is_draft', false)
  if (error) throw error
  return { demo: false }
}

/** 記錄今天穿著一次並更新最近穿著日。 */
export async function recordClosetItemWear(id: string): Promise<{ demo: boolean }> {
  if (!supabase) {
    demoClosetItems = demoClosetItems.map((item) => item.id === id ? { ...item, wearCount: (item.wearCount ?? 0) + 1, lastWornAt: todayISO() } : item)
    return { demo: true }
  }
  const { data, error } = await supabase.from('items').select('wear_count').eq('id', id).single()
  if (error) throw error
  const { error: updateError } = await supabase.from('items').update({ wear_count: data.wear_count + 1, last_worn_at: todayISO() }).eq('id', id)
  if (updateError) throw updateError
  return { demo: false }
}

/** 上傳衣物更多照片，最多八張，並加入照片索引。 */
export async function addClosetItemPhotos(id: string, files: File[]): Promise<{ demo: boolean }> {
  if (!files.length) return { demo: !supabase }
  const uploadFiles = await Promise.all(files.map(toUploadableImage))
  if (!supabase) {
    const existing = demoClosetPhotos.get(id) ?? []
    if (existing.length + uploadFiles.length > 8) throw new Error('每件衣物最多可以保留 8 張照片。')
    const next = uploadFiles.map((file, index) => { const url = URL.createObjectURL(file); return { id: `demo-photo-${Date.now()}-${index}`, path: url, url, sortOrder: existing.length + index, isCover: false } })
    demoClosetPhotos.set(id, [...existing, ...next])
    return { demo: true }
  }
  if (uploadFiles.some((file) => file.size > 10 * 1024 * 1024)) throw new Error('單張照片需小於 10 MB。')
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('請重新登入後再新增照片。')
  const { data: existing, error } = await supabase.from('item_photos').select('sort_order').eq('item_id', id).order('sort_order', { ascending: false }).limit(1)
  if (error) throw error
  const start = (existing?.[0]?.sort_order ?? -1) + 1
  if (start + uploadFiles.length > 8) throw new Error('每件衣物最多可以保留 8 張照片。')
  const uploaded: string[] = []
  try {
    const rows = []
    for (const [index, file] of uploadFiles.entries()) {
      const path = `${user.id}/${id}/photos/${crypto.randomUUID()}.${fileExtension(file)}`
      const { error: uploadError } = await supabase.storage.from(CUTOUT_BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream' })
      if (uploadError) throw uploadError
      uploaded.push(path)
      rows.push({ owner_id: user.id, item_id: id, storage_path: path, sort_order: start + index, is_cover: false })
    }
    const { error: insertError } = await supabase.from('item_photos').insert(rows)
    if (insertError) throw insertError
    return { demo: false }
  } catch (error) {
    if (uploaded.length) await supabase.storage.from(CUTOUT_BUCKET).remove(uploaded)
    throw error
  }
}

export async function setClosetPhotoCover(itemId: string, photoId: string): Promise<{ demo: boolean }> {
  if (!supabase) {
    const photos = demoClosetPhotos.get(itemId) ?? []
    demoClosetPhotos.set(itemId, photos.map((photo) => ({ ...photo, isCover: photo.id === photoId })))
    return { demo: true }
  }
  const { data: photo, error: photoError } = await supabase.from('item_photos').select('id,storage_path').eq('id', photoId).eq('item_id', itemId).single()
  if (photoError) throw photoError
  const { error: clearError } = await supabase.from('item_photos').update({ is_cover: false }).eq('item_id', itemId)
  if (clearError) throw clearError
  const { error: coverError } = await supabase.from('item_photos').update({ is_cover: true }).eq('id', photoId)
  if (coverError) throw coverError
  const { error: itemError } = await supabase.from('items').update({ image_original_path: photo.storage_path, image_cutout_path: null, cutout_status: 'pending' }).eq('id', itemId)
  if (itemError) throw itemError
  return { demo: false }
}

export async function removeClosetItemPhoto(itemId: string, photoId: string): Promise<{ demo: boolean }> {
  if (!supabase) {
    const photos = demoClosetPhotos.get(itemId) ?? []
    if (photos.length <= 1) throw new Error('至少保留一張衣物照片。')
    const removed = photos.find((photo) => photo.id === photoId)
    if (removed?.url) URL.revokeObjectURL(removed.url)
    const next = photos.filter((photo) => photo.id !== photoId).map((photo, index) => ({ ...photo, sortOrder: index, isCover: removed?.isCover ? index === 0 : photo.isCover }))
    demoClosetPhotos.set(itemId, next)
    return { demo: true }
  }
  const { data: photos, error } = await supabase.from('item_photos').select('id,storage_path,sort_order,is_cover').eq('item_id', itemId).order('sort_order')
  if (error) throw error
  if ((photos ?? []).length <= 1) throw new Error('至少保留一張衣物照片。')
  const removed = photos?.find((photo) => photo.id === photoId)
  if (!removed) throw new Error('找不到這張照片。')
  const remaining = photos!.filter((photo) => photo.id !== photoId)
  const nextCover = removed.is_cover ? remaining[0] : remaining.find((photo) => photo.is_cover)!
  const { error: deleteError } = await supabase.from('item_photos').delete().eq('id', photoId).eq('item_id', itemId)
  if (deleteError) throw deleteError
  if (removed.is_cover) {
    const { error: clearError } = await supabase.from('item_photos').update({ is_cover: false }).eq('item_id', itemId)
    if (clearError) throw clearError
    const { error: coverError } = await supabase.from('item_photos').update({ is_cover: true }).eq('id', nextCover.id)
    if (coverError) throw coverError
    const { error: pathError } = await supabase.from('items').update({ image_original_path: nextCover.storage_path, image_cutout_path: null, cutout_status: 'pending' }).eq('id', itemId)
    if (pathError) throw pathError
  }
  const { error: storageError } = await supabase.storage.from(CUTOUT_BUCKET).remove([removed.storage_path])
  if (storageError) throw storageError
  return { demo: false }
}

/** 永久刪除衣物列（其搭配關聯依 FK 設定保留空項），再盡力清理 Storage 圖片。 */
export async function deleteClosetItem(id: string): Promise<{ demo: boolean; cleanupWarning?: string }> {
  if (!supabase) {
    demoClosetItems = demoClosetItems.filter((item) => item.id !== id)
    for (const photo of demoClosetPhotos.get(id) ?? []) URL.revokeObjectURL(photo.url ?? photo.path)
    demoClosetPhotos.delete(id)
    return { demo: true }
  }
  const { data: item, error } = await supabase.from('items').select('image_original_path,image_cutout_path').eq('id', id).single()
  if (error) throw error
  const { data: photos, error: photosError } = await supabase.from('item_photos').select('storage_path').eq('item_id', id)
  if (photosError) throw photosError
  const paths = [...new Set([item.image_original_path, item.image_cutout_path, ...(photos ?? []).map((photo) => photo.storage_path)].filter((path): path is string => !!path))]
  const { error: deleteError } = await supabase.from('items').delete().eq('id', id).eq('is_draft', false)
  if (deleteError) throw deleteError
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from(CUTOUT_BUCKET).remove(paths)
    if (storageError) return { demo: false, cleanupWarning: '衣物已刪除，但部分圖片清理失敗。' }
  }
  return { demo: false }
}

const ACTIVE_WISH_STATUSES: WishStatus[] = ['considering', 'waiting', 'ready']
const WISHLIST_COLUMNS = 'id,name,slot,color_hex,color_name,shop,price,shipping,target_price,url,size,size_note,neckline_size,brand,material,material_composition,material_percentages,return_policy,reason,priority,status,compare_group_id,image_cutout_path,image_original_path,bought_item_id,created_at'

interface WishlistRow {
  id: string
  name: string
  slot: Slot
  color_hex: string
  color_name: string | null
  shop: string
  price: number
  shipping: number | null
  target_price: number | null
  url: string | null
  size: string | null
  size_note: string | null
  neckline_size: number | null
  brand: string | null
  material: string | null
  material_composition: string | null
  material_percentages: Record<string, number> | null
  return_policy: string | null
  reason: string | null
  priority: number | null
  status: WishStatus
  compare_group_id: string | null
  image_cutout_path: string | null
  image_original_path: string | null
  bought_item_id: string | null
  created_at: string
}

async function mapWishlistRows(rows: WishlistRow[]): Promise<WishlistItem[]> {
  const imagePath = (r: WishlistRow) => r.image_cutout_path ?? r.image_original_path
  const urls = await signed(rows.map(imagePath).filter((p): p is string => !!p))
  return rows.map((r) => {
    const path = imagePath(r)
    return {
      id: r.id,
      name: r.name,
      slot: r.slot,
      colorHex: r.color_hex,
      colorName: r.color_name ?? undefined,
      shop: r.shop,
      price: r.price,
      shipping: r.shipping ?? undefined,
      targetPrice: r.target_price ?? undefined,
      url: r.url ?? undefined,
      size: r.size ?? undefined,
      sizeNote: r.size_note ?? undefined,
      necklineSize: r.neckline_size ?? undefined,
      brand: r.brand ?? undefined,
      material: r.material ?? undefined,
      materialComposition: r.material_composition ?? undefined,
      materialPercentages: r.material_percentages ?? undefined,
      returnPolicy: r.return_policy ?? undefined,
      reason: r.reason ?? undefined,
      priority: r.priority === 1 || r.priority === 2 || r.priority === 3 ? r.priority : undefined,
      status: r.status,
      compareGroupId: r.compare_group_id ?? undefined,
      cutoutUrl: path ? urls[path] : undefined,
      shape: fallbackShape(r.slot),
      boughtItemId: r.bought_item_id ?? undefined,
      createdAt: r.created_at,
    }
  })
}

/** 進行中的選購候選（考慮中、等待降價、準備購買），供搭配板與比較台使用。 */
export async function fetchWishlist(): Promise<WishlistItem[]> {
  if (!supabase) return demoWishlistItems.filter((item) => ACTIVE_WISH_STATUSES.includes(item.status))
  const { data, error } = await supabase
    .from('wishlist_items')
    .select(WISHLIST_COLUMNS)
    .in('status', ACTIVE_WISH_STATUSES)
    .order('created_at', { ascending: false })
  if (error) throw error
  return mapWishlistRows((data ?? []) as unknown as WishlistRow[])
}

/** 選購清單頁：包含已購買與已放棄，依加入時間新到舊。 */
export async function fetchAllWishlist(): Promise<WishlistItem[]> {
  if (!supabase) return demoWishlistItems.map((item) => ({ ...item }))
  const { data, error } = await supabase
    .from('wishlist_items')
    .select(WISHLIST_COLUMNS)
    .order('created_at', { ascending: false })
  if (error) throw error
  return mapWishlistRows((data ?? []) as unknown as WishlistRow[])
}

const blankToNull = (value?: string) => value?.trim() || null

function wishlistPayload(input: WishlistInput) {
  return {
    name: input.name.trim(),
    slot: input.slot,
    color_hex: input.colorHex,
    color_name: blankToNull(input.colorName),
    shop: input.shop.trim() || '尚未決定',
    url: blankToNull(input.url),
    price: input.price,
    shipping: input.shipping,
    target_price: input.targetPrice,
    brand: blankToNull(input.brand),
    size: blankToNull(input.size),
    size_note: blankToNull(input.sizeNote),
    neckline_size: input.necklineSize ?? null,
    priority: input.priority,
    reason: blankToNull(input.reason),
    material: blankToNull(input.material),
    material_composition: blankToNull(input.materialComposition),
    material_percentages: input.materialPercentages ?? {},
    return_policy: blankToNull(input.returnPolicy),
    status: input.status,
    ...(input.compareGroupId !== undefined ? { compare_group_id: input.compareGroupId } : {}),
  }
}

function demoWishFromInput(id: string, input: WishlistInput, base?: WishlistItem): WishlistItem {
  const optional = (value?: string) => value?.trim() || undefined
  return {
    ...base,
    id,
    name: input.name.trim(),
    slot: input.slot,
    colorHex: input.colorHex,
    colorName: optional(input.colorName),
    shop: input.shop.trim() || '尚未決定',
    url: optional(input.url),
    price: input.price,
    shipping: input.shipping ?? undefined,
    targetPrice: input.targetPrice ?? undefined,
    brand: optional(input.brand),
    size: optional(input.size),
    necklineSize: input.necklineSize ?? base?.necklineSize,
    sizeNote: optional(input.sizeNote),
    priority: input.priority ?? undefined,
    reason: optional(input.reason),
    material: optional(input.material),
    materialComposition: optional(input.materialComposition),
    materialPercentages: input.materialPercentages ? { ...input.materialPercentages } : undefined,
    returnPolicy: optional(input.returnPolicy),
    status: input.status,
    compareGroupId: input.compareGroupId === undefined ? base?.compareGroupId : (input.compareGroupId ?? undefined),
    shape: base && base.slot === input.slot ? base.shape : fallbackShape(input.slot),
    createdAt: base?.createdAt ?? new Date().toISOString(),
  }
}

/** 新增一筆選購候選（不含照片；要加照片請走 /closet/new 流程）。 */
export async function createWishlistItem(input: WishlistInput): Promise<{ item: WishlistItem; demo: boolean }> {
  if (!supabase) {
    const item = demoWishFromInput(`demo-wish-${Date.now()}`, input)
    demoWishlistItems = [item, ...demoWishlistItems]
    return { item, demo: true }
  }
  const { data, error } = await supabase.from('wishlist_items').insert(wishlistPayload(input)).select(WISHLIST_COLUMNS).single()
  if (error) throw error
  const [item] = await mapWishlistRows([data as unknown as WishlistRow])
  return { item, demo: false }
}

/** 編輯選購候選的資料與狀態。已購買的候選不能再修改。 */
export async function updateWishlistItem(id: string, input: WishlistInput): Promise<{ item: WishlistItem; demo: boolean }> {
  if (!supabase) {
    const base = demoWishlistItems.find((item) => item.id === id)
    if (!base) throw new Error('找不到這件商品，可能已被刪除。')
    if (base.status === 'bought') throw new Error('已購買的商品不能再修改。')
    const item = demoWishFromInput(id, input, base)
    demoWishlistItems = demoWishlistItems.map((entry) => (entry.id === id ? item : entry))
    return { item, demo: true }
  }
  const { data, error } = await supabase.from('wishlist_items').update(wishlistPayload(input)).eq('id', id).neq('status', 'bought').select(WISHLIST_COLUMNS).maybeSingle()
  if (error) throw error
  if (!data) throw new Error('找不到這件商品，或它已移至已購買。')
  const [item] = await mapWishlistRows([data as unknown as WishlistRow])
  return { item, demo: false }
}

/** 只改狀態：放棄購買、重新考慮等。已購買的候選不受影響。 */
export async function setWishlistStatus(id: string, status: Exclude<WishStatus, 'bought'>): Promise<{ demo: boolean }> {
  if (!supabase) {
    demoWishlistItems = demoWishlistItems.map((item) => (item.id === id && item.status !== 'bought' ? { ...item, status } : item))
    return { demo: true }
  }
  const { error } = await supabase.from('wishlist_items').update({ status }).eq('id', id).neq('status', 'bought')
  if (error) throw error
  return { demo: false }
}

/**
 * 移至已購買：建立一件衣櫃衣物（帶入名稱、顏色、品牌、尺寸、圖片），
 * 選購候選保留原資料，狀態改為 bought 並指向新衣物。
 */
export async function markWishlistBought(id: string, purchase: { purchaseDate: string; paidPrice: number | null }): Promise<{ itemId: string; demo: boolean }> {
  if (!supabase) {
    const wish = demoWishlistItems.find((item) => item.id === id)
    if (!wish) throw new Error('找不到這件商品，可能已被刪除。')
    if (wish.status === 'bought') throw new Error('這件已經移至已購買了。')
    const category = SAMPLE_CATEGORIES.find((entry) => entry.slot === wish.slot)
    const itemId = `demo-bought-${Date.now()}`
    demoClosetItems = [{
      id: itemId,
      name: wish.name,
      categoryId: category?.id ?? SAMPLE_CATEGORIES[0].id,
      slot: wish.slot,
      colorName: wish.colorName ?? '',
      colorHex: wish.colorHex,
      brand: wish.brand,
      size: wish.size,
      necklineSize: wish.necklineSize,
      status: 'ok',
      cutoutUrl: wish.cutoutUrl,
      shape: wish.shape,
      wearCount: 0,
    }, ...demoClosetItems]
    demoWishlistItems = demoWishlistItems.map((item) => (item.id === id ? { ...item, status: 'bought', boughtItemId: itemId } : item))
    return { itemId, demo: true }
  }

  const client = supabase
  const { data, error } = await client
    .from('wishlist_items')
    .select('id,name,slot,category_id,color_hex,color_name,second_color_hex,brand,size,size_note,neckline_size,seasons,material,material_composition,material_percentages,flat_measurements,shop,url,reason,status,image_original_path,image_cutout_path')
    .eq('id', id)
    .single()
  if (error) throw error
  if (data.status === 'bought') throw new Error('這件已經移至已購買了。')
  const categories = await fetchCategories()
  const category = categories.find((entry) => entry.id === data.category_id) ?? categories.find((entry) => entry.slot === data.slot)
  if (!category) throw new Error('找不到對應的衣物分類，請先到衣櫃確認分類設定。')
  const { data: { user }, error: userError } = await client.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('登入狀態已失效，請重新登入。')

  const itemId = crypto.randomUUID()
  // 圖片複製一份到新衣物的資料夾，之後刪除選購紀錄也不會影響衣櫃。
  const copied: string[] = []
  const copyImage = async (path: string | null, name: string) => {
    if (!path) return null
    const ext = path.split('.').pop() ?? 'jpg'
    const target = `${user.id}/${itemId}/${name}.${ext}`
    const { error: copyError } = await client.storage.from(CUTOUT_BUCKET).copy(path, target)
    if (copyError) throw copyError
    copied.push(target)
    return target
  }

  let itemInserted = false
  try {
    const originalPath = await copyImage(data.image_original_path, 'original')
    const cutoutPath = data.image_cutout_path && data.image_cutout_path !== data.image_original_path ? await copyImage(data.image_cutout_path, 'cutout') : null
    const { error: insertError } = await client.from('items').insert({
      id: itemId,
      category_id: category.id,
      name: data.name,
      color_name: data.color_name || '未填',
      color_hex: data.color_hex,
      second_color_hex: data.second_color_hex,
      size: data.size || data.size_note || '',
      neckline_size: data.neckline_size,
      brand: data.brand,
      seasons: data.seasons ?? [],
      material: data.material,
      material_composition: data.material_composition,
      material_percentages: data.material_percentages ?? {},
      flat_measurements: data.flat_measurements ?? {},
      purchase_date: purchase.purchaseDate,
      purchase_price: purchase.paidPrice,
      store: data.shop,
      product_url: data.url,
      note: data.reason,
      image_original_path: originalPath,
      image_cutout_path: cutoutPath ?? originalPath,
      cutout_status: cutoutPath ? 'done' : 'skipped',
    })
    if (insertError) throw insertError
    itemInserted = true
    if (originalPath) {
      const { error: photoError } = await client.from('item_photos').insert({ owner_id: user.id, item_id: itemId, storage_path: originalPath, sort_order: 0, is_cover: true })
      if (photoError) throw photoError
    }
    const { error: updateError } = await client.from('wishlist_items').update({ status: 'bought', bought_item_id: itemId }).eq('id', id)
    if (updateError) throw updateError
  } catch (err) {
    if (itemInserted) await client.from('items').delete().eq('id', itemId)
    if (copied.length) await client.storage.from(CUTOUT_BUCKET).remove(copied)
    throw err
  }
  return { itemId, demo: false }
}

// ---------- 比較群組 ----------

/** 讀取比較群組，依建立時間新到舊。 */
export async function fetchCompareGroups(): Promise<CompareGroup[]> {
  if (!supabase) return demoCompareGroups.map((group) => ({ ...group }))
  const { data, error } = await supabase.from('compare_groups').select('id,title,budget,created_at').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => ({ id: row.id, title: row.title, budget: row.budget ?? undefined, createdAt: row.created_at }))
}

/** 讀取各比較群組加入的衣櫃單品 ID。 */
export async function fetchCompareClosetItems(): Promise<Record<string, string[]>> {
  if (!supabase) {
    return demoCompareClosetItems.reduce<Record<string, string[]>>((result, entry) => {
      result[entry.groupId] = [...(result[entry.groupId] ?? []), entry.itemId]
      return result
    }, {})
  }
  const { data, error } = await supabase.from('compare_group_closet_items').select('compare_group_id,item_id')
  if (error) throw error
  return (data ?? []).reduce<Record<string, string[]>>((result, entry) => {
    result[entry.compare_group_id] = [...(result[entry.compare_group_id] ?? []), entry.item_id]
    return result
  }, {})
}

/** 將衣櫃單品加入或移出比較群組；只刪除比較關聯，不會刪除衣物。 */
export async function setCompareClosetItem(groupId: string, itemId: string, included: boolean): Promise<{ demo: boolean }> {
  if (!supabase) {
    const exists = demoCompareClosetItems.some((entry) => entry.groupId === groupId && entry.itemId === itemId)
    if (included && !exists) demoCompareClosetItems = [...demoCompareClosetItems, { groupId, itemId }]
    if (!included) demoCompareClosetItems = demoCompareClosetItems.filter((entry) => entry.groupId !== groupId || entry.itemId !== itemId)
    return { demo: true }
  }
  if (included) {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError) throw authError
    if (!user) throw new Error('請重新登入後再加入衣櫃單品。')
    const { error } = await supabase.from('compare_group_closet_items').upsert({ owner_id: user.id, compare_group_id: groupId, item_id: itemId }, { onConflict: 'compare_group_id,item_id', ignoreDuplicates: true })
    if (error) throw error
  } else {
    const { error } = await supabase.from('compare_group_closet_items').delete().eq('compare_group_id', groupId).eq('item_id', itemId)
    if (error) throw error
  }
  return { demo: false }
}

function checkGroupInput(input: CompareGroupInput) {
  if (!input.title.trim()) throw new Error('請填群組名稱。')
  if (input.budget !== null && (!Number.isInteger(input.budget) || input.budget < 0)) throw new Error('預算請填 0 以上的整數。')
}

export async function createCompareGroup(input: CompareGroupInput): Promise<{ group: CompareGroup; demo: boolean }> {
  checkGroupInput(input)
  if (!supabase) {
    const group: CompareGroup = { id: `demo-group-${Date.now()}`, title: input.title.trim(), budget: input.budget ?? undefined, createdAt: new Date().toISOString() }
    demoCompareGroups = [group, ...demoCompareGroups]
    return { group, demo: true }
  }
  const { data, error } = await supabase.from('compare_groups').insert({ title: input.title.trim(), budget: input.budget }).select('id,title,budget,created_at').single()
  if (error) throw error
  return { group: { id: data.id, title: data.title, budget: data.budget ?? undefined, createdAt: data.created_at }, demo: false }
}

export async function updateCompareGroup(id: string, input: CompareGroupInput): Promise<{ group: CompareGroup; demo: boolean }> {
  checkGroupInput(input)
  if (!supabase) {
    const base = demoCompareGroups.find((group) => group.id === id)
    if (!base) throw new Error('找不到這個群組，可能已被刪除。')
    const group: CompareGroup = { ...base, title: input.title.trim(), budget: input.budget ?? undefined }
    demoCompareGroups = demoCompareGroups.map((entry) => (entry.id === id ? group : entry))
    return { group, demo: true }
  }
  const { data, error } = await supabase.from('compare_groups').update({ title: input.title.trim(), budget: input.budget }).eq('id', id).select('id,title,budget,created_at').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('找不到這個群組，可能已被刪除。')
  return { group: { id: data.id, title: data.title, budget: data.budget ?? undefined, createdAt: data.created_at }, demo: false }
}

/** 刪除群組只拿掉比較關係；候選商品仍留在選購清單（資料表為 on delete set null）。 */
export async function deleteCompareGroup(id: string): Promise<{ demo: boolean }> {
  if (!supabase) {
    demoCompareGroups = demoCompareGroups.filter((group) => group.id !== id)
    demoWishlistItems = demoWishlistItems.map((item) => (item.compareGroupId === id ? { ...item, compareGroupId: undefined } : item))
    return { demo: true }
  }
  const { error } = await supabase.from('compare_groups').delete().eq('id', id)
  if (error) throw error
  return { demo: false }
}

/** 把選購候選加入或移出比較群組（groupId 為 null 時移出）。 */
export async function setWishlistGroup(wishId: string, groupId: string | null): Promise<{ demo: boolean }> {
  if (!supabase) {
    demoWishlistItems = demoWishlistItems.map((item) => (item.id === wishId ? { ...item, compareGroupId: groupId ?? undefined } : item))
    return { demo: true }
  }
  const { error } = await supabase.from('wishlist_items').update({ compare_group_id: groupId }).eq('id', wishId)
  if (error) throw error
  return { demo: false }
}

/** 永久刪除選購候選與它的照片。 */
export async function deleteWishlistItem(id: string): Promise<{ demo: boolean }> {
  await deleteGarment(id, 'wishlist')
  return { demo: !supabase }
}

/** 讀取使用者自有分類；示範模式使用與新帳號相同的預設分類。 */
export async function fetchCategories(): Promise<Category[]> {
  if (!supabase) return [...SAMPLE_CATEGORIES]
  const { data, error } = await supabase.from('categories').select('id,name,slot,sort').order('sort')
  if (error) throw error
  return (data ?? []) as Category[]
}

/** 讀取衣物草稿的多張照片簽名 URL，支援重新開啟未完成的新增流程。 */
export async function fetchGarmentDraftPhotos(id: string): Promise<{ path: string; url: string; sortOrder: number; isCover: boolean }[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('item_photos').select('storage_path,sort_order,is_cover').eq('item_id', id).order('sort_order')
  if (error) throw error
  const paths = (data ?? []).map((photo) => photo.storage_path)
  const urls = await signed(paths)
  return (data ?? []).flatMap((photo) => urls[photo.storage_path] ? [{ path: photo.storage_path, url: urls[photo.storage_path], sortOrder: photo.sort_order, isCover: photo.is_cover }] : [])
}

export async function getGarmentPhotoUrl(path: string): Promise<string | null> {
  if (!supabase) return null
  const { data, error } = await supabase.storage.from(CUTOUT_BUCKET).createSignedUrl(path, SIGNED_URL_TTL)
  if (error) throw error
  return data.signedUrl
}

function fileExtension(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext && /^[a-z0-9]{2,5}$/.test(ext)) return ext
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}

/** 儲存衣物或選購候選及其照片。去背可在資料列與原圖上傳後呼叫 Edge Function。 */
export async function createGarment(input: NewGarmentInput, files: File[]): Promise<{ id: string; destination: AddItemDestination; demo: boolean }> {
  if (files.length === 0) throw new Error('請至少選擇一張衣物照片。')
  if (files.length > 8) throw new Error('最多可以加入 8 張照片。')
  const uploadFiles = await Promise.all(files.map(toUploadableImage))
  const category = (await fetchCategories()).find((entry) => entry.id === input.categoryId)
  if (!category) throw new Error('找不到選擇的衣物分類，請重新選擇。')
  if (input.destination === 'wishlist' && !category.slot) throw new Error('「其他」分類不能加入選購清單，請選擇有搭配部位的類型。')

  if (!supabase) {
    const id = `demo-new-${Date.now()}`
    const imageUrl = URL.createObjectURL(uploadFiles[0])
    const shape = fallbackShape(category.slot)
    if (input.destination === 'closet') {
      demoClosetItems = [{
        id,
        name: input.name.trim(),
        categoryId: category.id,
        slot: category.slot ?? 'acc',
        categorySlot: category.slot,
        categoryName: category.name,
        colorName: input.colorName,
        colorHex: input.colorHex,
        secondColorHex: input.secondColorHex || undefined,
        brand: input.brand || undefined,
        size: input.size || undefined,
        necklineSize: input.necklineSize ?? undefined,
        status: input.closetStatus ?? 'ok',
        seasons: [...input.seasons],
        material: input.material || undefined,
        materialComposition: input.materialComposition || undefined,
        materialPercentages: input.materialPercentages ? { ...input.materialPercentages } : undefined,
        purchaseDate: input.purchaseDate || undefined,
        purchasePrice: input.purchasePrice ?? undefined,
        store: input.store || undefined,
        productUrl: input.productUrl || undefined,
        note: input.note || undefined,
        flatMeasurements: { ...input.flatMeasurements },
        cutoutUrl: imageUrl,
        shape,
      }, ...demoClosetItems]
    } else {
      demoWishlistItems = [{
        id,
        name: input.name.trim(),
        slot: category.slot!,
        colorHex: input.colorHex,
        shop: input.store || '尚未決定',
        brand: input.brand || undefined,
        price: input.purchasePrice ?? 0,
        url: input.productUrl || undefined,
        sizeNote: input.size || undefined,
        material: input.material || undefined,
        materialComposition: input.materialComposition || undefined,
        materialPercentages: input.materialPercentages ? { ...input.materialPercentages } : undefined,
        status: 'considering',
        cutoutUrl: imageUrl,
        shape,
      }, ...demoWishlistItems]
    }
    return { id, destination: input.destination, demo: true }
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('請重新登入後再新增衣物。')

  const id = crypto.randomUUID()
  const coverPath = `${user.id}/${id}/original.${fileExtension(uploadFiles[0])}`
  const flatMeasurements = Object.fromEntries(Object.entries(input.flatMeasurements).filter(([, value]) => value !== null))
  const uploadedPaths: string[] = []

  const itemPayload = {
    id,
    category_id: category.id,
    name: input.name.trim(),
    color_name: input.colorName,
    color_hex: input.colorHex,
    second_color_hex: input.secondColorHex || null,
    size: input.size?.trim() || '',
    neckline_size: input.necklineSize ?? null,
    brand: input.brand?.trim() || null,
    seasons: input.seasons,
    material: input.material?.trim() || null,
    material_composition: input.materialComposition?.trim() || null,
    material_percentages: input.materialPercentages ?? {},
    purchase_date: input.purchaseDate || null,
    purchase_price: input.purchasePrice ?? null,
    store: input.store?.trim() || null,
    product_url: input.productUrl?.trim() || null,
    note: input.note?.trim() || null,
    flat_measurements: flatMeasurements,
    image_original_path: coverPath,
    cutout_status: input.useCutout ? 'pending' : 'skipped',
  }

  try {
    if (input.destination === 'closet') {
      const { error } = await supabase.from('items').insert(itemPayload)
      if (error) throw error
    } else {
      const { error } = await supabase.from('wishlist_items').insert({
        id,
        name: input.name.trim(),
        category_id: category.id,
        slot: category.slot,
        color_name: input.colorName,
        color_hex: input.colorHex,
        second_color_hex: input.secondColorHex || null,
        brand: input.brand?.trim() || null,
        size: input.size?.trim() || null,
        neckline_size: input.necklineSize ?? null,
        seasons: input.seasons,
        material: input.material?.trim() || null,
        material_composition: input.materialComposition?.trim() || null,
        material_percentages: input.materialPercentages ?? {},
        shop: input.store?.trim() || '尚未決定',
        price: input.purchasePrice ?? 0,
        url: input.productUrl?.trim() || null,
        size_note: input.size?.trim() || null,
        status: 'considering',
        image_original_path: coverPath,
        cutout_status: input.useCutout ? 'pending' : 'skipped',
      })
      if (error) throw error
    }

    const photoRows = []
    for (const [index, file] of uploadFiles.entries()) {
      const path = index === 0 ? coverPath : `${user.id}/${id}/photos/${crypto.randomUUID()}.${fileExtension(file)}`
      const { error } = await supabase.storage.from(CUTOUT_BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
      if (error) throw error
      uploadedPaths.push(path)
      photoRows.push({
        owner_id: user.id,
        item_id: input.destination === 'closet' ? id : null,
        wishlist_item_id: input.destination === 'wishlist' ? id : null,
        storage_path: path,
        sort_order: index,
        is_cover: index === 0,
      })
    }
    const { error: photosError } = await supabase.from('item_photos').insert(photoRows)
    if (photosError) throw photosError
    return { id, destination: input.destination, demo: false }
  } catch (error) {
    if (uploadedPaths.length) await supabase.storage.from(CUTOUT_BUCKET).remove(uploadedPaths)
    if (input.destination === 'closet') await supabase.from('items').delete().eq('id', id)
    else await supabase.from('wishlist_items').delete().eq('id', id)
    throw error
  }
}

/** 建立隱藏中的衣物草稿、上傳最多 8 張照片；供照片／去背步驟使用。 */
export async function createGarmentDraft(categoryId: string, files: File[], useCutout: boolean): Promise<{ id: string; demo: boolean }> {
  if (files.length === 0 || files.length > 8) throw new Error('請選擇 1 到 8 張照片。')
  const uploadFiles = await Promise.all(files.map(toUploadableImage))
  if (!supabase) {
    const id = `demo-draft-${Date.now()}`
    demoGarmentDraftFiles.set(id, uploadFiles)
    return { id, demo: true }
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('請重新登入後再新增衣物。')

  const draftId = crypto.randomUUID()
  const coverPath = `${user.id}/${draftId}/original.${fileExtension(uploadFiles[0])}`
  const uploadedPaths: string[] = []
  try {
    const { error } = await supabase.from('items').insert({
      id: draftId,
      category_id: categoryId,
      name: '衣物草稿',
      color_name: '其他',
      color_hex: '#D9CBB3',
      size: '',
      status: 'retired',
      is_draft: true,
      image_original_path: coverPath,
      cutout_status: useCutout ? 'pending' : 'skipped',
    })
    if (error) throw error

    const photoRows = []
    for (const [index, file] of uploadFiles.entries()) {
      const path = index === 0 ? coverPath : `${user.id}/${draftId}/photos/${crypto.randomUUID()}.${fileExtension(file)}`
      const { error: uploadError } = await supabase.storage.from(CUTOUT_BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream' })
      if (uploadError) throw uploadError
      uploadedPaths.push(path)
      photoRows.push({ owner_id: user.id, item_id: draftId, storage_path: path, sort_order: index, is_cover: index === 0 })
    }
    const { error: photosError } = await supabase.from('item_photos').insert(photoRows)
    if (photosError) throw photosError
    return { id: draftId, demo: false }
  } catch (error) {
    if (uploadedPaths.length) await supabase.storage.from(CUTOUT_BUCKET).remove(uploadedPaths)
    await supabase.from('items').delete().eq('id', draftId)
    throw error
  }
}

/** 更新暫存衣物的表單欄位，但仍不顯示在一般衣櫃中。 */
export async function updateGarmentDraft(id: string, input: NewGarmentInput): Promise<void> {
  if (!supabase) return
  const category = (await fetchCategories()).find((entry) => entry.id === input.categoryId)
  if (!category) throw new Error('找不到選擇的衣物分類，請重新選擇。')
  const { error } = await supabase.from('items').update({
    category_id: category.id,
    name: input.name.trim(),
    color_name: input.colorName,
    color_hex: input.colorHex,
    second_color_hex: input.secondColorHex || null,
    brand: input.brand?.trim() || null,
    size: input.size?.trim() || '',
    neckline_size: input.necklineSize ?? null,
    seasons: input.seasons,
    material: input.material?.trim() || null,
    material_composition: input.materialComposition?.trim() || null,
    material_percentages: input.materialPercentages ?? {},
    purchase_date: input.purchaseDate || null,
    purchase_price: input.purchasePrice ?? null,
    store: input.store?.trim() || null,
    product_url: input.productUrl?.trim() || null,
    note: input.note?.trim() || null,
    flat_measurements: Object.fromEntries(Object.entries(input.flatMeasurements).filter(([, value]) => value !== null)),
    ...(!input.useCutout ? { image_cutout_path: null, cutout_status: 'skipped' } : {}),
  }).eq('id', id).eq('is_draft', true)
  if (error) throw error
}

/** 完成草稿：存進衣櫃或轉成選購清單，照片紀錄一併遷移。 */
export async function finalizeGarmentDraft(id: string, input: NewGarmentInput): Promise<{ id: string; destination: AddItemDestination; demo: boolean }> {
  if (!supabase) {
    const files = demoGarmentDraftFiles.get(id) ?? []
    if (!files.length) throw new Error('示範照片已失效，請回上一步重新選取。')
    const result = await createGarment(input, files)
    demoGarmentDraftFiles.delete(id)
    return result
  }
  const category = (await fetchCategories()).find((entry) => entry.id === input.categoryId)
  if (!category) throw new Error('找不到選擇的衣物分類，請重新選擇。')
  if (input.destination === 'wishlist' && !category.slot) throw new Error('「其他」分類不能加入選購清單，請選擇有搭配部位的類型。')

  if (input.destination === 'closet') {
    const { error } = await supabase.from('items').update({ status: input.closetStatus ?? 'ok', is_draft: false }).eq('id', id).eq('is_draft', true)
    if (error) throw error
    return { id, destination: 'closet', demo: false }
  }

  const { data: draft, error: draftError } = await supabase.from('items').select('image_original_path,image_cutout_path,cutout_status').eq('id', id).eq('is_draft', true).single()
  if (draftError) throw draftError
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('登入狀態已失效，請重新登入。')
  const { error: insertError } = await supabase.from('wishlist_items').insert({
    id,
    owner_id: user.id,
    name: input.name.trim(),
    slot: category.slot,
    color_hex: input.colorHex,
    shop: input.store?.trim() || '尚未決定',
    price: input.purchasePrice ?? 0,
    url: input.productUrl?.trim() || null,
    size_note: input.size?.trim() || null,
    neckline_size: input.necklineSize ?? null,
    material: input.material?.trim() || null,
    material_composition: input.materialComposition?.trim() || null,
    material_percentages: input.materialPercentages ?? {},
    flat_measurements: Object.fromEntries(Object.entries(input.flatMeasurements).filter(([, value]) => value !== null)),
    reason: input.note?.trim() || null,
    status: 'considering',
    image_original_path: draft.image_original_path,
    image_cutout_path: draft.image_cutout_path ?? draft.image_original_path,
    cutout_status: draft.cutout_status,
  })
  if (insertError) throw insertError
  const { error: photoUpdateError } = await supabase.from('item_photos').update({ item_id: null, wishlist_item_id: id }).eq('item_id', id)
  if (photoUpdateError) {
    await supabase.from('wishlist_items').delete().eq('id', id)
    throw photoUpdateError
  }
  const { error: draftDeleteError } = await supabase.from('items').delete().eq('id', id).eq('is_draft', true)
  if (draftDeleteError) {
    await supabase.from('item_photos').update({ item_id: id, wishlist_item_id: null }).eq('wishlist_item_id', id)
    await supabase.from('wishlist_items').delete().eq('id', id)
    throw draftDeleteError
  }
  return { id, destination: 'wishlist', demo: false }
}

/** 取消新增流程時刪除未完成的暫存列和 Storage 物件。 */
export async function discardGarmentDraft(id: string): Promise<void> {
  if (!supabase) {
    demoGarmentDraftFiles.delete(id)
    return
  }
  const { data: photos, error: photosError } = await supabase.from('item_photos').select('storage_path').eq('item_id', id)
  if (photosError) throw photosError
  const { data: item, error: itemError } = await supabase.from('items').select('image_original_path,image_cutout_path').eq('id', id).eq('is_draft', true).maybeSingle()
  if (itemError) throw itemError
  const paths = [...(photos ?? []).map((photo) => photo.storage_path), item?.image_original_path, item?.image_cutout_path].filter((path): path is string => !!path)
  if (paths.length) {
    const { error } = await supabase.storage.from(CUTOUT_BUCKET).remove([...new Set(paths)])
    if (error) throw error
  }
  const { error } = await supabase.from('items').delete().eq('id', id).eq('is_draft', true)
  if (error) throw error
}

/** 移除原圖與去背圖物件，以及衣物／選購候選的資料列。 */
export async function deleteGarment(id: string, destination: AddItemDestination): Promise<void> {
  if (!supabase) {
    if (destination === 'closet') demoClosetItems = demoClosetItems.filter((item) => item.id !== id)
    else demoWishlistItems = demoWishlistItems.filter((item) => item.id !== id)
    return
  }
  const table = destination === 'closet' ? 'items' : 'wishlist_items'
  const { data, error } = await supabase.from(table).select('image_original_path,image_cutout_path').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return
  const paths = [data.image_original_path, data.image_cutout_path].filter((path): path is string => !!path)
  const { data: photos, error: photoError } = await supabase.from('item_photos').select('storage_path').eq(destination === 'closet' ? 'item_id' : 'wishlist_item_id', id)
  if (photoError) throw photoError
  paths.push(...(photos ?? []).map((photo) => photo.storage_path))
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from(CUTOUT_BUCKET).remove([...new Set(paths)])
    if (storageError) throw storageError
  }
  const { error: deleteError } = await supabase.from(table).delete().eq('id', id)
  if (deleteError) throw deleteError
}

/** 儲存穿搭到「穿搭日記」。示範模式回傳 demo: true，不寫入任何資料。 */
export async function saveOutfit(outfit: Outfit): Promise<{ demo: boolean; id?: string }> {
  if (!supabase) {
    const hypothetical = outfit.isHypothetical ?? Object.values(outfit.picks).some((pick) => pick?.kind === 'wish')
    if (hypothetical) return { demo: true }
    // 示範模式：今日搭配存檔也會出現在穿搭日記
    const id = `demo-outfit-${Date.now()}`
    demoDiary = [{ id, name: outfit.name, date: outfit.date, template: outfit.template, picks: { ...outfit.picks }, occasions: outfit.occasion ? [outfit.occasion] : [], rating: null, feel: null, weather: null, temperatureC: null, note: outfit.note ?? '', bgTheme: outfit.bgTheme ?? 'plain', bgBlobMode: outfit.bgBlobMode ?? 'on', bgCustom: outfit.bgCustom ?? { a: '#E7B9B4', b: '#8C9A86' }, createdAt: new Date().toISOString() }, ...demoDiary]
    demoAdjustWear(Object.values(outfit.picks).flatMap((pick) => (pick?.kind === 'closet' ? [pick.itemId] : [])), 1, outfit.date)
    return { demo: true, id }
  }
  const { data, error } = await supabase
    .from('outfits')
    .insert({
      name: outfit.name,
      worn_on: outfit.date,
      template: outfit.template,
      layout: outfit.template === 'free' ? (outfit.layout ?? null) : null,
      occasion: outfit.occasion ?? null,
      note: outfit.note ?? null,
      bg_theme: outfit.bgTheme ?? 'plain',
      bg_blob_mode: outfit.bgBlobMode ?? 'on',
      bg_custom: outfit.bgCustom ?? { a: '#E7B9B4', b: '#8C9A86' },
      is_hypothetical: outfit.isHypothetical ?? Object.values(outfit.picks).some((pick) => pick?.kind === 'wish'),
    })
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

/** 讀取個人偏好與量測紀錄；示範模式使用記憶體中的範例資料。 */
export async function fetchProfileData(): Promise<{ profile: ProfilePreferences; measurements: BodyMeasurement[] }> {
  if (!supabase) {
    return {
      profile: cloneProfile(demoProfile),
      measurements: demoMeasurements.map((measurement) => ({ ...measurement })),
    }
  }

  const [profileResult, measurementsResult] = await Promise.all([
    supabase.from('profiles').select('ai_use_body_data,shoe_sizes,frequent_sizes,fit_preferences,highlight_areas,proportion_notes,disliked_cuts').maybeSingle(),
    supabase.from('body_measurements').select('*').order('measured_on', { ascending: false }).order('created_at', { ascending: false }),
  ])
  if (profileResult.error) throw profileResult.error
  if (measurementsResult.error) throw measurementsResult.error

  const row = profileResult.data
  const profile: ProfilePreferences = row ? {
    aiUseBodyData: row.ai_use_body_data,
    shoeSizes: Array.isArray(row.shoe_sizes) ? row.shoe_sizes as ProfilePreferences['shoeSizes'] : [],
    frequentSizes: row.frequent_sizes ?? [],
    fitPreferences: row.fit_preferences ?? [],
    highlightAreas: row.highlight_areas ?? '',
    proportionNotes: row.proportion_notes ?? '',
    dislikedCuts: row.disliked_cuts ?? [],
  } : cloneProfile(SAMPLE_PROFILE)

  return {
    profile,
    measurements: (measurementsResult.data ?? []).map((measurement) => mapMeasurement(measurement as Record<string, unknown>)),
  }
}

/** 儲存個人穿搭與隱私偏好。示範模式只保留在目前工作階段。 */
export async function saveProfilePreferences(profile: ProfilePreferences): Promise<{ demo: boolean }> {
  if (!supabase) {
    demoProfile = cloneProfile(profile)
    return { demo: true }
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('請重新登入後再儲存個人資料。')

  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    ai_use_body_data: profile.aiUseBodyData,
    shoe_sizes: profile.shoeSizes,
    frequent_sizes: profile.frequentSizes,
    fit_preferences: profile.fitPreferences,
    highlight_areas: profile.highlightAreas || null,
    proportion_notes: profile.proportionNotes || null,
    disliked_cuts: profile.dislikedCuts,
  })
  if (error) throw error
  return { demo: false }
}

/** 新增或更新一筆量測紀錄。 */
export async function saveBodyMeasurement(input: BodyMeasurementInput): Promise<{ measurement: BodyMeasurement; demo: boolean }> {
  if (!supabase) {
    const now = new Date().toISOString()
    const measurement: BodyMeasurement = {
      ...input,
      id: input.id ?? `demo-measurement-${Date.now()}`,
      createdAt: input.id ? demoMeasurements.find((item) => item.id === input.id)?.createdAt ?? now : now,
      updatedAt: now,
    }
    demoMeasurements = input.id
      ? demoMeasurements.map((item) => item.id === input.id ? measurement : item)
      : [measurement, ...demoMeasurements]
    return { measurement, demo: true }
  }

  const payload = measurementPayload(input)
  const result = input.id
    ? await supabase.from('body_measurements').update(payload).eq('id', input.id).select('*').single()
    : await supabase.from('body_measurements').insert(payload).select('*').single()
  if (result.error) throw result.error
  return { measurement: mapMeasurement(result.data as Record<string, unknown>), demo: false }
}

/** 刪除一筆量測紀錄。 */
export async function deleteBodyMeasurement(id: string): Promise<{ demo: boolean }> {
  if (!supabase) {
    demoMeasurements = demoMeasurements.filter((measurement) => measurement.id !== id)
    return { demo: true }
  }
  const { error } = await supabase.from('body_measurements').delete().eq('id', id)
  if (error) throw error
  return { demo: false }
}

/** 儲存進階搭配工作台的任意多件單品與畫布位置。 */
export async function saveStudioOutfit(input: { id?: string; name: string; items: StudioCanvasItem[]; bgTheme: StudioBackgroundTheme; bgBlobMode: StudioBackgroundMode; bgCustom: StudioBackgroundCustom }): Promise<{ id: string; demo: boolean }> {
  if (!supabase) return { id: input.id ?? `demo-studio-${Date.now()}`, demo: true }

  const isHypothetical = input.items.some((item) => item.source === 'wishlist')
  let outfitId = input.id
  if (outfitId) {
    const { data, error } = await supabase.from('outfits').update({
      name: input.name.trim() || '未命名搭配',
      template: 'free',
      is_hypothetical: isHypothetical,
      bg_theme: input.bgTheme,
      bg_blob_mode: input.bgBlobMode,
      bg_custom: input.bgCustom,
    }).eq('id', outfitId).select('id').maybeSingle()
    if (error) throw error
    if (!data) outfitId = undefined
  }

  if (!outfitId) {
    const { data, error } = await supabase.from('outfits').insert({
      name: input.name.trim() || '未命名搭配',
      template: 'free',
      is_hypothetical: isHypothetical,
      bg_theme: input.bgTheme,
      bg_blob_mode: input.bgBlobMode,
      bg_custom: input.bgCustom,
    }).select('id').single()
    if (error) throw error
    outfitId = data.id
  }
  if (!outfitId) throw new Error('無法取得穿搭 ID，請稍後重試。')

  const { error: deleteError } = await supabase.from('outfit_canvas_items').delete().eq('outfit_id', outfitId)
  if (deleteError) throw deleteError

  if (input.items.length) {
    const rows = input.items.map(({ source, itemId, placement }) => ({
      outfit_id: outfitId,
      item_id: source === 'closet' ? itemId : null,
      wishlist_item_id: source === 'wishlist' ? itemId : null,
      x: placement.x,
      y: placement.y,
      w: placement.w,
      rot: placement.rot,
      z: placement.z,
    }))
    const { error } = await supabase.from('outfit_canvas_items').insert(rows)
    if (error) throw error
  }
  return { id: outfitId, demo: false }
}

/** 使用登入者 JWT 呼叫去背 Edge Function；region 為框選範圍（百分比），不給則用整張照片。 */
export async function removeItemBackground(target: ({ itemId: string } | { wishlistItemId: string }) & { photoIndex?: number; region?: CutoutRegion | null }): Promise<{ itemId: string; cutoutPath: string; status: 'done' }> {
  if (!supabase) throw new Error('自動去背需要連接 Supabase；示範模式不會上傳照片。')
  const { data, error } = await supabase.functions.invoke('remove-background', { body: target })
  if (error) throw error
  if (!data || data.status !== 'done' || typeof data.cutoutPath !== 'string') {
    throw new Error(typeof data?.error === 'string' ? data.error : '去背沒有完成，原始圖片仍會保留。')
  }
  return data as { itemId: string; cutoutPath: string; status: 'done' }
}

// ---------- 穿搭日記 ----------

let demoDiary: DiaryEntry[] = SAMPLE_DIARY.map((entry) => ({ ...entry, picks: { ...entry.picks }, occasions: [...entry.occasions] }))
const demoDiaryPhotos = new Map<string, string>()

interface DiaryRow {
  id: string
  name: string
  worn_on: string
  template: DiaryEntry['template']
  occasion: string | null
  occasions: string[] | null
  rating: number | null
  feel: DiaryFeel | null
  comfortable: boolean | null
  weather: DiaryWeather | null
  temperature_c: number | null
  note: string | null
  bg_theme: StudioBackgroundTheme | null
  bg_blob_mode: StudioBackgroundMode | null
  bg_custom: StudioBackgroundCustom | null
  photo_path: string | null
  created_at: string
  outfit_items: { slot: Slot; item_id: string | null; wishlist_item_id: string | null }[] | null
}

const DIARY_COLUMNS = 'id,name,worn_on,template,occasion,occasions,rating,feel,comfortable,weather,temperature_c,note,bg_theme,bg_blob_mode,bg_custom,photo_path,created_at,outfit_items(slot,item_id,wishlist_item_id)'

function cloneDiary(entry: DiaryEntry): DiaryEntry {
  return { ...entry, picks: { ...entry.picks }, occasions: [...entry.occasions] }
}

function sortDiary(entries: DiaryEntry[]) {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
}

/** 日記：有日期、不是「如果買了」試搭的穿搭，新到舊。 */
export async function fetchDiaryEntries(): Promise<DiaryEntry[]> {
  if (!supabase) return sortDiary(demoDiary).map((entry) => ({ ...cloneDiary(entry), photoUrl: demoDiaryPhotos.get(entry.id) }))
  const { data, error } = await supabase
    .from('outfits')
    .select(DIARY_COLUMNS)
    .eq('is_hypothetical', false)
    .not('worn_on', 'is', null)
    .order('worn_on', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  const rows = (data ?? []) as unknown as DiaryRow[]
  const urls = await signed(rows.map((r) => r.photo_path).filter((p): p is string => !!p))
  return rows.map((r) => {
    const picks: DiaryEntry['picks'] = {}
    for (const oi of r.outfit_items ?? []) {
      if (oi.item_id) picks[oi.slot] = { kind: 'closet', itemId: oi.item_id }
      else if (oi.wishlist_item_id) picks[oi.slot] = { kind: 'wish', wishId: oi.wishlist_item_id }
    }
    return {
      id: r.id,
      name: r.name,
      date: r.worn_on,
      template: r.template,
      picks,
      occasions: r.occasions?.length ? r.occasions : r.occasion ? [r.occasion] : [],
      rating: r.rating,
      feel: r.feel ?? (r.comfortable === null ? null : r.comfortable ? 'comfy' : 'uncomfy'),
      weather: r.weather,
      temperatureC: r.temperature_c,
      note: r.note ?? '',
      bgTheme: r.bg_theme ?? 'plain',
      bgBlobMode: r.bg_blob_mode ?? 'on',
      bgCustom: r.bg_custom ?? { a: '#E7B9B4', b: '#8C9A86' },
      photoUrl: r.photo_path ? urls[r.photo_path] : undefined,
      createdAt: r.created_at,
    }
  })
}

function checkDiaryInput(input: DiaryEntryInput) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error('請選擇日期。')
  if (!Object.values(input.picks).some(Boolean)) throw new Error('至少放一件這天穿的衣物。')
  if (input.rating !== null && (input.rating < 1 || input.rating > 5)) throw new Error('評分要在 1 到 5 分之間。')
  if (input.temperatureC !== null && (!Number.isInteger(input.temperatureC) || input.temperatureC < -30 || input.temperatureC > 50)) throw new Error('氣溫請填 -30 到 50 之間的整數。')
}

const diaryName = (input: DiaryEntryInput) => input.name.trim() || `${Number(input.date.slice(5, 7))} 月 ${Number(input.date.slice(8, 10))} 日的穿搭`

function diaryPayload(input: DiaryEntryInput) {
  return {
    name: diaryName(input),
    worn_on: input.date,
    occasions: input.occasions,
    occasion: input.occasions[0] ?? null,
    rating: input.rating,
    feel: input.feel,
    comfortable: input.feel === null || input.feel === 'ok' ? null : input.feel === 'comfy',
    weather: input.weather,
    temperature_c: input.temperatureC,
    note: input.note.trim() || null,
    is_hypothetical: false,
  }
}

/** 示範模式：依單品增減調整穿過次數 */
function demoAdjustWear(ids: string[], delta: 1 | -1, date?: string) {
  if (!ids.length) return
  demoClosetItems = demoClosetItems.map((item) => {
    if (!ids.includes(item.id)) return item
    const wearCount = Math.max(0, (item.wearCount ?? 0) + delta)
    const lastWornAt = delta === 1 && date && (!item.lastWornAt || date > item.lastWornAt) ? date : item.lastWornAt
    return { ...item, wearCount, lastWornAt }
  })
}

const closetIds = (picks: Partial<Record<Slot, string>>) => Object.values(picks).filter((id): id is string => !!id)

async function uploadDiaryPhoto(outfitId: string, file: File): Promise<string> {
  const { data: { user }, error } = await supabase!.auth.getUser()
  if (error) throw error
  if (!user) throw new Error('登入狀態已失效，請重新登入。')
  const uploadFile = await toUploadableImage(file)
  if (uploadFile.size > 10 * 1024 * 1024) throw new Error('照片需小於 10 MB。')
  const path = `${user.id}/outfits/${outfitId}/photo-${Date.now()}.${fileExtension(uploadFile)}`
  const { error: uploadError } = await supabase!.storage.from(CUTOUT_BUCKET).upload(path, uploadFile, { contentType: uploadFile.type || 'application/octet-stream', upsert: false })
  if (uploadError) throw uploadError
  return path
}

async function replaceOutfitItems(outfitId: string, picks: Partial<Record<Slot, string>>) {
  const { error: deleteError } = await supabase!.from('outfit_items').delete().eq('outfit_id', outfitId)
  if (deleteError) throw deleteError
  const rows = Object.entries(picks).filter(([, id]) => id).map(([slot, id]) => ({ outfit_id: outfitId, slot, item_id: id, wishlist_item_id: null }))
  if (rows.length) {
    const { error } = await supabase!.from('outfit_items').insert(rows)
    if (error) throw error
  }
}

/** 新增日記。穿過次數由資料庫 trigger 增加（示範模式在記憶體裡模擬）。 */
export async function createDiaryEntry(input: DiaryEntryInput, photo?: File | null): Promise<{ id: string; demo: boolean }> {
  checkDiaryInput(input)
  if (!supabase) {
    const id = `demo-diary-${Date.now()}`
    demoDiary = [{
      id,
      name: diaryName(input),
      date: input.date,
      template: 'full',
      picks: Object.fromEntries(Object.entries(input.picks).filter(([, v]) => v).map(([slot, itemId]) => [slot, { kind: 'closet', itemId: itemId! }])),
      occasions: [...input.occasions],
      rating: input.rating,
      feel: input.feel,
      weather: input.weather,
      temperatureC: input.temperatureC,
      note: input.note.trim(),
      createdAt: new Date().toISOString(),
    }, ...demoDiary]
    if (photo) demoDiaryPhotos.set(id, URL.createObjectURL(photo))
    demoAdjustWear(closetIds(input.picks), 1, input.date)
    return { id, demo: true }
  }

  const id = crypto.randomUUID()
  const { error } = await supabase.from('outfits').insert({ id, template: 'full', ...diaryPayload(input) })
  if (error) throw error
  try {
    await replaceOutfitItems(id, input.picks)
    if (photo) {
      const path = await uploadDiaryPhoto(id, photo)
      const { error: photoError } = await supabase.from('outfits').update({ photo_path: path }).eq('id', id)
      if (photoError) {
        await supabase.storage.from(CUTOUT_BUCKET).remove([path])
        throw photoError
      }
    }
  } catch (err) {
    await supabase.from('outfits').delete().eq('id', id)
    throw err
  }
  return { id, demo: false }
}

/** 編輯日記：單品變更時，trigger 會替拿掉的單品減 1、加入的加 1。 */
export async function updateDiaryEntry(id: string, input: DiaryEntryInput, photo: DiaryPhotoChange): Promise<{ demo: boolean }> {
  checkDiaryInput(input)
  if (!supabase) {
    const base = demoDiary.find((entry) => entry.id === id)
    if (!base) throw new Error('找不到這筆紀錄，可能已被刪除。')
    const before = Object.values(base.picks).flatMap((pick) => (pick?.kind === 'closet' ? [pick.itemId] : []))
    const after = closetIds(input.picks)
    demoAdjustWear(before.filter((x) => !after.includes(x)), -1)
    demoAdjustWear(after.filter((x) => !before.includes(x)), 1, input.date)
    demoDiary = demoDiary.map((entry) => entry.id === id ? {
      ...entry,
      name: diaryName(input),
      date: input.date,
      picks: Object.fromEntries(Object.entries(input.picks).filter(([, v]) => v).map(([slot, itemId]) => [slot, { kind: 'closet', itemId: itemId! }])),
      occasions: [...input.occasions],
      rating: input.rating,
      feel: input.feel,
      weather: input.weather,
      temperatureC: input.temperatureC,
      note: input.note.trim(),
    } : entry)
    if (photo) demoDiaryPhotos.set(id, URL.createObjectURL(photo))
    else if (photo === null) demoDiaryPhotos.delete(id)
    return { demo: true }
  }

  const { data: current, error: readError } = await supabase.from('outfits').select('photo_path').eq('id', id).maybeSingle()
  if (readError) throw readError
  if (!current) throw new Error('找不到這筆紀錄，可能已被刪除。')
  let photoPath: string | null | undefined
  if (photo) photoPath = await uploadDiaryPhoto(id, photo)
  else if (photo === null) photoPath = null

  const { error } = await supabase.from('outfits').update({ ...diaryPayload(input), ...(photoPath !== undefined ? { photo_path: photoPath } : {}) }).eq('id', id)
  if (error) {
    if (photoPath) await supabase.storage.from(CUTOUT_BUCKET).remove([photoPath])
    throw error
  }
  await replaceOutfitItems(id, input.picks)
  if (photoPath !== undefined && current.photo_path) await supabase.storage.from(CUTOUT_BUCKET).remove([current.photo_path])
  return { demo: false }
}

/** 刪除日記與照片；穿過次數由 trigger 減 1。 */
export async function deleteDiaryEntry(id: string): Promise<{ demo: boolean }> {
  if (!supabase) {
    const base = demoDiary.find((entry) => entry.id === id)
    if (base) demoAdjustWear(Object.values(base.picks).flatMap((pick) => (pick?.kind === 'closet' ? [pick.itemId] : [])), -1)
    demoDiary = demoDiary.filter((entry) => entry.id !== id)
    demoDiaryPhotos.delete(id)
    return { demo: true }
  }
  const { data, error: readError } = await supabase.from('outfits').select('photo_path').eq('id', id).maybeSingle()
  if (readError) throw readError
  const { error } = await supabase.from('outfits').delete().eq('id', id)
  if (error) throw error
  if (data?.photo_path) await supabase.storage.from(CUTOUT_BUCKET).remove([data.photo_path])
  return { demo: false }
}

// ---------- 品牌管理 ----------

/** 示範模式：手動新增、還沒有衣物在用的品牌，以及標記「不是同一個」的組合 */
let demoBrands = new Set<string>(['Beams'])
const demoDistinctGroups = new Set<string>()

const laterDate = (a: string | null, b?: string | null) => (b && (!a || b > a) ? b : a)

function summarizeBrands(
  closet: { brand?: string | null; date?: string | null }[],
  wishes: { brand?: string | null; date?: string | null }[],
  manual: string[],
): BrandSummary[] {
  const map = new Map<string, BrandSummary>()
  const entry = (name: string) => {
    let found = map.get(name)
    if (!found) map.set(name, (found = { name, closetCount: 0, wishCount: 0, lastUsed: null }))
    return found
  }
  for (const name of manual) entry(name)
  for (const row of closet) {
    const name = row.brand?.trim()
    if (!name) continue
    const e = entry(name)
    e.closetCount += 1
    e.lastUsed = laterDate(e.lastUsed, row.date?.slice(0, 10))
  }
  for (const row of wishes) {
    const name = row.brand?.trim()
    if (!name) continue
    const e = entry(name)
    e.wishCount += 1
    e.lastUsed = laterDate(e.lastUsed, row.date?.slice(0, 10))
  }
  return [...map.values()]
}

/** 品牌清單（含衣櫃／選購件數、最後使用日）與使用者標記為「不是同一個」的組合 */
export async function fetchBrands(): Promise<{ brands: BrandSummary[]; distinctGroups: string[] }> {
  if (!supabase) {
    return {
      brands: summarizeBrands(
        demoClosetItems.map((item) => ({ brand: item.brand, date: laterDate(item.lastWornAt ?? null, item.purchaseDate) })),
        demoWishlistItems.filter((wish) => wish.status !== 'bought').map((wish) => ({ brand: wish.brand, date: wish.createdAt })),
        [...demoBrands],
      ),
      distinctGroups: [...demoDistinctGroups],
    }
  }
  const [items, wishes, manual, groups] = await Promise.all([
    supabase.from('items').select('brand,created_at,last_worn_at').eq('is_draft', false).not('brand', 'is', null),
    supabase.from('wishlist_items').select('brand,created_at').neq('status', 'bought').not('brand', 'is', null),
    supabase.from('brands').select('name'),
    supabase.from('brand_distinct_groups').select('group_key'),
  ])
  for (const result of [items, wishes, manual, groups]) if (result.error) throw result.error
  return {
    brands: summarizeBrands(
      (items.data ?? []).map((row) => ({ brand: row.brand, date: laterDate(row.created_at, row.last_worn_at) })),
      (wishes.data ?? []).map((row) => ({ brand: row.brand, date: row.created_at })),
      (manual.data ?? []).map((row) => row.name as string),
    ),
    distinctGroups: (groups.data ?? []).map((row) => row.group_key as string),
  }
}

/** 新增一個還沒有衣物在用的品牌 */
export async function createBrand(name: string): Promise<{ demo: boolean }> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('請輸入品牌名稱。')
  if (trimmed.length > 60) throw new Error('品牌名稱最多 60 個字。')
  if (!supabase) {
    demoBrands.add(trimmed)
    return { demo: true }
  }
  const { error } = await supabase.from('brands').upsert({ name: trimmed }, { onConflict: 'owner_id,name', ignoreDuplicates: true })
  if (error) throw error
  return { demo: false }
}

/**
 * 把 from 裡的每個品牌換成 to（null＝清空品牌欄位），衣物與選購清單一起更新。
 * 改名、合併、刪除都用這個；回傳每個品牌被改到的資料，供復原。
 */
export async function replaceBrands(from: string[], to: string | null): Promise<BrandChange[]> {
  const target = to?.trim() || null
  if (target && target.length > 60) throw new Error('品牌名稱最多 60 個字。')
  const names = [...new Set(from)].filter((name) => name !== target)
  if (!supabase) {
    const changes = names.map((name) => ({
      name,
      itemIds: demoClosetItems.filter((item) => item.brand?.trim() === name).map((item) => item.id),
      wishIds: demoWishlistItems.filter((wish) => wish.brand?.trim() === name).map((wish) => wish.id),
    }))
    const hit = new Set(names)
    demoClosetItems = demoClosetItems.map((item) => (item.brand && hit.has(item.brand.trim()) ? { ...item, brand: target ?? undefined } : item))
    demoWishlistItems = demoWishlistItems.map((wish) => (wish.brand && hit.has(wish.brand.trim()) ? { ...wish, brand: target ?? undefined } : wish))
    demoBrands = new Set([...demoBrands].filter((name) => !hit.has(name)))
    if (target) demoBrands.add(target)
    for (const key of [...demoDistinctGroups]) if (key.split('\n').some((name) => hit.has(name))) demoDistinctGroups.delete(key)
    return changes
  }
  const changes: BrandChange[] = []
  // 一個品牌呼叫一次，才能分別記住要復原哪些資料
  for (const name of names) {
    const { data, error } = await supabase.rpc('replace_brands', { p_from: [name], p_to: target })
    if (error) throw error
    const result = (data ?? {}) as { items?: string[]; wishes?: string[] }
    changes.push({ name, itemIds: result.items ?? [], wishIds: result.wishes ?? [] })
  }
  return changes
}

/** 復原剛刪除的品牌：把衣物與選購改回原名，並放回品牌清單 */
export async function restoreBrands(changes: BrandChange[]): Promise<void> {
  if (!supabase) {
    for (const change of changes) {
      demoClosetItems = demoClosetItems.map((item) => (change.itemIds.includes(item.id) ? { ...item, brand: change.name } : item))
      demoWishlistItems = demoWishlistItems.map((wish) => (change.wishIds.includes(wish.id) ? { ...wish, brand: change.name } : wish))
      demoBrands.add(change.name)
    }
    return
  }
  for (const change of changes) {
    const { error } = await supabase.rpc('restore_brand', { p_name: change.name, p_items: change.itemIds, p_wishes: change.wishIds })
    if (error) throw error
  }
}

/** 「不是同一個」：之後不再把這組名稱列為可能重複 */
export async function markBrandsDistinct(groupKey: string): Promise<{ demo: boolean }> {
  if (!supabase) {
    demoDistinctGroups.add(groupKey)
    return { demo: true }
  }
  const { error } = await supabase.from('brand_distinct_groups').upsert({ group_key: groupKey }, { onConflict: 'owner_id,group_key', ignoreDuplicates: true })
  if (error) throw error
  return { demo: false }
}

export type ManagedListKind = 'shops' | 'materials'
export interface ManagedListFields {
  name: string
  kind?: ShopKind
  url?: string
  aliases?: string[]
  sortOrder?: number
  isHidden?: boolean
}

function replaceDelimitedValue(value: string | undefined, from: string, to: string | null) {
  const values = materialNames(value).map((part) => part === from ? to : part).filter((part): part is string => !!part)
  return [...new Set(values)].join('、')
}

function selectedMaterialNames(value?: string | null) {
  return materialNames(value ?? undefined).filter((name) => !/%/.test(name))
}

function summarizeManagedList(
  kind: ManagedListKind,
  metadata: Map<string, Partial<ManagedListSummary>>,
  closet: { value?: string | null; percentages?: Record<string, number> | null; date?: string | null }[],
  wishes: { value?: string | null; percentages?: Record<string, number> | null; date?: string | null }[],
): ManagedListSummary[] {
  const result = new Map<string, ManagedListSummary>()
  const ensure = (name: string) => {
    let entry = result.get(name)
    if (!entry) {
      entry = { name, closetCount: 0, wishCount: 0, lastUsed: null, ...metadata.get(name) }
      result.set(name, entry)
    }
    return entry
  }
  for (const name of metadata.keys()) ensure(name)
  for (const row of closet) {
    const names = kind === 'shops' ? [row.value?.trim()].filter((name): name is string => !!name) : [...new Set([...selectedMaterialNames(row.value), ...Object.keys(row.percentages ?? {})])]
    for (const name of names) {
      const entry = ensure(name)
      entry.closetCount += 1
      entry.lastUsed = laterDate(entry.lastUsed, row.date?.slice(0, 10))
    }
  }
  for (const row of wishes) {
    const names = kind === 'shops' ? [row.value?.trim()].filter((name): name is string => !!name && name !== '尚未決定') : [...new Set([...selectedMaterialNames(row.value), ...Object.keys(row.percentages ?? {})])]
    for (const name of names) {
      const entry = ensure(name)
      entry.wishCount += 1
      entry.lastUsed = laterDate(entry.lastUsed, row.date?.slice(0, 10))
    }
  }
  return [...result.values()]
}

/** 讀取購買通路或材質管理清單及使用統計。 */
export async function fetchManagedList(kind: ManagedListKind, includeHidden = false): Promise<{ entries: ManagedListSummary[]; distinctGroups: string[] }> {
  if (!supabase) {
    const metadata = kind === 'shops' ? demoManagedShops : demoManagedMaterials
    if (kind === 'materials') {
      for (const item of [...demoClosetItems, ...demoWishlistItems]) for (const name of selectedMaterialNames(item.material)) {
        if (!demoManagedMaterials.has(name)) demoManagedMaterials.set(name, { aliases: [], sortOrder: 500, isDefault: false, isHidden: false })
      }
    }
    const meta = new Map<string, Partial<ManagedListSummary>>([...metadata].map(([name, value]) => [name, { ...value }]))
    const entries = summarizeManagedList(kind, meta,
      demoClosetItems.map((item) => ({ value: kind === 'shops' ? item.store : item.material, percentages: item.materialPercentages, date: item.purchaseDate })),
      demoWishlistItems.map((item) => ({ value: kind === 'shops' ? item.shop : item.material, percentages: item.materialPercentages, date: item.createdAt })),
    ).filter((entry) => includeHidden || !entry.isHidden)
    return { entries, distinctGroups: [] }
  }

  if (kind === 'materials') {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError) throw authError
    if (user) {
      const seeds = MATERIAL_DEFAULTS.map((material) => ({ owner_id: user.id, name: material.name, aliases: [...material.aliases], sort_order: material.sortOrder, is_default: true }))
      const { error } = await supabase.from('materials').upsert(seeds, { onConflict: 'owner_id,name', ignoreDuplicates: true })
      if (error) throw error
    }
  }

  const [metadataResult, itemsResult, wishesResult, groupsResult] = await Promise.all([
    kind === 'shops' ? supabase.from('shops').select('name,kind,url') : supabase.from('materials').select('name,aliases,sort_order,is_default,is_hidden'),
    supabase.from('items').select('store,material,material_percentages,created_at,purchase_date').eq('is_draft', false),
    supabase.from('wishlist_items').select('shop,material,material_percentages,created_at'),
    kind === 'shops' ? supabase.from('shop_distinct_groups').select('group_key') : supabase.from('material_distinct_groups').select('group_key'),
  ])
  for (const result of [metadataResult, itemsResult, wishesResult, groupsResult]) if (result.error) throw result.error
  const metadataRows = (metadataResult.data ?? []) as unknown as Record<string, unknown>[]
  const itemRows = (itemsResult.data ?? []) as unknown as Record<string, unknown>[]
  const wishRows = (wishesResult.data ?? []) as unknown as Record<string, unknown>[]
  const metadata = new Map<string, Partial<ManagedListSummary>>(metadataRows.map((row) => [String(row.name), kind === 'shops'
    ? { kind: row.kind as ShopKind, url: row.url == null ? undefined : String(row.url) }
    : { aliases: row.aliases as string[] ?? [], sortOrder: Number(row.sort_order ?? 100), isDefault: Boolean(row.is_default), isHidden: Boolean(row.is_hidden) }]))
  const entries = summarizeManagedList(kind, metadata,
    itemRows.map((row) => ({ value: kind === 'shops' ? row.store as string | null : row.material as string | null, percentages: row.material_percentages as Record<string, number> | null, date: (row.purchase_date ?? row.created_at) as string | null })),
    wishRows.map((row) => ({ value: kind === 'shops' ? row.shop as string | null : row.material as string | null, percentages: row.material_percentages as Record<string, number> | null, date: row.created_at as string | null })),
  ).filter((entry) => includeHidden || !entry.isHidden)
  return { entries, distinctGroups: (groupsResult.data ?? []).map((row) => row.group_key as string) }
}

/** 新增自訂通路或材質；系統預設材質由 fetchManagedList 確保建立。 */
export async function createManagedEntry(kind: ManagedListKind, fields: ManagedListFields): Promise<void> {
  const name = fields.name.trim()
  if (!name) throw new Error(`請輸入${kind === 'shops' ? '通路' : '材質'}名稱。`)
  if (!supabase) {
    if (kind === 'shops') demoManagedShops.set(name, { kind: fields.kind ?? 'other', url: fields.url?.trim() || undefined })
    else demoManagedMaterials.set(name, { aliases: fields.aliases ?? [], sortOrder: fields.sortOrder ?? 500, isDefault: false, isHidden: false })
    return
  }
  const { error } = kind === 'shops'
    ? await supabase.from('shops').upsert({ name, kind: fields.kind ?? 'other', url: fields.url?.trim() || null }, { onConflict: 'owner_id,name', ignoreDuplicates: true })
    : await supabase.from('materials').upsert({ name, aliases: fields.aliases ?? [], sort_order: fields.sortOrder ?? 500, is_default: false, is_hidden: false }, { onConflict: 'owner_id,name', ignoreDuplicates: true })
  if (error) throw error
}

/** 改名會同步更新衣物與選購清單；同名目標改由合併流程處理。 */
export async function updateManagedEntry(kind: ManagedListKind, oldName: string, fields: ManagedListFields): Promise<void> {
  const name = fields.name.trim()
  if (!name) throw new Error('名稱不能空白。')
  if (name !== oldName) await replaceManagedEntries(kind, [oldName], name)
  if (!supabase) {
    if (kind === 'shops') {
      const old = demoManagedShops.get(oldName) ?? { kind: 'other' as const }
      demoManagedShops.delete(oldName)
      demoManagedShops.set(name, { kind: fields.kind ?? old.kind, url: fields.url?.trim() || undefined })
      demoClosetItems = demoClosetItems.map((item) => item.store === oldName ? { ...item, store: name } : item)
      demoWishlistItems = demoWishlistItems.map((item) => item.shop === oldName ? { ...item, shop: name } : item)
    } else {
      const old = demoManagedMaterials.get(oldName) ?? { aliases: [], sortOrder: 500, isDefault: false, isHidden: false }
      demoManagedMaterials.delete(oldName)
      demoManagedMaterials.set(name, { ...old, aliases: fields.aliases ?? old.aliases, sortOrder: fields.sortOrder ?? old.sortOrder, isHidden: fields.isHidden ?? old.isHidden })
    }
    return
  }
  const { error } = kind === 'shops'
    ? await supabase.from('shops').update({ kind: fields.kind ?? 'other', url: fields.url?.trim() || null }).eq('name', name)
    : await supabase.from('materials').update({ aliases: fields.aliases ?? [], sort_order: fields.sortOrder ?? 100, is_hidden: fields.isHidden ?? false }).eq('name', name)
  if (error) throw error
}

/** 合併或刪除名稱；刪除材質會從商品中移除，預設材質則只能隱藏。 */
export async function replaceManagedEntries(kind: ManagedListKind, names: string[], target: string | null): Promise<ManagedEntryChange[]> {
  const to = target?.trim() || null
  const from = [...new Set(names)].filter((name) => name !== to)
  if (!from.length) return []
  if (!supabase) {
    const changes: ManagedEntryChange[] = []
    if (kind === 'shops') {
      for (const name of from) {
        const itemRows = demoClosetItems.filter((item) => item.store === name)
        const wishRows = demoWishlistItems.filter((item) => item.shop === name)
        const metadata = demoManagedShops.get(name)
        changes.push({ name, itemIds: itemRows.map((item) => item.id), wishIds: wishRows.map((item) => item.id), itemValues: Object.fromEntries(itemRows.map((item) => [item.id, { value: item.store ?? null }])), wishValues: Object.fromEntries(wishRows.map((item) => [item.id, { value: item.shop }])), entry: metadata })
        demoClosetItems = demoClosetItems.map((item) => item.store === name ? { ...item, store: to ?? undefined } : item)
        demoWishlistItems = demoWishlistItems.map((item) => item.shop === name ? { ...item, shop: to ?? '尚未決定' } : item)
        demoManagedShops.delete(name)
      }
      if (to && !demoManagedShops.has(to)) demoManagedShops.set(to, { kind: 'other' })
    } else {
      for (const name of from) {
        const itemRows = demoClosetItems.filter((item) => selectedMaterialNames(item.material).includes(name) || name in (item.materialPercentages ?? {}))
        const wishRows = demoWishlistItems.filter((item) => selectedMaterialNames(item.material).includes(name) || name in (item.materialPercentages ?? {}))
        const metadata = demoManagedMaterials.get(name)
        changes.push({ name, itemIds: itemRows.map((item) => item.id), wishIds: wishRows.map((item) => item.id), itemValues: Object.fromEntries(itemRows.map((item) => [item.id, { value: item.material ?? null, percentages: item.materialPercentages }])), wishValues: Object.fromEntries(wishRows.map((item) => [item.id, { value: item.material ?? null, percentages: item.materialPercentages }])), entry: metadata })
        demoClosetItems = demoClosetItems.map((item) => {
          const percentages = { ...(item.materialPercentages ?? {}) }
          const oldPercentage = percentages[name]
          delete percentages[name]
          if (to && oldPercentage !== undefined) percentages[to] = Math.min(100, (percentages[to] ?? 0) + oldPercentage)
          const nextMaterial = to && oldPercentage !== undefined && !selectedMaterialNames(item.material).includes(name)
            ? replaceDelimitedValue(item.material, name, null)
            : replaceDelimitedValue(item.material, name, to)
          return nextMaterial !== item.material || oldPercentage !== undefined ? { ...item, material: nextMaterial || undefined, materialPercentages: percentages } : item
        })
        demoWishlistItems = demoWishlistItems.map((item) => {
          const percentages = { ...(item.materialPercentages ?? {}) }
          const oldPercentage = percentages[name]
          delete percentages[name]
          if (to && oldPercentage !== undefined) percentages[to] = Math.min(100, (percentages[to] ?? 0) + oldPercentage)
          const nextMaterial = to && oldPercentage !== undefined && !selectedMaterialNames(item.material).includes(name)
            ? replaceDelimitedValue(item.material, name, null)
            : replaceDelimitedValue(item.material, name, to)
          return nextMaterial !== item.material || oldPercentage !== undefined ? { ...item, material: nextMaterial || undefined, materialPercentages: percentages } : item
        })
        if (demoManagedMaterials.get(name)?.isDefault) demoManagedMaterials.set(name, { ...demoManagedMaterials.get(name)!, isHidden: true })
        else demoManagedMaterials.delete(name)
      }
      if (to && !demoManagedMaterials.has(to)) demoManagedMaterials.set(to, { aliases: [], sortOrder: 500, isDefault: false, isHidden: false })
    }
    return changes
  }
  const changes: ManagedEntryChange[] = []
  for (const name of from) {
    const { data, error } = await supabase.rpc(kind === 'shops' ? 'replace_shops' : 'replace_materials', { p_from: [name], p_to: to })
    if (error) throw error
    const result = (data ?? {}) as { items?: string[]; wishes?: string[]; item_values?: Record<string, Record<string, { material?: string | null; percentages?: Record<string, number>; store?: string | null }>>; wish_values?: Record<string, Record<string, { material?: string | null; percentages?: Record<string, number>; shop?: string | null }>>; entry?: Record<string, unknown> }
    const itemValues = result.item_values?.[name] ?? {}
    const wishValues = result.wish_values?.[name] ?? {}
    changes.push({
      name,
      itemIds: result.items ?? [],
      wishIds: result.wishes ?? [],
      itemValues: Object.fromEntries(Object.entries(itemValues).map(([id, value]) => [id, { value: kind === 'shops' ? value.store ?? null : value.material ?? null, percentages: value.percentages }])),
      wishValues: Object.fromEntries(Object.entries(wishValues).map(([id, value]) => [id, { value: kind === 'shops' ? value.shop ?? null : value.material ?? null, percentages: value.percentages }])),
      entry: kind === 'shops'
        ? { kind: result.entry?.kind as ShopKind | undefined, url: result.entry?.url as string | undefined }
        : { aliases: result.entry?.aliases as string[] | undefined, sortOrder: result.entry?.sort_order as number | undefined, isDefault: result.entry?.is_default as boolean | undefined, isHidden: result.entry?.is_hidden as boolean | undefined },
    })
  }
  return changes
}

/** 復原通路或材質的改名、合併及刪除。 */
export async function restoreManagedEntries(kind: ManagedListKind, changes: ManagedEntryChange[]): Promise<void> {
  if (!supabase) {
    for (const change of changes) {
      if (kind === 'shops') {
        for (const [id, snapshot] of Object.entries(change.itemValues ?? {})) demoClosetItems = demoClosetItems.map((item) => item.id === id ? { ...item, store: snapshot.value ?? undefined } : item)
        for (const [id, snapshot] of Object.entries(change.wishValues ?? {})) demoWishlistItems = demoWishlistItems.map((item) => item.id === id ? { ...item, shop: snapshot.value ?? '尚未決定' } : item)
        demoManagedShops.set(change.name, { kind: change.entry?.kind ?? 'other', url: change.entry?.url })
      } else {
        for (const [id, snapshot] of Object.entries(change.itemValues ?? {})) demoClosetItems = demoClosetItems.map((item) => item.id === id ? { ...item, material: snapshot.value ?? undefined, materialPercentages: snapshot.percentages } : item)
        for (const [id, snapshot] of Object.entries(change.wishValues ?? {})) demoWishlistItems = demoWishlistItems.map((item) => item.id === id ? { ...item, material: snapshot.value ?? undefined, materialPercentages: snapshot.percentages } : item)
        demoManagedMaterials.set(change.name, { aliases: change.entry?.aliases ?? [], sortOrder: change.entry?.sortOrder ?? 100, isDefault: change.entry?.isDefault ?? false, isHidden: change.entry?.isHidden ?? false })
      }
    }
    return
  }
  for (const change of changes) {
    const { error } = await supabase.rpc(kind === 'shops' ? 'restore_shop' : 'restore_material', {
      p_name: change.name,
      p_items: change.itemValues ?? {},
      p_wishes: change.wishValues ?? {},
      p_entry: kind === 'shops'
        ? { kind: change.entry?.kind ?? 'other', url: change.entry?.url ?? null }
        : { aliases: change.entry?.aliases ?? [], sort_order: change.entry?.sortOrder ?? 100, is_default: change.entry?.isDefault ?? false, is_hidden: change.entry?.isHidden ?? false },
    })
    if (error) throw error
  }
}

/** 記住被標為「不是同一個」的候選名稱，避免重複提醒。 */
export async function markManagedEntriesDistinct(kind: ManagedListKind, groupKey: string): Promise<void> {
  if (!supabase) return
  const table = kind === 'shops' ? 'shop_distinct_groups' : 'material_distinct_groups'
  const { error } = await supabase.from(table).upsert({ group_key: groupKey }, { onConflict: 'owner_id,group_key', ignoreDuplicates: true })
  if (error) throw error
}
