import { todayISO } from './date'
import { useEffect, useState } from 'react'
import { SAMPLE_BODY_MEASUREMENTS, SAMPLE_BODY_PROFILE, SAMPLE_CATEGORIES, SAMPLE_COMPARE_GROUPS, SAMPLE_COMPARE_GROUP_ITEMS, SAMPLE_DIARY, SAMPLE_ITEMS, SAMPLE_PROFILE, SAMPLE_WISHLIST } from '@/data/sample'
import type { MeasurementTrendPrefs } from '@/types'
import { DEFAULT_TREND_PREFS, normalizeTrendPrefs } from '@/lib/measurementTrend'
import { toUploadableImage } from '@/lib/image'
import { MATERIAL_DEFAULTS, materialNames } from '@/lib/materials'
import { cleanStretch } from '@/lib/stretch'
import { FEATURE_DEFAULTS, normalizeFeatureAliases, normalizeFeatureTags } from '@/lib/features'
import { wishlistSizeOptions } from '@/lib/wishlist'
import type { AddItemDestination, BodyMeasurement, BuyLine, BodyMeasurementInput, BodyProfile, BodyProfileInput, BrandChange, BrandSummary, Category, ClosetItem, ClosetPhoto, CompareGroup, CompareGroupInput, CompareGroupItem, CompareMembership, CutoutRegion, DiaryEntry, DiaryEntryInput, DiaryFeel, DiaryPhotoChange, DiaryWeather, FeatureDefinition, FeatureDefinitionInput, FeatureTag, GarmentShape, ItemStatus, LessonRule, LessonRuleInput, LessonStatus, ManagedEntryChange, ManagedListSummary, NewGarmentInput, Outfit, ProfilePreferences, ReviewDecision, ReviewRecord, ReviewRecordInput, ShopKind, Slot, StudioBackgroundCustom, StudioBackgroundMode, StudioBackgroundTheme, StudioCanvasItem, WishlistColor, WishlistInput, WishlistItem, WishlistPhotoUpload, WishStatus } from '@/types'
import { supabase } from './supabase'
import { colorFromName, normalizeWishColors, wishColorsToRow } from '@/lib/wishColors'
import { isInCloset, isLessonStatus } from './slots'

const CUTOUT_BUCKET = 'closet-images'
const SIGNED_URL_TTL = 60 * 60
const demoClosetPhotos = new Map<string, ClosetPhoto[]>()

let demoProfile: ProfilePreferences = cloneProfile(SAMPLE_PROFILE)
let demoMeasurements: BodyMeasurement[] = SAMPLE_BODY_MEASUREMENTS.map((measurement) => ({ ...measurement }))
let demoBodyProfile: BodyProfile = { ...SAMPLE_BODY_PROFILE }
let demoTrendPrefs: MeasurementTrendPrefs | null = null
let demoClosetItems: ClosetItem[] = [...SAMPLE_ITEMS]
let demoWishlistItems: WishlistItem[] = SAMPLE_WISHLIST.map((item) => ({ ...item, colors: normalizeWishColors(item.colors) }))
let demoCompareGroups: CompareGroup[] = SAMPLE_COMPARE_GROUPS.map((group) => ({ ...group }))
let demoCompareGroupItems: CompareGroupItem[] = SAMPLE_COMPARE_GROUP_ITEMS.map((entry) => ({
  groupId: entry.groupId,
  wishlistItemId: entry.itemId,
  position: entry.position,
  chosenSize: wishlistSizeOptions(SAMPLE_WISHLIST.find((item) => item.id === entry.itemId)?.size)[0],
  isDecided: 'isDecided' in entry ? entry.isDecided : false,
  addedAt: SAMPLE_WISHLIST.find((item) => item.id === entry.itemId)?.createdAt,
}))
const demoGarmentDraftFiles = new Map<string, File[]>()
const demoManagedShops = new Map<string, { kind: ShopKind; url?: string }>()
const demoManagedMaterials = new Map<string, { aliases: string[]; sortOrder: number; isDefault: boolean; isHidden: boolean }>(MATERIAL_DEFAULTS.map((material) => [material.name, { aliases: [...material.aliases], sortOrder: material.sortOrder, isDefault: true, isHidden: false }]))
let demoReviewRecords: ReviewRecord[] = []
let demoLessonRules: LessonRule[] = []
const demoFeatures = new Map<string, FeatureDefinition>(FEATURE_DEFAULTS.map((feature) => [feature.name, { ...feature, aliases: [...feature.aliases], applicableTypes: [...feature.applicableTypes] }]))

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
    weightKg: numberOrNull(row.weight_kg),
    shoulderCm: numberOrNull(row.shoulder_cm),
    // 舊資料的單一胸圍視為上胸圍，避免 migration 前的紀錄消失。
    upperBustCm: numberOrNull(row.upper_bust_cm) ?? numberOrNull(row.bust_cm),
    underBustCm: numberOrNull(row.under_bust_cm),
    highWaistCm: numberOrNull(row.high_waist_cm),
    waistCm: numberOrNull(row.waist_cm),
    waistSittingCm: numberOrNull(row.waist_sitting_cm),
    navelCm: numberOrNull(row.navel_cm),
    navelSittingCm: numberOrNull(row.navel_sitting_cm),
    hipCm: numberOrNull(row.hip_cm),
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
    timeOfDay: row.time_of_day === 'afternoon_evening' || row.time_of_day === 'other' ? row.time_of_day : 'morning_fasting',
    note: typeof row.note === 'string' ? row.note : '',
    createdAt: String(row.created_at ?? ''),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : undefined,
  }
}

function measurementPayload(input: BodyMeasurementInput) {
  return {
    measured_on: input.measuredOn,
    weight_kg: input.weightKg,
    shoulder_cm: input.shoulderCm,
    upper_bust_cm: input.upperBustCm,
    under_bust_cm: input.underBustCm,
    high_waist_cm: input.highWaistCm,
    waist_cm: input.waistCm,
    waist_sitting_cm: input.waistSittingCm,
    navel_cm: input.navelCm,
    navel_sitting_cm: input.navelSittingCm,
    hip_cm: input.hipCm,
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
    time_of_day: input.timeOfDay,
    note: input.note || null,
  }
}

function bodyProfileFromRow(row: Record<string, unknown> | null | undefined): BodyProfile {
  const numberOrNull = (value: unknown) => value === null || value === undefined || value === '' ? null : Number(value)
  return {
    heightCm: numberOrNull(row?.height_cm),
    armLengthCm: numberOrNull(row?.arm_length_cm),
    inseamCm: numberOrNull(row?.inseam_cm),
    seatedRiseCm: numberOrNull(row?.seated_rise_cm),
    footWidthLeftCm: numberOrNull(row?.foot_width_left_cm),
    footWidthRightCm: numberOrNull(row?.foot_width_right_cm),
    heelWidthCm: numberOrNull(row?.heel_width_cm),
    updatedAt: typeof row?.updated_at === 'string' ? row.updated_at : undefined,
  }
}

function bodyProfilePayload(input: BodyProfileInput) {
  return {
    height_cm: input.heightCm,
    arm_length_cm: input.armLengthCm,
    inseam_cm: input.inseamCm,
    seated_rise_cm: input.seatedRiseCm,
    foot_width_left_cm: input.footWidthLeftCm,
    foot_width_right_cm: input.footWidthRightCm,
    heel_width_cm: input.heelWidthCm,
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
  flat_stretch?: Record<string, number> | null
  feature_tags?: FeatureTag[] | null
  feature_suggestions_dismissed?: string[] | null
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
  color_family?: string | null
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
    flatStretch: row.flat_stretch ?? {},
    features: normalizeFeatureTags(row.feature_tags),
    featureSuggestionsDismissed: row.feature_suggestions_dismissed ?? [],
    status: row.status,
    isFavorite: row.is_favorite,
    cutoutUrl: imagePath ? urls[imagePath] : undefined,
    originalUrl: row.image_original_path ? urls[row.image_original_path] : undefined,
    cutoutStatus: row.cutout_status,
    photos,
    shape: fallbackShape(row.categories?.slot ?? null),
    wearCount: row.wear_count,
    lastWornAt: row.last_worn_at ?? undefined,
    cutoutPath: row.image_cutout_path ?? undefined,
  }
}

async function signed(paths: string[]): Promise<Record<string, string>> {
  if (!supabase || paths.length === 0) return {}
  const { data } = await supabase.storage.from(CUTOUT_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL)
  return Object.fromEntries((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]))
}

export async function fetchClosetItems(): Promise<ClosetItem[]> {
  if (!supabase) return demoClosetItems.filter((item) => isInCloset(item.status)).map((item) => ({ ...item }))
  const { data, error } = await supabase
    .from('items')
    .select('id,name,category_id,color_name,color_hex,brand,size,neckline_size,fit,material,material_composition,material_percentages,seasons,occasions,purchase_date,purchase_price,store,product_url,note,flat_measurements,flat_stretch,feature_tags,feature_suggestions_dismissed,status,is_favorite,image_original_path,image_cutout_path,cutout_status,wear_count,last_worn_at,categories(name,slot)')
    .not('status', 'in', '(retired,returned,exchanged,unworn,given_away)')
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
  if (!supabase) return [...new Set([...demoClosetItems.map((item) => item.brand?.trim()), ...demoWishlistItems.map((item) => item.brand?.trim()), ...demoBrands].filter((brand): brand is string => !!brand))].sort((a, b) => a.localeCompare(b, 'zh-TW'))
  const [{ data, error }, wishes, manual] = await Promise.all([
    supabase.from('items').select('brand').eq('is_draft', false).not('brand', 'is', null),
    supabase.from('wishlist_items').select('brand').not('brand', 'is', null),
    supabase.from('brands').select('name'),
  ])
  if (error) throw error
  // brands 表在 0011 之前不存在，讀不到時只用衣物上的品牌
  const extra = manual.error ? [] : (manual.data ?? []).map((row) => row.name as string)
  return [...new Set([...(data ?? []).map((row) => row.brand?.trim()), ...(wishes.data ?? []).map((row) => row.brand?.trim()), ...extra].filter((brand): brand is string => !!brand))].sort((a, b) => a.localeCompare(b, 'zh-TW'))
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
    .select('id,name,category_id,color_name,color_hex,second_color_hex,brand,size,neckline_size,fit,material,material_composition,material_percentages,seasons,occasions,purchase_date,purchase_price,store,product_url,note,flat_measurements,flat_stretch,feature_tags,feature_suggestions_dismissed,status,is_favorite,image_original_path,image_cutout_path,cutout_status,wear_count,last_worn_at,categories(id,name,slot,sort),item_photos(id,storage_path,sort_order,is_cover,color_family)')
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
    colorFamily: photo.color_family ?? undefined,
  }))
  const item = itemFromRow(row, urls, photos)
  item.categoryName = row.categories?.name
  // 0016 之後才有的欄位；還沒執行 migration 時略過
  const extra = await supabase.from('items').select('received_on,exchanged_from').eq('id', id).maybeSingle()
  if (!extra.error && extra.data) {
    item.receivedOn = (extra.data.received_on as string | null) ?? undefined
    item.exchangedFrom = (extra.data.exchanged_from as string | null) ?? undefined
  }
  return item
}

