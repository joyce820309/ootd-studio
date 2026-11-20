// 選購商品的顏色：一個顏色＝三個獨立欄位（色碼、名稱、歸類），每筆以 id 為 key。
// 只用相對路徑匯入，讓 `node --test` 可以直接跑這個檔案的測試。
import { COLOR_FAMILY_NAMES, GARMENT_COLORS, isHex, nearestGarmentColor } from './colors.ts'
import type { WishColorSource, WishlistColor } from '../types.ts'

const FALLBACK_HEX = '#D9CBB3'

export function newColorId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** 依色碼找最接近的色票名，當作建議名 */
export function suggestColorName(hex: string) {
  return nearestGarmentColor(isHex(hex) ? hex : FALLBACK_HEX).name
}

/** 依色碼（OKLab 最近色票）自動歸類色系 */
export function familyOfHex(hex: string) {
  return nearestGarmentColor(isHex(hex) ? hex : FALLBACK_HEX).family
}

/** 新的一色：照片取色或點色票來的；名稱先用建議名 */
export function createColor(input: { hex: string; source: WishColorSource; name?: string; nameCustom?: boolean }): WishlistColor {
  const hex = input.hex.toUpperCase()
  return { id: newColorId(), name: input.name ?? suggestColorName(hex), nameCustom: !!input.nameCustom && !!input.name, hex, family: familyOfHex(hex), familyCustom: false, source: input.source, favorite: false }
}

/** 由名稱（舊資料或衣櫃單品的 color_name）建一色：名稱是色票名時色碼用色票，否則視為自訂名 */
export function colorFromName(name: string, hex?: string | null): WishlistColor {
  const palette = GARMENT_COLORS.find((color) => color.name === name)
  const resolved = (isHex(hex) ? hex : palette?.hex ?? FALLBACK_HEX).toUpperCase()
  return { id: newColorId(), name: name || suggestColorName(resolved), nameCustom: !!name && !palette, hex: resolved, family: familyOfHex(resolved), familyCustom: false, source: 'palette', favorite: false }
}

type RawColor = Record<string, unknown>
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

/**
 * 讀取 colors JSONB：接受新格式（snake_case 或 camelCase）與舊格式 `{ family: 名稱, hex }`。
 * 舊格式的 family 是名稱；新格式的 family 是色系。每筆保證有唯一 id、最多一個最想要。
 */
export function normalizeWishColors(raw: unknown): WishlistColor[] {
  const list = Array.isArray(raw) ? (raw.filter((entry) => entry && typeof entry === 'object') as RawColor[]) : []
  const seen = new Set<string>()
  let favoriteTaken = false
  return list.map((entry, index) => {
    const isLegacy = typeof entry.name !== 'string'
    const name = isLegacy ? text(entry.family) : text(entry.name)
    const palette = GARMENT_COLORS.find((color) => color.name === name)
    const hex = (isHex(text(entry.hex)) ? text(entry.hex) : palette?.hex ?? FALLBACK_HEX).toUpperCase()
    const nameCustom = isLegacy ? !!name && !palette : entry.name_custom === true || entry.nameCustom === true
    const familyCustom = !isLegacy && (entry.family_custom === true || entry.familyCustom === true)
    const storedFamily = isLegacy ? '' : text(entry.family)
    const family = familyCustom && COLOR_FAMILY_NAMES.includes(storedFamily) ? storedFamily : familyOfHex(hex)
    let id = text(entry.id) || `legacy-${index}`
    while (seen.has(id)) id = `${id}-${index}`
    seen.add(id)
    const favorite = entry.favorite === true && !favoriteTaken
    if (favorite) favoriteTaken = true
    return { id, name: name || suggestColorName(hex), nameCustom, hex, family, familyCustom, source: entry.source === 'photo' ? 'photo' : 'palette', favorite }
  })
}

/** 寫回資料庫的格式 */
export function wishColorsToRow(colors: WishlistColor[]) {
  return colors.map((color) => ({ id: color.id, name: color.name.trim(), name_custom: color.nameCustom, hex: color.hex, family: color.family, family_custom: color.familyCustom, source: color.source, favorite: color.favorite }))
}

// ---------- 編輯操作：都只動指定 id 那一筆，其他筆原封不動 ----------

const patch = (colors: WishlistColor[], id: string, update: (color: WishlistColor) => WishlistColor) => colors.map((color) => (color.id === id ? update(color) : color))

export function addColor(colors: WishlistColor[], color: WishlistColor) {
  return [...colors, color]
}

export function removeColor(colors: WishlistColor[], id: string) {
  return colors.filter((color) => color.id !== id)
}

/** 改名：絕不動色碼與歸類。清空＝改回建議名（name_custom=false） */
export function renameColor(colors: WishlistColor[], id: string, name: string) {
  return patch(colors, id, (color) => (name.trim() ? { ...color, name, nameCustom: true } : { ...color, name: suggestColorName(color.hex), nameCustom: false }))
}

/**
 * 換色碼（照片重新取樣或點色票）：
 * - 名稱：自訂過就保留，否則換成新的建議名（點色票時用該色票名）；選色器有傳 nameCustom 時以選色器的名稱為準
 * - 歸類：手動改過就保留，否則依新色碼重新歸類
 */
export function applyColorPick(colors: WishlistColor[], id: string, pick: { hex: string; source: WishColorSource; name?: string; nameCustom?: boolean }) {
  const hex = pick.hex.toUpperCase()
  return patch(colors, id, (color) => {
    const nameCustom = pick.nameCustom ?? color.nameCustom
    const name = pick.nameCustom !== undefined ? pick.name ?? suggestColorName(hex) : color.nameCustom ? color.name : pick.name ?? suggestColorName(hex)
    return { ...color, hex, source: pick.source, name, nameCustom, family: color.familyCustom ? color.family : familyOfHex(hex) }
  })
}

/** 手動改歸類；之後換色碼也不再自動覆蓋 */
export function setColorFamily(colors: WishlistColor[], id: string, family: string) {
  return patch(colors, id, (color) => ({ ...color, family, familyCustom: true }))
}

/** 最想要最多一個：點已選的取消，點別的就換過去 */
export function toggleFavoriteColor(colors: WishlistColor[], id: string) {
  const turningOff = colors.some((color) => color.id === id && color.favorite)
  return colors.map((color) => ({ ...color, favorite: !turningOff && color.id === id }))
}

/** 名稱在介面上顯示：自訂名照實；建議名由呼叫端以淡色呈現 */
export const isSuggestedName = (color: WishlistColor) => !color.nameCustom

/** 圖片對應顏色：null＝全色（買下時帶到每一色）；此值＝未標顏色（買下時不帶到任何顏色） */
export const UNTAGGED_PHOTO_COLOR = '__untagged__'

/** 圖片要顯示的顏色名；全色與未標顏色都不顯示 */
export const photoColorLabel = (value?: string | null) => (value && value !== UNTAGGED_PHOTO_COLOR ? value : undefined)
