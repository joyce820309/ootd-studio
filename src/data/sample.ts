import type { BodyMeasurement, Category, ClosetItem, CompareGroup, DiaryEntry, ProfilePreferences, Slot, WishlistItem } from '@/types'

export const SAMPLE_CATEGORIES: Category[] = [
  { id: 'cat-top', name: '上衣', slot: 'top', sort: 1 },
  { id: 'cat-bottom', name: '下身', slot: 'bottom', sort: 2 },
  { id: 'cat-outer', name: '外套', slot: 'outer', sort: 3 },
  { id: 'cat-dress', name: '洋裝／套裝', slot: 'top', sort: 4 },
  { id: 'cat-socks', name: '襪子', slot: 'acc', sort: 5 },
  { id: 'cat-shoes', name: '鞋子', slot: 'shoes', sort: 6 },
  { id: 'cat-bag', name: '包包', slot: 'bag', sort: 7 },
  { id: 'cat-accessories', name: '配件', slot: 'acc', sort: 8 },
  { id: 'cat-other', name: '其他', slot: null, sort: 9 },
]

/** 示範模式用的衣櫃資料（與設計稿一致） */
export const SAMPLE_ITEMS: ClosetItem[] = [
  { id: 'blazer', name: '炭灰短版西裝外套', categoryId: 'outer', slot: 'outer', colorName: '炭灰', colorHex: '#3D3D3B', brand: 'Zara', size: 'M', status: 'ok', isFavorite: true, shape: 'coat', wearCount: 11 },
  { id: 'camel', name: '駝色羊毛長大衣', categoryId: 'outer', slot: 'outer', colorName: '駝色', colorHex: '#B88A5A', brand: 'Arket', size: 'S', status: 'ok', shape: 'coat', wearCount: 3 },
  { id: 'suede', name: '深咖啡麂皮夾克', categoryId: 'outer', slot: 'outer', colorName: '深咖啡', colorHex: '#5A4031', brand: 'Massimo Dutti', size: 'S', status: 'lent', shape: 'coat', wearCount: 4 },
  { id: 'knit', name: '燕麥色羊毛針織衫', categoryId: 'top', slot: 'top', colorName: '燕麥', colorHex: '#D9CBB3', brand: 'COS', size: 'M', status: 'ok', isFavorite: true, shape: 'knit', wearCount: 14 },
  { id: 'tee', name: '白色厚磅素 T', categoryId: 'top', slot: 'top', colorName: '白', colorHex: '#F4F1EA', brand: 'UNIQLO U', size: 'M', status: 'ok', shape: 'tee', wearCount: 32 },
  { id: 'wine', name: '酒紅羊毛混紡毛衣', categoryId: 'top', slot: 'top', colorName: '酒紅', colorHex: '#6E2E34', brand: 'Arket', size: 'M', status: 'ok', shape: 'knit', wearCount: 6 },
  { id: 'shirt', name: '白色牛津長袖襯衫', categoryId: 'top', slot: 'top', colorName: '白', colorHex: '#F4F1EA', brand: 'UNIQLO', size: 'M', status: 'cleaning', shape: 'shirt', wearCount: 21 },
  { id: 'jeans', name: '淺藍高腰直筒牛仔褲', categoryId: 'bottom', slot: 'bottom', colorName: '淺藍', colorHex: '#8FA3BC', brand: "Levi's", size: 'W26 L30', status: 'ok', isFavorite: true, shape: 'pants', wearCount: 27 },
  { id: 'slacks', name: '深藍打褶西裝褲', categoryId: 'bottom', slot: 'bottom', colorName: '深藍', colorHex: '#2E3A4F', brand: 'Massimo Dutti', size: '36', status: 'ok', shape: 'pants', wearCount: 9 },
  { id: 'skirt', name: '鼠尾草綠百褶中長裙', categoryId: 'bottom', slot: 'bottom', colorName: '鼠尾草綠', colorHex: '#8C9A86', brand: 'MUJI', size: 'M', status: 'ok', shape: 'skirt', wearCount: 5 },
  { id: 'sneaker', name: '米白德訓鞋', categoryId: 'shoes', slot: 'shoes', colorName: '米白', colorHex: '#EDE7DA', brand: 'adidas', size: 'US 6.5', status: 'ok', isFavorite: true, shape: 'shoe', wearCount: 25 },
  { id: 'boots', name: '黑色皮革短靴', categoryId: 'shoes', slot: 'shoes', colorName: '黑', colorHex: '#2A2826', brand: 'Vagabond', size: 'EU 38', status: 'ok', shape: 'boot', wearCount: 8 },
  { id: 'loafer', name: '黑色樂福鞋', categoryId: 'shoes', slot: 'shoes', colorName: '黑', colorHex: '#1F1F1E', brand: 'Clarks', size: 'EU 37.5', status: 'repair', shape: 'shoe', wearCount: 18 },
  { id: 'tote', name: '焦糖皮革托特包', categoryId: 'bag', slot: 'bag', colorName: '焦糖', colorHex: '#9A6B43', brand: 'Charles & Keith', status: 'ok', shape: 'bag', wearCount: 19 },
  { id: 'black-bag', name: '黑色皮革肩背包', categoryId: 'bag', slot: 'bag', colorName: '黑', colorHex: '#2B2826', status: 'ok', shape: 'bag', wearCount: 7 },
  { id: 'scarf', name: '灰色羊毛圍巾', categoryId: 'acc', slot: 'acc', colorName: '灰', colorHex: '#9A9893', brand: 'UNIQLO', status: 'stored', shape: 'scarf', wearCount: 2 },
]

