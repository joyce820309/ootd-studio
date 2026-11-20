/** 色系大類：統計、篩選、搭配建議用。挑色用 GARMENT_COLORS 的細色名。 */
export const COLOR_FAMILIES = [
  { id: 'white', name: '白米' },
  { id: 'brown', name: '棕' },
  { id: 'gray', name: '灰黑' },
  { id: 'blue', name: '藍' },
  { id: 'green', name: '綠' },
  { id: 'warm', name: '黃橘' },
  { id: 'red', name: '紅粉' },
  { id: 'purple', name: '紫' },
  { id: 'other', name: '其他' },
] as const

/**
 * 衣物色名（B6 新增衣物、B7.1 加入選購、換貨換顏色共用）。
 * 舊色名全部保留（白、米、燕麥、杏、駝、咖啡、灰、黑、海軍藍、藍、綠、黃、橘、紅、酒紅、粉、紫、多色、其他），既有資料不用轉換。
 * pattern：'heather' 花灰用細點紋、'multi' 多色用彩色圓盤；其餘為純色。
 */
export const GARMENT_COLORS = [
  // 白米
  { name: '白', hex: '#F6F4EF', family: 'white' },
  { name: '奶白', hex: '#F3EDE1', family: 'white' },
  { name: '米', hex: '#EFE6D2', family: 'white' },
  { name: '杏', hex: '#EAD9C6', family: 'white' },
  { name: '燕麥', hex: '#D9CBB3', family: 'white' },
  // 棕
  { name: '卡其', hex: '#BFAE8C', family: 'brown' },
  { name: '駝', hex: '#B88A5A', family: 'brown' },
  { name: '焦糖', hex: '#A0683A', family: 'brown' },
  { name: '咖啡', hex: '#6B4A36', family: 'brown' },
  { name: '深咖', hex: '#3F2C22', family: 'brown' },
  // 灰黑
  { name: '淺灰', hex: '#D3D1CC', family: 'gray' },
  { name: '米灰', hex: '#C6BFB3', family: 'gray' },
  { name: '花灰', hex: '#A9A7A3', family: 'gray', pattern: 'heather' },
  { name: '灰', hex: '#9A9893', family: 'gray' },
  { name: '深灰', hex: '#5E5D5B', family: 'gray' },
  { name: '炭灰', hex: '#3E3E3D', family: 'gray' },
  { name: '黑', hex: '#232322', family: 'gray' },
  // 藍
  { name: '寶寶藍', hex: '#B9D3EA', family: 'blue' },
  { name: '藍', hex: '#8FA3BC', family: 'blue' },
  { name: '牛仔藍', hex: '#4F6A8C', family: 'blue' },
  { name: '海軍藍', hex: '#2E3A4F', family: 'blue' },
  // 綠
  { name: '綠', hex: '#8C9A86', family: 'green' },
  { name: '軍綠', hex: '#5E6146', family: 'green' },
  // 黃橘
  { name: '黃', hex: '#E8C66A', family: 'warm' },
  { name: '橘', hex: '#D98A4E', family: 'warm' },
  // 紅粉
  { name: '粉', hex: '#E7B9B4', family: 'red' },
  { name: '紅', hex: '#A8423A', family: 'red' },
  { name: '酒紅', hex: '#6E2E34', family: 'red' },
  // 紫
  { name: '柔紫', hex: '#C9BBD9', family: 'purple' },
  { name: '紫', hex: '#8E7AA6', family: 'purple' },
  // 其他
  { name: '多色', hex: '#8C9A86', family: 'other', pattern: 'multi' },
  { name: '其他', hex: '#D9C7AC', family: 'other' },
] as const
export type ColorFamilyId = (typeof COLOR_FAMILIES)[number]['id']

/** 色系顯示名（「白米」「紅粉」…），用於歸類、篩選與重複度 */
export const COLOR_FAMILY_NAMES: string[] = COLOR_FAMILIES.map((family) => family.name)

const familyName = (id: string) => COLOR_FAMILIES.find((family) => family.id === id)?.name ?? '其他'

/** 色票名 → 色系顯示名，例如「酒紅」→「紅粉」 */
export function familyOfGarmentColor(name: string): string | null {
  const color = GARMENT_COLORS.find((entry) => entry.name === name)
  return color ? familyName(color.family) : null
}

function linearize(channel: number) {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

/** sRGB 轉 OKLab，讓不同色相的色差比較符合人眼感受。 */
export function toOklab(hex: string): [number, number, number] {
  const [r8, g8, b8] = [1, 3, 5].map((index) => linearize(Number.parseInt(hex.slice(index, index + 2), 16) / 255))
  const l = Math.cbrt(0.4122214708 * r8 + 0.5363325363 * g8 + 0.0514459929 * b8)
  const m = Math.cbrt(0.2119034982 * r8 + 0.6806995451 * g8 + 0.1073969566 * b8)
  const s = Math.cbrt(0.0883024619 * r8 + 0.2817188376 * g8 + 0.6299787005 * b8)
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]
}

export const isHex = (value: string | null | undefined): value is string => !!value && /^#[0-9a-f]{6}$/i.test(value)

/** 依 OKLab 找最接近的色票（不含「多色」「其他」），附距離與色系顯示名 */
export function nearestGarmentColor(hex: string) {
  const target = toOklab(hex)
  return GARMENT_COLORS
    .filter((color) => color.family !== 'other')
    .map((color) => {
      const lab = toOklab(color.hex)
      return { name: color.name as string, hex: color.hex as string, family: familyName(color.family), distance: Math.hypot(target[0] - lab[0], target[1] - lab[1], target[2] - lab[2]) }
    })
    .sort((a, b) => a.distance - b.distance)[0]
}