function closetItemPayload(input: Partial<ClosetItem> & { categoryId?: string }) {
  const payload: Record<string, unknown> = {}
  const fields: [keyof ClosetItem, string][] = [
    ['name', 'name'], ['categoryId', 'category_id'], ['colorName', 'color_name'], ['colorHex', 'color_hex'],
    ['secondColorHex', 'second_color_hex'], ['brand', 'brand'], ['size', 'size'], ['necklineSize', 'neckline_size'], ['fit', 'fit'],
    ['material', 'material'], ['materialComposition', 'material_composition'], ['materialPercentages', 'material_percentages'], ['seasons', 'seasons'],
    ['occasions', 'occasions'], ['features', 'feature_tags'], ['featureSuggestionsDismissed', 'feature_suggestions_dismissed'], ['purchaseDate', 'purchase_date'], ['purchasePrice', 'purchase_price'],
    ['store', 'store'], ['productUrl', 'product_url'], ['note', 'note'], ['flatMeasurements', 'flat_measurements'], ['flatStretch', 'flat_stretch'],
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

const ACTIVE_WISH_STATUSES: WishStatus[] = ['considering', 'ready']
const WISHLIST_COLUMNS = 'id,name,product_code,slot,primary_part,garment_type,garment_length,also_parts,colors,color_hex,color_name,shop,price,shipping,target_price,url,size,flat_measurements_size,size_note,neckline_size,brand,material,material_composition,material_percentages,feature_tags,feature_suggestions_dismissed,flat_measurements,flat_stretch,return_policy,buy_lines,ai_review,ai_reviewed_at,reason,priority,status,image_cutout_path,image_original_path,bought_item_id,bought_item_ids,created_at'

interface WishlistRow {
  id: string
  name: string
  product_code: string | null
  slot: Slot
  primary_part: Slot
  garment_type: string | null
  garment_length: WishlistItem['garmentLength'] | null
  also_parts: Slot[]
  colors: unknown
  color_hex: string
  color_name: string | null
  shop: string
  price: number
  shipping: number | null
  target_price: number | null
  url: string | null
  size: string | null
  flat_measurements_size: string | null
  size_note: string | null
  neckline_size: number | null
  brand: string | null
  material: string | null
  material_composition: string | null
  material_percentages: Record<string, number> | null
  feature_tags: FeatureTag[] | null
  feature_suggestions_dismissed: string[] | null
  flat_measurements: Record<string, number | null> | null
  flat_stretch: Record<string, number> | null
  return_policy: string | null
  buy_lines: BuyLineRow[] | null
  ai_review: string | null
  ai_reviewed_at: string | null
  reason: string | null
  priority: number | null
  status: WishStatus
  image_cutout_path: string | null
  image_original_path: string | null
  bought_item_id: string | null
  bought_item_ids: string[] | null
  created_at: string
}

interface BuyLineRow { color_name: string; hex?: string | null; size?: string | null; qty: number; unit_price: number }

const buyLinesFromRow = (rows: BuyLineRow[] | null | undefined): BuyLine[] => (Array.isArray(rows) ? rows : [])
  .filter((row) => row && typeof row.color_name === 'string')
  .map((row) => ({ colorName: row.color_name, hex: row.hex ?? undefined, size: typeof row.size === 'string' && row.size.trim() ? row.size.trim() : undefined, qty: Math.max(1, Math.round(Number(row.qty) || 1)), unitPrice: Math.max(0, Math.round(Number(row.unit_price) || 0)) }))
const buyLinesToRow = (lines: BuyLine[]): BuyLineRow[] => lines.map((line) => ({ color_name: line.colorName, hex: line.hex ?? null, size: line.size?.trim() || null, qty: Math.max(1, Math.round(line.qty)), unit_price: Math.max(0, Math.round(line.unitPrice)) }))

async function mapWishlistRows(rows: WishlistRow[]): Promise<WishlistItem[]> {
  const imagePath = (r: WishlistRow) => r.image_cutout_path ?? r.image_original_path
  const { data: photoRows, error: photoError } = supabase && rows.length
    ? await supabase.from('item_photos').select('id,wishlist_item_id,storage_path,sort_order,is_cover,color_family').in('wishlist_item_id', rows.map((row) => row.id)).order('sort_order')
    : { data: [], error: null }
  if (photoError) throw photoError
  const photosByWish = new Map<string, ClosetPhoto[]>()
  for (const photo of photoRows ?? []) {
    const wishId = photo.wishlist_item_id
    const photos = photosByWish.get(wishId) ?? []
    photos.push({ id: photo.id, path: photo.storage_path, sortOrder: photo.sort_order, isCover: photo.is_cover, colorFamily: photo.color_family ?? undefined })
    photosByWish.set(wishId, photos)
  }
  const photoPaths = [...(photoRows ?? []).map((photo) => photo.storage_path), ...rows.flatMap((row) => [row.image_cutout_path, row.image_original_path].filter((path): path is string => !!path))]
  const urls = await signed(photoPaths)
  return rows.map((r) => {
    const path = imagePath(r)
    // 舊資料沒有 colors 時，用 color_name／color_hex 組成一色（normalizeWishColors 也接受舊格式 { family: 名稱 }）
    const colors = normalizeWishColors(Array.isArray(r.colors) ? r.colors : [{ family: r.color_name || '其他', hex: r.color_hex }])
    const primaryColor = colors[0]
    const photos = photosByWish.get(r.id) ?? []
    const completePhotos = photos.length
      ? photos.map((photo) => ({ ...photo, url: urls[photo.path] }))
      : path ? [{ id: `legacy-cover-${r.id}`, path, url: urls[path], sortOrder: 0, isCover: true }] : []
    return {
      id: r.id,
      name: r.name,
      productCode: r.product_code ?? undefined,
      slot: r.slot,
      primaryPart: r.primary_part ?? r.slot,
      garmentType: r.garment_type ?? undefined,
      garmentLength: r.garment_length ?? undefined,
      alsoParts: r.also_parts ?? [],
      colors,
      colorHex: primaryColor?.hex ?? r.color_hex,
      colorName: primaryColor?.name ?? r.color_name ?? undefined,
      shop: r.shop,
      price: r.price,
      shipping: r.shipping ?? undefined,
      targetPrice: r.target_price ?? undefined,
      url: r.url ?? undefined,
      size: r.size ?? undefined,
      flatMeasurementsSize: r.flat_measurements_size ?? undefined,
      sizeNote: r.size_note ?? undefined,
      necklineSize: r.neckline_size ?? undefined,
      brand: r.brand ?? undefined,
      material: r.material ?? undefined,
      materialComposition: r.material_composition ?? undefined,
      materialPercentages: r.material_percentages ?? undefined,
      features: normalizeFeatureTags(r.feature_tags),
      featureSuggestionsDismissed: r.feature_suggestions_dismissed ?? [],
      flatMeasurements: r.flat_measurements ?? {},
      flatStretch: r.flat_stretch ?? {},
      returnPolicy: r.return_policy ?? undefined,
      buyLines: buyLinesFromRow(r.buy_lines),
      aiReview: r.ai_review ?? undefined,
      aiReviewedAt: r.ai_reviewed_at ?? undefined,
      reason: r.reason ?? undefined,
      priority: r.priority === 1 || r.priority === 2 || r.priority === 3 ? r.priority : undefined,
      status: (r.status as string) === 'waiting' ? 'considering' : r.status,
      cutoutUrl: path ? urls[path] : undefined,
      photos: completePhotos,
      shape: fallbackShape(r.slot),
      boughtItemId: r.bought_item_id ?? undefined,
      boughtItemIds: r.bought_item_ids ?? (r.bought_item_id ? [r.bought_item_id] : []),
      createdAt: r.created_at,
    }
  })
}

/** 進行中的選購候選（考慮中、準備購買），供搭配板與比較台使用。 */
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

/** 表單送來的顏色（沒有 colors 時用 colorName／colorHex 組一色），整理成唯一 id、最多一個最想要 */
const inputColors = (input: WishlistInput): WishlistColor[] => normalizeWishColors(wishColorsToRow(input.colors !== undefined ? input.colors : [colorFromName(input.colorName || '其他', input.colorHex)]))

/** 平放尺寸去掉空值；拉伸值只留有平放值且較大的欄位 */
function cleanFlat(flat: Record<string, number | null>) {
  return Object.fromEntries(Object.entries(flat).filter(([, value]) => value !== null && Number.isFinite(value))) as Record<string, number>
}

function flatPayload(flat: Record<string, number | null>, stretch?: Record<string, number>) {
  const flatMeasurements = cleanFlat(flat)
  return { flat_measurements: flatMeasurements, flat_stretch: cleanStretch(flatMeasurements, stretch) }
}

function wishlistPayload(input: WishlistInput) {
  const primaryPart = input.primaryPart ?? input.slot
  const colors = inputColors(input)
  const primaryColor = colors[0]
  return {
    name: input.name.trim(),
    product_code: blankToNull(input.productCode),
    slot: primaryPart,
    primary_part: primaryPart,
    garment_type: blankToNull(input.garmentType ?? undefined),
    garment_length: input.garmentLength ?? null,
    also_parts: [...new Set((input.alsoParts ?? []).filter((part) => part !== primaryPart))],
    colors: wishColorsToRow(colors),
    color_hex: primaryColor?.hex ?? input.colorHex,
    color_name: blankToNull(primaryColor?.name ?? (input.colors === undefined ? input.colorName : undefined)),
    shop: input.shop.trim() || '尚未決定',
    url: blankToNull(input.url),
    price: input.price,
    shipping: input.shipping,
    ...(input.targetPrice !== undefined ? { target_price: input.targetPrice } : {}),
    brand: blankToNull(input.brand),
    size: blankToNull(input.size),
    flat_measurements_size: blankToNull(input.flatMeasurementsSize),
    size_note: blankToNull(input.sizeNote),
    neckline_size: input.necklineSize ?? null,
    priority: input.priority,
    reason: blankToNull(input.reason),
    material: blankToNull(input.material),
    material_composition: blankToNull(input.materialComposition),
    material_percentages: input.materialPercentages ?? {},
    feature_tags: normalizeFeatureTags(input.features),
    feature_suggestions_dismissed: [...new Set(input.featureSuggestionsDismissed ?? [])],
    ...(input.flatMeasurements !== undefined ? flatPayload(input.flatMeasurements, input.flatStretch) : {}),
    return_policy: blankToNull(input.returnPolicy),
    status: input.status,
  }
}

function demoWishFromInput(id: string, input: WishlistInput, base?: WishlistItem): WishlistItem {
  const optional = (value?: string) => value?.trim() || undefined
  const primaryPart = input.primaryPart ?? input.slot
  const colors = inputColors(input)
  const primaryColor = colors[0]
  const colorHex = primaryColor?.hex ?? input.colorHex
  const photoChanges = !!input.photosToAdd?.length || !!input.photoIdsToRemove?.length || !!input.photoColorAssignments?.length
  const removedIds = new Set(input.photoIdsToRemove ?? [])
  const photos = photoChanges
    ? [...(base?.photos ?? []).filter((photo) => !removedIds.has(photo.id)).map((photo) => {
      const assignment = input.photoColorAssignments?.find((entry) => entry.photoId === photo.id)
      return { ...photo, colorFamily: assignment ? (assignment.colorFamily ?? undefined) : photo.colorFamily }
    }), ...(input.photosToAdd ?? []).map(({ file, colorFamily }, index) => {
      const url = URL.createObjectURL(file)
      return { id: `demo-wish-photo-${Date.now()}-${index}`, path: url, url, sortOrder: (base?.photos?.length ?? 0) + index, isCover: false, colorFamily: colorFamily ?? undefined }
    })].map((photo, index) => ({ ...photo, sortOrder: index, isCover: index === 0 }))
    : base?.photos
  if (photoChanges) for (const photo of base?.photos ?? []) if (removedIds.has(photo.id) && photo.url?.startsWith('blob:')) URL.revokeObjectURL(photo.url)
  const coverPhoto = photos?.find((photo) => photo.isCover) ?? photos?.[0]
  return {
    ...base,
    id,
    name: input.name.trim(),
    productCode: optional(input.productCode),
    slot: primaryPart,
    primaryPart,
    garmentType: optional(input.garmentType ?? undefined),
    garmentLength: input.garmentLength === undefined ? base?.garmentLength : (input.garmentLength ?? undefined),
    alsoParts: [...new Set((input.alsoParts ?? []).filter((part) => part !== primaryPart))],
    colors,
    colorHex,
    colorName: optional(primaryColor?.name ?? (input.colors === undefined ? input.colorName : undefined)),
    shop: input.shop.trim() || '尚未決定',
    url: optional(input.url),
    price: input.price,
    shipping: input.shipping ?? undefined,
    targetPrice: input.targetPrice ?? base?.targetPrice,
    brand: optional(input.brand),
    size: optional(input.size),
    flatMeasurementsSize: input.flatMeasurementsSize === undefined ? base?.flatMeasurementsSize : optional(input.flatMeasurementsSize),
    necklineSize: input.necklineSize ?? base?.necklineSize,
    sizeNote: optional(input.sizeNote),
    priority: input.priority ?? undefined,
    reason: optional(input.reason),
    material: optional(input.material),
    materialComposition: optional(input.materialComposition),
    materialPercentages: input.materialPercentages ? { ...input.materialPercentages } : undefined,
    features: normalizeFeatureTags(input.features ?? base?.features),
    featureSuggestionsDismissed: [...new Set(input.featureSuggestionsDismissed ?? base?.featureSuggestionsDismissed ?? [])],
    ...(input.flatMeasurements !== undefined ? { flatMeasurements: cleanFlat(input.flatMeasurements), flatStretch: cleanStretch(input.flatMeasurements, input.flatStretch) } : {}),
    returnPolicy: optional(input.returnPolicy),
    status: input.status,
    shape: base && base.slot === input.slot ? base.shape : fallbackShape(input.slot),
    photos,
    ...(photoChanges ? { cutoutUrl: coverPhoto?.url } : {}),
    buyLines: base?.buyLines,
    createdAt: base?.createdAt ?? new Date().toISOString(),
  }
}

/** 儲存選購候選的多張原始照片；第一張會作為封面。 */
async function saveWishlistPhotos(id: string, photosToAdd: WishlistPhotoUpload[], removeIds: string[], colorAssignments: WishlistInput['photoColorAssignments'] = []) {
  if (!supabase || (!photosToAdd.length && !removeIds.length && !colorAssignments?.length)) return
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('請重新登入後再儲存商品照片。')

  const [{ data: existingRows, error: photoError }, { data: wish, error: wishError }] = await Promise.all([
    supabase.from('item_photos').select('id,storage_path,sort_order,is_cover,color_family').eq('wishlist_item_id', id).order('sort_order'),
    supabase.from('wishlist_items').select('image_original_path,image_cutout_path').eq('id', id).single(),
  ])
  if (photoError) throw photoError
  if (wishError) throw wishError
  const rows = existingRows ?? []
  const removed = rows.filter((photo) => removeIds.includes(photo.id))
  const kept = rows.filter((photo) => !removeIds.includes(photo.id))
  const legacyPath = rows.length ? null : wish.image_cutout_path ?? wish.image_original_path
  const legacyRemoved = !!legacyPath && removeIds.includes(`legacy-cover-${id}`)
  let keptLegacy: { id: string; storage_path: string; sort_order: number; is_cover: boolean; color_family: string | null }[] = legacyPath && !legacyRemoved
    ? [{ id: `legacy-cover-${id}`, storage_path: legacyPath, sort_order: 0, is_cover: true, color_family: null }]
    : []
  const legacyColor = colorAssignments?.find((assignment) => assignment.photoId === `legacy-cover-${id}`)?.colorFamily ?? null
  const removedMainPhoto = !!(legacyRemoved || removed.some((photo) => photo.storage_path === (wish.image_cutout_path ?? wish.image_original_path)))
  const removedPaths = [...removed.map((photo) => photo.storage_path), ...(removedMainPhoto ? [wish.image_original_path, wish.image_cutout_path].filter((path): path is string => !!path) : [])]
  const uploadedPaths: string[] = []
  const insertedPhotoIds: string[] = []
  let photoChangesSaved = false
  try {
    if (keptLegacy.length) {
      const { data, error } = await supabase.from('item_photos').insert({ owner_id: user.id, wishlist_item_id: id, storage_path: keptLegacy[0].storage_path, sort_order: 0, is_cover: true, color_family: legacyColor }).select('id,storage_path,sort_order,is_cover,color_family').single()
      if (error) throw error
      keptLegacy = [data]
      insertedPhotoIds.push(data.id)
    }
    const newRows: { id: string; storage_path: string; sort_order: number; is_cover: boolean; color_family: string | null }[] = []
    for (const photo of photosToAdd) {
      const file = await toUploadableImage(photo.file)
      if (file.size > 10 * 1024 * 1024) throw new Error(`「${file.name}」超過 10 MB。`)
      const path = `${user.id}/${id}/photos/${crypto.randomUUID()}.${fileExtension(file)}`
      const { error } = await supabase.storage.from(CUTOUT_BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
      if (error) throw error
      uploadedPaths.push(path)
      newRows.push({ id: '', storage_path: path, sort_order: 0, is_cover: false, color_family: photo.colorFamily ?? null })
    }
    if (newRows.length) {
      const { data, error } = await supabase.from('item_photos').insert(newRows.map((photo) => ({ owner_id: user.id, wishlist_item_id: id, storage_path: photo.storage_path, sort_order: 0, is_cover: false, color_family: photo.color_family }))).select('id,storage_path,sort_order,is_cover,color_family')
      if (error) throw error
      newRows.splice(0, newRows.length, ...(data ?? []))
      insertedPhotoIds.push(...newRows.map((photo) => photo.id))
    }

    const assigned = new Map((colorAssignments ?? []).map(({ photoId, colorFamily }) => [photoId, colorFamily]))
    const finalRows = [...keptLegacy, ...kept.map((photo) => ({ ...photo, color_family: assigned.has(photo.id) ? assigned.get(photo.id) : photo.color_family })), ...newRows]
    const cover = finalRows[0]
    const coverUnchanged = cover?.storage_path === (wish.image_cutout_path ?? wish.image_original_path)
    const { error: clearError } = await supabase.from('item_photos').update({ is_cover: false }).eq('wishlist_item_id', id)
    if (clearError) throw clearError
    for (const [index, photo] of finalRows.entries()) {
      if (photo.id.startsWith('legacy-cover-')) continue
      const { error } = await supabase.from('item_photos').update({ sort_order: index, is_cover: photo.id === cover?.id, color_family: photo.color_family ?? null }).eq('id', photo.id).eq('wishlist_item_id', id)
      if (error) throw error
    }
    const { error: updateError } = await supabase.from('wishlist_items').update({
      image_original_path: coverUnchanged ? wish.image_original_path : cover?.storage_path ?? null,
      image_cutout_path: coverUnchanged ? wish.image_cutout_path : null,
      cutout_status: coverUnchanged ? undefined : 'skipped',
    }).eq('id', id)
    if (updateError) throw updateError
    photoChangesSaved = true
    if (removed.length) {
      const { error } = await supabase.from('item_photos').delete().in('id', removed.map((photo) => photo.id)).eq('wishlist_item_id', id)
      if (error) throw error
    }
    const pathsToRemove = [...new Set(removedPaths.filter((path) => !finalRows.some((photo) => photo.storage_path === path)))]
    if (pathsToRemove.length) {
      const { error } = await supabase.storage.from(CUTOUT_BUCKET).remove(pathsToRemove)
      if (error) throw error
    }
  } catch (error) {
    if (!photoChangesSaved) {
      if (insertedPhotoIds.length) await supabase.from('item_photos').delete().in('id', insertedPhotoIds).eq('wishlist_item_id', id)
      if (uploadedPaths.length) await supabase.storage.from(CUTOUT_BUCKET).remove(uploadedPaths)
    }
    throw error
  }
}

/** 新增一筆選購候選，可附加不限張數的商品圖片。 */
export async function createWishlistItem(input: WishlistInput): Promise<{ item: WishlistItem; demo: boolean }> {
  if (!supabase) {
    const item = demoWishFromInput(`demo-wish-${Date.now()}`, input)
    demoWishlistItems = [item, ...demoWishlistItems]
    return { item, demo: true }
  }
  const { data, error } = await supabase.from('wishlist_items').insert(wishlistPayload(input)).select(WISHLIST_COLUMNS).single()
  if (error) throw error
  try {
    await saveWishlistPhotos(data.id, input.photosToAdd ?? [], input.photoIdsToRemove ?? [], input.photoColorAssignments)
  } catch (cause) {
    await supabase.from('wishlist_items').delete().eq('id', data.id)
    throw cause
  }
  const { data: saved, error: savedError } = await supabase.from('wishlist_items').select(WISHLIST_COLUMNS).eq('id', data.id).single()
  if (savedError) throw savedError
  const [item] = await mapWishlistRows([saved as unknown as WishlistRow])
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
  await saveWishlistPhotos(id, input.photosToAdd ?? [], input.photoIdsToRemove ?? [], input.photoColorAssignments)
  const { data: saved, error: savedError } = await supabase.from('wishlist_items').select(WISHLIST_COLUMNS).eq('id', id).single()
  if (savedError) throw savedError
  const [item] = await mapWishlistRows([saved as unknown as WishlistRow])
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
 * 購買明細選擇器（B28）按「確定」才呼叫：lines＝放進採購籃（狀態改準備購買並寫入明細）；
 * null＝移出採購籃（清空明細，狀態改成 status，預設考慮中）。
 */
export async function saveWishlistBasket(id: string, lines: BuyLine[] | null, status: Exclude<WishStatus, 'bought' | 'ready'> = 'considering'): Promise<{ demo: boolean }> {
  const nextStatus: WishStatus = lines ? 'ready' : status
  if (!supabase) {
    demoWishlistItems = demoWishlistItems.map((item) => (item.id === id && item.status !== 'bought' ? { ...item, status: nextStatus, buyLines: lines ? lines.map((line) => ({ ...line })) : [] } : item))
    return { demo: true }
  }
  const { error } = await supabase.from('wishlist_items').update({ status: nextStatus, buy_lines: lines ? buyLinesToRow(lines) : [] }).eq('id', id).neq('status', 'bought')
  if (error) throw error
  return { demo: false }
}

/** AI 看過的提醒（B7.3）：存使用者貼回的外部 AI 回覆；空字串＝清除。平台不呼叫 AI。 */
export async function saveWishlistAiReview(id: string, text: string): Promise<{ aiReview?: string; aiReviewedAt?: string; demo: boolean }> {
  const aiReview = text.trim() || undefined
  const aiReviewedAt = aiReview ? new Date().toISOString() : undefined
  if (!supabase) {
    demoWishlistItems = demoWishlistItems.map((item) => (item.id === id ? { ...item, aiReview, aiReviewedAt } : item))
    return { aiReview, aiReviewedAt, demo: true }
  }
  const { error } = await supabase.from('wishlist_items').update({ ai_review: aiReview ?? null, ai_reviewed_at: aiReviewedAt ?? null }).eq('id', id)
  if (error) throw error
  return { aiReview, aiReviewedAt, demo: false }
}

let demoShoppingTarget: number | null = 5000

/** 採購籃目標金額（profiles.shopping_target，選填） */
export async function fetchShoppingTarget(): Promise<number | null> {
  if (!supabase) return demoShoppingTarget
  const { data, error } = await supabase.from('profiles').select('shopping_target').maybeSingle()
  if (error) throw error
  return typeof data?.shopping_target === 'number' ? data.shopping_target : null
}

export async function saveShoppingTarget(target: number | null): Promise<{ demo: boolean }> {
  const value = target == null || !Number.isFinite(target) ? null : Math.max(0, Math.round(target))
  if (!supabase) {
    demoShoppingTarget = value
    return { demo: true }
  }
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('請重新登入後再儲存目標金額。')
  const { error } = await supabase.from('profiles').upsert({ id: user.id, shopping_target: value })
  if (error) throw error
  return { demo: false }
}

/**
 * 移至已購買：建立一件衣櫃衣物（帶入名稱、顏色、品牌、尺寸、圖片），
 * 選購候選保留原資料，狀態改為 bought 並指向新衣物。
 */
export async function markWishlistBought(id: string, purchase: { purchaseDate: string; paidPrice: number | null; colorFamilies?: string[]; lines?: BuyLine[] }): Promise<{ itemIds: string[]; demo: boolean }> {
  // 從採購籃來：依明細每一件建立一件衣物，單價記為實付價格
  const pieces = (colors: WishlistColor[]) => purchase.lines?.length
    ? purchase.lines.flatMap((line) => {
      const color = colors.find((entry) => entry.name === line.colorName) ?? colorFromName(line.colorName, line.hex)
      return Array.from({ length: Math.max(1, line.qty) }, () => ({ color, price: line.unitPrice as number | null, size: line.size }))
    })
    : colors.filter((color) => new Set(purchase.colorFamilies?.length ? purchase.colorFamilies : colors.map((entry) => entry.name)).has(color.name)).map((color) => ({ color, price: purchase.paidPrice, size: undefined as string | undefined }))
  if (!supabase) {
    const wish = demoWishlistItems.find((item) => item.id === id)
    if (!wish) throw new Error('找不到這件商品，可能已被刪除。')
    if (wish.status === 'bought') throw new Error('這件已經移至已購買了。')
    const colors = wish.colors?.length ? wish.colors : [colorFromName(wish.colorName || '其他', wish.colorHex)]
    const selectedPieces = pieces(colors)
    if (!selectedPieces.length) throw new Error('請至少選擇一個購買顏色。')
    const itemIds = selectedPieces.map(({ color, price, size }, index) => {
      const itemId = `demo-bought-${Date.now()}-${index}`
      const category = SAMPLE_CATEGORIES.find((entry) => entry.slot === (wish.primaryPart ?? wish.slot))
      const photoFamily = color.name
      const photos = (wish.photos ?? []).filter((photo) => !photo.colorFamily || photo.colorFamily === photoFamily)
      demoClosetItems.unshift({
        id: itemId,
        name: wish.name,
        categoryId: category?.id ?? SAMPLE_CATEGORIES[0].id,
        slot: wish.primaryPart ?? wish.slot,
        colorName: color.name,
        colorHex: color.hex || wish.colorHex,
        brand: wish.brand,
        size: size ?? wish.size,
        necklineSize: wish.necklineSize,
        flatMeasurements: { ...wish.flatMeasurements },
        flatStretch: { ...wish.flatStretch },
        features: normalizeFeatureTags(wish.features),
        featureSuggestionsDismissed: [...(wish.featureSuggestionsDismissed ?? [])],
        status: 'ok',
        purchasePrice: price ?? undefined,
        cutoutUrl: photos.find((photo) => photo.isCover)?.url ?? wish.cutoutUrl,
        shape: wish.shape,
        wearCount: 0,
      })
      if (photos.length) demoClosetPhotos.set(itemId, photos.map((photo, photoIndex) => ({ ...photo, sortOrder: photoIndex, isCover: photoIndex === 0 })))
      return itemId
    })
    demoWishlistItems = demoWishlistItems.map((item) => item.id === id ? { ...item, status: 'bought', boughtItemId: itemIds[0], boughtItemIds: itemIds, buyLines: purchase.lines ?? item.buyLines } : item)
    return { itemIds, demo: true }
  }

  const client = supabase
  const { data, error } = await client
    .from('wishlist_items')
    .select('id,name,slot,primary_part,also_parts,colors,category_id,color_hex,color_name,second_color_hex,brand,size,size_note,neckline_size,seasons,material,material_composition,material_percentages,feature_tags,feature_suggestions_dismissed,flat_measurements,flat_stretch,shop,url,reason,status,image_original_path,image_cutout_path,bought_item_id')
    .eq('id', id)
    .single()
  if (error) throw error
  if (data.status === 'bought') throw new Error('這件已經移至已購買了。')
  const { data: wishlistPhotos, error: wishlistPhotosError } = await client.from('item_photos').select('storage_path,sort_order,is_cover,color_family').eq('wishlist_item_id', id).order('sort_order')
  if (wishlistPhotosError) throw wishlistPhotosError
  const allColors = normalizeWishColors(Array.isArray(data.colors) && data.colors.length ? data.colors : [{ family: data.color_name || '未標色', hex: data.color_hex }])
  const selectedPieces = pieces(allColors)
  if (!selectedPieces.length) throw new Error('請至少選擇一個購買顏色。')
  const categories = await fetchCategories()
  const primaryPart = data.primary_part ?? data.slot
  const category = categories.find((entry) => entry.slot === primaryPart) ?? categories.find((entry) => entry.id === data.category_id)
  if (!category) throw new Error('找不到對應的衣物分類，請先到衣櫃確認分類設定。')
  const { data: { user }, error: userError } = await client.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('登入狀態已失效，請重新登入。')

  const copied: string[] = []
  const insertedItems: string[] = []
  const outputIds: string[] = []
  try {
    for (const { color, price, size } of selectedPieces) {
      const itemId = crypto.randomUUID()
      const familyPhotos = (wishlistPhotos ?? []).filter((photo) => !photo.color_family || photo.color_family === color.name)
      const legacyCover = !(wishlistPhotos?.length) ? data.image_original_path : null
      const coverSource = familyPhotos.find((photo) => photo.is_cover)?.storage_path ?? familyPhotos[0]?.storage_path ?? legacyCover
      const copyImage = async (path: string | null | undefined, name: string) => {
        if (!path) return null
        const ext = path.split('.').pop() ?? 'jpg'
        const target = `${user.id}/${itemId}/${name}.${ext}`
        const { error: copyError } = await client.storage.from(CUTOUT_BUCKET).copy(path, target)
        if (copyError) throw copyError
        copied.push(target)
        return target
      }

      const originalPath = await copyImage(coverSource, 'original')
      const cutoutSource = coverSource === data.image_original_path ? data.image_cutout_path : null
      const cutoutPath = cutoutSource && cutoutSource !== coverSource ? await copyImage(cutoutSource, 'cutout') : null
      const { error: insertError } = await client.from('items').insert({
        id: itemId,
        category_id: category.id,
        name: data.name,
        color_name: color.name,
        color_hex: color.hex || data.color_hex,
        second_color_hex: null,
        size: size || data.size || data.size_note || '',
        neckline_size: data.neckline_size,
        brand: data.brand,
        seasons: data.seasons ?? [],
        material: data.material,
        material_composition: data.material_composition,
        material_percentages: data.material_percentages ?? {},
        feature_tags: normalizeFeatureTags(data.feature_tags as FeatureTag[] | null),
        feature_suggestions_dismissed: data.feature_suggestions_dismissed ?? [],
        flat_measurements: data.flat_measurements ?? {},
        flat_stretch: data.flat_stretch ?? {},
        purchase_date: purchase.purchaseDate,
        purchase_price: price,
        store: data.shop,
        product_url: data.url,
        note: data.reason,
        image_original_path: originalPath,
        image_cutout_path: cutoutPath ?? originalPath,
        cutout_status: cutoutPath ? 'done' : 'skipped',
      })
      if (insertError) throw insertError
      insertedItems.push(itemId)
      outputIds.push(itemId)

      const itemPhotoRows = []
      for (const [index, photo] of familyPhotos.entries()) {
        const path = photo.storage_path === coverSource && originalPath ? originalPath : await copyImage(photo.storage_path, `photos/${index}`)
        if (path) itemPhotoRows.push({ owner_id: user.id, item_id: itemId, storage_path: path, sort_order: index, is_cover: index === 0, color_family: photo.color_family ?? null })
      }
      if (itemPhotoRows.length) {
        const { error: photoError } = await client.from('item_photos').insert(itemPhotoRows)
        if (photoError) throw photoError
      } else if (originalPath) {
        const { error: photoError } = await client.from('item_photos').insert({ owner_id: user.id, item_id: itemId, storage_path: originalPath, sort_order: 0, is_cover: true })
        if (photoError) throw photoError
      }
    }
    const { error: updateError } = await client.from('wishlist_items').update({ status: 'bought', bought_item_id: outputIds[0], bought_item_ids: outputIds, ...(purchase.lines?.length ? { buy_lines: buyLinesToRow(purchase.lines) } : {}) }).eq('id', id)
    if (updateError) throw updateError
  } catch (err) {
    if (insertedItems.length) await client.from('items').delete().in('id', insertedItems)
    if (copied.length) await client.storage.from(CUTOUT_BUCKET).remove(copied)
    throw err
  }
  return { itemIds: outputIds, demo: false }
}

// ---------- 選購比較 ----------

/** 讀取比較清單，依更新時間新到舊（封存項目也回傳，由呼叫端決定是否顯示）。 */
export async function fetchCompareGroups(): Promise<CompareGroup[]> {
  if (!supabase) return demoCompareGroups.map((group) => ({ ...group })).sort((a, b) => (b.updatedAt ?? b.createdAt ?? '').localeCompare(a.updatedAt ?? a.createdAt ?? ''))
  const { data, error } = await supabase.from('compare_groups').select('id,name,budget,archived_at,created_at,updated_at').order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => ({ id: row.id, name: row.name, budget: row.budget ?? undefined, archivedAt: row.archived_at ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at }))
}

/** 讀取選購商品在比較中的順序與指定尺碼。 */
export async function fetchCompareGroupItems(groupId?: string): Promise<CompareGroupItem[]> {
  if (!supabase) return demoCompareGroupItems.filter((entry) => !groupId || entry.groupId === groupId).map((entry) => ({ ...entry })).sort((a, b) => a.position - b.position)
  let query = supabase.from('compare_group_items').select('group_id,wishlist_item_id,position,chosen_size,is_decided,cover_photo_path,added_at').order('position').order('added_at')
  if (groupId) query = query.eq('group_id', groupId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row) => ({ groupId: row.group_id, wishlistItemId: row.wishlist_item_id, position: row.position, chosenSize: row.chosen_size ?? undefined, isDecided: row.is_decided, coverPhotoPath: row.cover_photo_path ?? undefined, addedAt: row.added_at }))
}

/** 讀取候選已加入的比較名稱，供挑選器及卡片標記使用。 */
export async function fetchCompareMemberships(wishlistIds?: string[]): Promise<Record<string, CompareMembership[]>> {
  if (!supabase) {
    const groupsById = new Map(demoCompareGroups.map((group) => [group.id, group]))
    return demoCompareGroupItems.reduce<Record<string, CompareMembership[]>>((result, entry) => {
      const group = groupsById.get(entry.groupId)
      if (!group || (wishlistIds && !wishlistIds.includes(entry.wishlistItemId))) return result
      result[entry.wishlistItemId] = [...(result[entry.wishlistItemId] ?? []), { groupId: group.id, groupName: group.name }]
      return result
    }, {})
  }
  let query = supabase.from('compare_group_items').select('wishlist_item_id,group_id,compare_groups(name)')
  if (wishlistIds) query = query.in('wishlist_item_id', wishlistIds)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).reduce<Record<string, CompareMembership[]>>((result, row) => {
    const group = row.compare_groups as { name?: string } | null
    if (!group) return result
    result[row.wishlist_item_id] = [...(result[row.wishlist_item_id] ?? []), { groupId: row.group_id, groupName: group.name ?? '' }]
    return result
  }, {})
}

/** 批次加入商品；已存在的比較關聯會忽略，不會重複。 */
export async function addWishlistItemsToCompare(groupId: string, wishlistIds: string[]): Promise<{ demo: boolean }> {
  const uniqueIds = [...new Set(wishlistIds)]
  if (!uniqueIds.length) return { demo: !supabase }
  const existing = await fetchCompareGroupItems(groupId)
  const known = new Set(existing.map((entry) => entry.wishlistItemId))
  const additions = uniqueIds.filter((id) => !known.has(id))
  if (!additions.length) return { demo: !supabase }
  const position = existing.reduce((max, entry) => Math.max(max, entry.position), -1) + 1
  const now = new Date().toISOString()
  if (!supabase) {
    demoCompareGroupItems = [...demoCompareGroupItems, ...additions.map((wishlistItemId, index) => {
      const item = demoWishlistItems.find((entry) => entry.id === wishlistItemId)
      const options = wishlistSizeOptions(item?.size)
      const chosenSize = item?.flatMeasurementsSize && options.includes(item.flatMeasurementsSize) ? item.flatMeasurementsSize : options[0] ?? item?.flatMeasurementsSize
      return { groupId, wishlistItemId, position: position + index, chosenSize, addedAt: now }
    })]
    demoCompareGroups = demoCompareGroups.map((group) => group.id === groupId ? { ...group, updatedAt: now } : group)
    return { demo: true }
  }
  const { data: sizeRows, error: sizeError } = await supabase.from('wishlist_items').select('id,size,flat_measurements_size').in('id', additions)
  if (sizeError) throw sizeError
  const sizes = new Map((sizeRows ?? []).map((row) => {
    const options = wishlistSizeOptions(row.size ?? undefined)
    const measurementSize = row.flat_measurements_size as string | null
    return [row.id, measurementSize && options.includes(measurementSize) ? measurementSize : options[0] ?? measurementSize ?? null] as const
  }))
  const { error } = await supabase.from('compare_group_items').insert(additions.map((wishlistItemId, index) => ({ group_id: groupId, wishlist_item_id: wishlistItemId, position: position + index, chosen_size: sizes.get(wishlistItemId) ?? null })))
  if (error) throw error
  return { demo: false }
}

/** 從單一比較移除候選，只刪關聯列。 */
export async function removeWishlistItemFromCompare(groupId: string, wishlistId: string): Promise<{ demo: boolean }> {
  if (!supabase) {
    demoCompareGroupItems = demoCompareGroupItems.filter((entry) => entry.groupId !== groupId || entry.wishlistItemId !== wishlistId)
    demoCompareGroups = demoCompareGroups.map((group) => group.id === groupId ? { ...group, updatedAt: new Date().toISOString() } : group)
    return { demo: true }
  }
  const { error } = await supabase.from('compare_group_items').delete().eq('group_id', groupId).eq('wishlist_item_id', wishlistId)
  if (error) throw error
  return { demo: false }
}

/** 儲存目前比較表欄位順序。 */
export async function reorderCompareGroupItems(groupId: string, wishlistIds: string[]): Promise<{ demo: boolean }> {
  if (!supabase) {
    const order = new Map(wishlistIds.map((id, index) => [id, index]))
    demoCompareGroupItems = demoCompareGroupItems.map((entry) => entry.groupId === groupId && order.has(entry.wishlistItemId) ? { ...entry, position: order.get(entry.wishlistItemId)! } : entry)
    demoCompareGroups = demoCompareGroups.map((group) => group.id === groupId ? { ...group, updatedAt: new Date().toISOString() } : group)
    return { demo: true }
  }
  const client = supabase
  const results = await Promise.all(wishlistIds.map((wishlistItemId, position) => client.from('compare_group_items').update({ position }).eq('group_id', groupId).eq('wishlist_item_id', wishlistItemId)))
  const failure = results.find((result) => result.error)
  if (failure?.error) throw failure.error
  return { demo: false }
}

/** 儲存此比較要比對的尺碼。 */
export async function setCompareChosenSize(groupId: string, wishlistId: string, chosenSize: string | null): Promise<{ demo: boolean }> {
  if (!supabase) {
    demoCompareGroupItems = demoCompareGroupItems.map((entry) => entry.groupId === groupId && entry.wishlistItemId === wishlistId ? { ...entry, chosenSize: chosenSize ?? undefined } : entry)
    demoCompareGroups = demoCompareGroups.map((group) => group.id === groupId ? { ...group, updatedAt: new Date().toISOString() } : group)
    return { demo: true }
  }
  const { error } = await supabase.from('compare_group_items').update({ chosen_size: chosenSize }).eq('group_id', groupId).eq('wishlist_item_id', wishlistId)
  if (error) throw error
  return { demo: false }
}

/** 這個比較的欄頂封面（商品圖的 storage_path）；null＝改回商品封面。不影響選購清單本身的封面。 */
export async function setCompareCoverPhoto(groupId: string, wishlistId: string, path: string | null): Promise<{ demo: boolean }> {
  if (!supabase) {
    demoCompareGroupItems = demoCompareGroupItems.map((entry) => entry.groupId === groupId && entry.wishlistItemId === wishlistId ? { ...entry, coverPhotoPath: path ?? undefined } : entry)
    return { demo: true }
  }
  const { error } = await supabase.from('compare_group_items').update({ cover_photo_path: path }).eq('group_id', groupId).eq('wishlist_item_id', wishlistId)
  if (error) throw error
  return { demo: false }
}

/** 記錄此比較中使用者決定購買的候選；null 表示取消決定。 */
export async function setCompareDecision(groupId: string, wishlistId: string | null): Promise<{ demo: boolean }> {
  if (!supabase) {
    demoCompareGroupItems = demoCompareGroupItems.map((entry) => entry.groupId === groupId ? { ...entry, isDecided: entry.wishlistItemId === wishlistId } : entry)
    demoCompareGroups = demoCompareGroups.map((group) => group.id === groupId ? { ...group, updatedAt: new Date().toISOString() } : group)
    return { demo: true }
  }
  const { error } = await supabase.rpc('set_compare_decision', { p_group_id: groupId, p_wishlist_item_id: wishlistId })
  if (error) throw error
  return { demo: false }
}

/** 封存或還原比較。 */
export async function setCompareGroupArchived(id: string, archived: boolean): Promise<{ demo: boolean }> {
  const archivedAt = archived ? new Date().toISOString() : null
  if (!supabase) {
    demoCompareGroups = demoCompareGroups.map((group) => group.id === id ? { ...group, archivedAt: archivedAt ?? undefined, updatedAt: new Date().toISOString() } : group)
    return { demo: true }
  }
  const { error } = await supabase.from('compare_groups').update({ archived_at: archivedAt }).eq('id', id)
  if (error) throw error
  return { demo: false }
}

/** 建立比較並加入選定候選；若加入失敗會清除剛建立的空比較。 */
export async function createCompareWithItems(name: string, wishlistIds: string[]): Promise<{ group: CompareGroup; demo: boolean }> {
  const { group, demo } = await createCompareGroup({ name })
  try {
    await addWishlistItemsToCompare(group.id, wishlistIds)
    return { group, demo }
  } catch (error) {
    await deleteCompareGroup(group.id).catch(() => undefined)
    throw error
  }
}

function checkGroupInput(input: CompareGroupInput) {
  if (!input.name.trim()) throw new Error('請填比較名稱。')
}

export async function createCompareGroup(input: CompareGroupInput): Promise<{ group: CompareGroup; demo: boolean }> {
  checkGroupInput(input)
  if (!supabase) {
    const now = new Date().toISOString()
    const name = input.name.trim()
    const group: CompareGroup = { id: `demo-group-${Date.now()}`, name, createdAt: now, updatedAt: now }
    demoCompareGroups = [group, ...demoCompareGroups]
    return { group, demo: true }
  }
  const { data, error } = await supabase.from('compare_groups').insert({ name: input.name.trim() }).select('id,name,budget,archived_at,created_at,updated_at').single()
  if (error) throw error
  return { group: { id: data.id, name: data.name, budget: data.budget ?? undefined, archivedAt: data.archived_at ?? undefined, createdAt: data.created_at, updatedAt: data.updated_at }, demo: false }
}

export async function updateCompareGroup(id: string, input: CompareGroupInput): Promise<{ group: CompareGroup; demo: boolean }> {
  checkGroupInput(input)
  if (!supabase) {
    const base = demoCompareGroups.find((group) => group.id === id)
    if (!base) throw new Error('找不到這個群組，可能已被刪除。')
    const name = input.name.trim()
    const group: CompareGroup = { ...base, name, updatedAt: new Date().toISOString() }
    demoCompareGroups = demoCompareGroups.map((entry) => (entry.id === id ? group : entry))
    return { group, demo: true }
  }
  const { data, error } = await supabase.from('compare_groups').update({ name: input.name.trim() }).eq('id', id).select('id,name,budget,archived_at,created_at,updated_at').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('找不到這個群組，可能已被刪除。')
  return { group: { id: data.id, name: data.name, budget: data.budget ?? undefined, archivedAt: data.archived_at ?? undefined, createdAt: data.created_at, updatedAt: data.updated_at }, demo: false }
}

/** 刪除比較只拿掉比較與其關聯；候選商品仍留在選購清單。 */
export async function deleteCompareGroup(id: string): Promise<{ demo: boolean }> {
  if (!supabase) {
    demoCompareGroups = demoCompareGroups.filter((group) => group.id !== id)
    demoCompareGroupItems = demoCompareGroupItems.filter((entry) => entry.groupId !== id)
    return { demo: true }
  }
  const { error } = await supabase.from('compare_groups').delete().eq('id', id)
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
  if (files.length > 8) throw new Error('最多可以加入 8 張照片。')
  const uploadFiles = await Promise.all(files.map(toUploadableImage))
  const useCutout = input.useCutout && uploadFiles.length > 0
  const category = (await fetchCategories()).find((entry) => entry.id === input.categoryId)
  if (!category) throw new Error('找不到選擇的衣物分類，請重新選擇。')
  if (input.destination === 'wishlist' && !category.slot) throw new Error('「其他」分類不能加入選購清單，請選擇有搭配部位的類型。')

  if (!supabase) {
    const id = `demo-new-${Date.now()}`
    const imageUrl = uploadFiles[0] ? URL.createObjectURL(uploadFiles[0]) : undefined
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
        features: normalizeFeatureTags(input.features),
        featureSuggestionsDismissed: [...new Set(input.featureSuggestionsDismissed ?? [])],
        material: input.material || undefined,
        materialComposition: input.materialComposition || undefined,
        materialPercentages: input.materialPercentages ? { ...input.materialPercentages } : undefined,
        purchaseDate: input.purchaseDate || undefined,
        purchasePrice: input.purchasePrice ?? undefined,
        store: input.store || undefined,
        productUrl: input.productUrl || undefined,
        note: input.note || undefined,
        flatMeasurements: { ...input.flatMeasurements },
        flatStretch: cleanStretch(input.flatMeasurements, input.flatStretch),
        ...(imageUrl ? { cutoutUrl: imageUrl } : {}),
        shape,
      }, ...demoClosetItems]
    } else {
      demoWishlistItems = [{
        id,
        name: input.name.trim(),
        slot: category.slot!,
        primaryPart: category.slot!,
        alsoParts: [],
        colors: [colorFromName(input.colorName || '其他', input.colorHex)],
        colorHex: input.colorHex,
        shop: input.store || '尚未決定',
        brand: input.brand || undefined,
        price: input.purchasePrice ?? 0,
        url: input.productUrl || undefined,
        sizeNote: input.size || undefined,
        material: input.material || undefined,
        materialComposition: input.materialComposition || undefined,
        materialPercentages: input.materialPercentages ? { ...input.materialPercentages } : undefined,
        flatMeasurements: cleanFlat(input.flatMeasurements),
        flatStretch: cleanStretch(input.flatMeasurements, input.flatStretch),
        status: 'considering',
        ...(imageUrl ? { cutoutUrl: imageUrl } : {}),
        shape,
      }, ...demoWishlistItems]
    }
    return { id, destination: input.destination, demo: true }
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('請重新登入後再新增衣物。')

  const id = crypto.randomUUID()
  const coverPath = uploadFiles[0] ? `${user.id}/${id}/original.${fileExtension(uploadFiles[0])}` : null
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
    feature_tags: normalizeFeatureTags(input.features),
    feature_suggestions_dismissed: [...new Set(input.featureSuggestionsDismissed ?? [])],
    material: input.material?.trim() || null,
    material_composition: input.materialComposition?.trim() || null,
    material_percentages: input.materialPercentages ?? {},
    purchase_date: input.purchaseDate || null,
    purchase_price: input.purchasePrice ?? null,
    store: input.store?.trim() || null,
    product_url: input.productUrl?.trim() || null,
    note: input.note?.trim() || null,
    flat_measurements: flatMeasurements,
    flat_stretch: cleanStretch(flatMeasurements, input.flatStretch),
    image_original_path: coverPath,
    cutout_status: useCutout ? 'pending' : 'skipped',
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
        primary_part: category.slot,
        also_parts: [],
        colors: wishColorsToRow([colorFromName(input.colorName || '其他', input.colorHex)]),
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
        feature_tags: normalizeFeatureTags(input.features),
        feature_suggestions_dismissed: [...new Set(input.featureSuggestionsDismissed ?? [])],
        shop: input.store?.trim() || '尚未決定',
        price: input.purchasePrice ?? 0,
        url: input.productUrl?.trim() || null,
        size_note: input.size?.trim() || null,
        ...flatPayload(input.flatMeasurements, input.flatStretch),
        status: 'considering',
        image_original_path: coverPath,
        cutout_status: useCutout ? 'pending' : 'skipped',
      })
      if (error) throw error
    }

    const photoRows = []
    for (const [index, file] of uploadFiles.entries()) {
      const path = index === 0 ? coverPath! : `${user.id}/${id}/photos/${crypto.randomUUID()}.${fileExtension(file)}`
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
        ...(input.destination === 'wishlist' ? { color_family: input.colorName || null } : {}),
      })
    }
    if (photoRows.length) {
      const { error: photosError } = await supabase.from('item_photos').insert(photoRows)
      if (photosError) throw photosError
    }
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
  if (files.length > 8) throw new Error('最多可以加入 8 張照片。')
  const uploadFiles = await Promise.all(files.map(toUploadableImage))
  const draftUseCutout = useCutout && uploadFiles.length > 0
  if (!supabase) {
    const id = `demo-draft-${Date.now()}`
    demoGarmentDraftFiles.set(id, uploadFiles)
    return { id, demo: true }
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('請重新登入後再新增衣物。')

  const draftId = crypto.randomUUID()
  const coverPath = uploadFiles[0] ? `${user.id}/${draftId}/original.${fileExtension(uploadFiles[0])}` : null
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
      cutout_status: draftUseCutout ? 'pending' : 'skipped',
    })
    if (error) throw error

    const photoRows = []
    for (const [index, file] of uploadFiles.entries()) {
      const path = index === 0 ? coverPath! : `${user.id}/${draftId}/photos/${crypto.randomUUID()}.${fileExtension(file)}`
      const { error: uploadError } = await supabase.storage.from(CUTOUT_BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream' })
      if (uploadError) throw uploadError
      uploadedPaths.push(path)
      photoRows.push({ owner_id: user.id, item_id: draftId, storage_path: path, sort_order: index, is_cover: index === 0 })
    }
    if (photoRows.length) {
      const { error: photosError } = await supabase.from('item_photos').insert(photoRows)
      if (photosError) throw photosError
    }
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
    feature_tags: normalizeFeatureTags(input.features),
    feature_suggestions_dismissed: [...new Set(input.featureSuggestionsDismissed ?? [])],
    material: input.material?.trim() || null,
    material_composition: input.materialComposition?.trim() || null,
    material_percentages: input.materialPercentages ?? {},
    purchase_date: input.purchaseDate || null,
    purchase_price: input.purchasePrice ?? null,
    store: input.store?.trim() || null,
    product_url: input.productUrl?.trim() || null,
    note: input.note?.trim() || null,
    ...flatPayload(input.flatMeasurements, input.flatStretch),
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
    primary_part: category.slot,
    also_parts: [],
    colors: wishColorsToRow([colorFromName(input.colorName || '其他', input.colorHex)]),
    color_hex: input.colorHex,
    shop: input.store?.trim() || '尚未決定',
    price: input.purchasePrice ?? 0,
    url: input.productUrl?.trim() || null,
    size_note: input.size?.trim() || null,
    neckline_size: input.necklineSize ?? null,
    material: input.material?.trim() || null,
    material_composition: input.materialComposition?.trim() || null,
    material_percentages: input.materialPercentages ?? {},
    feature_tags: normalizeFeatureTags(input.features),
    feature_suggestions_dismissed: [...new Set(input.featureSuggestionsDismissed ?? [])],
    ...flatPayload(input.flatMeasurements, input.flatStretch),
    reason: input.note?.trim() || null,
    status: 'considering',
    image_original_path: draft.image_original_path,
    image_cutout_path: draft.image_cutout_path ?? draft.image_original_path,
    cutout_status: draft.cutout_status,
  })
  if (insertError) throw insertError
  const { error: photoUpdateError } = await supabase.from('item_photos').update({ item_id: null, wishlist_item_id: id, color_family: input.colorName || null }).eq('item_id', id)
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
    else {
      demoWishlistItems = demoWishlistItems.filter((item) => item.id !== id)
      demoCompareGroupItems = demoCompareGroupItems.filter((entry) => entry.wishlistItemId !== id)
    }
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