export const SAMPLE_WISHLIST: WishlistItem[] = [
  { id: 'w-navy', name: '海軍藍雙排扣西裝外套', slot: 'outer', colorHex: '#2E3A4F', colorName: '海軍藍', shop: 'Massimo Dutti', brand: 'Massimo Dutti', size: 'S', sizeNote: '肩寬 39 cm', price: 5990, targetPrice: 4500, priority: 3, reason: '衣櫃缺一件比炭灰更正式、但不黑的外套，冬天開會可以穿。', status: 'waiting', shape: 'coat', createdAt: '2026-10-24T10:00:00.000Z' },
  { id: 'w-scarf', name: '灰藍喀什米爾圍巾', slot: 'acc', colorHex: '#7F92A3', colorName: '灰藍', shop: 'Arket 官網', brand: 'Arket', size: 'F', price: 2890, shipping: 0, priority: 3, reason: '舊的灰圍巾起毛球了，想換一條顏色更乾淨的。', returnPolicy: '30 天內可退', status: 'ready', shape: 'scarf', createdAt: '2026-11-02T10:00:00.000Z' },
  { id: 'w-cos', name: '羊毛混紡高腰寬褲', slot: 'bottom', colorHex: '#EFE8DA', colorName: '奶油白', shop: 'COS 官網', brand: 'COS', size: '36', price: 3900, shipping: 0, sizeNote: '36 有貨', material: '羊毛 60%', priority: 2, returnPolicy: '30 天內可退', status: 'considering', compareGroupId: 'g-pants', shape: 'pants', createdAt: '2026-11-05T10:00:00.000Z' },
  { id: 'w-uq', name: '寬版九分打褶褲', slot: 'bottom', colorHex: '#E6DCC8', colorName: '米色', shop: 'UNIQLO 線上', brand: 'UNIQLO', size: 'M', price: 990, shipping: 60, sizeNote: 'M 有貨', material: '聚酯纖維', priority: 2, returnPolicy: '30 天內可退', status: 'considering', compareGroupId: 'g-pants', shape: 'pants', createdAt: '2026-11-05T11:00:00.000Z' },
  { id: 'w-shop', name: '奶油白羊毛直筒寬褲', slot: 'bottom', colorHex: '#F2EADB', colorName: '奶油白', shop: '選物店・蝦皮', size: 'L', price: 2280, shipping: 60, sizeNote: '只剩 L', material: '羊毛 50%', priority: 2, returnPolicy: '7 天・需自付運費', status: 'considering', compareGroupId: 'g-pants', shape: 'pants', createdAt: '2026-11-05T12:00:00.000Z' },
  { id: 'w-loafer', name: '黑色流蘇樂福鞋', slot: 'shoes', colorHex: '#22201E', colorName: '黑', shop: 'G.H. Bass', brand: 'G.H. Bass', size: 'EU 37.5', price: 5480, shipping: 0, priority: 1, sizeNote: 'EU 37.5 有貨', material: '牛皮', returnPolicy: '14 天內可退', status: 'considering', compareGroupId: 'g-loafer', shape: 'shoe', createdAt: '2026-10-30T10:00:00.000Z' },
  { id: 'w-loafer2', name: '黑色皮革便士樂福鞋', slot: 'shoes', colorHex: '#2A2826', colorName: '黑', shop: '品牌直營・momo', brand: 'Clarks', size: 'EU 37.5', price: 3680, shipping: 0, sizeNote: '需調貨 7 天', material: '牛皮', returnPolicy: '7 天鑑賞期', priority: 1, status: 'considering', compareGroupId: 'g-loafer', shape: 'shoe', createdAt: '2026-10-31T10:00:00.000Z' },
  { id: 'w-trench', name: '卡其短版風衣', slot: 'outer', colorHex: '#B7A07A', colorName: '卡其', shop: 'UNIQLO 線上', brand: 'UNIQLO', size: 'M', price: 2990, shipping: 60, reason: '和駝色大衣太像，先不買。', status: 'dropped', shape: 'coat', createdAt: '2026-09-18T10:00:00.000Z' },
  { id: 'w-belt', name: '焦糖色細皮帶', slot: 'acc', colorHex: '#9A6B43', colorName: '焦糖', shop: 'Charles & Keith', brand: 'Charles & Keith', size: 'S', price: 890, status: 'bought', shape: 'scarf', createdAt: '2026-08-12T10:00:00.000Z' },
]

/** 比較試搭台的示範群組 */
export const SAMPLE_COMPARE_GROUPS: CompareGroup[] = [
  { id: 'g-pants', title: '冬天想要一條寬褲', budget: 3500, createdAt: '2026-11-05T09:00:00.000Z' },
  { id: 'g-loafer', title: '換一雙黑色樂福鞋', createdAt: '2026-10-30T09:00:00.000Z' },
]

const diaryPicks = (ids: Partial<Record<Slot, string>>): DiaryEntry['picks'] =>
  Object.fromEntries(Object.entries(ids).map(([slot, itemId]) => [slot, { kind: 'closet' as const, itemId: itemId! }]))

const d = (id: string, date: string, name: string, picks: Partial<Record<Slot, string>>, extra: Partial<DiaryEntry>): DiaryEntry => ({
  id, date, name, template: 'full', picks: diaryPicks(picks), occasions: [], rating: null, feel: null, weather: null, temperatureC: null, note: '', createdAt: `${date}T20:00:00.000Z`, ...extra,
})

/** 穿搭日記示範資料（與設計稿 B-Diary 一致）；資料為虛構示例。 */
export const SAMPLE_DIARY: DiaryEntry[] = [
  d('diary-1112', '2026-11-12', '雨天的季度簡報', { outer: 'blazer', top: 'knit', bottom: 'jeans', shoes: 'sneaker', bag: 'tote' }, { occasions: ['上班', '簡報'], rating: 4, feel: 'comfy', weather: 'rain', temperatureC: 18, note: '外套擋風剛好；德訓鞋踩水有點濕，下雨天改穿短靴比較好。' }),
  d('diary-1111', '2026-11-11', '圖書館一整天', { outer: 'camel', top: 'tee', bottom: 'jeans', shoes: 'sneaker' }, { occasions: ['休閒'], rating: 4, feel: 'comfy', weather: 'cloudy', temperatureC: 20, note: '大衣在室內有點熱，可以換短一點的外套。' }),
  d('diary-1110', '2026-11-10', '週二例會', { top: 'shirt', bottom: 'slacks', shoes: 'loafer', bag: 'black-bag' }, { occasions: ['上班'], rating: 3, feel: 'ok', weather: 'overcast', temperatureC: 21, note: '襯衫領口有點緊，下次裡面別穿高領。' }),
  d('diary-1108', '2026-11-08', '週末市集', { top: 'wine', bottom: 'skirt', shoes: 'boots', bag: 'tote' }, { occasions: ['出遊'], rating: 5, feel: 'comfy', weather: 'sunny', temperatureC: 23, note: '酒紅配鼠尾草綠很喜歡，被朋友稱讚。' }),
  d('diary-1106', '2026-11-06', '朋友生日晚餐', { outer: 'blazer', top: 'wine', bottom: 'slacks', shoes: 'boots', bag: 'black-bag' }, { occasions: ['聚餐'], rating: 4, feel: 'comfy', weather: 'cloudy', temperatureC: 19, note: '' }),
  d('diary-1105', '2026-11-05', '普通上班日', { top: 'knit', bottom: 'slacks', shoes: 'loafer', bag: 'tote' }, { occasions: ['上班'], rating: 4, feel: 'ok', weather: 'sunny', temperatureC: 22, note: '樂福鞋走久了腳跟會磨，要貼後跟貼。' }),
  d('diary-1103', '2026-11-03', '外套配素 T', { outer: 'blazer', top: 'tee', bottom: 'jeans', shoes: 'sneaker' }, { occasions: ['上班'], rating: 4, feel: 'comfy', weather: 'sunny', temperatureC: 24, note: '' }),
  d('diary-1102', '2026-11-02', '看展', { outer: 'camel', top: 'knit', bottom: 'skirt', shoes: 'boots' }, { occasions: ['出遊'], rating: 5, feel: 'comfy', weather: 'overcast', temperatureC: 20, note: '整套燕麥和駝色很協調，拍照好看。' }),
  d('diary-1028', '2026-10-28', '加班到很晚', { top: 'tee', bottom: 'slacks', shoes: 'sneaker', bag: 'tote' }, { occasions: ['上班'], rating: 3, feel: 'ok', weather: 'rain', temperatureC: 22, note: '' }),
  d('diary-1025', '2026-10-25', '爬郊山', { top: 'tee', bottom: 'jeans', shoes: 'sneaker' }, { occasions: ['運動', '出遊'], rating: 2, feel: 'uncomfy', weather: 'sunny', temperatureC: 27, note: '牛仔褲爬山太悶，下次穿運動褲。' }),
  d('diary-1019', '2026-10-19', '家族聚餐', { top: 'wine', bottom: 'skirt', shoes: 'loafer', bag: 'black-bag' }, { occasions: ['聚餐'], rating: 4, feel: 'comfy', weather: 'cloudy', temperatureC: 25, note: '' }),
]