/** 最近一次身體量測（彈性尺寸的一圈量提示用）；讀不到時回傳 null，不擋表單 */
export async function fetchLatestBodyMeasurement(): Promise<BodyMeasurement | null> {
  try {
    const { measurements } = await fetchProfileData()
    return [...measurements].sort((a, b) => b.measuredOn.localeCompare(a.measuredOn))[0] ?? null
  } catch {
    return null
  }
}

/** 最近一次身體量測的 hook */
export function useLatestBody() {
  const [body, setBody] = useState<BodyMeasurement | null>(null)
  useEffect(() => {
    let alive = true
    void fetchLatestBodyMeasurement().then((value) => alive && setBody(value))
    return () => { alive = false }
  }, [])
  return body
}

/** 讀取個人偏好與量測紀錄；示範模式使用記憶體中的範例資料。 */
export async function fetchProfileData(): Promise<{ profile: ProfilePreferences; measurements: BodyMeasurement[]; bodyProfile: BodyProfile }> {
  if (!supabase) {
    return {
      profile: cloneProfile(demoProfile),
      measurements: demoMeasurements.map((measurement) => ({ ...measurement })),
      bodyProfile: { ...demoBodyProfile },
    }
  }

  const [profileResult, measurementsResult, bodyProfileResult] = await Promise.all([
    supabase.from('profiles').select('ai_use_body_data,shoe_sizes,frequent_sizes,fit_preferences,highlight_areas,proportion_notes,disliked_cuts').maybeSingle(),
    supabase.from('body_measurements').select('*').order('measured_on', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('body_profile').select('*').maybeSingle(),
  ])
  if (profileResult.error) throw profileResult.error
  if (measurementsResult.error) throw measurementsResult.error
  if (bodyProfileResult.error) throw bodyProfileResult.error

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
    bodyProfile: bodyProfileFromRow(bodyProfileResult.data as Record<string, unknown> | null),
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

/** 儲存固定身體資料；更新 body_profile，不新增量測快照。 */
export async function saveBodyProfile(input: BodyProfileInput): Promise<{ bodyProfile: BodyProfile; demo: boolean }> {
  if (!supabase) {
    demoBodyProfile = { ...input, updatedAt: new Date().toISOString() }
    return { bodyProfile: { ...demoBodyProfile }, demo: true }
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('請重新登入後再儲存固定資料。')

  const { data, error } = await supabase.from('body_profile')
    .upsert({ owner_id: user.id, ...bodyProfilePayload(input) }, { onConflict: 'owner_id' })
    .select('*')
    .single()
  if (error) throw error
  return { bodyProfile: bodyProfileFromRow(data as Record<string, unknown>), demo: false }
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

/* ── 踩雷覆盤與挑選規則 ───────────────────────────── */

const DECISION_STATUS: Record<ReviewDecision, LessonStatus> = { returned: 'returned', exchanged: 'exchanged', kept: 'unworn', given_away: 'given_away' }

interface ReviewRow {
  id: string
  item_id: string
  item_name: string
  brand: string | null
  size: string | null
  material: string | null
  price: number | string | null
  purchase_date: string | null
  decision: string
  returned_on: string | null
  exchange_kind?: string | null
  exchange_size?: string | null
  exchange_color_name?: string | null
  exchange_color_hex?: string | null
  exchanged_on?: string | null
  exchange_extra?: number | string | null
  reasons: string[] | null
  personal_note: string[] | null
  ai_summary: string[] | null
  ai_pasted_at?: string | null
  created_at: string
  updated_at: string | null
}

function reviewFromRow(row: ReviewRow): ReviewRecord {
  const decision: ReviewDecision =
    row.decision === 'kept' || row.decision === 'not_worn' ? 'kept' : row.decision === 'given_away' ? 'given_away' : row.decision === 'exchanged' ? 'exchanged' : 'returned'
  const kind = row.exchange_kind
  return {
    id: row.id,
    itemId: row.item_id,
    itemName: row.item_name,
    brand: row.brand ?? undefined,
    size: row.size ?? undefined,
    material: row.material ?? undefined,
    price: row.price == null ? undefined : Number(row.price),
    purchaseDate: row.purchase_date ?? undefined,
    decision,
    returnedOn: row.returned_on ?? undefined,
    exchangeKind: kind === 'size' || kind === 'color' || kind === 'other' ? kind : undefined,
    exchangeSize: row.exchange_size ?? undefined,
    exchangeColorName: row.exchange_color_name ?? undefined,
    exchangeColorHex: row.exchange_color_hex ?? undefined,
    exchangedOn: row.exchanged_on ?? undefined,
    exchangeExtra: row.exchange_extra == null ? undefined : Number(row.exchange_extra),
    reasons: (row.reasons ?? []).filter(Boolean),
    personalNote: (row.personal_note ?? []).filter(Boolean),
    aiSummary: (row.ai_summary ?? []).filter(Boolean),
    aiPastedAt: row.ai_pasted_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  }
}

/** 所有覆盤，新到舊 */
export async function fetchReviewRecords(): Promise<ReviewRecord[]> {
  if (!supabase) return [...demoReviewRecords].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const { data, error } = await supabase.from('review_records').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as ReviewRow[]).map(reviewFromRow)
}

/** 單件衣物的覆盤；沒有就回傳 null */
export async function fetchReviewForItem(itemId: string): Promise<ReviewRecord | null> {
  if (!supabase) return demoReviewRecords.find((record) => record.itemId === itemId) ?? null
  const { data, error } = await supabase.from('review_records').select('*').eq('item_id', itemId).maybeSingle()
  if (error) throw error
  return data ? reviewFromRow(data as ReviewRow) : null
}

/**
 * 儲存覆盤（每件衣物一筆，重複儲存會更新），並把衣物狀態改成對應的踩雷狀態。
 */
export async function saveReviewRecord(input: ReviewRecordInput): Promise<{ record: ReviewRecord; demo: boolean }> {
  const now = new Date().toISOString()
  const status = DECISION_STATUS[input.decision]
  const exchanged = input.decision === 'exchanged'
  const normalized: ReviewRecordInput = {
    ...input,
    returnedOn: input.decision === 'returned' ? input.returnedOn : undefined,
    exchangeKind: exchanged ? input.exchangeKind : undefined,
    exchangeSize: exchanged && input.exchangeKind === 'size' ? input.exchangeSize : undefined,
    exchangeColorName: exchanged && input.exchangeKind === 'color' ? input.exchangeColorName : undefined,
    exchangeColorHex: exchanged && input.exchangeKind === 'color' ? input.exchangeColorHex : undefined,
    exchangedOn: exchanged ? input.exchangedOn : undefined,
    exchangeExtra: exchanged ? input.exchangeExtra : undefined,
  }

  if (!supabase) {
    const existing = demoReviewRecords.find((record) => record.itemId === input.itemId)
    const record: ReviewRecord = { ...normalized, id: existing?.id ?? crypto.randomUUID(), createdAt: existing?.createdAt ?? now, updatedAt: now }
    demoReviewRecords = existing ? demoReviewRecords.map((entry) => entry.id === existing.id ? record : entry) : [record, ...demoReviewRecords]
    demoClosetItems = demoClosetItems.map((item) => item.id === input.itemId ? { ...item, status } : item)
    return { record, demo: true }
  }

  const payload: Record<string, unknown> = {
    item_id: normalized.itemId,
    item_name: normalized.itemName,
    brand: normalized.brand ?? null,
    size: normalized.size ?? null,
    material: normalized.material ?? null,
    price: normalized.price ?? null,
    purchase_date: normalized.purchaseDate || null,
    decision: normalized.decision,
    returned_on: normalized.returnedOn ?? null,
    reasons: normalized.reasons,
    personal_note: normalized.personalNote,
    ai_summary: normalized.aiSummary,
  }
  // 換貨欄位在 0016 才有；不是換貨時不送，舊資料庫也能存退貨等其他處理方式
  if (exchanged) {
    Object.assign(payload, {
      exchange_kind: normalized.exchangeKind ?? null,
      exchange_size: normalized.exchangeSize ?? null,
      exchange_color_name: normalized.exchangeColorName ?? null,
      exchange_color_hex: normalized.exchangeColorHex ?? null,
      exchanged_on: normalized.exchangedOn ?? null,
      exchange_extra: normalized.exchangeExtra ?? null,
    })
  }
  const { data, error } = await supabase.from('review_records').upsert(payload, { onConflict: 'owner_id,item_id' }).select('*').single()
  if (error) throw error
  const { error: statusError } = await supabase.from('items').update({ status }).eq('id', input.itemId)
  if (statusError) throw statusError
  return { record: reviewFromRow(data as ReviewRow), demo: false }
}

/** 只更新覆盤的部分欄位（我的體感、AI 覆盤），不動衣物狀態 */
export async function updateReviewRecord(id: string, patch: Partial<Pick<ReviewRecord, 'personalNote' | 'aiSummary' | 'aiPastedAt' | 'reasons'>>): Promise<{ demo: boolean }> {
  if (!supabase) {
    demoReviewRecords = demoReviewRecords.map((record) => record.id === id ? { ...record, ...patch, updatedAt: new Date().toISOString() } : record)
    return { demo: true }
  }
  const payload: Record<string, unknown> = {}
  if (patch.personalNote) payload.personal_note = patch.personalNote
  if (patch.aiSummary) payload.ai_summary = patch.aiSummary
  if ('aiPastedAt' in patch) payload.ai_pasted_at = patch.aiPastedAt ?? null
  if (patch.reasons) payload.reasons = patch.reasons
  const { error } = await supabase.from('review_records').update(payload).eq('id', id)
  if (error) throw error
  return { demo: false }
}

/** 換貨換到的那件（新衣物的 exchanged_from 指向舊的） */
export async function fetchExchangedTo(itemId: string): Promise<Pick<ClosetItem, 'id' | 'name' | 'size'> | null> {
  if (!supabase) {
    const item = demoClosetItems.find((entry) => entry.exchangedFrom === itemId)
    return item ? { id: item.id, name: item.name, size: item.size } : null
  }
  const { data, error } = await supabase.from('items').select('id,name,size').eq('exchanged_from', itemId).eq('is_draft', false).limit(1).maybeSingle()
  if (error) return null // 0016 之前沒有這個欄位
  return data ? { id: data.id as string, name: data.name as string, size: (data.size as string | null) || undefined } : null
}

/** 複製衣物（換貨下一步、「複製這件」）：建立新衣物，照片在 Storage 裡複製一份 */
export interface CopyItemInput {
  name: string
  categoryId: string
  colorName: string
  colorHex: string
  secondColorHex?: string
  brand?: string
  size?: string
  material?: string
  materialComposition?: string
  materialPercentages?: Record<string, number>
  seasons: string[]
  purchaseDate?: string
  purchasePrice?: number | null
  store?: string
  productUrl?: string
  note?: string
  flatMeasurements: Record<string, number | null>
  /** 換尺寸時清空；同尺寸沿用 */
  flatStretch?: Record<string, number>
  receivedOn?: string
  exchangedFrom?: string
  /** 換貨還沒收到時為 not_arrived */
  status: Extract<ItemStatus, 'ok' | 'not_arrived'>
  /** 要沿用的去背圖 */
  copyCutout: boolean
  /** 要沿用的照片（item_photos 的路徑），第一張當封面 */
  photoPaths: string[]
}

export async function copyClosetItem(source: ClosetItem, input: CopyItemInput): Promise<{ id: string; demo: boolean }> {
  if (!input.name.trim()) throw new Error('請填品名。')
  const flatMeasurements = Object.fromEntries(Object.entries(input.flatMeasurements).filter(([, value]) => value !== null && Number.isFinite(value)))

  if (!supabase) {
    const id = `demo-copy-${Date.now()}`
    const category = SAMPLE_CATEGORIES.find((entry) => entry.id === input.categoryId)
    const keepImage = input.copyCutout || input.photoPaths.length > 0
    demoClosetItems = [{
      id,
      name: input.name.trim(),
      categoryId: input.categoryId,
      slot: category?.slot ?? source.slot,
      categorySlot: category?.slot ?? source.categorySlot,
      categoryName: category?.name ?? source.categoryName,
      colorName: input.colorName,
      colorHex: input.colorHex,
      secondColorHex: input.secondColorHex || undefined,
      brand: input.brand || undefined,
      size: input.size || undefined,
      material: input.material || undefined,
      materialComposition: input.materialComposition || undefined,
      materialPercentages: input.materialPercentages,
      seasons: [...input.seasons],
      features: normalizeFeatureTags(source.features),
      purchaseDate: input.purchaseDate || undefined,
      purchasePrice: input.purchasePrice ?? undefined,
      store: input.store || undefined,
      productUrl: input.productUrl || undefined,
      note: input.note || undefined,
      flatMeasurements,
      flatStretch: cleanStretch(flatMeasurements, input.flatStretch),
      status: input.status,
      cutoutUrl: keepImage ? source.cutoutUrl : undefined,
      shape: source.shape,
      wearCount: 0,
      receivedOn: input.receivedOn,
      exchangedFrom: input.exchangedFrom,
    }, ...demoClosetItems]
    return { id, demo: true }
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('請重新登入後再新增衣物。')

  const id = crypto.randomUUID()
  const ext = (path: string) => path.split('.').pop() || 'jpg'
  const copied: string[] = []
  const payload: Record<string, unknown> = {
    id,
    category_id: input.categoryId,
    name: input.name.trim(),
    color_name: input.colorName,
    color_hex: input.colorHex,
    second_color_hex: input.secondColorHex || null,
    size: input.size?.trim() || '',
    brand: input.brand?.trim() || null,
    seasons: input.seasons,
    material: input.material?.trim() || null,
    material_composition: input.materialComposition?.trim() || null,
    material_percentages: input.materialPercentages ?? {},
    feature_tags: normalizeFeatureTags(source.features),
    feature_suggestions_dismissed: [],
    purchase_date: input.purchaseDate || null,
    purchase_price: input.purchasePrice ?? null,
    store: input.store?.trim() || null,
    product_url: input.productUrl?.trim() || null,
    note: input.note?.trim() || null,
    flat_measurements: flatMeasurements,
    flat_stretch: cleanStretch(flatMeasurements, input.flatStretch),
    status: input.status,
    cutout_status: 'skipped',
  }
  // 0016 的欄位只在有值時送出
  if (input.receivedOn) payload.received_on = input.receivedOn
  if (input.exchangedFrom) payload.exchanged_from = input.exchangedFrom

  try {
    const { error } = await supabase.from('items').insert(payload)
    if (error) throw error

    const bucket = supabase.storage.from(CUTOUT_BUCKET)
    const photoRows = []
    for (const [index, from] of input.photoPaths.entries()) {
      const to = index === 0 ? `${user.id}/${id}/original.${ext(from)}` : `${user.id}/${id}/photos/${crypto.randomUUID()}.${ext(from)}`
      const { error: copyError } = await bucket.copy(from, to)
      if (copyError) throw copyError
      copied.push(to)
      photoRows.push({ owner_id: user.id, item_id: id, storage_path: to, sort_order: index, is_cover: index === 0 })
    }
    let cutoutPath: string | null = null
    if (input.copyCutout && source.cutoutPath) {
      cutoutPath = `${user.id}/${id}/cutout.${ext(source.cutoutPath)}`
      const { error: copyError } = await bucket.copy(source.cutoutPath, cutoutPath)
      if (copyError) throw copyError
      copied.push(cutoutPath)
    }
    if (photoRows.length) {
      const { error: photosError } = await supabase.from('item_photos').insert(photoRows)
      if (photosError) throw photosError
    }
    if (photoRows.length || cutoutPath) {
      const { error: imageError } = await supabase.from('items').update({
        image_original_path: photoRows[0]?.storage_path ?? null,
        image_cutout_path: cutoutPath,
        cutout_status: cutoutPath ? 'done' : 'skipped',
      }).eq('id', id)
      if (imageError) throw imageError
    }
    return { id, demo: false }
  } catch (error) {
    if (copied.length) await supabase.storage.from(CUTOUT_BUCKET).remove(copied)
    await supabase.from('items').delete().eq('id', id)
    throw error
  }
}

/** 取消踩雷：刪除覆盤（規則保留），衣物回到衣櫃 */
export async function removeReviewRecord(record: ReviewRecord): Promise<{ demo: boolean }> {
  if (!supabase) {
    demoReviewRecords = demoReviewRecords.filter((entry) => entry.id !== record.id)
    demoLessonRules = demoLessonRules.map((rule) => rule.sourceReviewId === record.id ? { ...rule, sourceReviewId: undefined } : rule)
    demoClosetItems = demoClosetItems.map((item) => item.id === record.itemId ? { ...item, status: 'ok' } : item)
    return { demo: true }
  }
  const { error } = await supabase.from('review_records').delete().eq('id', record.id)
  if (error) throw error
  const { error: statusError } = await supabase.from('items').update({ status: 'ok' }).eq('id', record.itemId)
  if (statusError) throw statusError
  return { demo: false }
}

/** 踩雷筆記本裡的衣物（已退貨／留著不穿／轉賣・送人），含圖片 */
export async function fetchLessonItems(): Promise<ClosetItem[]> {
  if (!supabase) return demoClosetItems.filter((item) => isLessonStatus(item.status)).map((item) => ({ ...item }))
  const { data, error } = await supabase
    .from('items')
    .select('id,name,category_id,color_name,color_hex,brand,size,neckline_size,fit,material,material_composition,material_percentages,seasons,occasions,purchase_date,purchase_price,store,product_url,note,flat_measurements,flat_stretch,status,is_favorite,image_original_path,image_cutout_path,cutout_status,wear_count,last_worn_at,categories(name,slot)')
    .in('status', ['returned', 'exchanged', 'unworn', 'given_away'])
    .eq('is_draft', false)
  if (error) throw error
  const rows = (data ?? []) as unknown as ItemRow[]
  const urls = await signed(rows.flatMap((row) => [row.image_cutout_path, row.image_original_path].filter((path): path is string => !!path)))
  return rows.map((row) => itemFromRow(row, urls))
}

interface LessonRuleRow {
  id: string
  scope: string
  kind: string | null
  check_kind?: string | null
  text: string
  why: string
  active: boolean
  source_review_id: string | null
  created_at: string
  last_notified_at?: string | null
}

function ruleFromRow(row: LessonRuleRow): LessonRule {
  return {
    id: row.id,
    scope: row.scope,
    kind: row.kind === 'brand' || row.kind === 'size' ? row.kind : 'category',
    checkKind: row.check_kind === 'auto' ? 'auto' : 'remind',
    text: row.text,
    why: row.why,
    active: row.active,
    sourceReviewId: row.source_review_id ?? undefined,
    createdAt: row.created_at,
    lastNotifiedAt: row.last_notified_at ?? undefined,
  }
}

/** 挑選規則，新到舊 */
export async function fetchLessonRules(): Promise<LessonRule[]> {
  if (!supabase) return [...demoLessonRules].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const { data, error } = await supabase.from('lesson_rules').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as LessonRuleRow[]).map(ruleFromRow)
}

/** 新增或更新一條規則（有 id 就更新） */
export async function saveLessonRule(input: LessonRuleInput): Promise<{ rule: LessonRule; demo: boolean }> {
  if (!supabase) {
    const existing = input.id ? demoLessonRules.find((rule) => rule.id === input.id) : undefined
    const rule: LessonRule = { ...input, id: existing?.id ?? crypto.randomUUID(), createdAt: existing?.createdAt ?? new Date().toISOString() }
    demoLessonRules = existing ? demoLessonRules.map((entry) => entry.id === rule.id ? rule : entry) : [rule, ...demoLessonRules]
    return { rule, demo: true }
  }
  const payload: Record<string, unknown> = {
    scope: input.scope,
    kind: input.kind,
    text: input.text,
    why: input.why,
    active: input.active,
    source_review_id: input.sourceReviewId ?? null,
  }
  // 0016 才有 check_kind；只有「可自動檢查」需要特別記
  payload.check_kind = input.checkKind
  const query = input.id
    ? supabase.from('lesson_rules').update(payload).eq('id', input.id)
    : supabase.from('lesson_rules').insert(payload)
  const { data, error } = await query.select('*').single()
  if (error) throw error
  return { rule: ruleFromRow(data as LessonRuleRow), demo: false }
}

/** 記錄選購時已顯示的規則提醒；同一條規則每 7 天最多提醒一次。 */
export async function markLessonRulesNotified(ids: string[]): Promise<string[]> {
  const uniqueIds = [...new Set(ids)]
  if (!uniqueIds.length) return []
  const now = new Date()
  const notifiedAt = now.toISOString()
  const cooldownBefore = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  if (!supabase) {
    const marked: string[] = []
    demoLessonRules = demoLessonRules.map((rule) => {
      const lastNotified = rule.lastNotifiedAt ? Date.parse(rule.lastNotifiedAt) : 0
      if (uniqueIds.includes(rule.id) && rule.active && (!lastNotified || lastNotified <= Date.parse(cooldownBefore))) {
        marked.push(rule.id)
        return { ...rule, lastNotifiedAt: notifiedAt }
      }
      return rule
    })
    return marked
  }

  const { data, error } = await supabase
    .from('lesson_rules')
    .update({ last_notified_at: notifiedAt })
    .in('id', uniqueIds)
    .eq('active', true)
    .or(`last_notified_at.is.null,last_notified_at.lte.${cooldownBefore}`)
    .select('id')
  if (error) throw error
  return (data ?? []).map((row) => row.id)
}

export async function deleteLessonRule(id: string): Promise<{ demo: boolean }> {
  if (!supabase) {
    demoLessonRules = demoLessonRules.filter((rule) => rule.id !== id)
    return { demo: true }
  }
  const { error } = await supabase.from('lesson_rules').delete().eq('id', id)
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

function featureFromRow(row: Record<string, unknown>, counts: { closet: number; wishlist: number } = { closet: 0, wishlist: 0 }): FeatureDefinition {
  return {
    name: String(row.name),
    dimension: row.dimension as FeatureDefinition['dimension'],
    aliases: Array.isArray(row.aliases) ? row.aliases as string[] : [],
    applicableTypes: Array.isArray(row.applicable_types) ? row.applicable_types as string[] : [],
    sortOrder: Number(row.sort_order ?? 100),
    isHidden: row.is_hidden === true,
    closetCount: counts.closet,
    wishCount: counts.wishlist,
  }
}

function incrementFeatureCounts(rows: { feature_tags?: FeatureTag[] | null }[], counts: Map<string, { closet: number; wishlist: number }>, kind: 'closet' | 'wishlist') {
  for (const row of rows) {
    const names = new Set(normalizeFeatureTags(row.feature_tags).map((tag) => tag.name))
    for (const name of names) {
      const count = counts.get(name) ?? { closet: 0, wishlist: 0 }
      count[kind] += 1
      counts.set(name, count)
    }
  }
}

/** 讀取使用者的特徵字典及衣物／候選使用件數；首次進入會補上預設特徵。 */
export async function fetchGarmentFeatures(includeHidden = false): Promise<FeatureDefinition[]> {
  if (!supabase) {
    for (const [name, feature] of demoFeatures) {
      const closetCount = demoClosetItems.filter((item) => item.features?.some((tag) => tag.name === name)).length
      const wishCount = demoWishlistItems.filter((item) => item.features?.some((tag) => tag.name === name)).length
      demoFeatures.set(name, { ...feature, closetCount, wishCount })
    }
    return [...demoFeatures.values()].filter((feature) => includeHidden || !feature.isHidden).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh-TW'))
  }

  const seeds = FEATURE_DEFAULTS.map((feature) => ({
    name: feature.name,
    dimension: feature.dimension,
    aliases: feature.aliases,
    applicable_types: feature.applicableTypes,
    sort_order: feature.sortOrder,
    is_hidden: false,
  }))
  const { error: seedError } = await supabase.from('garment_features').upsert(seeds, { onConflict: 'owner_id,name', ignoreDuplicates: true })
  if (seedError) throw seedError

  const [featuresResult, closetResult, wishResult] = await Promise.all([
    supabase.from('garment_features').select('name,dimension,aliases,applicable_types,sort_order,is_hidden').order('sort_order').order('name'),
    supabase.from('items').select('feature_tags').eq('is_draft', false),
    supabase.from('wishlist_items').select('feature_tags'),
  ])
  for (const result of [featuresResult, closetResult, wishResult]) if (result.error) throw result.error
  const counts = new Map<string, { closet: number; wishlist: number }>()
  incrementFeatureCounts((closetResult.data ?? []) as { feature_tags?: FeatureTag[] | null }[], counts, 'closet')
  incrementFeatureCounts((wishResult.data ?? []) as { feature_tags?: FeatureTag[] | null }[], counts, 'wishlist')
  return ((featuresResult.data ?? []) as unknown as Record<string, unknown>[])
    .map((row) => featureFromRow(row, counts.get(String(row.name))))
    .filter((feature) => includeHidden || !feature.isHidden)
}

export async function createGarmentFeature(input: FeatureDefinitionInput): Promise<void> {
  const name = input.name.trim()
  if (!name) throw new Error('請輸入特徵名稱。')
  const aliases = normalizeFeatureAliases(input.aliases, name)
  if (!supabase) {
    if (demoFeatures.has(name)) throw new Error(`「${name}」已經在特徵清單。`)
    demoFeatures.set(name, { ...input, name, aliases, closetCount: 0, wishCount: 0 })
    return
  }
  const { error } = await supabase.from('garment_features').insert({
    name,
    dimension: input.dimension,
    aliases,
    applicable_types: input.applicableTypes,
    sort_order: input.sortOrder,
    is_hidden: input.isHidden,
  })
  if (error) throw error
}

export async function updateGarmentFeature(oldName: string, input: FeatureDefinitionInput): Promise<void> {
  const name = input.name.trim()
  if (!name) throw new Error('特徵名稱不能空白。')
  if (input.dimension !== (demoFeatures.get(oldName)?.dimension ?? input.dimension)) throw new Error('已建立的特徵維度不可直接更改，請在同維度內新增或合併。')
  const aliases = normalizeFeatureAliases(input.aliases, name)
  if (!supabase) {
    const old = demoFeatures.get(oldName)
    if (!old) throw new Error('找不到這個特徵。')
    if (name !== oldName && demoFeatures.has(name)) throw new Error(`「${name}」已存在，請改用合併。`)
    demoFeatures.delete(oldName)
    demoFeatures.set(name, { ...input, name, aliases, closetCount: old.closetCount, wishCount: old.wishCount })
    for (const [key, feature] of demoFeatures) {
      if (key !== name && feature.aliases.some((alias) => alias === oldName)) demoFeatures.set(key, { ...feature, aliases: feature.aliases.map((alias) => alias === oldName ? name : alias) })
    }
    const rename = (tags?: FeatureTag[]) => normalizeFeatureTags(tags?.map((tag) => tag.name === oldName ? { ...tag, name } : tag))
    demoClosetItems = demoClosetItems.map((item) => item.features?.some((tag) => tag.name === oldName) ? { ...item, features: rename(item.features) } : item)
    demoWishlistItems = demoWishlistItems.map((item) => item.features?.some((tag) => tag.name === oldName) ? { ...item, features: rename(item.features) } : item)
    return
  }
  const old = await supabase.from('garment_features').select('dimension').eq('name', oldName).maybeSingle()
  if (old.error) throw old.error
  if (!old.data) throw new Error('找不到這個特徵。')
  if (old.data.dimension !== input.dimension) throw new Error('已建立的特徵維度不可直接更改。')
  if (name !== oldName) {
    const { error: replaceError } = await supabase.rpc('replace_garment_feature_tags', { p_from: [oldName], p_to: name, p_to_dimension: input.dimension })
    if (replaceError) throw replaceError
  }
  const { error } = await supabase.from('garment_features').update({
    name,
    aliases,
    applicable_types: input.applicableTypes,
    sort_order: input.sortOrder,
    is_hidden: input.isHidden,
  }).eq('name', oldName)
  if (error) throw error
}

/** 合併特徵或刪除；關聯更新由單一資料庫 RPC 同步套用到衣物及選購候選。 */
export async function replaceGarmentFeatures(names: string[], targetName: string | null): Promise<void> {
  const from = [...new Set(names)].filter((name) => name !== targetName)
  if (!from.length) return
  const target = targetName ? demoFeatures.get(targetName) : undefined
  if (!supabase) {
    const definitions = from.map((name) => demoFeatures.get(name)).filter((feature): feature is FeatureDefinition => !!feature)
    const targetDefinition = target ?? [...demoFeatures.values()].find((feature) => feature.name === targetName)
    if (targetName && !targetDefinition) throw new Error('找不到合併後要保留的特徵。')
    if (targetDefinition && definitions.some((feature) => feature.dimension !== targetDefinition.dimension)) throw new Error('只能合併相同維度的特徵。')
    const namesToReplace = new Set(from)
    const remap = (tags?: FeatureTag[]) => normalizeFeatureTags(tags?.flatMap((tag) => {
      if (!namesToReplace.has(tag.name)) return [tag]
      return targetDefinition ? [{ name: targetDefinition.name, dimension: targetDefinition.dimension }] : []
    }))
    demoClosetItems = demoClosetItems.map((item) => ({ ...item, features: remap(item.features) }))
    demoWishlistItems = demoWishlistItems.map((item) => ({ ...item, features: remap(item.features) }))
    for (const name of from) demoFeatures.delete(name)
    if (targetDefinition) {
      const aliases = [...new Set([...targetDefinition.aliases, ...definitions.flatMap((feature) => [feature.name, ...feature.aliases])].filter((alias) => alias !== targetDefinition.name))]
      demoFeatures.set(targetDefinition.name, { ...targetDefinition, aliases })
    }
    return
  }
  let targetDimension: FeatureDefinition['dimension'] | null = null
  if (targetName) {
    const { data, error } = await supabase.from('garment_features').select('dimension').eq('name', targetName).single()
    if (error) throw error
    targetDimension = data.dimension as FeatureDefinition['dimension']
    const { data: sources, error: sourceError } = await supabase.from('garment_features').select('name,dimension,aliases').in('name', from)
    if (sourceError) throw sourceError
    if ((sources ?? []).some((feature) => feature.dimension !== targetDimension)) throw new Error('只能合併相同維度的特徵。')
    const targetCurrent = await supabase.from('garment_features').select('aliases').eq('name', targetName).single()
    if (targetCurrent.error) throw targetCurrent.error
    const mergedAliases = [...new Set([...(targetCurrent.data.aliases as string[] ?? []), ...(sources ?? []).flatMap((feature) => [feature.name, ...(feature.aliases as string[] ?? [])])].filter((alias) => alias !== targetName))]
    const { error: aliasError } = await supabase.from('garment_features').update({ aliases: mergedAliases }).eq('name', targetName)
    if (aliasError) throw aliasError
  }
  const { error: replaceError } = await supabase.rpc('replace_garment_feature_tags', { p_from: from, p_to: targetName, p_to_dimension: targetDimension })
  if (replaceError) throw replaceError
  const { error: deleteError } = await supabase.from('garment_features').delete().in('name', from)
  if (deleteError) throw deleteError
}

/** 登出；示範模式沒有登入狀態 */
export async function signOut(): Promise<{ demo: boolean }> {
  if (!supabase) return { demo: true }
  const { error } = await supabase.auth.signOut()
  if (error) throw error
  return { demo: false }
}

/* ── 量測趨勢檢視設定（measurement_trend_prefs）────────── */

function trendPrefsFromRow(row: Record<string, unknown> | null | undefined): MeasurementTrendPrefs {
  if (!row) return { ...DEFAULT_TREND_PREFS }
  return normalizeTrendPrefs({
    metrics: Array.isArray(row.metrics) ? (row.metrics as MeasurementTrendPrefs['metrics']) : undefined,
    range: row.time_range as MeasurementTrendPrefs['range'],
    morningOnly: row.morning_only === true,
    showWeight: row.show_weight !== false,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : undefined,
  })
}

/** 讀取趨勢設定；還沒存過時回傳預設值（saved = false） */
export async function fetchTrendPrefs(): Promise<{ prefs: MeasurementTrendPrefs; saved: boolean }> {
  if (!supabase) return { prefs: demoTrendPrefs ? { ...demoTrendPrefs } : { ...DEFAULT_TREND_PREFS }, saved: Boolean(demoTrendPrefs) }
  const { data, error } = await supabase.from('measurement_trend_prefs').select('metrics,time_range,morning_only,show_weight,updated_at').maybeSingle()
  if (error) throw error
  return { prefs: trendPrefsFromRow(data as Record<string, unknown> | null), saved: Boolean(data) }
}

/** 新增或更新趨勢設定（每人一筆） */
export async function saveTrendPrefs(input: MeasurementTrendPrefs): Promise<{ prefs: MeasurementTrendPrefs; demo: boolean }> {
  const prefs = normalizeTrendPrefs(input)
  if (!supabase) {
    demoTrendPrefs = { ...prefs, updatedAt: new Date().toISOString() }
    return { prefs: { ...demoTrendPrefs }, demo: true }
  }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('請先登入再儲存設定。')
  const { data, error } = await supabase
    .from('measurement_trend_prefs')
    .upsert({ owner_id: user.id, metrics: prefs.metrics, time_range: prefs.range, morning_only: prefs.morningOnly, show_weight: prefs.showWeight }, { onConflict: 'owner_id' })
    .select('metrics,time_range,morning_only,show_weight,updated_at')
    .single()
  if (error) throw error
  return { prefs: trendPrefsFromRow(data as Record<string, unknown>), demo: false }
}

/** 刪除趨勢設定＝還原預設 */
export async function resetTrendPrefs(): Promise<{ prefs: MeasurementTrendPrefs; demo: boolean }> {
  if (!supabase) {
    demoTrendPrefs = null
    return { prefs: { ...DEFAULT_TREND_PREFS }, demo: true }
  }
  const { error } = await supabase.from('measurement_trend_prefs').delete().not('owner_id', 'is', null)
  if (error) throw error
  return { prefs: { ...DEFAULT_TREND_PREFS }, demo: false }
}