/** 個人體態頁的示範偏好資料；只在示範模式使用。 */
export const SAMPLE_PROFILE: ProfilePreferences = {
  aiUseBodyData: true,
  shoeSizes: [
    { label: '運動鞋', eu: '37.5', us: '6.5', uk: '4.5', jp: '23.5' },
    { label: '樂福鞋・皮鞋', eu: '37', us: '6', uk: '4', jp: '23.5' },
    { label: '靴子', eu: '38', us: '7', uk: '5', jp: '24' },
  ],
  frequentSizes: ['上衣 S–M', '褲子 26 / 36', '洋裝 S'],
  fitPreferences: ['高腰', '直筒', '落肩', '九分褲長'],
  highlightAreas: '肩線、腰線',
  proportionNotes: '讓腿部看起來更修長',
  dislikedCuts: ['低腰', '過緊的鉛筆裙'],
}

/** 個人體態頁的量測歷史示範資料；資料為虛構示例。 */
export const SAMPLE_BODY_MEASUREMENTS: BodyMeasurement[] = [
  {
    id: 'demo-measurement-2026-11', measuredOn: '2026-11-12', heightCm: 162, weightKg: 52,
    shoulderCm: 38, upperBustCm: 84, underBustCm: 70, waistCm: 65, navelCm: 73, hipCm: 91, armCm: 55, inseamCm: 74,
    thighCm: null,
    footToeLengthCm: null, footToeWidthCm: null, footToeBallCm: null, footToeInstepCm: null,
    footSockLengthCm: 23.5, footSockWidthCm: 9.1, footSockBallCm: 22, footSockInstepCm: 22.8,
    footBareLengthCm: 23.3, footBareWidthCm: 9, footBareBallCm: 21.8, footBareInstepCm: 22.4,
    note: '早上起床後量，穿薄內衣', createdAt: '2026-11-12T09:00:00.000Z',
  },
  {
    id: 'demo-measurement-2026-10', measuredOn: '2026-10-02', heightCm: 162, weightKg: 52.5,
    shoulderCm: 38, upperBustCm: 84, underBustCm: 71, waistCm: 66, navelCm: 73, hipCm: 91, armCm: 55, inseamCm: 74,
    thighCm: null,
    footToeLengthCm: null, footToeWidthCm: null, footToeBallCm: null, footToeInstepCm: null,
    footSockLengthCm: 23.5, footSockWidthCm: 9.1, footSockBallCm: 22, footSockInstepCm: 22.8,
    footBareLengthCm: 23.3, footBareWidthCm: 9, footBareBallCm: 21.8, footBareInstepCm: 22.4,
    note: '更新：腰圍、腿長、鞋碼', createdAt: '2026-10-02T09:00:00.000Z',
  },
  {
    id: 'demo-measurement-2026-04', measuredOn: '2026-04-18', heightCm: 162, weightKg: 53,
    shoulderCm: 38, upperBustCm: 85, underBustCm: 71, waistCm: 66, navelCm: null, hipCm: 92, armCm: 55, inseamCm: 74,
    thighCm: null,
    footToeLengthCm: null, footToeWidthCm: null, footToeBallCm: null, footToeInstepCm: null,
    footSockLengthCm: null, footSockWidthCm: null, footSockBallCm: null, footSockInstepCm: null,
    footBareLengthCm: 23.3, footBareWidthCm: null, footBareBallCm: null, footBareInstepCm: null,
    note: '更新：肩寬、胸圍', createdAt: '2026-04-18T09:00:00.000Z',
  },
  {
    id: 'demo-measurement-2025-11', measuredOn: '2025-11-05', heightCm: 162, weightKg: 52,
    shoulderCm: null, upperBustCm: null, underBustCm: null, waistCm: null, navelCm: null, hipCm: null, armCm: null, inseamCm: null,
    thighCm: null,
    footToeLengthCm: null, footToeWidthCm: null, footToeBallCm: null, footToeInstepCm: null,
    footSockLengthCm: null, footSockWidthCm: null, footSockBallCm: null, footSockInstepCm: null,
    footBareLengthCm: 23.3, footBareWidthCm: null, footBareBallCm: null, footBareInstepCm: null,
    note: '第一次記錄', createdAt: '2025-11-05T09:00:00.000Z',
  },
]
